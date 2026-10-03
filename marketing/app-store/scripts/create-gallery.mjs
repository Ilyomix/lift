import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../.local-release/marketing');
const manifest = JSON.parse(await readFile(resolve(output, 'upload-ready.json'), 'utf8'));
assert.equal(manifest.version, 1);
assert(Array.isArray(manifest.assets) && manifest.assets.length > 0, 'No validated final assets: gallery not generated');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = path => path.split('/').map(encodeURIComponent).join('/');
const verify = async file => {
  assert(file.path && !file.path.includes('\\'), 'Use relative POSIX paths');
  assert(!file.path.startsWith('/') && !file.path.split('/').includes('..'), 'Use a direct relative final-asset path');
  assert(!file.path.startsWith('browser-proofs/'), 'Browser proofs are excluded from the final gallery');
  const path = resolve(output, file.path);
  assert(path.startsWith(output + sep), 'Asset must stay inside the final output folder');
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  assert.equal(actual, file.sha256, `${file.path}: changed since visual/format validation`);
};
const labels = { screenshot: 'Capture', preview: 'Aperçu App Store', promo: 'Vidéo verticale' };
const allowed = new Set(['/', '/index.html', '/gallery-assets/icon.png', '/gallery-assets/geologica.woff2']);
const cards = [];
const assets = [...manifest.assets].sort((a, b) => a.lang.localeCompare(b.lang, 'fr') || a.kind.localeCompare(b.kind) || (a.device ?? 'iphone').localeCompare(b.device ?? 'iphone') || a.path.localeCompare(b.path));
for (const asset of assets) {
  assert(asset.reviewed === true, `${asset.path}: visual and format review required`);
  assert(['fr', 'en'].includes(asset.lang) && ['screenshot', 'preview', 'promo'].includes(asset.kind));
  assert(asset.kind !== 'screenshot' || ['iphone', 'ipad'].includes(asset.device));
  assert(asset.path.endsWith(asset.kind === 'screenshot' ? '.png' : '.mp4'));
  await verify(asset);
  allowed.add('/' + asset.path);
  if (asset.poster) { await verify(asset.poster); allowed.add('/' + asset.poster.path); }
  const media = asset.kind === 'screenshot'
    ? `<a href="${url(asset.path)}" target="_blank" rel="noopener"><img src="${url(asset.path)}" alt="${escape(asset.title)}" loading="lazy"></a>`
    : `<video controls playsinline preload="metadata"${asset.poster ? ` poster="${url(asset.poster.path)}"` : ''} src="${url(asset.path)}"></video>`;
  const ratio = asset.kind === 'screenshot' ? (asset.device === 'ipad' ? '2064/2752' : '1320/2868') : (asset.kind === 'promo' ? '1080/1920' : asset.device === 'ipad' ? '1200/1600' : '886/1920');
  const uploaded = ['uploaded', 'processing', 'processed'].includes(asset.upload?.status);
  cards.push(`<article data-lang="${asset.lang}" data-kind="${asset.kind}" data-device="${asset.device ?? 'iphone'}"><div class="media" style="aspect-ratio:${ratio}">${media}</div><div class="caption"><div><span>${labels[asset.kind]} · ${asset.lang.toUpperCase()}${asset.device ? ' · ' + (asset.device === 'ipad' ? 'iPad' : 'iPhone') : ''}</span><h2>${escape(asset.title)}</h2>${uploaded ? '<p style="font-size:11px;color:#147344">Déjà envoyé dans App Store Connect</p>' : '<p style="font-size:11px;color:#52617b">Prêt à envoyer</p>'}</div><a class="download" href="${url(asset.path)}" download>Télécharger</a></div></article>`);
}
await mkdir(resolve(output, 'gallery-assets'), { recursive: true });
for (const file of ['icon.png', 'geologica.woff2', 'Geologica-LICENSE.txt']) await copyFile(resolve(project, 'public/brand', file), resolve(output, 'gallery-assets', file));
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lift · Médias App Store</title>
<style>@font-face{font-family:Geologica;src:url(gallery-assets/geologica.woff2);font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:#f1f5ff;color:#060a13;font-family:Geologica,system-ui,sans-serif}header,main{max-width:1500px;margin:auto;padding:36px 28px}header{padding-bottom:22px}.brand{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:750}.brand img{width:42px;border-radius:11px}h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;line-height:1.06;margin:32px 0 12px}p{color:#41516c;margin:0;line-height:1.5}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}fieldset{border:0;padding:0;margin:0;display:flex;gap:6px}legend{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}button{border:1px solid #bbc7db;border-radius:8px;padding:10px 14px;background:transparent;font:inherit;font-size:13px;cursor:pointer}button[aria-pressed=true]{background:#060a13;color:white;border-color:#060a13}button:focus-visible,a:focus-visible,video:focus-visible{outline:3px solid #2e62f5;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:30px 22px}.media{background:#0b101c;border-radius:14px;overflow:hidden;aspect-ratio:1320/2868;display:flex;align-items:center;justify-content:center}.media img,.media video{display:block;width:100%;height:100%;object-fit:contain}.media a{display:block;width:100%;height:100%}.caption{display:flex;align-items:start;justify-content:space-between;gap:10px;padding:14px 2px}.caption span{font-size:10px;color:#52617b;text-transform:uppercase;letter-spacing:.05em}h2{font-size:15px;margin:6px 0;line-height:1.3}.download{font-size:11px;color:#164cd8;text-decoration:none;padding-top:4px;white-space:nowrap}.download:hover{text-decoration:underline}[hidden]{display:none!important}.empty{padding:30px 0}footer{max-width:1500px;margin:auto;padding:0 28px 40px;color:#52617b;font-size:12px}@media(max-width:550px){header,main{padding-left:18px;padding-right:18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 12px}.caption{display:block}.caption span{font-size:9px}h2{font-size:13px}}</style>
<header><div class="brand"><img src="gallery-assets/icon.png" alt="">Lift</div><h1>Les médias, prêts à choisir.</h1><p>Parcourir les captures, lire les vidéos, télécharger les fichiers validés.</p><nav aria-label="Filtres"><fieldset data-group="lang"><legend>Langue</legend><button data-value="all" aria-pressed="true">FR + EN</button><button data-value="fr" aria-pressed="false">Français</button><button data-value="en" aria-pressed="false">English</button></fieldset><fieldset data-group="device"><legend>Appareil</legend><button data-value="all" aria-pressed="true">Tous les appareils</button><button data-value="iphone" aria-pressed="false">iPhone</button><button data-value="ipad" aria-pressed="false">iPad</button></fieldset><fieldset data-group="kind"><legend>Format</legend><button data-value="all" aria-pressed="true">Tous les formats</button><button data-value="screenshot" aria-pressed="false">Captures</button><button data-value="preview" aria-pressed="false">App Store</button><button data-value="promo" aria-pressed="false">Vidéos verticales</button></fieldset></nav></header><main><div class="grid">${cards.join('\n')}</div><p class="empty" hidden>Aucun fichier validé dans cette sélection.</p></main><footer>${manifest.assets.length} fichiers validés · Images PNG et vidéos MP4</footer>
<script>const filters={lang:'all',kind:'all',device:'all'};document.querySelectorAll('fieldset button').forEach(button=>button.addEventListener('click',()=>{const group=button.parentElement.dataset.group;filters[group]=button.dataset.value;button.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let visible=0;document.querySelectorAll('article').forEach(card=>{card.hidden=Object.entries(filters).some(([key,value])=>value!=='all'&&card.dataset[key]!==value);if(card.hidden)card.querySelector('video')?.pause();else visible++});document.querySelector('.empty').hidden=visible>0}));</script></html>`;
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, 'gallery-assets/allowed-paths.json'), JSON.stringify([...allowed], null, 2) + '\n');
console.log(`Gallery: ${resolve(output, 'index.html')} (${manifest.assets.length} validated assets)`);
