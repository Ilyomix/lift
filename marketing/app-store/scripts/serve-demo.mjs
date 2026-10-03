/** Local-only download endpoint for the simulator's real Files import flow. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files = new Map(['fr', 'en'].map(lang => [`/lift-demo-${lang}.json`, fileURLToPath(new URL(`../../../.local-release/demo/lift-demo-${lang}.json`, import.meta.url))]));
const port = Number(process.env.LIFT_DEMO_PORT ?? 43125);
const server = createServer(async (request, response) => {
  const file = files.get(request.url ?? '');
  if (request.method !== 'GET' || !file) { response.writeHead(404).end('Not found'); return; }
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${request.url.slice(1)}"`, 'Cache-Control': 'no-store', 'Content-Length': content.byteLength });
    response.end(content);
  } catch { response.writeHead(404).end('Run npm run demo first.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Demo downloads: http://127.0.0.1:${port}/lift-demo-fr.json and /lift-demo-en.json. Stop with Ctrl-C.`));
