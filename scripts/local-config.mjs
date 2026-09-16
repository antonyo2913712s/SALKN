import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const localConfigPath = fileURLToPath(new URL('../.env.local', import.meta.url));

// Values are literal: do not execute shell expressions or interpolate variables.
// Only full comment lines are ignored, so an unquoted password may contain #.
export function readLocalConfig() {
  const values = {};
  readFileSync(localConfigPath, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/);
    if (!match) throw new Error(`Invalid local configuration line ${index + 1}`);
    if (Object.hasOwn(values, match[1])) throw new Error(`Duplicate setting: ${match[1]}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  });
  return values;
}

export function saveChatRecipient(id) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Expected a private Telegram chat ID');
  // Re-read immediately before writing to retain newly added hosting credentials.
  let text = readFileSync(localConfigPath, 'utf8');
  const values = readLocalConfig();
  const recipients = [...new Set([...(values.TELEGRAM_CHAT_IDS || '').split(',').map(x => x.trim()).filter(Boolean), String(id)])];
  for (const [key, value] of Object.entries({ TELEGRAM_CHAT_ID: values.TELEGRAM_CHAT_ID || String(id), TELEGRAM_CHAT_IDS: recipients.join(',') })) {
    const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, () => `${key}=${value}`) : text.replace(/\s*$/, '') + `\n${key}=${value}\n`;
  }
  writeFileSync(localConfigPath, text, { mode: 0o600 });
}
