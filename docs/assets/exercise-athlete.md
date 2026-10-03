# Exercise athlete — MakeHuman / MPFB

The athlete is an original Lift configuration of MakeHuman's continuous human mesh, with the official GameEngine skin and skeleton. It is not assembled from body-part primitives. The runtime uses the exported GLB only; MPFB's GPL code is not included in the app.

## Source and license

- Official source: https://github.com/makehumancommunity/mpfb2
- Pinned revision: `afb9f530a7c2741dedb8df0ebae2e0b183caec21` (MPFB 2.0.17).
- Core mesh, targets, rig and skin weights: **CC0 1.0**, per [upstream asset license](https://github.com/makehumancommunity/mpfb2/blob/afb9f530a7c2741dedb8df0ebae2e0b183caec21/LICENSE.ASSETS.md) and [MakeHuman license explanation](https://static.makehumancommunity.org/about/license.html).
- Inputs: `data/3dobjs/base.obj`, `data/targets/`, `data/rigs/standard/rig.game_engine.json`, `data/rigs/standard/weights.game_engine.json`.
- Lift additions: an anonymous head retopology, topology-derived matte shorts, anatomical material regions. No downloaded skin textures, photographs, or third-party clothing.

## Reproduce

Run from the repository root with Blender 5.2.2 LTS. The source download is a build tool, not a shipped dependency.

```sh
mkdir -p .local-release/tools/mpfb2
curl -L --fail https://github.com/makehumancommunity/mpfb2/archive/afb9f530a7c2741dedb8df0ebae2e0b183caec21.tar.gz -o .local-release/tools/mpfb2-source.tar.gz
tar -xzf .local-release/tools/mpfb2-source.tar.gz --strip-components=1 -C .local-release/tools/mpfb2
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-athlete.py
node scripts/verify-exercise-athlete.mjs
```

The script registers the addon in its isolated Blender process. A process-local extension-path adapter places MPFB cache/config under `.local-release/athlete/mpfb-user`; it does not save user preferences or install the addon globally.

Outputs:

- `public/models/exercise/athlete.glb` — bundled model.
- `public/models/exercise/athlete.rig.json` — exact exported bone/material names and bind landmarks.
- `.local-release/athlete/athlete-source.blend` — editable phenotype and official rig.
- `.local-release/athlete/athlete-final.blend` — final skinned mesh, shorts and materials.
- `.local-release/athlete/athlete-{front,back}.png` — studio geometry previews.

## Geometry and runtime contract

Meters, height 1.82 m, glTF +Y up and +Z forward. The source uses MPFB's relaxed A-pose, not a synthetic T-pose. Pose code must derive rotations from the supplied bind landmarks and bone transforms. The 53-bone skeleton includes three bones per finger; hands, feet and fingers are actual skinned geometry.

The baked phenotype is an adult male mannequin (age slider 0.5), mixed default ancestry, muscle 1.0, weight 0.38, height 0.58, proportions 0.5. Additional modest built-in muscle targets define pectorals, upper back, deltoids, arms and thighs. A single height normalization is applied to both mesh and rig. The user-requested face is a smooth anonymous mannequin surface: no eyes, sockets, eyebrows, nose, mouth or facial texture. `scripts/athlete-head.py` replaces the original facial topology with clean quad rings following the measured skull envelope. The rings share the actual neck boundary; new weights blend from that boundary to the existing head bone, with a local neck smoothing pass. The rounded crown keeps the original maximum height. The body, muscle regions and 53-bone rig remain unchanged outside this head/neck treatment.

Helpers and morph targets are removed from the shipped GLB. Only the upper-torso topology is subdivided to improve muscle-region edges. Exact plane cuts follow the pectoral outline on the continuous skin, preserving original vertex positions and interpolating weights for new edge vertices. Four strongest skin influences per vertex are normalized by Blender's glTF exporter. Source weights remain editable in the `.blend`.

The 18 anatomical surface regions are named materials, grouped in the manifest under Lift's canonical visual-muscle keys. Lats, upperBack, lowerBack and obliques remain distinct visual keys; `hams` maps hamstrings and `abductors` maps gluteMedius. No broad back alias overwrites these surfaces. These are qualitative visual zones, **not muscle activation percentages or training-volume credits**. Forearms remain neutral unless explicitly requested. Opaque shorts have separate glutes, abductors, quads, hams and adductors material zones. They keep their dark fabric base unless their region is active. Underlying body surfaces are retained. Biceps/triceps regions are restricted to the upper-arm surface below the humeral head; clavicular surfaces cannot inherit them. Calf highlighting excludes the tibial front and ankle; pectoral zones follow a sternum-to-humerus fan rather than an oval.

No camera, studio light, texture, animation clip, or addon code ships in the GLB. Motion is supplied by the exercise runtime. The same source may be posed for small workout icons.

## Export validation

Current export: 2,136,248 bytes, 59,104 triangles, 33,312 exported vertices including material seams, 25 primitives, one skin, 53 joints, zero textures. All referenced bone and material names exist in the serialized GLB. Every vertex has finite normalized skin weights; maximum weight-sum error measured `1.27e-7`, zero unweighted vertices. Below the PWA 4 MiB per-file limit.

SHA-256: `da59c8923afa62f54ccded6cceafa90229325c98abe024b764fddeb4ff137ae9`.

Static export checks do not replace runtime deformation/performance checks or review of each exercise's movement.
