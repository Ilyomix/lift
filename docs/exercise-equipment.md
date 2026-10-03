# Exercise equipment

Lift uses locally authored equipment geometry around the bundled faceless athlete. The equipment shares graphite padding, steel frames and theme-aware ropes. Human asset provenance remains in [Exercise athlete](assets/exercise-athlete.md).

## Asset search, 3 October 2026

The search found downloadable gym models, but no verified drop-in articulated pec deck matching the existing athlete and lightweight runtime:

- [Gym Lat Pulldown by neilken](https://sketchfab.com/3d-models/gym-lat-pulldown-50fb1df222e6468f9d7ada63c45d673d): the indexed publisher listing advertises CC Attribution and about 34,400 triangles. The direct viewer was unavailable; hierarchy and animation were not inspected.
- [Gym Machine — Body Solid](https://sketchfab.com/3d-models/gym-machine--body-solid-4d1d0fb6879f42a9bccf1666a752c276): a generic multifunction machine advertised under CC Attribution, about 18,000 triangles. Its fit for the pec deck and press motions was not established.
- [Wall-Mounted Lat Pulldown](https://www.blendkit.com/asset-gallery-detail/84796dce-4306-42d3-b5d4-a2725d9588f3/): CC0 listing, 41,854 polygons, available through a paid BlenderKit plan. Not a free downloadable rigged glTF.

[Sketchfab supports glTF downloads](https://sketchfab.com/features/gltf), but format availability does not establish usable joints, correct body clearance or suitable exercise motion. None of these files was downloaded, purchased or incorporated. The corrections keep the authored geometry and repair its pivots, supports and contact trajectories; no new third-party attribution is required.

## Contact verification

Tests load the shipped GLB and deform its actual skinned vertices across sampled movement phases. They inspect the equipment's transformed solid geometry, rather than checking only bone centres. Intended hand contacts and shallow pad compression are handled explicitly. Existing motion tests also check limb reach, fixed supports and repeatable loop endpoints.

The checks also constrain the corrected exercise postures: knee flexion toward the torso at the leg press, a small bend at extension, and nearly extended arms for fly movements and the top of a pulldown. Seat and footplate proximity checks prevent solving penetrations by leaving the athlete suspended above a support. Rigid machine links keep a fixed length and pivot; ropes may change their span.

Run `npm test` and `npm run build`. Then inspect the actual exercise sheet at its starting, intermediate and ending poses, from the technique view and a side view, in both themes. The free rotation controls should expose the same geometry without a stale second body underneath it. The committed [renderer fixture](../tests/fixtures/exercise-renderer.html) exercises the shared-canvas handoff separately.

These checks are regression guards, not a physics simulation or a certification of exercise technique. They sample time and vertices; visual review from several angles remains necessary, particularly at the start and end of each motion.
