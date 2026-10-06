# Animated sport models

The dumbbell uses substantial rubber heads, a contoured machined steel grip, actual diamond knurl geometry and a painted accent. The other object illustrations share its physical material roles. The five workout icons derive from the MakeHuman/MPFB CC0 athlete, with anatomical contours preserved. Their separate generator records this provenance. Browser and native QA checked fixed title sizes and theme adaptation; native frame cadence is recorded separately.

Twenty original object models authored for Lift in Blender 5.2.2 LTS, plus six CC0 human derivatives documented in [Workout icons](assets/workout-icons.md) and [Exercise athlete](assets/exercise-athlete.md). The files contain real mesh geometry and transform animation; no raster illustration is transformed to imitate 3D. No external texture, licensed music, generation service or remote runtime resource is used. The human derivatives use the locally vendored CC0 source cited in their provenance; they are not described as original Lift anatomy.

## Production files

`public/models/sport/` contains `dumbbell`, `plate`, `stopwatch`, `calendar`, `chart`, `nutrition`, `settings`, `appearance`, `backup`, `coach`, `trophy`, `program`, `evidence`, `pause`, `reminders`, `privacy`, `kit`, `logbook`, `camera`, `measuring-tape`, `body-target` and `workout-{upper,lower,push,pull,legs}.glb`. The workout models are stylized category symbols, not exercise instructions. Upper and Push show chest panels, Pull shows back panels, Lower shows bent legs and a lower torso, and Legs shows extended legs.

Each GLB contains an `ArtRoot`, a square orthographic `IconCamera`, and one six-second `Idle` clip starting at zero. glTF uses Y-up coordinates. The model is centered and normalized to approximately two units. At runtime, `frameSportMotion` frames each object's complete gesture once using its mesh vertices, preserving a square projection and transparent margins. The camera then stays fixed. The workout models retain their exported camera. **Set Blender's render resolution to square before exporting**, because the glTF exporter computes camera `xmag` and `ymag` from that aspect ratio.

Four stable PBR material names permit runtime theming: `LiftGraphite`, `LiftCobalt`, `LiftSilver`, and `LiftInk`. A model includes only the materials it uses. There are no texture maps or baked vertex colors; the runtime can adapt both the neutral material colors and the blue/orange accent. The illustrative `.blend` studio lighting is not exported, so the runtime supplies its own shared environment and lights.

The original objects use these authored material values (human derivatives retain matte surfaces):

| Material | sRGB color | Metallic | Roughness |
| --- | --- | --- | --- |
| `LiftGraphite` | `#1B1E23` | 0 | 0.61 |
| `LiftCobalt` | `#2859E8` | 0 | 0.34 |
| `LiftSilver` | `#C7CCD2` | 1 | 0.24 |
| `LiftInk` | `#101216` | 0 | 0.70 |

Keep the rubber neutral and dark when adapting themes; whitening it changes the perceived material. The accent can switch between blue and orange. Runtime environmental reflections and restrained lights provide separation on dark surfaces. These metallic/roughness roles follow the [Three.js PBR material model](https://threejs.org/docs/pages/MeshStandardMaterial.html); intermediate metallic values are not used to make rubber and steel look vaguely shiny.

Static meshes with the same direct parent and material are joined without deleting vertices or faces. Animated pivots are never merged together. This reduces draw calls while retaining independent moving parts, materials, geometry and normals. The generator asserts that vertex and polygon counts remain unchanged; the artifact verifier reports triangle counts and checks that each model uses at most ten mesh primitives.

Animation is authored on a 60 fps timeline; the runtime's frame scheduler determines actual playback frame rate. `sportModelMotion.ts` replaces object clips with short gestures on real internal nodes: a stopwatch hand, calendar page hinge, cascading chart bars, gear engagement, archive lid, trophy cup, apple leaf and sliding dumbbell loads. The plate rolls as a single rigid assembly, with travel equal to its radius times its angle, then returns to rest. Generic object yaw is disabled. The optional coach stays static.

Object cycles last 24–32 seconds, with staggered entry delays and at least 20 seconds at rest. The five human category icons retain their six-second clips at native speed, followed by 22–25 seconds of rest. Reduced Motion selects the static initial pose; offscreen, hidden and inactive-native states pause rendering. No CSS transform animation is applied to the illustrations.

## Reproduce and validate

```sh
blender -b --factory-startup --python scripts/generate-sport-models.py
node scripts/verify-sport-models.mjs
node --import tsx --test tests/sport-motion.test.ts
```

Pass model names after `--` to rebuild a subset. The generator saves editable `.blend` files, 384×384 transparent PNG review renders and individual geometry/provenance JSON files in ignored `.local-release/sport-models/`. These files can be regenerated; the scenes are retained for further manual editing.

The command rebuilds the twenty object icons and the dedicated body-target derivative. The rejected procedural human generators have been removed. Regenerate the five anatomical workout icons with `scripts/generate-workout-icons.py`. `scripts/prototype-realistic-dumbbell.py` uses the same canonical geometry and materials while exporting only to `.local-release/sport-models/realistic-v2/` and producing a larger studio review render. There is no second, stale dumbbell implementation.

The verification script checks all twenty-six GLB binary containers, internal buffer bounds and mesh indices, finite geometry and animation values, square camera aspect, material names, absence of textures/external resources, `ArtRoot`, a single `Idle` clip, the exact zero-to-six-second time range and continuous loop endpoints. It writes source hashes, triangle counts, animated channel counts and total bytes to `.local-release/sport-models/validation.json`. Read the current verifier output for exact byte counts; the human derivatives are larger than the original object icons. Runtime motion tests additionally check actual mesh framing, rigid rolling, static rest poses, long pauses and staggered starts.

Five static fallback images live in `src/assets/sport/workout-*.webp`. The human workout generator refreshes them directly from its Blender review renders under `.local-release/workout-models/`, retaining alpha. They are distinct from the ten earlier ImageGen fallback illustrations, whose provenance remains in `src/assets/sport/README.md`.

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-workout-icons.py
node scripts/verify-sport-models.mjs
```

Visual QA must still check actual runtime lighting, 32/64 px legibility, light/dark themes and both accent colors. Render tests do not prove native frame rate or battery impact. The app should pause off-screen/hidden animation and respect reduced-motion preferences.

## Dedicated page artwork

Seven additional original Blender models provide distinct semantic artwork: a clipboard for the program, a research book for sources, an hourglass for program pauses, a bell for reminders, a shield and lock for privacy, a sports bag for More, and a workout journal for empty progress views. Their matching WebP fallbacks are rendered from the same Blender scenes. No old asset is copied or renamed.

The new internal motions use `ProgramClipPivot`, `EvidenceBookmarkPivot`, `HourglassPivot`, `BellSwingPivot`/`BellClapperPivot`, `LockShacklePivot`, `KitZipPullPivot` and `LogbookPencilPivot`. The sports bag zipper slides along its track while its handles stay still. All seven keep a static ArtRoot; the shared runtime controls long rest intervals, theme materials and complete-motion framing. The added assets total 449,708 bytes of GLB and 69,888 bytes of transparent WebP.

## Dedicated Appearance artwork

`appearance.glb` is an original Lift day/night control, separate from the settings gear. Its graphite shell, steel rim, embossed sun/crescent and accent-colored thumb are real geometry. `AppearanceThumbSlide` travels horizontally within the stationary track, uncovers the sun, then returns to the crescent side. The app plays a 1.48-second gesture starting about 2.1 seconds after entering view, repeating every 30 seconds. The original six-second export clip remains available; the runtime uses its own gesture timing. ArtRoot and the camera stay fixed.

The asset uses the four existing themeable PBR materials, without textures or external resources. The 81,508-byte GLB contains 4,212 triangles and five mesh primitives. Its 8,706-byte transparent WebP fallback is encoded directly from the Blender Cycles PNG. Neither the app icon nor any existing model is regenerated by this targeted command:

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-sport-models.py -- appearance
```

Editable scene, geometry/license metadata and review renders are retained as `.local-release/sport-models/appearance.{blend,json,png}`. License/provenance: original procedural Lift artwork; no third-party assets or textures. Runtime camera-bound, motion and long-rest tests include Appearance.

## Photos, measurements and target physique

Three dedicated assets serve these main sections. `camera` has a compact graphite body, accent grip and focus ring, a translating lens barrel and a physical shutter button. `measuring-tape` has a retractable graduated strip; its hook and markings move together without stretching. `body-target` frames the existing continuous, anonymous MakeHuman/MPFB athlete with four accent focus corners. Only the corners move inward, then return; the human stays still. This is a physique symbol, not an exercise demonstration. It is used once on the Goal page, without repeating the same illustration in the priority-area controls.

The camera and tape are original procedural Lift geometry. The body uses exactly the two body/shorts surfaces from the bundled `public/models/exercise/athlete.glb`, in their relaxed bind pose; no rig-display helper geometry is exported. Its source SHA and CC0 license reference are recorded in `.local-release/sport-models/body-target.json`. The source's topology and anonymous face are preserved, with matte `LiftSilver` skin and graphite shorts. See [athlete provenance](assets/exercise-athlete.md). No new downloaded mesh, texture or license is introduced.

All three use the existing theme-adaptive PBR material names. Internal gestures repeat every 28–31 seconds with independent delays and at least twenty seconds at rest. ArtRoot and the camera stay fixed. Reduced Motion, offscreen and hidden-state behavior use the shared renderer unchanged. Their transparent WebP fallbacks come directly from the matching Blender Cycles renders.

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-sport-models.py -- camera measuring-tape body-target
node scripts/verify-sport-models.mjs
node --import tsx --test tests/sport-motion.test.ts
```

The source-preserving body derivative is larger than the props: 1,164,280 bytes / 59,200 triangles / four primitives, versus 66,804 bytes / 3,592 triangles / eight primitives for the camera and 65,484 bytes / 3,160 triangles / six primitives for the tape. No existing asset is regenerated by this subset command. Editable scenes, provenance, dimensions and transparent review renders are kept in `.local-release/sport-models/`. Binary and runtime motion/camera tests cover the new assets; rendered geometry review does not imply measured native frame cadence.
