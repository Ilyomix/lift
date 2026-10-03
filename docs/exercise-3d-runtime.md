# Exercise demonstrations

The exercise panel uses a real, weighted human mesh. The former procedural-body experiment is rejected and is not part of the runtime. Its local source snapshot is kept in `.local-release/rejected-exercise-prototype/` only.

## Asset contract

`public/models/exercise/athlete.glb` is paired with `athlete.rig.json` (version 1). The manifest records the exported bone names, world convention (+Y up, +Z forward), height in metres, and the material names used by skin, shorts and anatomical regions. The loader validates the manifest against the actual GLB. It does not infer bone names or assume local bind axes.

Surface regions share the human's skinned geometry; no separate shapes are placed over its muscles. An explicit anatomical table covers all 78 built-in exercises, including separate lats, upper/lower back, deltoids, adductors, abductors, forearms and obliques. The table is independent of the fractional set credits in the training library and does not modify volume calculations. Deep muscles without a corresponding surface are not painted onto unrelated anatomy. Primary and secondary regions use the selected blue or orange accent. Inactive shorts remain neutral graphite. Their individual anatomical panels use the selected accent only when the corresponding region is primary or secondary.

`exerciseModelRig.ts` measures each arm and leg in the exported bind pose. The two-bone solver clamps unreachable targets before solving, preserves both segment lengths, and computes bone rotations relative to their real bind orientation. Closed-chain grips solve the wrist from the desired contact and measured palm offset, with a stable hand frame; unreachable initial wrist estimates cannot accumulate contact error. Pelvis tilt, spine flexion and independent feet/wrist rotations support the movement definitions. Equipment is built separately from the human.

Closed hands use independent, absolute phalanx directions fitted to the shipped skin around an 18 mm grip. The relaxed bind-pose curl is removed before applying them. The thumb has an attainable opposition target and an explicit distal direction. The palm contact offset includes the skin envelope; a bone centre on a handle does not establish a valid surface contact. Open support palms remain a separate pose for weights held by their heads. Free handles and weights follow the resolved palm axis; their mounts end outside the grasped area. Any change to this skin asset or grip diameter requires a new close-up review and surface-contact checks.

## Runtime

One lazily created WebGL context serves the visible exercise panel. The active canvas renders directly to the DOM; a 2D snapshot is taken only when a sheet replaces an existing panel. Rendering resolution is capped at 900 × 675 pixels. No large canvas readback occurs per frame.

The backing snapshot is cleared when its panel regains the shared WebGL surface, mounts a different exercise or is disposed. A visibility change schedules a frame even when the returning panel is paused. This prevents a frozen pose from remaining beneath the transparent live view after sheet or scroll transitions. The real-GPU lifecycle fixture at `tests/fixtures/exercise-renderer.html` checks four previously failing cases with the shipped GLB and actual canvas pixels; serve it with Vite and use “Run checks”.

The scheduler targets 60 frames per second using display callbacks and a bounded accumulator. Static front/back views and paused/reduced-motion demonstrations render once, then stop requesting frames. Offscreen panels, hidden documents and inactive native apps stop rendering. Opening another exercise sheet gives it priority. Closing the last panel disposes the renderer, skeleton textures, cloned geometries and materials. GLB source data is cached for later mounts.

The interface keeps reference-video links available if WebGL or an asset is unavailable. Model loading and context restoration cannot interrupt workout logging.

Drag the model with one finger, a pen or the primary mouse button to rotate through 360° and tilt the view. Only the canvas captures the gesture; the surrounding sheet remains scrollable. Each panel retains its own orientation, including while paused or under Reduced Motion. Arrow keys rotate and tilt a focused model; Home, the reset button or reselecting a view preset restores its original angle. French and English instructions identify the gesture. Camera elevation stops short of the poles to keep the model upright. Framing includes the neutral body or the full measured movement and equipment, and remains fixed during playback. Three regression tests project the shipped meshes through rotated cameras to check framing, stable playback and reset behavior.

## Movement coverage and validation

The three motion modules cover 37 upper-body movements, 12 arm movements, and 29 lower-body/core movements. Unknown custom exercises retain the reference-video fallback. A camera frame measured across five poses keeps the deformed skin and equipment visible throughout playback without moving the camera each frame.

All 78 movements were reviewed at start, contraction and return poses. Upper-body and lower/core batches also received an independent visual review. Automated reach, support, loop and floor checks validate specific mechanical invariants; they do not establish anatomical realism on their own. The later featureless-face revision is reviewed separately from these body-motion checks. Marketing captures must use the final native source commit.

Type checking passes. The solver was checked against 3,000 reachable, unreachable and collinear/degenerate target configurations: both bone lengths remained constant, the solved hand stayed connected, and all coordinates remained finite. This validates the solver, not biomechanics or real-device frame rate. The shipped GLB is also tested across all 78 motions: 37 upper motions retain reachable limbs, fixed supports, straight braced legs, constant elbow angles for isolation arcs, floor clearance and continuous loops; 12 arm and 29 lower/core motions have their own support and contact checks. Native visual and measured frame-rate checks remain separate requirements.

## Native cadence evidence

On 2026-10-03, an iPhone 17 Pro Max simulator running iOS 26.5 under Xcode 27 measured the native WKWebView at source `3c312dc`. A QA-only `VITE_LIFT_RENDER_METRICS=1` build counted completed renderer submissions over 15-second windows: the home atlas (four models, 256 × 256) submitted 56.29–57.36 frames/s in its first three windows; the exercise panel (816 × 612) submitted 58.76–58.80 frames/s in its first two windows. A resumed exercise window submitted 59.26 frames/s. These are JavaScript submission counts, not GPU completion or physical-device presentation measurements.

Pausing stopped exercise reports for 34.66 seconds. Backgrounding stopped both renderers' reports for 23.65 seconds; returning resumed the visible demonstration without a blank page. Reduced Motion was inspected in code, not toggled during this native run. Assets were verified in the package; a network-disabled device run was not performed. The QA flag and diagnostic strings are absent from normal production bundles. Detailed local evidence: `.local-release/build7-qa/metrics-results.json`.
