"""Pose/crop the CC0 MPFB athlete into five real-human workout illustrations.
Run after generate-athlete.py; Blender 5.2 headless. Editable scenes stay local.
No exercise runtime animation is baked here: Idle only rotates the static illustration.
"""
import bpy,bmesh,math,json,subprocess,shutil
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/sport'; WORK=ROOT/'.local-release/workout-models'; WORK.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'.local-release/athlete/athlete-final.blend'
CWEBP=shutil.which('cwebp')
if not CWEBP:raise RuntimeError('Install the WebP cwebp encoder before generating workout icons')

def material(name,color,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True
 c=tuple((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in color)
 m.diffuse_color=(*c,1);p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0
 return m

def aim_bone(rig,name,target):
 p=rig.pose.bones[name];head=p.head.copy();old=p.tail-head;desired=Vector(target)-head
 turn=old.rotation_difference(desired);p.matrix=Matrix.Translation(head)@turn.to_matrix().to_4x4()@Matrix.Translation(-head)@p.matrix
 bpy.context.view_layer.update()

def limb(rig,first,middle,end,target,pole):
 a=rig.pose.bones[first];b=rig.pose.bones[middle];start=a.head.copy();u=a.length;l=b.length;d=Vector(target)-start;distance=max(abs(u-l)+.001,min(u+l-.001,d.length));d.normalize()
 normal=Vector(pole)-start;normal-=d*normal.dot(d);normal.normalize()
 along=(u*u-l*l+distance*distance)/(2*distance);height=math.sqrt(max(0,u*u-along*along));joint=start+d*along+normal*height
 aim_bone(rig,first,joint);aim_bone(rig,middle,start+d*distance)

def pose(rig,kind):
 for side,sign in [('l',1),('r',-1)]:
  if kind=='push':target=(sign*.26,-.44,1.43);pole=(sign*.55,-.06,1.20)
  elif kind=='pull':target=(sign*.26,-.12,1.31);pole=(sign*.40,.19,1.23)
  else:target=(sign*.33,-.16,1.13);pole=(sign*.40,-.02,1.29)
  limb(rig,'upperarm_'+side,'lowerarm_'+side,'hand_'+side,target,pole)
  if kind=='push':
   hand=rig.pose.bones['hand_'+side];index=rig.pose.bones['index_01_'+side].head;pinky=rig.pose.bones['pinky_01_'+side].head;middle=rig.pose.bones['middle_01_'+side].head
   across=(index-pinky).normalized();along=(middle-hand.head).normalized();along=(along-across*along.dot(across)).normalized()
   normal=across.cross(along).normalized();current=Matrix((across,along,normal)).transposed()
   across=Vector((-sign,0,0));along=Vector((0,0,1));desired=Matrix((across,along,across.cross(along))).transposed()
   delta=desired@current.inverted();head=hand.head.copy();hand.matrix=Matrix.Translation(head)@delta.to_4x4()@Matrix.Translation(-head)@hand.matrix;bpy.context.view_layer.update()
 if kind=='lower':
  pelvis=rig.pose.bones['pelvis'];matrix=pelvis.matrix.copy();matrix.translation.z-=.13;pelvis.matrix=matrix;bpy.context.view_layer.update()
  for side,sign in [('l',1),('r',-1)]:
   limb(rig,'thigh_'+side,'calf_'+side,'foot_'+side,(sign*.21,-.045,.08),(sign*.24,-.5,.52))
   aim_bone(rig,'foot_'+side,(sign*.215,-.20,.025))

def crop(obj,kind):
 bm=bmesh.new();bm.from_mesh(obj.data)
 low=kind in ['lower','legs'];height=.965 if kind=='lower' else 1.095 if low else 1.0
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,height),plane_no=(0,0,1),clear_inner=not low,clear_outer=low)
 cut=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-height)<.0001 for v in e.verts)]
 if cut:
  result=bmesh.ops.holes_fill(bm,edges=cut,sides=0)
  for face in result.get('faces',[]):face.material_index=2
 bm.to_mesh(obj.data);bm.free();obj.data.update()

def build(kind):
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE));scene=bpy.context.scene
 body=bpy.data.objects['SK_AthleteBody'];shorts=bpy.data.objects['SK_AthleteShorts'];rig=bpy.data.objects['SK_AthleteRig']
 # Remove disconnected arm/hand geometry from lower-body illustrations in bind space.
 if kind in ['lower','legs']:
  bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if abs(v.co.x)>.29],context='VERTS');bm.to_mesh(body.data);bm.free();body.data.update()
 pose(rig,kind)
 active={'upper':{'chest','lats','upperBack','frontDelts','rearDelts','sideDelts'},'push':{'chest','frontDelts','triceps'},'pull':{'lats','upperBack','rearDelts','biceps'},'lower':{'glutes','gluteMedius','quads','hamstrings','adductors','abductors','hams'},'legs':{'quads','hamstrings','calves','adductors','hams'}}[kind]
 mats=[material('LiftSilver',(.78,.80,.83),.44),material('LiftCobalt',(.157,.349,.91),.43),material('LiftGraphite',(.106,.118,.137),.72)]
 meshes=[]
 for obj in [body,shorts]:
  evalobj=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=bpy.data.meshes.new_from_object(evalobj,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
  old=[m.name for m in mesh.materials];indices=[]
  for p in mesh.polygons:
   name=old[p.material_index];region=name.removeprefix('M_Muscle_').removeprefix('M_Shorts_')
   indices.append(1 if region in active else 2 if name.startswith('M_Shorts') else 0)
  mesh.materials.clear()
  for mat in mats:mesh.materials.append(mat)
  for p,i in zip(mesh.polygons,indices):p.material_index=i;p.use_smooth=True
  new=bpy.data.objects.new('SM_Athlete_'+('Shorts' if obj==shorts else 'Body'),mesh);scene.collection.objects.link(new);crop(new,kind);meshes.append(new)
 for obj in [body,shorts,rig]:bpy.data.objects.remove(obj,do_unlink=True)
 # Lossless join. Collapse decimation moves anatomical material boundaries even
 # with a MATERIAL delimiter, so retain the source topology after cropping.
 bpy.ops.object.select_all(action='DESELECT')
 for obj in meshes:obj.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();human=meshes[0]
 for g in list(human.vertex_groups):human.vertex_groups.remove(g)
 art=bpy.data.objects.new('ArtRoot',None);scene.collection.objects.link(art)
 coords=[v.co for v in human.data.vertices];lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)));center=(lo+hi)*.5;scale=2/max(hi-lo)
 human.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-center));human.parent=art
 scene.name='Idle';scene.render.fps=60;scene.frame_start=0;scene.frame_end=360
 for frame,yaw in [(0,0),(90,math.radians(6)),(180,0),(270,math.radians(-6)),(360,0)]:
  art.rotation_euler=(0,0,yaw);art.keyframe_insert(data_path='rotation_euler',frame=frame)
 art.animation_data.action.name='Idle'
 scene.frame_set(0)
 camdata=bpy.data.cameras.new('IconCamera');camdata.type='ORTHO';cam=bpy.data.objects.new('IconCamera',camdata);scene.collection.objects.link(cam)
 cam.location=(2.0,6,2.0) if kind=='pull' else (1.4,-6,1.8) if kind=='push' else (2.4,-6,2.0)
 cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam;bpy.context.view_layer.update()
 projected=[cam.matrix_world.inverted()@human.matrix_world@v.co for v in human.data.vertices]
 camdata.ortho_scale=max(max(v[i] for v in projected)-min(v[i] for v in projected) for i in (0,1))/.83
 scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100
 for obj in scene.objects:obj.select_set(obj.type in {'MESH','EMPTY','CAMERA'})
 path=OUT/('workout-'+kind+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_materials='EXPORT',export_cameras=True,export_lights=False,export_skins=False,export_animations=True,export_animation_mode='SCENE',export_anim_scene_split_object=False,export_frame_range=True,export_frame_step=3,export_force_sampling=True,export_optimize_animation_size=True,export_texcoords=False,export_normals=True)
 # Studio lights are only for review images/blend, not part of the GLB.
 scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.3,.35,.45,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
 for name,loc,power,size in [('Key',(-3,-4,6),700,4),('Fill',(4,-2,2),300,3),('Rim',(0,3,4),850,3)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
 scene.view_settings.view_transform='AgX';scene.render.filepath=str(WORK/('workout-'+kind+'.png'));bpy.ops.render.render(write_still=True)
 subprocess.run([CWEBP,'-quiet','-q','92','-m','6','-exact',str(WORK/('workout-'+kind+'.png')),'-o',str(ROOT/'src/assets/sport'/('workout-'+kind+'.webp'))],check=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(WORK/('workout-'+kind+'.blend')))
 print('LIFT_WORKOUT_ICON',json.dumps({'name':kind,'bytes':path.stat().st_size,'vertices':len(human.data.vertices),'faces':len(human.data.polygons),'source':'CC0 MPFB athlete; static derived pose; cropped before export; anatomical boundaries retained'}))
for kind in ['upper','push','pull','lower','legs']:build(kind)
