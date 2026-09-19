import { readFileSync } from 'node:fs';
import { runRemote } from './hosting.mjs';

// Execute only pure validation against the candidate code, without loading config or writing leads.
const app = readFileSync(new URL('../server/app.php', import.meta.url), 'utf8');
const suite = readFileSync(new URL('../tests/lead-validation.php', import.meta.url), 'utf8')
  .replace(/^<\?php\s*declare\(strict_types=1\);\s*/, '');
try { console.log(await runRemote('/opt/php/8.3/bin/php', `${app}\n${suite}`)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
