"""Rebuild only print-model assets; never modify the original Showroom."""
from pathlib import Path
import json, hashlib, zipfile
import numpy as np
import trimesh as tm
from scipy.spatial import cKDTree
ROOT=Path(__file__).parent
source=ROOT.parent/'dist/assets/model.json'
data=json.loads(source.read_text())
OUT=ROOT/'models'; OUT.mkdir(exist_ok=True)
MIN=1.2

def box(lo,hi):
    m=tm.creation.box(np.array(hi)-lo);m.apply_translation((np.array(hi)+lo)/2);return m

def union(parts):return tm.boolean.union(parts,engine='manifold')
raw=[]
for d in data['items']:
    if d['category'] in ['glass','hood']:continue
    # Original corner and central pedestals overlap by 1.7 source mm.
    # Move the entire infeed/corner base group, rather than cutting either pedestal.
    if d['stage']<2:d['pos'][0]-=2.3
    if d['kind']=='box':m=tm.creation.box(d['size'])
    elif d['kind']=='cylinder':m=tm.creation.cylinder(radius=d['size'][0],height=d['size'][1],sections=32)
    else:m=tm.creation.annulus(r_min=d['size'][0],r_max=d['size'][1],height=d['size'][2],sections=48)
    t=tm.transformations.euler_matrix(*d['rotation']);t[:3,3]=d['pos'];m.apply_transform(t)
    raw.append((d,m))
bounds=np.array([m.bounds for _,m in raw]);lo=bounds[:,0].min(0);hi=bounds[:,1].max(0)
scale=200/(hi[0]-lo[0]+4) # 2 mm source padding each end
origin=np.array([lo[0]-2,lo[1]-2,lo[2]])
# All printable bodies share this assembly coordinate frame.
items=[[],[],[]];thickened=0
for d,_ in raw:
    size=np.array(d['size'])*scale
    if d['kind']=='box':
        thickened+=int(np.any(size<MIN));size=np.maximum(size,MIN);m=tm.creation.box(size)
    elif d['kind']=='cylinder':
        thickened+=int(size[0]*2<MIN or size[1]<MIN)
        m=tm.creation.cylinder(radius=max(size[0],MIN/2),height=max(size[1],MIN),sections=32)
    else:
        thickened+=int(size[1]-size[0]<MIN or size[2]<MIN)
        outer=max(size[1],size[0]+MIN)
        m=tm.creation.annulus(r_min=size[0],r_max=outer,height=max(size[2],MIN),sections=48)
    t=tm.transformations.euler_matrix(*d['rotation']);t[:3,3]=(np.array(d['pos'])-origin)*scale+[0,0,3.2];m.apply_transform(t)
    items[0 if d['stage']<2 else 1 if d['stage']==2 else 2].append(m)
# Seam planes follow full machine base boundaries, never split central shared base.
b1=(-95-origin[0])*scale;b2=(35-origin[0])*scale
Y=(hi[1]-origin[1]+2)*scale;X=200
# L floor follows short-leg equipment and the long-leg pedestal/ramp.
longY=(-38-origin[1])*scale;longTop=(38-origin[1])*scale
floors=[union([box([0,longY,0],[b1,longTop,3.2]),box([0,longY,0],[b1,Y,3.2])]),box([b1,longY,0],[b2,longTop,3.2]),box([b2,longY,0],[X,longTop,3.2])]
# Permanent ramp buttress: beneath discharge end, leaving lower transport visible.
ramp=box([X-8,(-5-origin[1])*scale,3],[X-4,(5-origin[1])*scale,10])
items[2].append(ramp)
links=[];built=[]
for group,floor in zip(items,floors):
    result=union([floor]+group)
    n=0
    # Bridge truly disconnected detail to nearest attached body using stout permanent ties.
    while True:
        comps=sorted(result.split(),key=lambda c:c.volume,reverse=True)
        if len(comps)==1:break
        main=comps[0];other=comps[1];tree=cKDTree(main.vertices);dist,idx=tree.query(other.vertices)
        j=np.argmin(dist);a=other.vertices[j];b=main.vertices[idx[j]];v=b-a
        tie=tm.creation.cylinder(radius=.7,height=np.linalg.norm(v)+1.4,sections=16)
        tie.apply_transform(tm.geometry.align_vectors([0,0,1],v));tie.apply_translation((a+b)/2)
        result=union([result,tie]);n+=1
        if n>200:raise RuntimeError('connection failed')
    links.append(n);built.append(result)
# Keep each complete machine inside its own assembly envelope. 0.24 mm seam clearance.
for group_index,group in enumerate(items):
    for m in group:
        if m.bounds[1,2]<20 and m.extents[0]>20 and m.extents[1]>20:
            if group_index==0:assert m.bounds[1,0]<=b1-.12+1e-6
            if group_index==1:assert m.bounds[0,0]>=b1+.12-1e-6 and m.bounds[1,0]<=b2-.12+1e-6
            if group_index==2:assert m.bounds[0,0]>=b2+.12-1e-6
modules=[]
for i,m in enumerate(built):
    left=[0,b1+.12,b2+.12][i];right=[b1-.12,b2-.12,X][i]
    m=tm.boolean.intersection([m,box([left,-10,-1],[right,Y+10,100])],engine='manifold')
    # Underside glue-key recesses, accessible after printing; 0.2 mm per-side clearance.
    cuts=[]
    for seam in ([b1] if i==0 else [b1,b2] if i==1 else [b2]):
        cuts.append(box([seam-4,(-origin[1])*scale-3,-.1],[seam+4,(-origin[1])*scale+3,1.6]))
    m=tm.boolean.difference([m]+cuts,engine='manifold');modules.append(m)
one=union(built)
# Trim one-piece to exact 200 mm footprint after detail thickening.
one=tm.boolean.intersection([one,box([0,-10,0],[X,Y+10,100])],engine='manifold')
records=[]
def save(m,name,label,stages):
    offset=m.bounds[0].copy();m=m.copy();m.apply_translation(-offset);path=OUT/name;m.export(path)
    check=tm.load_mesh(path);components=len(check.split(only_watertight=False))
    assert check.is_watertight and check.is_winding_consistent and check.volume>0 and components==1,(name,components)
    assert abs(check.bounds[0,2])<1e-5
    # Down-facing triangles above first layers need slicer review (conservative surface metric).
    mask=(check.face_normals[:,2]<-.707)&(check.triangles_center[:,2]>.4)
    records.append(dict(file=name,label=label,stages=stages,dimensions_mm=check.extents.round(3).tolist(),assembly_offset_mm=offset.round(6).tolist(),watertight=bool(check.is_watertight),consistent_winding=bool(check.is_winding_consistent),components=components,volume_mm3=round(float(check.volume),2),triangles=len(check.faces),elevated_downward_area_mm2=round(float(check.area_faces[mask].sum()),2),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
save(one,'Flexfill_200mm_OnePiece.stl','A 一體成型（實驗性）',[0,1,2,3,4])
for m,name,label,stages in zip(modules,['Flexfill_200mm_Module_A_Infeed_Turn.stl','Flexfill_200mm_Module_B_Heat_Peel_Lift.stl','Flexfill_200mm_Module_C_Fill_Stopper_Outfeed.stl'],['B1 入料與轉角','B2 加熱取紙與共同升降','B3 充填打膠塞與出料'],[[0,1],[2],[3,4]]):save(m,name,label,stages)
save(box([0,0,0],[7.6,5.6,1.4]),'Flexfill_Alignment_Key.stl','底面定位片（列印 2 片）',[])
report=dict(source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),source_revision=data['revision'],units='mm',scale=scale,minimum_primitive_thickness_mm=MIN,infeed_corner_translation_source_mm=[-2.3,0,0],thickened_primitives=thickened,permanent_detail_ties=links,seam_clearance_mm=.24,base_thickness_mm=3.2,key_clearance_per_side_mm=.2,files=records,limitations=['網格驗證完成；未執行 Bambu Studio 切片或實機列印。','最小厚度針對基本元件，非全網格局部厚度證明。','入料轉角整組左移 2.3 原始 mm，解除原始基座重疊；跨基座輸送於接縫分開。','下向表面面積為保守指標；支撐可達性、細針與上下層通道需切片逐層確認。'])
assembly=[]
for m in modules:assembly.append(m)
for i in range(3):
    for j in range(i+1,3):
        overlap=tm.boolean.intersection([assembly[i],assembly[j]],engine='manifold')
        assert len(overlap.faces)==0
ab=np.array([m.bounds for m in assembly]);dims=ab[:,1].max(0)-ab[:,0].min(0)
assert abs(dims[0]-200)<1e-5
report['assembly_checks']=dict(dimensions_mm=dims.round(3).tolist(),module_intersection_volume_mm3=0,main_pedestal_envelopes_preserved=True)
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with zipfile.ZipFile(OUT/'Flexfill_200mm_Print_Kit.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.glob('*.stl')):z.write(p,p.name)
    for name in ['validation.json','PRINTING.md']:z.write(ROOT/name,name)
print(json.dumps(report,ensure_ascii=False,indent=2))
