import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' };
http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' || req.url.startsWith('/api/')) { res.writeHead(503, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify({error: 'В локальном предпросмотре отправка недоступна. Рабочая форма — на salkn.ru.'})); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Страница не найдена'); }
}).listen(3000, '127.0.0.1', () => console.log('Local: http://127.0.0.1:3000'));
