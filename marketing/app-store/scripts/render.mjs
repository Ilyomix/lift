import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uncut, validateSegments } from './segments.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, '../..');
const output = resolve(root, '.local-release/marketing');
const mode = process.argv[2] ?? 'all';
const langs = (process.env.LIFT_LANG ?? 'fr,en').split(',');
const devices = (process.env.LIFT_DEVICES ?? 'iphone,ipad').split(',');
const names = { home: '01-home', workout: '02-workout', plan: '05-plan', calendar: '06-calendar', progress: '07-progress', timer: '04-timer', live: '03-live-activity', exercise: '08-exercise', gyms: '09-gyms', backup: '10-backup' };
const order = ['home', 'workout', 'progress', 'timer', 'live', 'calendar', 'plan', 'exercise', 'gyms', 'backup'];
const features = process.env.LIFT_FEATURES?.split(',') ?? order;
const themes = (process.env.LIFT_THEMES ?? 'plan,workout,live').split(',');
const cli = resolve(project, 'node_modules/@remotion/cli/remotion-cli.js');
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
const browserArgs = browser ? [`--browser-executable=${browser}`] : [];
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const ffprobe = process.env.FFPROBE ?? 'ffprobe';
const run = (bin, args, capture = false) => {
  const result = spawnSync(bin, args, { cwd: project, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} exited ${result.status}`);
  return result.stdout;
};
const probe = path => JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], true));
const verifyStill = (path, device = 'iphone') => {
  const image = probe(path).streams[0];
  assert.equal(image.codec_name, 'png');
  assert.equal(image.width, device === 'iphone' ? 1320 : 2064);
  assert.equal(image.height, device === 'iphone' ? 2868 : 2752);
  assert.equal(image.pix_fmt, 'rgb24', `${path}: expected opaque RGB PNG without alpha`);
};
const requireFile = async path => { try { await stat(path); } catch { throw new Error(`Missing source: ${path}. Capture the real native app first; browser proofs are never substituted.`); } };
const readCut = async (path, sourceDuration) => {
  let cut;
  try { cut = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; cut = uncut; }
  validateSegments(cut, sourceDuration);
  return cut;
};
await mkdir(output, { recursive: true });
assert(langs.every(x => ['fr', 'en'].includes(x)), 'LIFT_LANG must be fr,en');
assert(devices.every(x => ['iphone', 'ipad'].includes(x)), 'LIFT_DEVICES must be iphone,ipad');
assert(features.every(x => x in names), 'Unknown LIFT_FEATURES');
assert(themes.every(x => ['plan', 'workout', 'live'].includes(x)), 'LIFT_THEMES must be plan,workout,live');
assert(['sync', 'recordings', 'stills', 'videos', 'all', 'proof', 'proofs'].includes(mode), 'Use sync, recordings, stills, videos, all, proof or proofs');
const { obsoleteSha256 } = JSON.parse(await readFile(resolve(project, 'source-requirements.json'), 'utf8'));

if (mode === 'sync' || mode === 'recordings') {
  const manifest = { importedAt: new Date().toISOString(), note: 'Actual native simulator captures. Verify capture freshness against the release build before publication.', files: [] };
  if (mode === 'sync') for (const lang of langs) for (const device of devices) for (const feature of features) {
    const file = `${device}-${names[feature]}${lang === 'en' ? '-en' : ''}.png`;
    const source = resolve(root, '.local-release/screenshots', file);
    await requireFile(source);
    const hash = createHash('sha256').update(await readFile(source)).digest('hex');
    assert(!obsoleteSha256.includes(hash), `${file}: known obsolete capture. Replace with a capture of the final release and populated demo profile.`);
    const { width, height } = probe(source).streams[0];
    assert.equal(width, device === 'iphone' ? 1320 : 2064, `${file}: source width`);
    assert.equal(height, device === 'iphone' ? 2868 : 2752, `${file}: source height`);
    const target = resolve(project, 'public/screenshots', lang, `${device}-${names[feature]}.png`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    manifest.files.push({ file: `screenshots/${lang}/${device}-${names[feature]}.png`, origin: `.local-release/screenshots/${file}`, sourceModifiedAt: (await stat(source)).mtime.toISOString(), ...(process.env.LIFT_SOURCE_BUILD ? { sourceBuild: process.env.LIFT_SOURCE_BUILD } : {}), width, height, sha256: createHash('sha256').update(await readFile(source)).digest('hex') });
  }
  for (const lang of langs) for (const theme of themes) {
    const name = `iphone-preview-${theme}-${lang}.mp4`;
    const source = resolve(root, '.local-release/recordings', name);
    try { await stat(source); } catch { console.log(`Recording pending: ${name}`); continue; }
    const metadata = probe(source);
    assert(Number(metadata.format.duration) >= 20, `${name}: record at least 20 seconds`);
    const cutName = name.replace('.mp4', '.segments.json');
    const cut = await readCut(resolve(root, '.local-release/recordings', cutName), Number(metadata.format.duration));
    await mkdir(resolve(project, 'public/recordings'), { recursive: true });
    await copyFile(source, resolve(project, 'public/recordings', name));
    await writeFile(resolve(project, 'public/recordings', cutName), JSON.stringify(cut, null, 2) + '\n');
    manifest.files.push({ file: `recordings/${name}`, origin: `.local-release/recordings/${name}`, sourceModifiedAt: (await stat(source)).mtime.toISOString(), ...(process.env.LIFT_SOURCE_BUILD ? { sourceBuild: process.env.LIFT_SOURCE_BUILD } : {}), duration: Number(metadata.format.duration), sha256: createHash('sha256').update(await readFile(source)).digest('hex') });
    manifest.files.push({ file: `recordings/${cutName}`, origin: cut === uncut ? 'Default first 20 seconds; review the actual footage before publishing.' : `.local-release/recordings/${cutName}`, sha256: createHash('sha256').update(await readFile(resolve(project, 'public/recordings', cutName))).digest('hex') });
  }
  let previous = { files: [] };
  try { previous = JSON.parse(await readFile(resolve(project, 'public/source-manifest.json'), 'utf8')); } catch {}
  const merged = new Map(previous.files.map(file => [file.file, file]));
  for (const file of manifest.files) merged.set(file.file, file);
  manifest.files = [...merged.values()];
  await writeFile(resolve(project, 'public/source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} else if (mode === 'proofs') {
  const selected = features.filter(feature => feature !== 'live');
  for (const lang of langs) for (const feature of selected) {
    const source = resolve(root, '.local-release/proof-browser', `iphone-${names[feature]}-${lang}.jpg`);
    await requireFile(source);
    const target = resolve(project, 'public/proofs', lang, `iphone-${names[feature]}-${lang}.jpg`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  for (const lang of langs) {
    const directory = resolve(output, 'browser-proofs', lang);
    await mkdir(directory, { recursive: true });
    for (const feature of selected) {
      const target = resolve(directory, `${String(order.indexOf(feature) + 1).padStart(2, '0')}-${feature}.png`);
      run(process.execPath, [cli, 'still', 'src/index.ts', `Proof-${lang}-${feature}`, target, ...browserArgs]);
      verifyStill(target);
    }
    if (selected.length === 9) run(process.execPath, [cli, 'still', 'src/index.ts', `Proof-Collection-${lang}`, resolve(output, `collection-${lang}-internal.png`), ...browserArgs]);
  }
} else if (mode === 'proof') {
  run(process.execPath, [cli, 'still', 'src/index.ts', 'Direction-Board', resolve(output, 'direction-board-v2.png'), ...browserArgs]);
} else {
  // Preflight the entire selected batch before producing any output.
  if (mode !== 'videos') for (const lang of langs) for (const device of devices) for (const feature of features) await requireFile(resolve(project, 'public/screenshots', lang, `${device}-${names[feature]}.png`));
  if (mode !== 'stills') for (const lang of langs) for (const theme of themes) {
    const source = resolve(project, 'public/recordings', `iphone-preview-${theme}-${lang}.mp4`);
    await requireFile(source);
    assert(Number(probe(source).format.duration) >= 20, `${source}: at least 20 real recorded seconds required`);
    await readCut(source.replace('.mp4', '.segments.json'), Number(probe(source).format.duration));
  }
  if (mode !== 'videos') for (const lang of langs) for (const device of devices) for (const feature of features) {
    const target = resolve(output, lang, device, `${String(order.indexOf(feature) + 1).padStart(2, '0')}-${feature}.png`);
    await mkdir(dirname(target), { recursive: true });
    run(process.execPath, [cli, 'still', 'src/index.ts', `Screenshot-${lang}-${device}-${feature}`, target, ...browserArgs]);
    verifyStill(target, device);
  }
  if (mode !== 'stills') for (const lang of langs) for (const theme of themes) for (const kind of ['Preview', 'Promo']) {
    const directory = resolve(output, lang, kind.toLowerCase());
    await mkdir(directory, { recursive: true });
    const raw = resolve(directory, `${theme}.render.mp4`);
    const target = resolve(directory, `${theme}.mp4`);
    const source = resolve(project, 'public/recordings', `iphone-preview-${theme}-${lang}.mp4`);
    const cut = await readCut(source.replace('.mp4', '.segments.json'), Number(probe(source).format.duration));
    const propsPath = resolve(directory, `${theme}.props.json`);
    await writeFile(propsPath, JSON.stringify({ lang, theme, segments: cut.segments }, null, 2) + '\n');
    run(process.execPath, [cli, 'render', 'src/index.ts', `${kind}-${lang}-${theme}`, raw, `--props=${propsPath}`, '--codec=h264', '--video-bitrate=14M', '--pixel-format=yuv420p', '--image-format=png', ...browserArgs]);
    // Silent stereo AAC: no music or voice from an unlicensed source.
    run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', '-i', raw, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-map', '0:v:0', '-map', '1:a:0', '-t', '20', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', kind === 'Preview' ? '4.0' : '4.1', '-pix_fmt', 'yuv420p', '-r', '30', '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', target]);
    const metadata = probe(target);
    const video = metadata.streams.find(x => x.codec_type === 'video');
    const audio = metadata.streams.find(x => x.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264'); assert.equal(video.profile, 'High');
    assert.equal(video.width, kind === 'Preview' ? 886 : 1080); assert.equal(video.height, 1920);
    assert.equal(video.r_frame_rate, '30/1'); assert.equal(video.pix_fmt, 'yuv420p');
    assert.equal(video.level, kind === 'Preview' ? 40 : 41);
    assert.equal(audio.codec_name, 'aac'); assert.equal(audio.channels, 2); assert.equal(audio.sample_rate, '48000');
    assert(Math.abs(Number(metadata.format.duration) - 20) < 0.1);
    assert(Number(metadata.format.size) < 500 * 1024 * 1024);
    await writeFile(`${target}.metadata.json`, JSON.stringify(metadata, null, 2) + '\n');
    if (kind === 'Preview') {
      const poster = resolve(directory, `${theme}.poster.png`);
      run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', '-ss', '5', '-i', target, '-frames:v', '1', '-pix_fmt', 'rgb24', '-update', '1', poster]);
      const still = probe(poster).streams[0];
      assert.equal(still.width, 886); assert.equal(still.height, 1920); assert.equal(still.pix_fmt, 'rgb24');
    }
  }
}
console.log(`Done: ${mode}. Outputs: ${output}`);
