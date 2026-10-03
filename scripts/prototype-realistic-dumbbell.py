"""One local fidelity prototype. Does not replace public production models."""
import bpy
import importlib.util
import sys
from pathlib import Path

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('lift_models',ROOT/'scripts/generate-sport-models.py')
base=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.OUT=base.WORK=ROOT/'.local-release/sport-models/realistic-v2'

# The accepted object geometry and physical materials have one source of truth.
base.build('dumbbell')
scene=bpy.context.scene
scene.cycles.samples=96
scene.render.resolution_x=scene.render.resolution_y=768
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.25,.28,.33,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.28
lighting={'Key':(850,3.8),'Fill':(190,4),'Rim':(1000,2.5)}
for name,(power,size) in lighting.items():
    bpy.data.lights[name].energy=power
    bpy.data.lights[name].size=size
scene.view_settings.exposure=-.25
scene.render.filepath=str(base.WORK/'dumbbell-studio.png')
bpy.ops.wm.save_as_mainfile(filepath=str(base.WORK/'dumbbell.blend'))
bpy.ops.render.render(write_still=True)
