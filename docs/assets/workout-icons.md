# Workout icons — anatomical source

The five `public/models/sport/workout-*.glb` assets are cropped static poses of the same real MPFB athlete used by exercise demonstrations. Source and CC0 license are documented in [exercise-athlete.md](exercise-athlete.md). The ten equipment/utility illustrations have a separate original-art provenance.

Regenerate after the athlete with Blender and the `cwebp` encoder installed. The generator also refreshes all five alpha-preserving `src/assets/sport/workout-*.webp` fallbacks directly from its new PNG renders:

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/generate-workout-icons.py
node scripts/verify-sport-models.mjs
```

- `upper`: front three-quarter bust, pectorals/shoulders and back highlighted.
- `push`: front bust, forearms forward and open palms facing forward, pectorals/front delts/triceps highlighted.
- `pull`: back three-quarter bust, elbows pulled back, upper back/lats/rear delts/biceps highlighted.
- `lower`: pelvis and legs in a modest bent stance, thighs/hips highlighted.
- `legs`: pelvis and standing legs, thighs/calves highlighted; tibial front remains neutral.

The upper/push/pull derivatives use the same smooth anonymous head as the demonstration model, with no facial features. These are illustrative poses, not exercise instruction clips. They share the anatomical skin/shorts surface. Off-frame body geometry is removed; cut planes are capped, and disconnected hand geometry is removed from lower-body icons. The cropped topology is retained without collapse decimation: Blender's collapse mode moves anatomical boundaries despite the material delimiter. The original animated athlete is untouched by the derivative generator.

Each file has three material names (`LiftSilver`, `LiftCobalt`, `LiftGraphite`), an orthographic 1:1 camera, and one `Idle` clip from 0 to 6 seconds. Only a subtle whole-object yaw is animated. The character's skinning is baked into this static derivative, so no skeleton is loaded for tiny icons. No texture, remote asset or raster picture is used at runtime.

Editable scenes and transparent review renders stay under `.local-release/workout-models/`. Review at full size and the app's 32 px slots; technical verification alone does not imply visual approval.
