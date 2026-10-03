# Lift app icon

Canonical master: `public/icons/app-icon-1024.png` (1024 × 1024, RGB, opaque).

Generated with the built-in OpenAI image generation tool on 2026-10-03. Original output: 1254 × 1254, RGB; resampled to 1024 × 1024. The final two-piece sculpted monogram was generated as a targeted edit of the first L direction; it replaces the rejected dumbbell identity. No seed was exposed by the tool. The committed master is the source for reproducible derived files.

Master SHA-256: `23cfb58a9b9fb1df08af13515380716c8d3618fe6d30b932179a03689239c00b`.

Reproduce exports with `python3 scripts/icons.py` (Python 3 + Pillow). The script creates iOS and Live Activity artwork, web/PWA/apple-touch/favicon assets, Android launchers at five densities, the Web Push monochrome badge, and the App Store marketing brand asset. RGB launcher exports preserve opacity. Maskable/adaptive exports inset the mark with edge-color extension and a feathered blue-background join; notification-only alpha is derived from blue-background separation. Android notification `ic_workout.xml` stays a functional monochrome dumbbell representing an active workout.

Validated: all 24 PNG files decode; iOS and marketing images match master pixels; visible monogram maximum radius is 0.294 of canvas width in the PWA maskable export (safe radius 0.4), and 0.224 in the Android adaptive export (safe radius 33/108). The 64 px favicon and monochrome notification silhouette remain legible.

## Initial generation prompt

Use case: logo-brand.
Asset type: final iOS and Android app icon for Lift, a premium strength-training app. One opaque 1024 x 1024 square image.
Primary request: design a distinctive proprietary capital L monogram, expressing controlled upward drive and strength. The L is the entire mark, unmistakably legible as L at tiny size, designed with a tall decisive vertical stem and a powerful lower foot whose upper face rises subtly toward its outer end. Compact, muscular, elegant engineered geometry. Do not turn it into an arrow.
Scene/backdrop: full-bleed saturated cobalt blue close to #2D5EEC, very subtle refined tonal depth; same blue reaches all four corners.
Subject/style: a single sculptural custom L in porcelain-white / satin brushed silver with restrained graphite side facets, shallow dimensional extrusion and precise small bevels. Broad simple surfaces, a confident asymmetric cut giving the monogram its own identity. Near-front view, tiny perspective just enough to reveal material thickness. High contrast, no black voids in the letter.
Composition: monogram optically centered, occupies around 66% of height and 60% of width, calm balanced negative space. Strong readable silhouette and intentionally designed proportions rather than typeset generic font. The foot is clearly attached to the stem; one cohesive mark.
Lighting: soft upper-left studio illumination, crisp edges, subtle short grounded shadow. The bevel stays quiet so the L reads first.
Constraints: full opaque square, NO rounded outer corners, NO inset tile or border, NO app mockup or device, NO slogan or word Lift, no extraneous lettering, no watermark. No dumbbell, no barbell, no stock sports equipment, no generic upward arrow, no chevron, no swoosh, no wings, no muscles, no stock logo resemblance. No neon, gradients inside rainbow chrome, glossy toy plastic, excessive ornament, rings, background texture or scenery.

## Final targeted-edit prompt

Edit target: the first generated Lift app icon above, supplied as a local image to the built-in image generation tool. Final generated source was a 1254 × 1254 opaque RGB PNG, resampled to the canonical 1024 × 1024 master. Only deterministic resizing, PNG encoding and the documented platform-specific exports follow generation.

Use case: precise-object-edit / logo-brand. Edit target: the supplied Lift app icon. Keep the full-bleed opaque cobalt background, square format with no rounded corners, white/satin silver/graphite materials and restrained studio light. Replace ONLY the generic tall typeset L with a MUCH more distinctive compact custom-built identity mark for Lift.
Design the new emblem as TWO broad interlocking sculpted machined-weight masses, making one angular athletic L silhouette: a stout upright block rising from a low extended shoulder/base block. Cut a deliberate clean diagonal negative-space seam between the two masses; the seam rises from lower-left toward upper-right and conveys progressive load. A bold asymmetrical stepped silhouette and a sharply engineered inside corner, not a standard font glyph. The two fitted pieces nearly meet across the cobalt seam. Each broad shape is simple enough to read at 24px. Quiet shallow bevels, satin white front faces, graphite side facets; sculptural but flat enough for strong icon recognition. The resulting emblem feels like custom precision strength equipment reduced to a proprietary letterform, not a literal dumbbell. Compact center of mass and consistent thick structural strokes, avoid a giant skinny vertical L. Optically centered, around 62% of canvas height and 64% width, generous margins. Keep only this ONE emblem, no wordmark. Avoid arrows, chevrons, generic sans-serif letters, swooshes, rings, weights on a bar, stock fitness logos, faux rounded outer icon, inset tiles, frames, text, watermark. Produce one finished premium direction.
