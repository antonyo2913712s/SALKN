import { readLocalConfig } from './local-config.mjs';

export async function panelCall(params) {
  const config = readLocalConfig();
  const endpoint = `https://${config.HOSTING_HOST}:1500/ispmgr`;
  const request = async values => {
    const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ out: 'json', ...values }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Panel HTTP ${response.status}`);
    return response.json();
  };
  const login = await request({ func: 'auth', username: config.HOSTING_USER, password: config.HOSTING_PASSWORD });
  const auth = login.doc?.auth?.$id;
  if (!auth) throw new Error('Panel authentication failed');
  const data = await request({ ...params, auth });
  let output = JSON.stringify(data);
  for (const value of [auth, ...Object.entries(config).filter(([key]) => /(PASSWORD|TOKEN)$/.test(key)).map(([,v]) => v)].filter(Boolean)) output = output.split(value).join('[REDACTED]');
  return JSON.parse(output);
}

if (process.argv[1]?.endsWith('/panel.mjs') || process.argv[1] === 'scripts/panel.mjs') {
  try {
    const data = await panelCall(JSON.parse(process.argv[2] || '{}'));
    if (!process.argv.includes('--full')) {
      const trim = value => {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
          if (['metadata', 'messages', 'tips', 'tparams'].includes(key) || key.startsWith('$') && key !== '$') delete value[key];
          else trim(value[key]);
        }
      };
      trim(data);
    }
    console.log(JSON.stringify(data));
  }
  catch (e) { console.error(e instanceof SyntaxError ? 'Invalid JSON input/output' : e.message); process.exitCode = 1; }
}
