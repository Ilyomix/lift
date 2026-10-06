"""Original Lift 3D props. Run with Blender, not ordinary Python.

blender -b --factory-startup --python scripts/generate-sport-models.py -- dumbbell stopwatch
Models: public/models/sport. Editable scenes and review renders: .local-release/sport-models.
One Blender unit is one meter; these are normalized illustration props, not physical products.
Section icons also produce alpha WebP fallbacks through the installed Python/Pillow
encoder from their Blender PNG renders; no external illustration is substituted.
"""
import bpy
import bmesh
import hashlib
import json
import math
import shutil
import subprocess
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
        load = empty(tag+'LoadSlide', GEOMETRY)
        cylinder(tag+'SteelShoulder',(side*.646,0,0),.205,.15,'LiftSilver',axis='X',vertices=48,bevel=.023)
        cylinder(tag+'Seat',(side*.726,0,0),.242,.060,'LiftSilver',axis='X',vertices=48,bevel=.012,parent=load)
        cylinder(tag+'RubberHead',(side*1.037,0,0),.58,.615,'LiftGraphite',axis='X',vertices=6,bevel=.066,parent=load)
        cylinder(tag+'PaintedInset',(side*1.351,0,0),.438,.018,'LiftCobalt',axis='X',vertices=6,bevel=.010,parent=load)
        animate(load, 'location', [(1,(0,0,0)),(61,(side*.12,0,0)),(121,(0,0,0)),(END,(0,0,0))])
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
    roll = empty('PlateRollPivot', GEOMETRY)
    annulus('OuterPlate',1,.69,.27)
    annulus('InnerPlate',.56,.18,.24)
    for i in range(3):
        a=i*math.tau/3
        obj=box('PlateSpoke'+str(i),(.61*math.sin(a),0,.61*math.cos(a)),(.39,.24,.46),bevel=.045)
        obj.rotation_euler.y=a
    torus('CobaltOuterLip',(0,-.153,0),.935,.033,'LiftCobalt')
    torus('SilverBore',(0,-.146,0),.198,.029,'LiftSilver')
    torus('BoreRear',(0,.146,0),.198,.022,'LiftSilver')
    for obj in list(GEOMETRY.children):
        if obj != roll:
            obj.parent = roll
    # Unit-radius plate: translation equals radius × angle. All pieces form
    # one rigid wheel; no decorative lock detaches from its center bore.
    animate(roll,'location',[(1,(0,0,0)),(61,(.44,0,0)),(121,(0,0,0)),(END,(0,0,0))])
    animate(roll,'rotation_euler',[(1,(0,0,0)),(61,(0,.44,0)),(121,(0,0,0)),(END,(0,0,0))])


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


def appearance():
    """A physical day/night slider: fixed shell, embossed symbols, accent thumb."""
    def capsule(name, radius, y, depth, mat):
        points=[]
        for center,start in [(.45,-math.pi/2),(-.45,math.pi/2)]:
            for i in range(25):
                angle=start+math.pi*i/24
                points.append((center+radius*math.cos(angle),radius*math.sin(angle)))
        return badge(name,points,y,depth,mat)
    capsule('AppearanceShell',.59,0,.38,'LiftGraphite')
    capsule('AppearanceRim',.50,-.205,.035,'LiftSilver')
    capsule('AppearanceTrack',.454,-.231,.036,'LiftInk')
    # The sun is uncovered when the thumb slides right; the moon is visible at rest.
    cylinder('DayCenter',(-.45,-.263,0),.13,.026,'LiftSilver',vertices=32,bevel=.009)
    for ray in range(8):
        angle=math.tau*ray/8
        line('DayRay'+str(ray),[
            (-.45+.19*math.cos(angle),-.275,.19*math.sin(angle)),
            (-.45+.255*math.cos(angle),-.275,.255*math.sin(angle))],.021,'LiftSilver')
    radius=.245
    points=[(.45+radius*math.cos(math.radians(60+240*i/32)),radius*math.sin(math.radians(60+240*i/32))) for i in range(33)]
    inner_x=.17
    tip=Vector((radius*.5-inner_x,radius*math.sin(math.pi/3)))
    inner_radius=tip.length
    lower_angle=math.atan2(-tip.y,tip.x)
    upper_angle=-math.tau-lower_angle
    points += [(.45+inner_x+inner_radius*math.cos(lower_angle+(upper_angle-lower_angle)*i/32),inner_radius*math.sin(lower_angle+(upper_angle-lower_angle)*i/32)) for i in range(1,33)]
    badge('NightCrescent',points,-.266,.025,'LiftSilver')
    thumb=empty('AppearanceThumbSlide',GEOMETRY,(-.45,-.295,0))
    cylinder('AppearanceThumbEdge',(0,0,0),.407,.135,'LiftSilver',vertices=48,bevel=.018,parent=thumb)
    cylinder('AppearanceThumbFace',(0,-.077,0),.340,.035,'LiftCobalt',vertices=48,bevel=.014,parent=thumb)
    # A shallow, real grip notch gives the small object a machined surface.
    line('AppearanceThumbGrip',[(0,-.103,-.14),(0,-.103,.14)],.018,'LiftSilver',parent=thumb)
    animate(thumb,'location',[(1,(-.45,-.295,0)),(81,(.45,-.295,0)),(111,(.45,-.295,0)),(201,(-.45,-.295,0)),(END,(-.45,-.295,0))])


def camera():
    """Compact camera, with a translating focus barrel and real shutter button."""
    box('CameraBody',(0,0,0),(1.90,.62,1.18),'LiftGraphite',bevel=.14)
    box('CameraTop',(-.22,0,.64),(.72,.46,.18),'LiftGraphite',bevel=.06)
    box('CameraGrip',(.73,-.24,-.015),(.35,.27,.99),'LiftCobalt',bevel=.10)
    box('CameraViewfinder',(-.64,-.326,.30),(.25,.035,.17),'LiftSilver',bevel=.025)
    cylinder('CameraLensMount',(-.12,-.36,-.045),.43,.16,'LiftSilver',bevel=.027)
    focus=empty('CameraFocusSlide',GEOMETRY,(0,0,0))
    cylinder('CameraLensBarrel',(-.12,-.49,-.045),.385,.20,'LiftGraphite',bevel=.025,parent=focus)
    torus('CameraFocusRing',(-.12,-.596,-.045),.35,.035,'LiftCobalt',parent=focus)
    cylinder('CameraLensGlass',(-.12,-.606,-.045),.306,.026,'LiftInk',bevel=.008,parent=focus)
    torus('CameraOptics',(-.12,-.623,-.045),.216,.016,'LiftSilver',parent=focus)
    shutter=empty('CameraShutterPress',GEOMETRY,(0,0,0))
    cylinder('CameraShutter',(.66,-.025,.638),.12,.09,'LiftSilver',axis='Z',bevel=.018,parent=shutter)
    animate(focus,'location',[(1,(0,0,0)),(55,(0,-.075,0)),(81,(0,-.075,0)),(151,(0,0,0)),(END,(0,0,0))])
    animate(shutter,'location',[(1,(0,0,0)),(73,(0,0,0)),(88,(0,0,-.035)),(111,(0,0,0)),(END,(0,0,0))])


def measuring_tape():
    """Retractable measuring tape: the markings move with its physical strip."""
    cylinder('TapeCase',(-.48,.02,.02),.66,.38,'LiftGraphite',vertices=48,bevel=.075)
    cylinder('TapeFace',(-.48,-.187,.02),.535,.055,'LiftCobalt',vertices=48,bevel=.025)
    cylinder('TapeCenter',(-.48,-.226,.02),.18,.03,'LiftSilver',vertices=40,bevel=.015)
    # The ribbon overlaps inside the case at every phase. It never stretches,
    # so the graduations stay evenly spaced while the exit reveals more tape.
    pull=empty('TapePullSlide',GEOMETRY,(0,0,0))
    box('MeasuringRibbon',(.44,0,-.43),(1.21,.23,.032),'LiftSilver',bevel=.01,parent=pull)
    for i in range(12):
        x=-.06+i*.09
        box('RibbonTick'+str(i),(x,-.044,-.409),(.013,.12 if i%5==0 else .065,.009),'LiftInk',bevel=.002,parent=pull)
    box('TapeHook',(1.058,0,-.478),(.04,.29,.13),'LiftGraphite',bevel=.012,parent=pull)
    box('TapeExit',(.12,.02,-.43),(.12,.32,.12),'LiftGraphite',bevel=.025)
    animate(pull,'location',[(1,(0,0,0)),(81,(.26,0,0)),(111,(.26,0,0)),(201,(0,0,0)),(END,(0,0,0))])


def body_target():
    """A framed, anonymous CC0 athlete: the frame focuses, the body stays still."""
    source=ROOT/'public/models/exercise/athlete.glb'
    # Match the matte human category models; metalness stays material-authored
    # at runtime while the shared LiftSilver color remains theme-adaptive.
    surface=MAT['LiftSilver'].node_tree.nodes.get('Principled BSDF')
    surface.inputs['Metallic'].default_value=0
    surface.inputs['Roughness'].default_value=.44
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported=set(bpy.data.objects)-before
    depsgraph=bpy.context.evaluated_depsgraph_get()
    surfaces=[obj for obj in imported if obj.name in {'SK_AthleteBody','SK_AthleteShorts'}]
    assert len(surfaces)==2 and all(obj.type=='MESH' for obj in surfaces), 'Expected the two canonical athlete surfaces'
    # Bake the approved continuous human surface in its relaxed bind pose. No
    # new rig, primitive anatomy, decimation, or copied workout-icon silhouette.
    # Blender also creates a hidden bone display mesh on skin import. It is
    # not a node in the source GLB and must never become icon geometry.
    for original in surfaces:
        evaluated=original.evaluated_get(depsgraph)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
        data.transform(original.matrix_world)
        is_shorts=any(mat and mat.name.startswith('M_Shorts') for mat in data.materials)
        data.materials.clear()
        data.materials.append(MAT['LiftGraphite' if is_shorts else 'LiftSilver'])
        for polygon in data.polygons:
            polygon.material_index=0
            polygon.use_smooth=True
        obj=bpy.data.objects.new('SM_TargetShorts' if is_shorts else 'SM_TargetBody',data)
        bpy.context.collection.objects.link(obj)
        obj.parent=GEOMETRY
    for original in imported:
        bpy.data.objects.remove(original,do_unlink=True)
    # Four focus corners follow the actual full-body envelope; the viewer sees
    # a physique/priority-area illustration, rather than a workout demonstration.
    for side,name in [(-1,'Left'),(1,'Right')]:
        pivot=empty('BodyFocus'+name,GEOMETRY)
        for z,vertical in [(.08,1),(1.79,-1)]:
            line('BodyFocus'+name+str(z),[(side*.45,-.22,z+vertical*.19),(side*.45,-.22,z),(side*.29,-.22,z)],.028,'LiftCobalt',parent=pivot)
        animate(pivot,'location',[(1,(0,0,0)),(81,(-side*.055,0,0)),(111,(-side*.055,0,0)),(201,(0,0,0)),(END,(0,0,0))])


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


def program():
    """Three physical check rows on a sprung clipboard, not a calendar alias."""
    box('ClipboardBoard',(0,0,0),(1.48,.17,1.98),'LiftGraphite',bevel=.085)
    box('ClipboardPaper',(0,-.102,-.055),(1.27,.043,1.65),'LiftSilver',bevel=.035)
    for row,z in enumerate([.48,.015,-.45]):
        box('TaskTile'+str(row),(-.38,-.142,z),(.28,.033,.28),'LiftCobalt',bevel=.04)
        line('TaskCheck'+str(row),[(-.463,-.168,z+.008),(-.405,-.168,z-.058),(-.30,-.168,z+.073)],.021,'LiftSilver')
        box('TaskTitle'+str(row),(.16,-.143,z+.05),(.55,.025,.075),'LiftGraphite',bevel=.014)
        box('TaskDetail'+str(row),(.095,-.143,z-.073),(.42,.025,.039),'LiftGraphite',bevel=.012)
    clip=empty('ProgramClipPivot',GEOMETRY,(0,-.025,.91))
    cylinder('ClipAxle',(0,0,0),.055,.65,'LiftSilver',axis='X',vertices=24,bevel=.01,parent=clip)
    box('SpringClip',(0,-.13,-.062),(.64,.21,.23),'LiftCobalt',bevel=.047,parent=clip)
    box('ClipLip',(0,-.245,-.135),(.65,.047,.056),'LiftSilver',bevel=.014,parent=clip)
    animate(clip,'rotation_euler',[(1,(0,0,0)),(71,(-.16,0,0)),(141,(0,0,0)),(END,(0,0,0))])


def evidence():
    """Open bound research book, curved page blocks and a real ribbon hinge."""
    def page_y(t):
        return -.16+.19*(t-.32)**2
    def panel(name,side,y_offset,mat,depth):
        verts=[]; faces=[]; steps=12
        for back in [False,True]:
            for i in range(steps+1):
                t=i/steps
                x=side*(.055+1.025*t)
                y=page_y(t)+y_offset+(depth if back else 0)
                for z in [-.72,.72]:
                    verts.append((x,y,z))
        layer=(steps+1)*2
        for i in range(steps):
            a=i*2
            faces += [(a,a+1,a+3,a+2),(layer+a+2,layer+a+3,layer+a+1,layer+a),
                      (a,a+2,layer+a+2,layer+a),(a+1,layer+a+1,layer+a+3,a+3)]
        faces += [(0,layer,layer+1,1),(steps*2,steps*2+1,layer+steps*2+1,layer+steps*2)]
        return mesh(name,verts,faces,mat,bevel=.012)
    for side in [-1,1]:
        panel('BookCover'+str(side),side,.095,'LiftGraphite',.05)
        panel('PageBlock'+str(side),side,0,'LiftSilver',.086)
        for z in [-.688,-.647,.647,.688]:
            line('LeafEdge',[(side*(.055+1.025*t),page_y(t)+.063,z) for t in [j/12 for j in range(13)]],.006,'LiftGraphite')
    cylinder('BookSpine',(0,.052,0),.081,1.48,'LiftGraphite',axis='Z',vertices=24,bevel=.02)
    for row,z in enumerate([.39,.17,-.05,-.27,-.49]):
        line('PrintedParagraph'+str(row),[(-(.055+1.025*t),page_y(t)-.011,z) for t in [.16,.3,.5,.72,.86]],.016,'LiftGraphite')
    # A small connected molecular figure is authored mesh, not external text/art.
    centers=[(.40,.29),(.76,.16),(.72,-.23),(.36,-.32),(.19,-.03)]
    for i,(x,z) in enumerate(centers):
        t=(x-.055)/1.025; y=page_y(t)-.026
        sphere('ResearchAtom'+str(i),(x,y,z),(.057,.032,.057),'LiftCobalt',segments=16)
        nx,nz=centers[(i+1)%len(centers)]
        nt=(nx-.055)/1.025
        line('ResearchBond'+str(i),[(x,y,z),(nx,page_y(nt)-.026,nz)],.017,'LiftCobalt')
    ribbon=empty('EvidenceBookmarkPivot',GEOMETRY,(.83,-.095,.755))
    badge('Ribbon',[(-.11,.025),(.11,.025),(.11,-.83),(0,-.745),(-.11,-.83)],-.06,.025,'LiftCobalt',parent=ribbon)
    animate(ribbon,'rotation_euler',[(1,(0,0,0)),(101,(.14,0,0)),(201,(0,0,0)),(END,(0,0,0))])


def lathed_shell(name,profile,mat='LiftSilver',parent=None,segments=36):
    """Closed radial profile: real shell thickness and no shader transparency."""
    verts=[]; faces=[]
    for radius,z in profile:
        for i in range(segments):
            a=math.tau*i/segments
            verts.append((radius*math.cos(a),radius*math.sin(a),z))
    for j in range(len(profile)):
        nj=(j+1)%len(profile)
        for i in range(segments):
            ni=(i+1)%segments
            faces.append((j*segments+i,j*segments+ni,nj*segments+ni,nj*segments+i))
    return mesh(name,verts,faces,mat,parent=parent)


def pause():
    """Recovery hourglass held by a static frame on two real side trunnions."""
    for z in [-.86,.86]:
        cylinder('HourglassStand',(0,0,z),.62,.105,'LiftGraphite',axis='Z',vertices=32,bevel=.025)
        torus('StandTrim',(0,0,z),.575,.018,'LiftSilver',axis='Z')
    for side in [-1,1]:
        cylinder('FrameColumn'+str(side),(side*.535,.075,0),.048,1.70,'LiftGraphite',axis='Z',vertices=20,bevel=.012)
        cylinder('Trunnion'+str(side),(side*.31,0,0),.043,.45,'LiftSilver',axis='X',vertices=20,bevel=.01)
    glass=empty('HourglassPivot',GEOMETRY)
    torus('VesselWaist',(0,0,0),.073,.016,'LiftSilver',axis='Z',parent=glass)
    for z in [-.685,.685]:
        cylinder('VesselCap',(0,0,z),.395,.065,'LiftCobalt',axis='Z',vertices=32,bevel=.015,parent=glass)
        torus('VesselRim',(0,0,z),.36,.018,'LiftSilver',axis='Z',parent=glass)
    profile=[(.34,-.65),(.30,-.46),(.18,-.22),(.073,0),(.18,.22),(.30,.46),(.34,.65)]
    for j in range(4):
        angle=math.pi/4+j*math.pi/2
        line('VesselMeridian'+str(j),[(r*math.cos(angle),r*math.sin(angle),z) for r,z in profile],.018,'LiftSilver',parent=glass)
    lathed_shell('UpperSand',[(.018,.12),(.27,.50),(.27,.515),(.018,.515)],'LiftCobalt',glass,28)
    lathed_shell('LowerSand',[(.012,-.30),(.31,-.64),(.012,-.64)],'LiftCobalt',glass,28)
    cylinder('SandStream',(0,0,-.09),.018,.43,'LiftCobalt',axis='Z',vertices=12,bevel=0,parent=glass)
    animate(glass,'rotation_euler',[(1,(0,0,0)),(101,(.12,0,0)),(191,(0,0,0)),(END,(0,0,0))])


def reminders():
    """Hollow metal bell, separate clapper and a fixed handle above its axle."""
    torus('BellHandle',(0,0,.84),.185,.042,'LiftGraphite',axis='Y')
    cylinder('BellAxle',(0,0,.635),.069,.24,'LiftSilver',axis='X',vertices=20,bevel=.012)
    bell=empty('BellSwingPivot',GEOMETRY,(0,0,.635))
    profile=[(.10,-.055),(.22,-.10),(.32,-.24),(.365,-.50),(.40,-.77),(.54,-.98),(.59,-1.01),
             (.585,-1.08),(.525,-1.08),(.48,-1.01),(.345,-.80),(.31,-.51),(.26,-.27),(.15,-.17),(.075,-.15)]
    lathed_shell('BellShell',profile,'LiftSilver',bell,40)
    torus('BellCobaltLip',(0,0,-1.035),.564,.033,'LiftCobalt',axis='Z',parent=bell)
    cylinder('BellCrown',(0,0,-.07),.135,.12,'LiftCobalt',axis='Z',vertices=24,bevel=.021,parent=bell)
    clapper=empty('BellClapperPivot',bell,(0,0,-.20))
    cylinder('ClapperStem',(0,0,-.42),.027,.83,'LiftGraphite',axis='Z',vertices=16,bevel=.009,parent=clapper)
    sphere('ClapperBall',(0,0,-.86),(.113,.113,.13),'LiftGraphite',parent=clapper,segments=20)
    animate(bell,'rotation_euler',[(1,(0,0,0)),(61,(0,.14,0)),(111,(0,-.09,0)),(161,(0,0,0)),(END,(0,0,0))])
    animate(clapper,'rotation_euler',[(1,(0,0,0)),(71,(0,-.18,0)),(121,(0,.12,0)),(171,(0,0,0)),(END,(0,0,0))])


def privacy():
    """Forged shield with layered rim and an independently lifting lock shackle."""
    shape=[(0,1.0),(.29,.92),(.65,.78),(.70,.42),(.66,.03),(.53,-.39),(.29,-.71),(0,-.91),
           (-.29,-.71),(-.53,-.39),(-.66,.03),(-.70,.42),(-.65,.78),(-.29,.92)]
    badge('ShieldBacking',shape,.06,.20,'LiftGraphite')
    badge('ShieldRim',[(x*.956,z*.956) for x,z in shape],-.065,.065,'LiftSilver')
    badge('ShieldFace',[(x*.84,z*.84+.017) for x,z in shape],-.11,.05,'LiftCobalt')
    lock=empty('LockShacklePivot',GEOMETRY,(0,-.20,.14))
    points=[(-.23,0,.02),(-.23,0,.28)]
    points += [(.23*math.cos(a),0,.28+.23*math.sin(a)) for a in [math.pi-j*math.pi/18 for j in range(19)]]
    points += [(.23,0,.02)]
    line('LockShackle',points,.045,'LiftSilver',parent=lock)
    box('LockBody',(0,-.25,-.055),(.64,.21,.49),'LiftGraphite',bevel=.075)
    cylinder('KeyholeHead',(0,-.366,-.007),.060,.018,'LiftSilver',axis='Y',vertices=20,bevel=.006)
    box('KeyholeStem',(0,-.366,-.079),(.038,.018,.11),'LiftSilver',bevel=.009)
    animate(lock,'location',[(1,(0,-.20,.14)),(91,(0,-.20,.21)),(161,(0,-.20,.14)),(END,(0,-.20,.14))])


def kit():
    """Soft-sided sports duffel with sewn straps, front pocket and zip hardware."""
    box('DuffelBody',(0,0,0),(1.98,.90,.99),'LiftGraphite',bevel=.20)
    for side in [-1,1]:
        box('EndPanel'+str(side),(side*.953,0,0),(.069,.77,.83),'LiftInk',bevel=.08)
        line('WebbingFront'+str(side),[(side*.59,-.40,-.32),(side*.59,-.46,.15),(side*.59,-.35,.48)],.047,'LiftInk')
        line('WebbingBack'+str(side),[(side*.59,.40,-.32),(side*.59,.46,.15),(side*.59,.35,.48)],.047,'LiftInk')
        torus('StrapRing'+str(side),(side*1.012,0,.24),.079,.016,'LiftSilver',axis='X')
    box('FrontPocket',(0,-.465,-.04),(1.06,.085,.43),'LiftCobalt',bevel=.073)
    line('PocketZip',[(-.40,-.512,.12),(.40,-.512,.12)],.018,'LiftSilver')
    zipper=empty('KitZipPullPivot',GEOMETRY,(.30,-.531,.066))
    box('PocketZipPull',(0,0,0),(.040,.021,.092),'LiftSilver',bevel=.009,parent=zipper)
    line('TopZip',[(-.73,-.035,.484),(.73,-.035,.484)],.023,'LiftSilver')
    handles=empty('KitHandlePivot',GEOMETRY,(0,0,.43))
    for y in [-.29,.29]:
        points=[(-.58,y,.02),(-.47,y,.27),(-.35,y,.48),(-.17,y,.59),(.17,y,.59),(.35,y,.48),(.47,y,.27),(.58,y,.02)]
        line('CarryHandle',points,.048,'LiftGraphite',parent=handles)
    box('HandleWrap',(0,0,.60),(.38,.66,.12),'LiftGraphite',bevel=.05,parent=handles)
    animate(zipper,'location',[(1,(.30,-.531,.066)),(101,(-.27,-.531,.066)),(181,(.30,-.531,.066)),(END,(.30,-.531,.066))])


def logbook():
    """Closed workout journal and a separately articulated mechanical pencil."""
    box('JournalPages',(.025,0,-.015),(1.17,.24,1.69),'LiftSilver',bevel=.025)
    for y in [-.15,.15]:
        box('JournalCover',(0,y,0),(1.29,.065,1.82),'LiftGraphite',bevel=.05)
    box('JournalSpine',(-.60,0,0),(.16,.36,1.81),'LiftCobalt',bevel=.065)
    for y in [-.075,0,.075]:
        line('PageEdges',[(.615,y,-.78),(.615,y,.76)],.005,'LiftGraphite')
    # An embossed training graph differentiates a workout log from plain notes.
    line('JournalChartAxes',[(-.36,-.193,.42),(-.36,-.193,-.12),(.23,-.193,-.12)],.017,'LiftSilver')
    line('JournalChart',[(-.28,-.204,.025),(-.11,-.204,.12),(.035,-.204,.12),(.21,-.204,.35)],.028,'LiftCobalt')
    for z,width in [(-.38,.55),(-.52,.42)]:
        box('JournalEntry',(-.055,-.193,z),(width,.023,.043),'LiftSilver',bevel=.009)
    box('ElasticClosure',(.40,-.192,0),(.064,.025,1.70),'LiftInk',bevel=.012)
    pencil=empty('LogbookPencilPivot',GEOMETRY,(.67,-.24,.02))
    cylinder('PencilBarrel',(0,0,.13),.056,1.30,'LiftGraphite',axis='Z',vertices=6,bevel=.008,parent=pencil)
    cylinder('PencilGrip',(0,0,-.54),.059,.20,'LiftSilver',axis='Z',vertices=24,bevel=.013,parent=pencil)
    lathed_shell('PencilTip',[(.055,-.63),(.020,-.80),(.014,-.85),(.005,-.85),(.043,-.63)],'LiftSilver',pencil,24)
    cylinder('PencilLead',(0,0,-.866),.009,.036,'LiftInk',axis='Z',vertices=12,bevel=0,parent=pencil)
    cylinder('PencilEnd',(0,0,.80),.068,.12,'LiftCobalt',axis='Z',vertices=24,bevel=.018,parent=pencil)
    line('PencilClip',[(0,-.055,.72),(0,-.095,.64),(0,-.095,.37),(0,-.065,.33)],.015,'LiftSilver',parent=pencil)
    animate(pencil,'rotation_euler',[(1,(0,-.08,0)),(101,(0,.025,0)),(181,(0,-.08,0)),(END,(0,-.08,0))])


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
          'chart':chart,'nutrition':nutrition,'settings':settings,'appearance':appearance,'backup':backup,'coach':coach,'trophy':trophy,
          'program':program,'evidence':evidence,'pause':pause,'reminders':reminders,'privacy':privacy,'kit':kit,'logbook':logbook,
          'camera':camera,'measuring-tape':measuring_tape,'body-target':body_target}

SECTION_MODELS = {'program', 'evidence', 'pause', 'reminders', 'privacy', 'kit', 'logbook', 'appearance', 'camera', 'measuring-tape', 'body-target'}


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
    if name not in {'nutrition', 'plate'} | SECTION_MODELS:
        yaw = math.radians(7)
        animate(art, 'rotation_euler', [(1, (0, 0, 0)), (91, (0, 0, yaw)), (181, (0, 0, 0)), (271, (0, 0, -yaw)), (END, (0, 0, 0))])
    scene.frame_set(0)
    cam_data = bpy.data.cameras.new('IconCamera')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('IconCamera', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (1.0, -6, 1.2) if name=='body-target' else (3, -6, 2.7)
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
    fallback = None
    if name in SECTION_MODELS:
        fallback = ROOT / 'src/assets/sport' / (name+'.webp')
        encoder = shutil.which('python3')
        if encoder is None:
            raise RuntimeError('Python with Pillow is required for section-icon fallbacks')
        subprocess.run([encoder, '-c',
            "from PIL import Image; import sys; Image.open(sys.argv[1]).convert('RGBA').save(sys.argv[2], 'WEBP', quality=92, method=6)",
            scene.render.filepath, str(fallback)], check=True)
    for obj in meshes:
        obj.data.calc_loop_triangles()
    record = {'name': name, 'bytes': path.stat().st_size, 'meshes': len(meshes), 'meshBatching': {'before':before_merge,'after':after_merge,'method':'Lossless join by direct parent and identical material; animated pivots preserved'}, 'triangles': sum(len(o.data.loop_triangles) for o in meshes), 'sourceBounds': [list(low), list(high)], 'normalizationScale': scale, 'cameraOrthoScale': cam_data.ortho_scale, 'durationSeconds': 6, 'authoringFps': FPS, 'materials': list(MAT), 'animatedPivots': [obj.name for obj in scene.objects if obj.animation_data], 'staticArtRoot': art.animation_data is None, 'license': 'Original Lift artwork; no external assets or textures'}
    if name=='body-target':
        source=ROOT/'public/models/exercise/athlete.glb'
        record['license']='CC0 MakeHuman/MPFB athlete with original Lift anonymous head and focus frame; no textures'
        record['source']={'path':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'licenseDetails':'docs/assets/exercise-athlete.md'}
    if fallback:
        record['fallback'] = {'path': str(fallback.relative_to(ROOT)), 'bytes': fallback.stat().st_size, 'source': str((WORK / (name+'.png')).relative_to(ROOT)), 'method': 'Blender Cycles RGBA PNG encoded as WebP with Pillow; alpha preserved'}
    (WORK / (name+'.json')).write_text(json.dumps(record, indent=2)+'\n')
    print('LIFT_MODEL', json.dumps(record), flush=True)


if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(MODELS)
    for name in names:
        if name not in MODELS:
            raise ValueError('Unknown model: '+name)
        build(name)
