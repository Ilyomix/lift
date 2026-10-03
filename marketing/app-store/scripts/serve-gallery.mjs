import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.local-release/marketing');
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const allowed = JSON.parse(await readFile(resolve(root, 'gallery-assets/allowed-paths.json'), 'utf8'));
    if (!['GET', 'HEAD'].includes(req.method) || !allowed.includes(path)) { res.writeHead(404).end(); return; }
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    const { size } = await stat(file);
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    res.writeHead(range ? 206 : 200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    if (req.method === 'HEAD') res.end(); else createReadStream(file, { start, end }).pipe(res);
  } catch { res.writeHead(404).end(); }
}).listen(43127, '127.0.0.1', () => console.log('Lift gallery: http://127.0.0.1:43127'));
