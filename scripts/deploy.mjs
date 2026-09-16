import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runRemote } from './hosting.mjs';
import { readLocalConfig } from './local-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const mode = process.argv[2];
if (!['prepare', 'publish'].includes(mode)) throw new Error('Usage: node scripts/deploy.mjs prepare|publish');
const c = readLocalConfig();
if (c.HOSTING_USER !== 'u3649492' || c.PRIMARY_DOMAIN !== 'salkn.ru' || c.SECONDARY_DOMAIN !== 'salkn.online') throw new Error('Unexpected deployment target');
const home = '/var/www/u3649492/data';
const privateDir = `${home}/salkn-private`;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('.local', { recursive: true, mode: 0o700 });
const archive = (directory, filename) => {
  execFileSync('/usr/bin/tar', ['-czf', `.local/${filename}`, '-C', directory, '.'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  return readFileSync(`.local/${filename}`);
};
try {
  if (mode === 'prepare') {
    if (!existsSync('.local/backend-secret')) writeFileSync('.local/backend-secret', randomBytes(32).toString('hex'), { mode: 0o600 });
    const chatIds = [...new Set(c.TELEGRAM_CHAT_IDS.split(',').map(x => x.trim()).filter(Boolean))];
    if (chatIds.length !== 2 || chatIds.some(x => !/^\d+$/.test(x))) throw new Error('Expected two approved Telegram recipients');
    const config = {
      origin: 'https://salkn.ru', secret: readFileSync('.local/backend-secret', 'utf8').trim(),
      database: { host: c.DB_HOST, port: Number(c.DB_PORT), name: c.DB_NAME, user: c.DB_USER, password: c.DB_PASSWORD },
      telegram: { token: c.TELEGRAM_BOT_TOKEN, chat_ids: chatIds },
    };
    console.log(await runRemote(`umask 077; mkdir -p ${privateDir}; chmod 700 ${privateDir}; tar -xzf - -C ${privateDir}`, archive('server', 'server.tar.gz')));
    await runRemote(`umask 077; cat > ${privateDir}/config.json.new; chmod 600 ${privateDir}/config.json.new; mv ${privateDir}/config.json.new ${privateDir}/config.json`, JSON.stringify(config));
    console.log(await runRemote(`set -e; for f in ${privateDir}/*.php; do /opt/php/8.3/bin/php -l "$f"; done; /opt/php/8.3/bin/php ${privateDir}/migrate.php`));
    console.log('Private backend prepared; credentials never uploaded to the public directory.');
  } else {
    const staging = `${privateDir}/release-${stamp}`;
    console.log(await runRemote(`set -e; umask 077; mkdir -p ${privateDir}/backups ${staging}; tar -czf ${privateDir}/backups/public-${stamp}.tar.gz -C ${home}/www salkn.ru salkn.online; tar -xzf - -C ${staging}`, archive('dist', 'public.tar.gz')));
    // Validate the uploaded code before replacing the public page.
    console.log(await runRemote(`set -e; for f in ${staging}/api/*.php; do /opt/php/8.3/bin/php -l "$f"; done; /opt/php/8.3/bin/php ${privateDir}/migrate.php; chmod -R u=rwX,go=rX ${staging}; cp -R ${staging}/. ${home}/www/salkn.ru/; chmod 755 ${home}/www/salkn.ru; cp ${staging}/.htaccess ${home}/www/salkn.online/.htaccess`));
    const cronLine = `* * * * * /opt/php/8.3/bin/php ${privateDir}/worker.php >> ${privateDir}/worker.log 2>&1`;
    const installCron = `<?php
      $file = '${privateDir}/crontab.new';
      exec('crontab -l 2>/dev/null', $lines, $status);
      if ($status !== 0 && $status !== 1) exit(1);
      $line = '${cronLine}';
      if (!in_array($line, $lines, true)) $lines[] = $line;
      file_put_contents($file, implode("\n", $lines) . "\n"); chmod($file, 0600);
      passthru('crontab ' . escapeshellarg($file), $code); unlink($file); exit($code);
    `;
    await runRemote('/opt/php/8.3/bin/php', installCron);
    console.log(await runRemote(`/opt/php/8.3/bin/php ${privateDir}/worker.php`));
    console.log(`Published to salkn.ru; backup: ${privateDir}/backups/public-${stamp}.tar.gz`);
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
