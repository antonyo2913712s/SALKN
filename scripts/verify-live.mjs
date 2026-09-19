import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = 'https://salkn.ru';
const request = (path, options = {}) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), ...options });
for (const host of ['salkn.ru', 'www.salkn.ru', 'salkn.online', 'www.salkn.online']) {
  for (const scheme of ['http', 'https']) {
    const url = `${scheme}://${host}/`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, url);
    assert.equal(response.url, `${origin}/`, url);
    console.log(`${url} → ${response.url}: OK`);
  }
}
const response = await request('/');
const html = await response.text();
assert.match(html, /<title>Кондиционеры в Казани с установкой — SALKN<\/title>/);
assert.match(html, /rel="canonical" href="https:\/\/salkn.ru\/"/);
assert.doesNotMatch(html, /noindex|Проверить заявку|Онлайн-приём ещё|SLKN/);
assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.equal(data.url, origin + '/');
assert.equal(data.areaServed.name, 'Казань');
for (const path of ['/privacy.html', '/consent.html', '/robots.txt', '/sitemap.xml', '/app.js?v=20260919-1', '/phone-mask.js?v=20260919-1', '/styles.css', '/assets/salkn-logo.png']) {
  const r = await request(path); assert.equal(r.status, 200, path);
}
const robots = await (await request('/robots.txt')).text();
assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
assert.match(robots, /Sitemap: https:\/\/salkn.ru\/sitemap.xml/);
for (const path of ['/missing-page-salkn-check', '/.env.local', '/.git/config', '/salkn-private/config.json', '/server/config.json']) {
  const r = await request(path);
  assert.ok([403,404].includes(r.status), `${path}: expected not publicly accessible, got ${r.status}`);
}
const redirect = await request('/index.html', {redirect:'manual'}); assert.equal(redirect.status,301);
assert.equal((await request('/api/lead.php')).status, 405);
const session = await request('/api/session.php'); assert.equal(session.status, 200);
assert.equal(session.headers.get('cache-control'), 'no-store');
const cookie = session.headers.getSetCookie()[0];
assert.match(cookie, /secure/i); assert.match(cookie, /httponly/i); assert.match(cookie, /samesite=strict/i);
const { csrf } = await session.json();
const headers = {'Content-Type':'application/json',Origin:origin,Cookie:cookie.split(';')[0],'X-CSRF-Token':csrf};
const payload = {requestId:randomUUID(),name:'Техническая проверка SALKN',phone:'+79990000000',service:'Кондиционер + установка',brand:'FUNAI',comment:'Тест запуска сайта. Не звонить. Проверяем сохранение заявки и доставку двум получателям.',consent:true,website:''};
const post = (value, override = {}) => request('/api/lead.php',{method:'POST',headers:{...headers,...override},body:JSON.stringify(value)});
for (const [label, value] of [['consent',{...payload,consent:false}],['phone',{...payload,phone:'invalid'}],['phone too long',{...payload,phone:'+7999123456789'}],['phone incomplete',{...payload,phone:'+7999123456'}],['brand',{...payload,brand:'Unknown'}],['honeypot',{...payload,website:'spam'}],['comment length',{...payload,comment:'x'.repeat(1001)}]]) {
  assert.equal((await post(value)).status,422,label);
}
assert.equal((await post(payload,{'X-CSRF-Token':'invalid'})).status,403,'CSRF');
assert.equal((await post(payload,{Origin:'https://example.com'})).status,403,'Origin');
console.log('HTTPS, canonical redirects, metadata, robots, legal pages, private paths and form validation: OK');
if (process.argv.includes('--submit-test')) {
  const accepted = await post(payload); const result = await accepted.json();
  assert.equal(accepted.status,201,JSON.stringify(result)); assert.equal(result.ok,true);
  const duplicate = await post(payload); assert.equal(duplicate.status,200);
  const conflict = await post({...payload,brand:'GREE'}); assert.equal(conflict.status,409);
  console.log(JSON.stringify({ testLead:result.id, accepted:true, duplicatePrevented:true, changedDuplicateRejected:true }));
}
