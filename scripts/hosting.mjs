import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { readLocalConfig } from './local-config.mjs';

export function runRemote(command, input = '', timeout = 60000) {
  const c = readLocalConfig();
  const args = ['-T', '-p', c.HOSTING_PORT || '22', '-o', 'ConnectTimeout=15', '-o', 'NumberOfPasswordPrompts=1', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${fileURLToPath(new URL('../.local/known_hosts', import.meta.url))}`, '-o', 'LogLevel=ERROR'];
  if (c.HOSTING_KEY_PATH) args.push('-i', c.HOSTING_KEY_PATH, '-o', 'IdentitiesOnly=yes');
  else args.push('-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password');
  args.push(`${c.HOSTING_USER}@${c.HOSTING_HOST}`, command);
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/ssh', args, { env: { ...process.env, SSH_ASKPASS: fileURLToPath(new URL('./hosting-askpass.mjs', import.meta.url)), SSH_ASKPASS_REQUIRE: 'force', SALKN_ASKPASS: '1', DISPLAY: 'salkn:0' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', x => out.push(x)); child.stderr.on('data', x => err.push(x));
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('SSH could not start')); });
    child.on('close', code => {
      clearTimeout(timer);
      let stdout = Buffer.concat(out).toString(); let stderr = Buffer.concat(err).toString();
      for (const [key, value] of Object.entries(c)) if (/(TOKEN|PASSWORD)$/.test(key) && value) { stdout = stdout.split(value).join('[REDACTED]'); stderr = stderr.split(value).join('[REDACTED]'); }
      if (code !== 0) reject(new Error(`Remote command failed (${code}): ${stderr.slice(0, 1200)} ${stdout.slice(0, 1200)}`));
      else resolve(stdout);
    });
    child.stdin.end(input);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/hosting.mjs <remote-command> [local-stdin-file]');
    console.log(await runRemote(process.argv[2], process.argv[3] ? readFileSync(process.argv[3]) : ''));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
