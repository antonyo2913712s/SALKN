import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readLocalConfig, saveChatRecipient } from './local-config.mjs';

const run = promisify(execFile);
const mode = process.argv[2];
if (!['telegram', 'hosting'].includes(mode)) {
  console.log('Usage: node scripts/check-connections.mjs telegram [--save-single] | hosting');
  process.exit(mode ? 1 : 0);
}

try {
  const config = readLocalConfig();
  if (mode === 'telegram') {
    const token = config.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is empty');
    const api = async (method, body = {}) => {
      let response;
      try {
        response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
        });
      } catch { throw new Error('Telegram network connection failed'); }
      let data;
      try { data = await response.json(); } catch { throw new Error(`Telegram returned HTTP ${response.status}`); }
      if (!data.ok) throw new Error(`Telegram ${method} failed with code ${data.error_code || response.status}`);
      return data.result;
    };
    const [bot, webhook] = await Promise.all([api('getMe'), api('getWebhookInfo')]);
    if (webhook.url) throw new Error('Bot already has a webhook; existing integration left unchanged');
    // No offset: updates are not acknowledged or discarded. No messages are sent.
    const updates = await api('getUpdates', { limit: 100, timeout: 0 });
    const candidates = new Map();
    for (const update of updates) {
      const message = update.message;
      if (message?.chat?.type !== 'private' || !/^\/start(?:@[\w]+)?(?:\s|$)/.test(message.text || '')) continue;
      candidates.set(String(message.chat.id), { chatId: String(message.chat.id), username: message.from?.username || null });
    }
    const result = { bot: bot.username, pendingUpdates: updates.length, candidates: [...candidates.values()], saved: false };
    if (process.argv.includes('--save-single') && !config.TELEGRAM_CHAT_ID && !config.TELEGRAM_CHAT_IDS && candidates.size === 1) {
      saveChatRecipient([...candidates.keys()][0]);
      result.saved = true;
    }
    console.log(JSON.stringify(result));
  } else {
    const { HOSTING_HOST: host, HOSTING_PORT: port, HOSTING_USER: user } = config;
    if (!/^[a-z\d.-]+$/i.test(host || '') || !/^\d+$/.test(port || '') || !/^[a-z\d_-]+$/i.test(user || '')) throw new Error('Invalid SSH host, port or username');
    if (!config.HOSTING_PASSWORD && !config.HOSTING_KEY_PATH) throw new Error('No hosting authentication configured');
    const stateDirectory = fileURLToPath(new URL('../.local/', import.meta.url));
    mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
    const remote = `php -r '$r=getcwd();echo json_encode(["directory"=>$r,"php"=>PHP_VERSION,"extensions"=>array_values(array_intersect(["curl","pdo_mysql","mbstring","openssl"],get_loaded_extensions())),"siteDirectories"=>array_values(array_filter(glob($r."/www/*")?:[],"is_dir"))],JSON_UNESCAPED_SLASHES);'`;
    const args = ['-T', '-p', port, '-o', 'ConnectTimeout=15', '-o', 'NumberOfPasswordPrompts=1', '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${stateDirectory}known_hosts`, '-o', 'LogLevel=ERROR'];
    if (config.HOSTING_KEY_PATH) args.push('-i', config.HOSTING_KEY_PATH, '-o', 'IdentitiesOnly=yes');
    else args.push('-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password');
    args.push(`${user}@${host}`, remote);
    try {
      const { stdout } = await run('/usr/bin/ssh', args, { timeout: 30000, maxBuffer: 1024 * 1024, env: {
        ...process.env, SSH_ASKPASS: fileURLToPath(new URL('./hosting-askpass.mjs', import.meta.url)),
        SSH_ASKPASS_REQUIRE: 'force', SALKN_ASKPASS: '1', DISPLAY: process.env.DISPLAY || 'salkn:0'
      } });
      const info = JSON.parse(stdout.trim());
      console.log(JSON.stringify({ connected: true, ...info }));
    } catch (error) {
      const stderr = String(error.stderr || '');
      const reason = /Permission denied/.test(stderr) ? 'Authentication rejected; credentials were not printed' : /HOST IDENTIFICATION|Host key verification/.test(stderr) ? 'SSH host key mismatch; connection stopped' : /resolve hostname|Could not resolve|nodename nor servname/.test(stderr) ? 'Hosting DNS resolution failed' : /Operation not permitted|Network is unreachable|timed out/.test(stderr) ? 'Hosting network connection blocked or timed out' : 'SSH connection or remote PHP check failed';
      throw new Error(reason);
    }
  }
} catch (error) {
  // Only our own fixed messages are printed; never dump API URLs or child errors.
  console.error(error.message);
  process.exitCode = 1;
}
