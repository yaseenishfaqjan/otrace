/**
 * Serve dist/public exactly the way production nginx does (deploy/nginx.conf):
 *
 *   try_files $uri $uri.html $uri/ =404;   error_page 404 /404.html;
 *
 * so a local preview returns the prerendered HTML for each route and a real
 * 404 status for unknown URLs (Vite's own preview answers 200 with the SPA
 * shell for everything, which hides soft-404s from testing).
 *
 *   node scripts/serve.mjs [port]
 *
 * The prerender step imports createServer() with `fallbackHtml`, so routes
 * that have no file yet get the SPA shell while they are being snapshotted.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(HERE, '../dist/public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json)|image\/svg\+xml)/;

// gzip text responses, as production nginx does (deploy/nginx.conf), so local
// speed measurements match what a visitor downloads.
function send(res, status, body, type, req) {
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (req && COMPRESSIBLE.test(type) && buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    res.end(zlib.gzipSync(buf, { level: 6 }));
    return;
  }
  res.writeHead(status, headers);
  res.end(buf);
}

function fileFor(root, urlPath) {
  for (const candidate of [urlPath, `${urlPath}.html`, path.posix.join(urlPath, 'index.html')]) {
    const file = path.join(root, candidate);
    if (!file.startsWith(root)) continue;
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      /* not this candidate */
    }
  }
  return null;
}

export function createServer({ root = DIST, fallbackHtml = null } = {}) {
  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Bad request', TYPES['.txt'], req);
    }
    if (urlPath.includes('\0')) return send(res, 400, 'Bad request', TYPES['.txt'], req);

    const file = fileFor(root, urlPath);
    if (file) {
      return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', req);
    }
    if (fallbackHtml) return send(res, 200, fallbackHtml, TYPES['.html'], req);

    const notFound = path.join(root, '404.html');
    if (fs.existsSync(notFound)) return send(res, 404, fs.readFileSync(notFound), TYPES['.html'], req);
    return send(res, 404, 'Not found', TYPES['.txt'], req);
  });
}

const runDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 5180);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`OTRACE (production-like static server) on http://localhost:${port}`);
  });
}
