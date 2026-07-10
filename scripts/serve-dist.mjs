import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CHIC_E2E_PORT) || 8139;
const PREFIX = '/ChIC/';
const ROOT = resolve('dist');
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

const resolveRequest = (pathname) => {
  if (!pathname.startsWith(PREFIX)) return null;
  const relative =
    pathname === PREFIX ? 'index.html' : decodeURIComponent(pathname.slice(PREFIX.length));
  const file = resolve(ROOT, relative);
  return file === ROOT || file.startsWith(`${ROOT}${sep}`) ? file : null;
};

createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${HOST}`).pathname;
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let file;
  try {
    file = resolveRequest(pathname);
  } catch {
    response.writeHead(400).end('Bad path');
    return;
  }

  const acceptsHtml = request.headers.accept?.includes('text/html');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    const fallback = resolve(ROOT, '404.html');
    if (file && pathname.startsWith(PREFIX) && acceptsHtml && existsSync(fallback)) file = fallback;
    else {
      response.writeHead(404).end('Not found');
      return;
    }
  }

  const contentType = MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
  const immutable = file.startsWith(resolve(ROOT, 'assets') + sep);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': statSync(file).size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(response);
}).listen(PORT, HOST, () => {
  console.log(`ChIC test server: http://${HOST}:${PORT}${PREFIX}`);
});
