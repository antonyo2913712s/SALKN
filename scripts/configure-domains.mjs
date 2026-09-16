import { panelCall } from './panel.mjs';

for (const domain of ['salkn.ru', 'salkn.online']) {
  const { doc } = await panelCall({ func: 'webdomain.edit', elid: domain });
  if (doc.error || doc.name?.$ !== domain) throw new Error('Could not read domain settings');
  const fields = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    for (const [type, items] of Object.entries(node)) {
      if (['input', 'select', 'textarea', 'slider'].includes(type)) for (const field of Array.isArray(items) ? items : [items]) {
        if (field.$name && !field.$name.startsWith('limit_')) fields.add(field.$name);
      }
      else if (Array.isArray(items)) items.forEach(visit);
      else if (typeof items === 'object') visit(items);
    }
  }
  visit(doc.metadata.form);
  const params = { func: 'webdomain.edit', elid: domain, sok: 'ok' };
  for (const name of fields) if (Object.hasOwn(doc, name)) {
    params[name] = Array.isArray(doc[name]) ? doc[name].map(item => item.$).join(',') : doc[name].$ || '';
  }
  Object.assign(params, { redirect_http: 'on', redirect_www: 'from_www', srv_gzip: 'on', gzip_level: '4' });
  const saved = await panelCall(params);
  if (saved.doc.error) throw new Error(`Could not update ${domain}: ${JSON.stringify(saved.doc.error)}`);
  const current = (await panelCall({ func: 'webdomain.edit', elid: domain })).doc;
  console.log(JSON.stringify({ domain, https: current.redirect_http?.$, www: current.redirect_www?.$, gzip: current.srv_gzip?.$, php: current.php?.$, certificate: current.ssl_cert?.$, root: current.docroot?.$ }));
  if (current.redirect_http?.$ !== 'on' || current.redirect_www?.$ !== 'from_www' || current.srv_gzip?.$ !== 'on' || current.php?.$ !== 'on') throw new Error(`Domain settings verification failed: ${domain}`);
}
