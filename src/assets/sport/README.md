# Lift athletic illustrations

Ten original transparent illustrations generated with the built-in ImageGen tool on 2026-10-03, then encoded as 384 × 384 WebP assets. The source renders are retained locally in `.local-release/3d-originals/`.

Shared art direction: modern three-dimensional athletic equipment, matte graphite, cobalt blue matching Lift, brushed silver details, consistent studio lighting, isolated on a transparent background, no lettering or logo.

Prompt subjects:

- `dumbbell.webp`: a single hexagonal dumbbell, diagonal three-quarter view, knurled silver grip and blue end caps.
- `plate.webp`: a weight plate with three grip cutouts and an inset cobalt rim.
- `stopwatch.webp`: a compact analog stopwatch with a dark face, white tick marks, blue hand and no numbers.

These are decorative brand illustrations. They do not replace interface labels, the official app icon, exercise technique images or the live timer. Their dimensions reserve layout space, and the UI hides them from assistive technologies.

Five additional `workout-{upper,lower,push,pull,legs}.webp` fallbacks are direct transparent render encodings of the CC0 MakeHuman/MPFB anatomical category models, not ImageGen outputs. Their reproducible model source, animation contract and verification are documented in [sport-model-assets.md](../../../docs/sport-model-assets.md). The ten ImageGen illustrations below retain their original provenance.

## Additional section illustrations

Seven distinct built-in ImageGen calls extend the same graphite/cobalt/silver family. The generated alpha is retained. Each complete object is centered within a 384 × 384 transparent canvas, with a 320 px longest silhouette axis (approximately 83% occupancy) for consistent display at 64 CSS pixels. No interface labels or functionality are baked into the artwork.

Shared generation prompt:

Use case: stylized-concept. Asset type: original transparent 3D raster illustration for Lift fitness app, displayed at 64 CSS pixels. Match a premium athletic-equipment icon family: matte/satin dark graphite #191D23, vivid cobalt #2E62F5, small brushed-silver accents; substantial realistic materials, softly rounded machined bevels and restrained studio highlights. Soft key light from upper left and subtle rim light, neutral white reflections, photoreal clean 3D render rather than toy/clay. Composition: square canvas, one centered isolated object, visually balanced front three-quarter perspective, entire object inside image, occupy about 82% of the canvas on its longest axis, transparent margins on all sides. Transparent background with true alpha, no floor, no cast-ground shadow, no background glow. High legibility as a small icon. Do not add text, lettering, numbers, logos, watermark, people, hands, decorative sparkles or extra objects.

### `calendar.webp`

A compact training calendar object: graphite rectangular calendar body with beveled rounded corners, two brushed-silver binder rings at top, a cobalt-blue header strip, and a clean 3-by-3 grid of inset date squares. Two squares have small cobalt checkmarks. No date numerals, no text. Three-quarter view slightly from above and front, front face fully readable.

### `chart.webp`

A compact freestanding strength-progress chart object: three substantial graphite rectangular bars rising from left to right on a small shared base, cobalt-blue top faces and a single bold cobalt rising arrow running behind the bars. Restrained brushed-silver edge details. The whole silhouette reads instantly as a rising bar chart. Three-quarter view slightly from above and front.

### `nutrition.webp`

One athletic nutrition apple sculpture: unmistakable full apple silhouette with a slight central cleft, graphite satin body, one cobalt-blue leaf, short brushed-silver stem, and a subtle cobalt accent around one side. No bite, no logo, no food props. Three-quarter view slightly from above and front.

### `settings.webp`

One precision settings gear: thick graphite eight-tooth cog, cobalt-blue recessed inner ring and a brushed-silver circular central hub opening. Strong simple symmetric silhouette, clean machined bevels. Three-quarter view slightly from above and front, no secondary gears.

### `backup.webp`

One compact backup archive/storage box: sturdy graphite rounded rectangular box with a fitted cobalt-blue lid, a small inset brushed-silver front pull handle, and a clean silver downward arrow embossed on the front. It must read as a backup archive box, not a shipping parcel or gift. Three-quarter view slightly from above and front.

### `coach.webp`

One classic sports coach whistle: substantial graphite whistle body with a cobalt-blue outer side panel, brushed-silver mouthpiece and tiny silver attachment loop. Strong recognisable whistle silhouette, no lanyard or cord. Three-quarter diagonal view slightly from above and front.

### `trophy.webp`

One compact achievement trophy: broad graphite cup with two substantial cobalt-blue side handles, short brushed-silver stem and a squat graphite base with a cobalt inset. Clear balanced trophy silhouette with no inscription or emblem. Three-quarter view slightly from above and front.

## Original Blender page models — 4 October 2026

`program`, `evidence`, `pause`, `reminders`, `privacy`, `kit`, and `logbook` are original procedural mesh models authored for Lift. Their WebP files here are transparent renders of the matching GLBs, not ImageGen outputs or third-party downloads. The canonical generator is `scripts/generate-sport-models.py`; editable Blender scenes and review PNGs are retained in `.local-release/sport-models/`. See [model documentation](../../../docs/sport-model-assets.md) for their material, animation and validation contract.
