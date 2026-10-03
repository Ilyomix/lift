"""Build Lift's CC0 MPFB athlete, skin/shorts, named anatomy and GameEngine GLB.
Run from repository root with Blender --background --factory-startup --python-exit-code 1.
See docs/assets/exercise-athlete.md for source revision, license and exact commands.
MPFB runs in this process only; no user preferences are saved.
"""
import sys, bpy, json
from pathlib import Path
root=Path.cwd()
sys.path.insert(0,str(root/'.local-release/tools/mpfb2/src'))
import addon_utils
original_extension_path=bpy.utils.extension_path_user
def extension_path(package, **kwargs):
    if package == 'mpfb':
        path=root/'.local-release/athlete/mpfb-user'
        path.mkdir(parents=True,exist_ok=True)
        return str(path)
    return original_extension_path(package, **kwargs)
bpy.utils.extension_path_user=extension_path
addon_utils.enable('mpfb', default_set=True)
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict()
macro.update({'age':0.5,'gender':1.0,'muscle':1.0,'weight':0.38,'height':0.58,'proportions':0.5})
body=HumanService.create_human(macro_detail_dict=macro)
for target,weight in [('torso/torso-muscle-pectoral-incr',.38),('torso/torso-muscle-dorsi-incr',.35),('stomach/stomach-tone-incr',.5),('arms/l-upperarm-shoulder-muscle-incr',.38),('arms/r-upperarm-shoulder-muscle-incr',.38),('arms/l-upperarm-muscle-incr',.22),('arms/r-upperarm-muscle-incr',.22),('legs/l-upperleg-muscle-incr',.28),('legs/r-upperleg-muscle-incr',.28)]:
    TargetService.load_target(body,str(root/'.local-release/tools/mpfb2/src/mpfb/data/targets'/(target+'.target.gz')),weight=weight)
rig=HumanService.add_builtin_rig(body,'game_engine')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'.local-release/athlete/athlete-source.blend'))


import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix
root=Path.cwd(); out=root/'.local-release/athlete'; out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(out/'athlete-source.blend'))
body=bpy.data.objects['Human']; rig=body.parent
bpy.context.view_layer.objects.active=body
# Freeze the MPFB phenotype without changing its rig weights.
body.modifiers['Armature'].show_viewport=False
bpy.context.view_layer.update()
evalbody=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
coords=[v.co.copy() for v in evalbody.data.vertices]
# MASK changes evaluated vertex count, so first evaluate only shape keys.
body.modifiers['Hide helpers'].show_viewport=False; bpy.context.view_layer.update()
coords=[v.co.copy() for v in body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices]
body.shape_key_clear()
for v,c in zip(body.data.vertices,coords): v.co=c
body.modifiers['Hide helpers'].show_viewport=True
bpy.ops.object.modifier_apply(modifier='Hide helpers')
body.modifiers['Armature'].show_viewport=True
body.name='SK_AthleteBody'; rig.name='SK_AthleteRig'
height=max(v.co.z for v in body.data.vertices)-min(v.co.z for v in body.data.vertices)
factor=1.82/height
body.data.transform(Matrix.Scale(factor,4)); rig.data.transform(Matrix.Scale(factor,4))
for v in body.data.vertices: v.co.z-=0 # source is grounded
for p in body.data.polygons: p.use_smooth=True
bpy.context.view_layer.update()
# Anatomical surface materials remain a single continuous weighted mesh.
def material(name,color,rough=.52,metal=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
 return m
skin=material('M_Skin',(0.29,.34,.4),.48)
body.data.materials.clear(); body.data.materials.append(skin)
# User-requested anonymous mannequin face, with no ocular geometry or facial relief.
# Retopology keeps the real body and existing GameEngine skeleton.
import runpy
runpy.run_path(str(root/'scripts/athlete-head.py'))['make_faceless_head'](body)
# Compression shorts are cut from the actual character topology, with same skin weights.
shorts=body.copy(); shorts.data=body.data.copy(); bpy.context.collection.objects.link(shorts); shorts.name='SK_AthleteShorts'
bm=bmesh.new(); bm.from_mesh(shorts.data)
lo=.775; hi=1.075
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z < lo or v.co.z > hi or abs(v.co.x) > .255],context='VERTS')
for v in bm.verts:
 if v.is_boundary: v.co.z=lo if v.co.z<(lo+hi)/2 else hi
bm.normal_update()
for v in bm.verts: v.co+=v.normal*.009
bm.to_mesh(shorts.data); bm.free(); shorts.data.update()
shorts.data.materials.clear(); shorts.data.materials.append(material('M_Shorts',(.009,.025,.06),.92))
bpy.context.view_layer.objects.active=shorts
solid=shorts.modifiers.new('Cloth thickness','SOLIDIFY'); solid.thickness=.002; solid.offset=0
bpy.ops.object.modifier_apply(modifier=solid.name)
for p in shorts.data.polygons: p.use_smooth=True
# Save clean editable asset before adding presentation-only light/camera objects.
bpy.ops.wm.save_as_mainfile(filepath=str(out/'athlete-rigged.blend'))
# Studio preview: frontal three-quarter plus back.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.resolution_x=1000; scene.render.resolution_y=1300; scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18); scene.view_settings.view_transform='AgX'
def aim(obj,p):obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,location,power,size in [('Key',(-3,-4,5),650,2.5),('Fill',(3,-2,2),160,3),('Rim',(0,3,3),500,3)]:
 bpy.ops.object.light_add(type='AREA',location=location); light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shape='DISK'; light.data.size=size; aim(light,(0,0,1))
bpy.ops.object.camera_add(location=(2,-6,2.4)); camera=bpy.context.object; camera.data.type='ORTHO'; camera.data.ortho_scale=2.2; aim(camera,(0,0,.92)); scene.camera=camera
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(out/'athlete-front.png'); bpy.ops.render.render(write_still=True)
camera.location=(2,6,2.4); aim(camera,(0,0,.92)); scene.render.filepath=str(out/'athlete-back.png'); bpy.ops.render.render(write_still=True)
print('LIFT_STAGE',json.dumps({'height':height*factor,'factor':factor,'bodyVerts':len(body.data.vertices),'shortsVerts':len(shorts.data.vertices),'rigBones':len(rig.data.bones)}))


import bpy, bmesh, json, math, struct
from pathlib import Path
from mathutils import Vector
root=Path.cwd(); out=root/'.local-release/athlete'; public=root/'public/models/exercise'; public.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(out/'athlete-rigged.blend'))
body=bpy.data.objects['SK_AthleteBody']; shorts=bpy.data.objects['SK_AthleteShorts']; rig=bpy.data.objects['SK_AthleteRig']
# Refine only upper-torso faces for smooth anatomical tint boundaries.
bm=bmesh.new(); bm.from_mesh(body.data)
edges=[e for e in bm.edges if all(1.24<v.co.z<1.55 and abs(v.co.x)<.31 for v in e.verts)]
bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
bm.to_mesh(body.data);bm.free();body.data.update()
names=['chest','lats','upperBack','lowerBack','frontDelts','sideDelts','rearDelts','biceps','triceps','forearms','abs','obliques','glutes','gluteMedius','quads','hamstrings','adductors','calves']
base=body.data.materials[0]
for name in names:
 mat=base.copy(); mat.name='M_Muscle_'+name; body.data.materials.append(mat)
indices={name:i+1 for i,name in enumerate(names)}
# Regions classify actual surface faces in the MPFB rest anatomy, not training-volume weights.
# Body remains continuous; independent material primitives permit target/assistant tinting.
CHEST_OUTLINE=[(.015,1.49),(.10,1.49),(.185,1.455),(.197,1.415),(.166,1.365),(.10,1.345),(.020,1.36)]
def inside_polygon(x,z,points):
 inside=False
 for i,(ax,az) in enumerate(points):
  bx,bz=points[i-1]
  if (az>z)!=(bz>z) and x<(bx-ax)*(z-az)/(bz-az)+ax:inside=not inside
 return inside
def region(poly):
 c=poly.center; x=abs(c.x); y=c.y; z=c.z; front=poly.normal.y < -.18
 groups={}
 for idx in poly.vertices:
  for g in body.data.vertices[idx].groups:
   name=body.vertex_groups[g.group].name
   if name in rig.data.bones: groups[name]=groups.get(name,0)+g.weight
 dominant=max(groups,key=groups.get) if groups else ''
 if dominant.startswith(('hand','index','middle','pinky','ring','thumb','foot','ball')) or z>1.57:return None
 if dominant.startswith('lowerarm'):return 'forearms'
 if dominant.startswith('upperarm') or (dominant.startswith('clavicle') and x>.185):
  shoulder=rig.data.bones['upperarm_l' if c.x>0 else 'upperarm_r'].head_local
  if (c-shoulder).length<.135 and x>.18:
   return 'frontDelts' if poly.normal.y<-.4 else ('rearDelts' if poly.normal.y>.4 else 'sideDelts')
  if dominant.startswith('upperarm') and z<shoulder.z-.045:return 'biceps' if front else 'triceps'
  return None
 if dominant.startswith('calf'):return 'calves' if z>.15 and (poly.normal.y>.05 or abs(poly.normal.x)>.78) else None
 if dominant.startswith('thigh'):
  if z>.9 and y>.025:return 'glutes'
  axis=rig.data.bones['thigh_l' if c.x>0 else 'thigh_r'].head_local
  if x<abs(axis.x)-.025 and z>.63:return 'adductors'
  return 'quads' if front else 'hamstrings'
 if z<1.08:
  if y>.03:return 'glutes'
  if x>.15:return 'gluteMedius'
  return None
 if front:
  # Pectoral lower edge follows the curved chest contour instead of a flat band.
  if inside_polygon(x,z,CHEST_OUTLINE) and y<-.035:return 'chest'
  if 1.09<z<1.32:return 'abs' if x<.09 else 'obliques'
  return None
 if y>.0:
  if z>1.37:return 'upperBack'
  if z>1.15:return 'lats' if x>.065 else 'upperBack'
  return 'lowerBack'
 if 1.1<z<1.32:return 'obliques'
 return None
# Cut the continuous skin on the pectoral outline before classifying faces.
# Centroid-only tinting makes a staircase; these exact surface cuts preserve all
# original coordinates and interpolate weights only at the new edge vertices.
bm=bmesh.new();bm.from_mesh(body.data)
for sign in [-1,1]:
 for k,(ax,az) in enumerate(CHEST_OUTLINE):
  bx,bz=CHEST_OUTLINE[k-1];ax*=sign;bx*=sign
  patch=[f for f in bm.faces if 1.32<f.calc_center_median().z<1.52 and abs(f.calc_center_median().x)<.22 and f.calc_center_median().y<-.025]
  geom=set(patch)
  for f in patch:geom.update(f.edges);geom.update(f.verts)
  bmesh.ops.bisect_plane(bm,geom=list(geom),dist=1e-7,plane_co=Vector((ax,0,az)),plane_no=Vector((bz-az,0,ax-bx)),clear_inner=False,clear_outer=False)
bm.normal_update();bm.to_mesh(body.data);bm.free()
body.data.update()
counts={name:0 for name in names}
for poly in body.data.polygons:
 name=region(poly)
 if name:poly.material_index=indices[name]; counts[name]+=1
# Opaque fabric carries anatomical tint regions without revealing underlying body.
short_regions=['glutes','abductors','quads','hams','adductors']
for name in short_regions:
 mat=shorts.data.materials[0].copy();mat.name='M_Shorts_'+name;shorts.data.materials.append(mat)
short_counts={name:0 for name in short_regions}
shorts.data.update()
for poly in shorts.data.polygons:
 c=poly.center; n=poly.normal; x=abs(c.x); z=c.z
 name=None
 if abs(n.x)>.65 and x>.14 and z>.91:name='abductors'
 elif n.y>.1:name='glutes' if z>.88 else 'hams'
 elif n.y<-.1 and z<.96:name='adductors' if x<.08 else 'quads'
 if name:poly.material_index=short_regions.index(name)+1;short_counts[name]+=1
# Select only exportable character. Stage cameras never enter GLB.
bpy.ops.object.select_all(action='DESELECT')
for obj in [body,shorts,rig]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
rig['assetLicense']='CC0-1.0'; rig['assetSource']='MakeHuman / MPFB core assets'; rig['heightMeters']=1.82
bpy.ops.wm.save_as_mainfile(filepath=str(out/'athlete-final.blend'))
bpy.ops.export_scene.gltf(filepath=str(public/'athlete.glb'),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_animations=False,export_skins=True,export_all_influences=False,export_extras=True)
def xyz(v):return [round(v.x,7),round(v.z,7),round(-v.y,7)]
def limbs(side):return {'clavicle':'clavicle_'+side,'upperArm':'upperarm_'+side,'forearm':'lowerarm_'+side,'hand':'hand_'+side,'thigh':'thigh_'+side,'shin':'calf_'+side,'foot':'foot_'+side,'toe':'ball_'+side,'fingers':{finger:[finger+'_'+str(i).zfill(2)+'_'+side for i in [1,2,3]] for finger in ['thumb','index','middle','ring','pinky']},'palmLandmarks':{'index':'index_01_'+side,'middle':'middle_01_'+side,'pinky':'pinky_01_'+side}}
used={k:['M_Muscle_'+k] for k,v in counts.items() if v}
used['hams']=used.pop('hamstrings'); used['abductors']=used.pop('gluteMedius')
skin_materials=['M_Skin']+[m for names in used.values() for m in names]
for name in short_regions:
 if short_counts[name]:used[name].append('M_Shorts_'+name)
contract={'version':1,'forwardAxis':'+Z','upAxis':'+Y','heightMeters':1.82,'restPose':'MakeHuman relaxed A-pose; use measured bind transforms, not assumed local axes','bones':{'root':'Root','pelvis':'pelvis','spine':['spine_01','spine_02','spine_03'],'neck':'neck_01','head':'head','left':limbs('l'),'right':limbs('r')},'muscleMaterials':used,'skinMaterials':skin_materials,'shortsMaterials':['M_Shorts']+['M_Shorts_'+name for name in short_regions if short_counts[name]],'restLandmarks':{b.name:{'head':xyz(b.head_local),'tail':xyz(b.tail_local),'parent':b.parent.name if b.parent else None} for b in rig.data.bones},'source':{'project':'MakeHuman / MPFB','commit':'afb9f530a7c2741dedb8df0ebae2e0b183caec21','license':'CC0-1.0','url':'https://github.com/makehumancommunity/mpfb2'}}
(public/'athlete.rig.json').write_text(json.dumps(contract,indent=2)+'\n')
# Verify serialized bone/material names exist rather than trusting Blender names.
raw=(public/'athlete.glb').read_bytes(); n=struct.unpack_from('<I',raw,12)[0]; gltf=json.loads(raw[20:20+n]); nodes={n.get('name') for n in gltf['nodes']}; mats={m['name'] for m in gltf['materials']}
assert all(b.name in nodes for b in rig.data.bones)
assert all(m in mats for m in contract['skinMaterials']+contract['shortsMaterials'])
assert len(gltf['skins'])>=1 and all(len(s['joints'])==53 for s in gltf['skins'])
report={'glbBytes':len(raw),'boneCount':53,'bodyVertices':len(body.data.vertices),'shortsVertices':len(shorts.data.vertices),'surfaceFaceCounts':counts,'materials':sorted(mats),'skins':len(gltf['skins'])}
(out/'athlete-validation.json').write_text(json.dumps(report,indent=2)+'\n'); print('LIFT_EXPORT',json.dumps(report))
