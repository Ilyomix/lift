# Lift app icon

Canonical master: `public/icons/app-icon-1024.png` (1024 × 1024, RGB, opaque).

Generated with OpenAI image generation on 2026-10-03. Original output: 1254 × 1254; approved artwork resampled to 1024 × 1024. No seed was exposed by the generation tool. The committed master, rather than a promised deterministic regeneration, is the source for all derived files.

Master SHA-256: `72149e7a014a99fc87751af6c9757b952f0d750216f718806532216328614440`.

Reproduce exports with `python3 scripts/icons.py` (Python 3 + Pillow). The script creates iOS and Live Activity artwork, web/PWA/apple-touch/favicon assets, Android launchers at five densities, the Web Push monochrome badge, and the App Store marketing brand asset. RGB launcher exports preserve opacity. Maskable/adaptive exports inset the subject with edge-color extension and a feathered blue-background join; notification-only alpha is derived from blue-background separation. Android notification `ic_workout.xml` stays a purpose-built monochrome dumbbell.

## Generation prompt

Use case: stylized-concept.
Asset type: final iOS App Store app icon for Lift, a strength training app. Produce one 1024 x 1024 pixel opaque square image.
Primary request: a bold, custom-designed sculptural 3D athletic dumbbell mark, simple enough to remain unmistakable at 24 pixels.
Scene/backdrop: a full-bleed saturated cobalt blue background based on #2D5EEC, subtle refined light variation, opaque all the way to every corner.
Subject: one single chunky dumbbell, diagonal from southwest to northeast, broad deep-graphite weight masses at both ends and a short sculptural brushed-silver metal handle. Few strong geometric forms, subtle bevels, deliberately designed proportions. Clean silver highlights provide immediate contrast and recognizability.
Composition: tightly designed app icon, centered silhouette occupying about 76% of the square, generous equal safe clearance around all extremities. Three-quarter view with controlled shallow perspective. Strong diagonal energy and balanced center of mass.
Style: premium athletic industrial design expressed as a precise stylized 3D icon. Restrained, confident, contemporary. A designed symbolic object rather than a photograph of gym equipment.
Lighting: soft directional upper-left light, gentle controlled shadows contained within the canvas, crisp clear outer silhouette.
Constraints: full square artwork, no baked rounded corners, no icon mockup, no device frame, no border or inset tile, no transparency, no lettering, no numbers, no logos, no watermark, no interface.
Avoid: toy or clay appearance, puffy inflatable forms, excessive tiny machining details or knurling, neon glow, dramatic lens effects, photo environment, extra objects, busy background.
