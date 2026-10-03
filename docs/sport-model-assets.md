# Animated sport models

The dumbbell uses substantial rubber heads, a contoured machined steel grip, actual diamond knurl geometry and a painted accent. The other nine objects share its physical material roles. The five workout icons derive from the MakeHuman/MPFB CC0 athlete, with anatomical contours preserved. Their separate generator records this provenance. Browser and native QA checked fixed title sizes and theme adaptation; native frame cadence is recorded separately.

Ten original object models authored for Lift in Blender 5.2.2 LTS, plus five CC0 human derivatives documented in [Workout icons](assets/workout-icons.md) and [Exercise athlete](assets/exercise-athlete.md). The files contain real mesh geometry and transform animation; no raster illustration is transformed to imitate 3D. No external texture, licensed music, generation service or remote runtime resource is used. The human derivatives use the locally vendored CC0 source cited in their provenance; they are not described as original Lift anatomy.

## Production files

`public/models/sport/` contains `dumbbell`, `plate`, `stopwatch`, `calendar`, `chart`, `nutrition`, `settings`, `backup`, `coach`, `trophy` and `workout-{upper,lower,push,pull,legs}.glb`. The workout models are stylized category symbols, not exercise instructions. Upper and Push show chest panels, Pull shows back panels, Lower shows bent legs and a lower torso, and Legs shows extended legs.

Each GLB contains an `ArtRoot`, a square orthographic `IconCamera`, and one six-second `Idle` clip starting at zero. glTF uses Y-up coordinates. The model is centered and normalized to approximately two units, and the exported camera frames its silhouette with transparent margins. Use the embedded camera unchanged; changing its aspect ratio compresses the object. **Set Blender's render resolution to square before exporting**, because the glTF exporter computes camera `xmag` and `ymag` from that aspect ratio.

Four stable PBR material names permit runtime theming: `LiftGraphite`, `LiftCobalt`, `LiftSilver`, and `LiftInk`. A model includes only the materials it uses. There are no texture maps or baked vertex colors; the runtime can adapt both the neutral material colors and the blue/orange accent. The illustrative `.blend` studio lighting is not exported, so the runtime supplies its own shared environment and lights.

The ten objects use these authored material values:

| Material | sRGB color | Metallic | Roughness |
| --- | --- | --- | --- |
| `LiftGraphite` | `#1B1E23` | 0 | 0.61 |
| `LiftCobalt` | `#2859E8` | 0 | 0.34 |
| `LiftSilver` | `#C7CCD2` | 1 | 0.24 |
| `LiftInk` | `#101216` | 0 | 0.70 |

Keep the rubber neutral and dark when adapting themes; whitening it changes the perceived material. The accent can switch between blue and orange. Runtime environmental reflections and restrained lights provide separation on dark surfaces. These metallic/roughness roles follow the [Three.js PBR material model](https://threejs.org/docs/pages/MeshStandardMaterial.html); intermediate metallic values are not used to make rubber and steel look vaguely shiny.

Static meshes with the same direct parent and material are joined without deleting vertices or faces. Animated pivots are never merged together. This reduces draw calls while retaining independent moving parts, materials, geometry and normals. The generator asserts that vertex and polygon counts remain unchanged; the artifact verifier reports triangle counts and checks that each model uses at most ten mesh primitives.

Animation is authored on a 60 fps timeline. glTF interpolates its sampled transform keys continuously; the runtime's frame scheduler determines actual playback frame rate. The motion includes real depth changes and pivots: stopwatch hand, calendar page hinge, chart bar scale, gear rotation, archive lid hinge, trophy cup turn, and a hinged apple leaf, while the five static human category poses use only a subtle whole-object yaw. A common three-dimensional yaw stays within ±7 degrees. The nutrition apple stays still while its leaf and vein pivot together at the stem (−14° to +10° around the leaf hinge), making the six-second loop visible even at title-icon size without moving the layout. Loop endpoints match, including quaternion sign equivalence. There is no 2D bounce or CSS rotation in the assets.

## Reproduce and validate

```sh
blender -b --factory-startup --python scripts/generate-sport-models.py
node scripts/verify-sport-models.mjs
```

Pass model names after `--` to rebuild a subset. The generator saves editable `.blend` files, 384×384 transparent PNG review renders and individual geometry/provenance JSON files in ignored `.local-release/sport-models/`. These files can be regenerated; the scenes are retained for further manual editing.

The command rebuilds only the ten object icons. The rejected procedural human generators have been removed. Regenerate the five anatomical workout icons with `scripts/generate-workout-icons.py`. `scripts/prototype-realistic-dumbbell.py` uses the same canonical geometry and materials while exporting only to `.local-release/sport-models/realistic-v2/` and producing a larger studio review render. There is no second, stale dumbbell implementation.

The verification script checks all fifteen GLB binary containers, internal buffer bounds and mesh indices, finite geometry and animation values, square camera aspect, material names, absence of textures/external resources, `ArtRoot`, a single `Idle` clip, the exact zero-to-six-second time range and continuous loop endpoints. It writes source hashes, triangle counts, animated channel counts and total bytes to `.local-release/sport-models/validation.json`. The complete fifteen-model set is 3,858,636 bytes (about 3.86 MB) before transfer compression. Read the current verifier output for exact byte counts; the human derivatives are larger than the original object icons.

Five static fallback images live in `src/assets/sport/workout-*.webp`. The human workout generator refreshes them directly from its Blender review renders under `.local-release/workout-models/`, retaining alpha. They are distinct from the ten earlier ImageGen fallback illustrations, whose provenance remains in `src/assets/sport/README.md`.

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-workout-icons.py
node scripts/verify-sport-models.mjs
```

Visual QA must still check actual runtime lighting, 32/64 px legibility, light/dark themes and both accent colors. Render tests do not prove native frame rate or battery impact. The app should pause off-screen/hidden animation and respect reduced-motion preferences.
