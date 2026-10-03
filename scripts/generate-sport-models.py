"""Original Lift 3D props. Run with Blender, not ordinary Python.

blender -b --factory-startup --python scripts/generate-sport-models.py -- dumbbell stopwatch
Models: public/models/sport. Editable scenes and review renders: .local-release/sport-models.
One Blender unit is one meter; these are normalized illustration props, not physical products.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models/sport"
WORK = ROOT / ".local-release/sport-models"
FPS = 60
END = 361
MAT = {}
GEOMETRY = None


def linear(channel):
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4


def material(name, hex_color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    color = tuple(linear(int(hex_color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)
    mat.diffuse_color = color
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = color
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    return mat


def empty(name, parent=None, loc=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    return obj


def finish(obj, name, mat, bevel=0, smooth=True, parent=None):
    obj.name = "SM_" + name
    obj.data.name = obj.name + "_Mesh"
    obj.data.materials.clear()
    obj.data.materials.append(MAT[mat])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new("EdgeBevel", 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        mod = obj.modifiers.new("WeightedNormals", 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.parent = parent or GEOMETRY
    obj.select_set(False)
    return obj


def box(name, loc, dims, mat='LiftGraphite', bevel=.045, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    return finish(obj, name, mat, bevel, parent=parent)


def cylinder(name, loc, radius, depth, mat='LiftSilver', axis='Y', vertices=40, bevel=.025, parent=None):
    rotation = {'X': (0, math.pi/2, 0), 'Y': (math.pi/2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, mat, bevel, parent=parent)


def sphere(name, loc, scale, mat='LiftCobalt', parent=None, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8,segments//2), radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat, parent=parent)


def torus(name, loc, major, minor, mat='LiftSilver', axis='Y', parent=None):
    rotation = {'X': (0, math.pi/2, 0), 'Y': (math.pi/2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=8, major_radius=major, minor_radius=minor, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, mat, parent=parent)


def line(name, points, radius=.035, mat='LiftSilver', parent=None):
    curve = bpy.data.curves.new(name + "Curve", 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_u = 1
    poly = curve.splines.new('POLY')
    poly.points.add(len(points)-1)
    for point, co in zip(poly.points, points):
        point.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, mat, parent=parent)


def animate(obj, prop, values, linear_motion=False):
    for frame, value in values:
        setattr(obj, prop, value)
        obj.keyframe_insert(data_path=prop, frame=frame-1)
    obj.animation_data.action.name = obj.name + "Action"
    for layer in obj.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR' if linear_motion else 'BEZIER'
                        key.handle_left_type = 'AUTO_CLAMPED'
                        key.handle_right_type = 'AUTO_CLAMPED'


def mesh(name, verts, faces, mat='LiftGraphite', bevel=0, parent=None):
    data = bpy.data.meshes.new(name+'Mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, bevel, parent=parent)


def annulus(name, outer, inner, depth, mat='LiftGraphite', teeth=0):
    count = 48
    verts = []
    for y, inner_ring in [(-depth/2, False), (-depth/2, True), (depth/2, False), (depth/2, True)]:
        for i in range(count):
            radius = inner if inner_ring else outer * (1.12 if teeth and i%4 in (1,2) else 1)
            a = math.tau*i/count
            verts.append((radius*math.sin(a), y, radius*math.cos(a)))
    faces = []
    for a,b in [(0,1),(2,0),(1,3),(3,2)]:
        for i in range(count):
            j=(i+1)%count
            faces.append((a*count+i,a*count+j,b*count+j,b*count+i))
    return mesh(name, verts, faces, mat, bevel=.016)


def badge(name, points, y, depth, mat='LiftSilver', parent=None):
    count=len(points)
    verts=[(x, y+d, z) for d in (-depth/2,depth/2) for x,z in points]
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    return mesh(name,verts,faces,mat,bevel=.01,parent=parent)


def dumbbell():
    # A lightly contoured machined steel grip, with actual crossed knurl ridges.
    profile=[(-.68,.103),(-.59,.117),(-.43,.139),(-.28,.146),(.28,.146),(.43,.139),(.59,.117),(.68,.103)]
    verts=[];faces=[];segments=48
    for x,r in profile:
        for i in range(segments):
            a=i*math.tau/segments
            verts.append((x,r*math.sin(a),r*math.cos(a)))
    for j in range(len(profile)-1):
        for i in range(segments):
            n=(i+1)%segments
            faces.append((j*segments+i,j*segments+n,(j+1)*segments+n,(j+1)*segments+i))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range((len(profile)-1)*segments,len(profile)*segments)))
    mesh('MachinedHandle',verts,faces,'LiftSilver')
    knurl_verts=[];knurl_faces=[];steps=24
    for direction in [-1,1]:
        for ridge in range(14):
            offset=len(knurl_verts)
            for j in range(steps+1):
                x=-.40+.80*j/steps
                radius=.146-.007*max(0,(abs(x)-.28)/.12)
                angle=ridge*math.tau/14+direction*(x+.4)/.8*math.tau*.9
                for da,dr in [(-.035,0),(0,.0045),(.035,0)]:
                    knurl_verts.append((x,(radius+dr)*math.sin(angle+da),(radius+dr)*math.cos(angle+da)))
            for j in range(steps):
                for k in range(2):
                    a=offset+j*3+k
                    knurl_faces.append((a,a+1,a+4,a+3))
    mesh('DiamondKnurl',knurl_verts,knurl_faces,'LiftSilver')
    for side,tag in [(-1,'Left'),(1,'Right')]:
        cylinder(tag+'SteelShoulder',(side*.646,0,0),.205,.15,'LiftSilver',axis='X',vertices=48,bevel=.023)
        cylinder(tag+'Seat',(side*.726,0,0),.242,.060,'LiftSilver',axis='X',vertices=48,bevel=.012)
        cylinder(tag+'RubberHead',(side*1.037,0,0),.58,.615,'LiftGraphite',axis='X',vertices=6,bevel=.066)
        cylinder(tag+'PaintedInset',(side*1.351,0,0),.438,.018,'LiftCobalt',axis='X',vertices=6,bevel=.010)
        for i in range(2):
            torus(tag+'CollarGroove'+str(i),(side*(.627+i*.03),0,0),.204,.003,'LiftGraphite',axis='X')
    GEOMETRY.rotation_euler.y=-.56


def stopwatch():
    cylinder('Case', (0, .02, -.05), .91, .3, 'LiftGraphite', bevel=.06)
    cylinder('BlueBezel', (0, -.155, -.05), .89, .08, 'LiftCobalt', bevel=.025)
    cylinder('Dial', (0, -.204, -.05), .763, .023, 'LiftInk', bevel=.009)
    torus('DialRim', (0, -.224, -.05), .775, .013)
    for i in range(36):
        a = i * math.tau / 36
        obj = box(f'Tick{i:02}', (.681*math.sin(a), -.239, -.05+.681*math.cos(a)), (.025 if i%3 else .033, .014, .057 if i%3 else .099), 'LiftSilver', bevel=0)
        obj.rotation_euler.y = a
    pivot = empty('SecondHandPivot', GEOMETRY, (0, -.266, -.05))
    hand = box('SecondHand', (0, 0, .245), (.041, .033, .59), 'LiftCobalt', bevel=.012, parent=pivot)
    cylinder('HandPin', (0, -.295, -.05), .08, .048, 'LiftSilver', vertices=24, bevel=.009)
    cylinder('TopStem', (0, 0, .95), .12, .2, 'LiftGraphite', axis='Z', vertices=24)
    cylinder('TopButton', (0, 0, 1.085), .215, .15, 'LiftSilver', axis='Z', vertices=32)
    for side in [-1, 1]:
        obj = cylinder('SideButton'+str(side), (side*.72, .015, .62), .115, .18, 'LiftSilver', axis='Z', vertices=24)
        obj.rotation_euler.y = side*.65
    animate(pivot, 'rotation_euler', [(1, (0, -.3, 0)), (END, (0, -.3-math.tau, 0))], True)


def plate():
    annulus('OuterPlate',1,.69,.27)
    annulus('InnerPlate',.56,.18,.24)
    for i in range(3):
        a=i*math.tau/3
        obj=box('PlateSpoke'+str(i),(.61*math.sin(a),0,.61*math.cos(a)),(.39,.24,.46),bevel=.045)
        obj.rotation_euler.y=a
    torus('CobaltOuterLip',(0,-.153,0),.935,.033,'LiftCobalt')
    torus('SilverBore',(0,-.146,0),.198,.029,'LiftSilver')
    torus('BoreRear',(0,.146,0),.198,.022,'LiftSilver')


def calendar():
    box('CalendarBody',(0,0,0),(1.62,.27,1.75),bevel=.11)
    box('CalendarHeader',(0,-.04,.64),(1.64,.3,.43),'LiftCobalt',bevel=.09)
    page=empty('PageHinge',GEOMETRY,(0,-.18,.42))
    box('CalendarPage',(0,0,-.55),(1.46,.065,1.07),'LiftGraphite',bevel=.035,parent=page)
    for row in range(3):
        for col in range(3):
            x,z=(col-1)*.44,-.2-row*.33
            box(f'Day{row}{col}',(x,-.061,z),(.36,.041,.25),'LiftInk',bevel=.025,parent=page)
            if (row,col) in [(0,0),(1,2),(2,1)]:
                line(f'Check{row}{col}',[(x-.085,-.096,z),(x-.025,-.096,z-.06),(x+.10,-.096,z+.066)],.025,'LiftCobalt',parent=page)
    for x in [-.48,.48]:
        torus('Binder'+str(x),(x,0,.9),.175,.055,'LiftSilver',axis='X')
    animate(page,'rotation_euler',[(1,(0,0,0)),(91,(-.10,0,0)),(181,(0,0,0)),(END,(0,0,0))])


def chart():
    box('ChartBase',(0,0,-.84),(1.85,.67,.19),'LiftSilver',bevel=.06)
    for i,h in enumerate([.55,.95,1.4]):
        pivot=empty('BarPivot'+str(i),GEOMETRY,((i-1)*.55,0,-.74))
        box('Bar'+str(i),(0,0,h/2),(.39,.40,h),'LiftGraphite',bevel=.035,parent=pivot)
        box('BarCap'+str(i),(0,-.015,h-.012),(.4,.42,.1),'LiftCobalt',bevel=.022,parent=pivot)
        animate(pivot,'scale',[(1,(1,1,1)),(91+i*20,(1,1,.90)),(211+i*20,(1,1,1.03)),(END,(1,1,1))])
    line('Rise',[(-.85,-.30,.05),(-.3,-.30,.4),(.18,-.30,.46),(.8,-.30,.99)],.065,'LiftCobalt')
    badge('ArrowHead',[(.47,.96),(.91,1.12),(.84,.69)],-.3,.12,'LiftCobalt')


def nutrition():
    MAT['LiftCobalt'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.55
    # Broad shoulders, tapered base and a recessed calyx distinguish an apple
    # from a sphere even at 32px. Five subtle lobes remain part of the skin.
    profile=[(0,-.66),(.16,-.73),(.36,-.70),(.55,-.54),(.69,-.25),
             (.79,.08),(.82,.35),(.74,.57),(.54,.66),(.28,.61),(.10,.49),(0,.47)]
    curve=[]
    for j in range(len(profile)-1):
        p0=profile[max(0,j-1)]; p1=profile[j]
        p2=profile[j+1]; p3=profile[min(len(profile)-1,j+2)]
        for k in range(4):
            t=k/4
            curve.append(tuple(.5*((2*p1[a])+(-p0[a]+p2[a])*t+
                (2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t*t+
                (-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t*t*t) for a in range(2)))
    curve.append(profile[-1])
    verts=[]; faces=[]; seg=48
    for radius,height in curve:
        for i in range(seg):
            a=math.tau*i/seg
            r=max(0,radius)*(1+.025*math.cos(5*a))
            z=height+.025*math.cos(5*a)*min(1,radius*3)*max(0,abs(height)-.15)
            verts.append((r*math.cos(a),r*math.sin(a)*.88,z))
    for j in range(len(curve)-1):
        for i in range(seg):
            n=(i+1)%seg
            faces.append((j*seg+i,j*seg+n,(j+1)*seg+n,(j+1)*seg+i))
    mesh('AppleBody',verts,faces,'LiftCobalt')
    # A leaf hinge reads at 32px; yaw on the symmetric fruit barely registers.
    leaf_pivot=empty('AppleLeafPivot',GEOMETRY,(.065,.01,.83))
    line('AppleStem',[(0,0,.47),(.015,0,.67),(.06,.005,.84),(.12,.015,.96)],.043,'LiftGraphite')
    verts=[]; faces=[]
    for j in range(17):
        t=j/16; width=.18*math.sin(math.pi*t)**.85
        for side in [-1,0,1]:
            verts.append((.66*t,side*width,.24*t+.12*math.sin(math.pi*t)-.07*abs(side)*math.sin(math.pi*t)))
    for j in range(16):
        for side in range(2):
            a=j*3+side; faces.append((a,a+1,a+4,a+3))
    leaf=mesh('AppleLeaf',verts,faces,'LiftSilver',parent=leaf_pivot)
    solid=leaf.modifiers.new('LeafThickness','SOLIDIFY'); solid.thickness=.015
    bpy.context.view_layer.objects.active=leaf
    bpy.ops.object.modifier_apply(modifier=solid.name)
    line('LeafVein',[(.005+.64*t,-.003,.003+.24*t+.12*math.sin(math.pi*t)) for t in [j/12 for j in range(13)]],.009,'LiftGraphite',parent=leaf_pivot)
    animate(leaf_pivot,'rotation_euler',[
        (1,(0,0,0)),(91,(0,math.radians(-14),0)),(181,(0,0,0)),
        (271,(0,math.radians(10),0)),(END,(0,0,0))])


def settings():
    annulus('Gear',.9,.39,.3,teeth=12)
    torus('GearBlueRing',(0,-.166,0),.7,.06,'LiftCobalt')
    torus('GearSilverBore',(0,-.164,0),.4,.034,'LiftSilver')
    animate(GEOMETRY,'rotation_euler',[(1,(0,0,0)),(END,(0,math.tau,0))],True)


def backup():
    box('ArchiveBody',(0,0,-.14),(1.5,.99,1.35),bevel=.11)
    lid=empty('LidHinge',GEOMETRY,(0,.51,.58))
    box('ArchiveLid',(0,-.51,0),(1.60,1.10,.26),'LiftCobalt',bevel=.07,parent=lid)
    box('ArchiveLatch',(0,-1.079,-.08),(.48,.07,.24),'LiftSilver',bevel=.035,parent=lid)
    badge('ArchiveArrow',[(-.12,.17),(.12,.17),(.12,-.14),(.30,-.14),(0,-.44),(-.30,-.14),(-.12,-.14)],-.517,.05)
    animate(lid,'rotation_euler',[(1,(0,0,0)),(121,(-.15,0,0)),(211,(-.15,0,0)),(END,(0,0,0))])


def coach():
    sphere('WhistleChamber',(-.28,0,0),(.64,.4,.51),'LiftGraphite')
    box('Mouthpiece',(.52,0,.02),(1.0,.60,.31),'LiftCobalt',bevel=.075)
    box('MouthOpening',(1.024,-.002,.02),(.013,.41,.13),'LiftInk',bevel=.015)
    box('AirSlot',(.18,-.02,.342),(.28,.35,.025),'LiftInk',bevel=.025)
    torus('WhistleLoop',(-.93,0,.05),.19,.047,'LiftSilver',axis='X')
    torus('ChamberDetail',(-.3,-.355,0),.275,.019,'LiftSilver')
    GEOMETRY.rotation_euler.y=-.18


def trophy():
    box('TrophyBase',(0,0,-.94),(1.10,.79,.21),'LiftGraphite',bevel=.065)
    box('BaseTrim',(0,0,-.805),(.86,.63,.06),'LiftSilver',bevel=.02)
    cylinder('TrophyStem',(0,0,-.53),.17,.52,'LiftSilver',axis='Z',vertices=24)
    cup=empty('CupPivot',GEOMETRY)
    profile=[(.15,-.3),(.27,-.12),(.47,.19),(.65,.56),(.69,.77),(.63,.80),(.60,.58),(.41,.22),(.2,-.08),(.13,-.13)]
    verts=[];faces=[];seg=32
    for r,z in profile:
        for i in range(seg):
            a=i*math.tau/seg
            verts.append((r*math.cos(a),r*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(seg):
            k=(i+1)%seg;faces.append((j*seg+i,j*seg+k,(j+1)*seg+k,(j+1)*seg+i))
    mesh('Cup',verts,faces,'LiftCobalt',parent=cup)
    torus('CupRim',(0,0,.785),.659,.025,'LiftSilver',axis='Z',parent=cup)
    for side in [-1,1]:
        line('Handle'+str(side),[(side*.58,0,.57),(side*.93,0,.63),(side*1.04,0,.40),(side*.92,0,.10),(side*.31,0,-.04)],.073,'LiftSilver',parent=cup)
    animate(cup,'rotation_euler',[(1,(0,0,0)),(91,(0,0,.12)),(181,(0,0,0)),(271,(0,0,-.12)),(END,(0,0,0))])


def merge_static_meshes():
    """Lossless batching: never cross a material boundary or animated pivot."""
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    original_vertices=sum(len(obj.data.vertices) for obj in meshes)
    original_faces=sum(len(obj.data.polygons) for obj in meshes)
    groups={}
    for obj in meshes:
        if obj.animation_data is not None:
            continue
        key=(obj.parent,tuple(mat.name for mat in obj.data.materials))
        groups.setdefault(key,[]).append(obj)
    for (parent,materials),objects in groups.items():
        if len(objects)<2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        joined=bpy.context.object
        joined.name='SM_'+(parent.name if parent else 'Root')+'_'+materials[0]
        joined.data.name=joined.name+'_Mesh'
        joined.select_set(False)
    result=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    assert sum(len(obj.data.vertices) for obj in result)==original_vertices
    assert sum(len(obj.data.polygons) for obj in result)==original_faces
    return len(meshes),len(result)


MODELS = {'dumbbell': dumbbell, 'plate':plate, 'stopwatch': stopwatch, 'calendar':calendar,
          'chart':chart,'nutrition':nutrition,'settings':settings,'backup':backup,'coach':coach,'trophy':trophy}


def build(name):
    global GEOMETRY, MAT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'Idle'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 0, END-1
    # glTF camera xmag/ymag derive from render aspect at EXPORT time.
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    MAT = {name: material(name, color, metallic, roughness) for name, color, metallic, roughness in [
        ('LiftGraphite', '1B1E23', 0, .61), ('LiftCobalt', '2859E8', 0, .34),
        ('LiftSilver', 'C7CCD2', 1, .24), ('LiftInk', '101216', 0, .7)]}
    art = empty('ArtRoot')
    GEOMETRY = empty('ModelGeometry', art)
    MODELS[name]()
    scene.frame_set(0)
    bpy.context.view_layer.update()
    before_merge,after_merge=merge_static_meshes()
    meshes = [obj for obj in scene.objects if obj.type == 'MESH']
    # Actual vertices avoid inflated bounds from a rotated, merged mesh AABB.
    corners = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    low = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center = (low+high)*.5
    scale = 2 / max(high-low)
    GEOMETRY.location = -center * scale
    GEOMETRY.scale = (scale,)*3
    if name != 'nutrition':
        yaw = math.radians(7)
        animate(art, 'rotation_euler', [(1, (0, 0, 0)), (91, (0, 0, yaw)), (181, (0, 0, 0)), (271, (0, 0, -yaw)), (END, (0, 0, 0))])
    scene.frame_set(0)
    cam_data = bpy.data.cameras.new('IconCamera')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('IconCamera', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (3, -6, 2.7)
    cam.rotation_euler = (-cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    bpy.context.view_layer.update()
    inverse = cam.matrix_world.inverted()
    projected = [inverse @ obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    cam_data.ortho_scale = max(max(v[i] for v in projected)-min(v[i] for v in projected) for i in (0, 1)) / .80
    cam_data.lens = 50
    # Only constant PBR inputs, so all four material names remain runtime-themeable.
    for mat in MAT.values():
        assert {node.type for node in mat.node_tree.nodes} == {'BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'}
    for obj in scene.objects:
        obj.select_set(obj.type in {'MESH', 'EMPTY', 'CAMERA'})
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    path = OUT / (name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=False,
        export_yup=True, export_materials='EXPORT', export_cameras=True, export_lights=False,
        export_animations=True, export_animation_mode='SCENE', export_anim_scene_split_object=False, export_frame_range=True,
        export_frame_step=3, export_force_sampling=True, export_optimize_animation_size=True,
        export_texcoords=False, export_normals=True,
        export_draco_mesh_compression_enable=False)
    # Transparent studio renders are QA only; the app uses the actual GLB geometry.
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('StudioWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.4,.45,.55,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .45
    for light_name, loc, power, size in [('Key', (-3,-4,6), 700, 4), ('Fill', (4,-2,2), 450, 3), ('Rim', (0,3,4), 850, 3)]:
        data = bpy.data.lights.new(light_name, 'AREA')
        data.energy, data.shape, data.size = power, 'DISK', size
        obj = bpy.data.objects.new(light_name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / (name+'.blend')))
    scene.render.filepath = str(WORK / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    record = {'name': name, 'bytes': path.stat().st_size, 'meshes': len(meshes), 'meshBatching': {'before':before_merge,'after':after_merge,'method':'Lossless join by direct parent and identical material; animated pivots preserved'}, 'triangles': sum(len(o.data.loop_triangles) for o in meshes), 'sourceBounds': [list(low), list(high)], 'normalizationScale': scale, 'cameraOrthoScale': cam_data.ortho_scale, 'durationSeconds': 6, 'authoringFps': FPS, 'materials': list(MAT), 'license': 'Original Lift artwork; no external assets or textures'}
    (WORK / (name+'.json')).write_text(json.dumps(record, indent=2)+'\n')
    print('LIFT_MODEL', json.dumps(record), flush=True)


if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(MODELS)
    for name in names:
        if name not in MODELS:
            raise ValueError('Unknown model: '+name)
        build(name)
