"""Anonymous mannequin head for the CC0 athlete.

A clean quad surface follows the measured skull envelope and shares the real
neck boundary. All original face/ocular topology above the cut is removed.
The existing 53-bone rig is unchanged; new skin weights blend from the original
neck boundary to the existing head bone. Only the neck transition is smoothed.
Run via generate-athlete.py, never independently against a published asset.
"""
import bmesh, math
from mathutils import Vector


def make_faceless_head(body):
    bm=bmesh.new();bm.from_mesh(body.data)
    cut=1.565
    peak=max(v.co.z for v in body.data.vertices)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=Vector((0,0,cut)),plane_no=Vector((0,0,1)),clear_outer=True,clear_inner=False)
    ring_edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut)<1e-5 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm,edges=ring_edges,cuts=2,use_grid_fill=False)
    ring_vertices={v for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut)<1e-5 for v in e.verts) for v in e.verts}
    center=sum((v.co for v in ring_vertices),Vector())/len(ring_vertices)
    ring=sorted(ring_vertices,key=lambda v:math.atan2(v.co.y-center.y,v.co.x))
    angles=[math.atan2(v.co.y-center.y,v.co.x) for v in ring]
    base=[v.co.copy() for v in ring];deform=bm.verts.layers.deform.verify();base_weights=[dict(v[deform]) for v in ring]
    head_group=body.vertex_groups['head'].index
    # Clean quad rings follow the measured skull silhouette, with no eye/nose/mouth
    # topology. They share the original neck boundary rather than overlap it.
    base_rx=max(abs(v.x) for v in base);base_cy=(max(v.y for v in base)+min(v.y for v in base))/2;base_ry=(max(v.y for v in base)-min(v.y for v in base))/2
    profile=[(cut,base_rx,base_cy,base_ry),(1.596,.058,-.056,.078),(1.62,.067,-.066,.085),(1.66,.078,-.063,.090),(1.70,.079,-.052,.105),(1.74,.076,-.052,.102),(1.78,.069,-.050,.087),(1.81,.048,-.050,.060),(peak,0,-.047,0)]
    def at(z):
     if z>1.74:
      u=(z-1.735)/(peak-1.735);start=(1.74-1.735)/(peak-1.735);shape=math.sqrt(max(0,1-u*u))/math.sqrt(1-start*start)
      return .076*shape,-.052+.005*(z-1.74)/(peak-1.74),.102*shape
     for k in range(len(profile)-1):
      a,b=profile[k:k+2]
      if z<=b[0]:
       t=(z-a[0])/(b[0]-a[0]);p=profile[max(0,k-1)];q=profile[min(len(profile)-1,k+2)]
       vals=[]
       for axis in [1,2,3]:
        ma=(b[axis]-p[axis])/(b[0]-p[0]);mb=(q[axis]-a[axis])/(q[0]-a[0]);span=b[0]-a[0]
        vals.append((2*t**3-3*t*t+1)*a[axis]+(t**3-2*t*t+t)*ma*span+(-2*t**3+3*t*t)*b[axis]+(t**3-t*t)*mb*span)
       return vals
     return profile[-1][1:]
    previous=ring
    for j in range(1,57):
     z=cut+(peak-.0005-cut)*j/56;rx,cy,ry=at(z);new_ring=[]
     blend=min(1,(z-cut)/.040);blend=blend*blend*(3-2*blend)
     skin_mix=min(1,(z-cut)/.075);skin_mix=skin_mix*skin_mix*(3-2*skin_mix)
     for i,angle in enumerate(angles):
      ellipse=Vector((rx*math.cos(angle),cy+ry*math.sin(angle),z))
      base_ellipse=Vector((base_rx*math.cos(angle),base_cy+base_ry*math.sin(angle),cut))
      co=ellipse+(base[i]-base_ellipse)*(1-blend);co.z=z
      v=bm.verts.new(co)
      for group,weight in base_weights[i].items():v[deform][group]=weight*(1-skin_mix)
      v[deform][head_group]=v[deform].get(head_group,0)+skin_mix
      new_ring.append(v)
     for i in range(len(ring)):
      f=bm.faces.new((previous[i],previous[(i+1)%len(ring)],new_ring[(i+1)%len(ring)],new_ring[i]));f.material_index=0;f.smooth=True
     previous=new_ring
    top=bm.verts.new((0,-.047,peak));top[deform][head_group]=1
    for i in range(len(ring)):
     f=bm.faces.new((previous[i],previous[(i+1)%len(ring)],top));f.material_index=0;f.smooth=True
    # Smooth only the shared neck transition, including the original cut boundary.
    for iteration in range(32):
     updates={}
     for v in bm.verts:
      z=v.co.z
      if not 1.535<z<1.625 or abs(v.co.x)>.10:continue
      weight=math.sin(math.pi*(z-1.535)/.090)**2
      neighbors=[e.other_vert(v) for e in v.link_edges]
      if neighbors:updates[v]=v.co.lerp(sum((n.co for n in neighbors),Vector())/len(neighbors),.32*weight)
     for v,co in updates.items():v.co=co
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
