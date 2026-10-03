# Exercise demonstrations

The exercise panel uses a real, weighted human mesh. The former procedural-body experiment is rejected and is not part of the runtime. Its local source snapshot is kept in `.local-release/rejected-exercise-prototype/` only.

## Asset contract

`public/models/exercise/athlete.glb` is paired with `athlete.rig.json` (version 1). The manifest records the exported bone names, world convention (+Y up, +Z forward), height in metres, and the material names used by skin, shorts and anatomical regions. The loader validates the manifest against the actual GLB. It does not infer bone names or assume local bind axes.

Surface regions share the human's skinned geometry; no separate shapes are placed over its muscles. An explicit anatomical table covers all 78 built-in exercises, including separate lats, upper/lower back, deltoids, adductors, abductors, forearms and obliques. The table is independent of the fractional set credits in the training library and does not modify volume calculations. Deep muscles without a corresponding surface are not painted onto unrelated anatomy. Primary and secondary regions use the selected blue or orange accent. Inactive shorts remain neutral graphite. Their individual anatomical panels use the selected accent only when the corresponding region is primary or secondary.

`exerciseModelRig.ts` measures each arm and leg in the exported bind pose. The two-bone solver clamps unreachable targets before solving, preserves both segment lengths, and computes bone rotations relative to their real bind orientation. Closed-chain grips solve the wrist from the desired contact and measured palm offset, with a stable hand frame; unreachable initial wrist estimates cannot accumulate contact error. Pelvis tilt, spine flexion and independent feet/wrist rotations support the movement definitions. Equipment is built separately from the human.

## Runtime

One lazily created WebGL context serves the visible exercise panel. The active canvas renders directly to the DOM; a 2D snapshot is taken only when a sheet replaces an existing panel. Rendering resolution is capped at 900 × 675 pixels. No large canvas readback occurs per frame.

The scheduler targets 60 frames per second using display callbacks and a bounded accumulator. Static front/back views and paused/reduced-motion demonstrations render once, then stop requesting frames. Offscreen panels, hidden documents and inactive native apps stop rendering. Opening another exercise sheet gives it priority. Closing the last panel disposes the renderer, skeleton textures, cloned geometries and materials. GLB source data is cached for later mounts.

The interface keeps reference-video links available if WebGL or an asset is unavailable. Model loading and context restoration cannot interrupt workout logging.

## Movement coverage and validation

The three motion modules cover 37 upper-body movements, 12 arm movements, and 29 lower-body/core movements. Unknown custom exercises retain the reference-video fallback. A camera frame measured across five poses keeps the deformed skin and equipment visible throughout playback without moving the camera each frame.

All 78 movements were reviewed at start, contraction and return poses. Upper-body and lower/core batches also received an independent visual review. Automated reach, support, loop and floor checks validate specific mechanical invariants; they do not establish anatomical realism on their own. Final asset contours, native cadence and marketing captures remain separate release checks.

Type checking passes. The solver was checked against 3,000 reachable, unreachable and collinear/degenerate target configurations: both bone lengths remained constant, the solved hand stayed connected, and all coordinates remained finite. This validates the solver, not biomechanics or real-device frame rate. The shipped GLB is also tested across all 78 motions: 37 upper motions retain reachable limbs, fixed supports, straight braced legs, constant elbow angles for isolation arcs, floor clearance and continuous loops; 12 arm and 29 lower/core motions have their own support and contact checks. Native visual and measured frame-rate checks remain separate requirements.
