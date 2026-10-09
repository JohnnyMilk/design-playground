from pathlib import Path
import json, math, zipfile
import numpy as np
import trimesh as tm

ROOT=Path(__file__).parent
OUT=ROOT/'dist'/'assets'; OUT.mkdir(parents=True,exist_ok=True)
PRINT=OUT/'print';PRINT.mkdir(exist_ok=True)
items=[]; scene=tm.Scene(); solids={}; reports=[]
colors={'steel':'#b7c6ce','white':'#e4e9eb','dark':'#263c48','glass':'#90cbd7','teal':'#087f88','black':'#17262e','green':'#52d6a0','red':'#ed725e','amber':'#f1bf59'}
def layout(stage):
    old=[-165,-100,0,97.5,162.5][stage]
    T=tm.transformations.rotation_matrix(-math.pi/2 if stage<2 else 0,[0,0,1])
    target=np.array([-130,65 if stage==0 else 0,0]) if stage<2 else np.array([old-30,0,0])
    T[:3,3]=target-T[:3,:3]@np.array([old,0,0])
    return T

def shape(kind,pos,size,color,stage,category='body',rotation=None,printpart=None):
    d=dict(kind=kind,pos=pos,size=size,color=colors.get(color,color),stage=stage,category=category,rotation=rotation or [0,0,0])
    if kind=='box':m=tm.creation.box(size)
    elif kind=='cylinder':m=tm.creation.cylinder(radius=size[0],height=size[1],sections=24)
    else:m=tm.creation.annulus(r_min=size[0],r_max=size[1],height=size[2],sections=40)
    T=tm.transformations.euler_matrix(*d['rotation']);T[:3,3]=pos;T=layout(stage)@T;m.apply_transform(T)
    d['pos']=T[:3,3].tolist();d['rotation']=list(tm.transformations.euler_from_matrix(T));items.append(d)
    rgba=list(bytes.fromhex(d['color'][1:]))+[55 if category=='glass' else 255]
    m.visual=tm.visual.TextureVisuals(material=tm.visual.material.PBRMaterial(baseColorFactor=rgba,metallicFactor=.35,roughnessFactor=.4,alphaMode='BLEND' if category=='glass' else 'OPAQUE',doubleSided=True))
    scene.add_geometry(m,node_name=f'{stage}_{category}_{len(items)}')
    if printpart:solids.setdefault(printpart,[]).append(m.copy())
    return m
widths=[60,70,130,65,65];start=-195
names=['入料與去袋','D/L 轉角轉送','加熱取紙與上層充填','上層加塞／回退降層','震動盤與下層出料']
centers=[]
for i,w in enumerate(widths):
    x=start+w/2;centers.append(x);b=f'{i+1:02d}_base';h=f'{i+1:02d}_hood';dep=70
    def box(p,s,c='steel',cat='body',part=b):return shape('box',p,s,c,i,cat,printpart=part)
    def cyl(p,r,ht,c='steel',cat='detail',part=b,rot=None):return shape('cylinder',p,[r,ht],c,i,cat,rot,part)
    # Connected slab, pedestal, deck; all print dimensions in millimetres.
    box([x,0,2],[w-.6,dep+4,4],'dark')
    box([x,0,16],[w-3,dep-4,25])
    box([x,0,31],[w-.6,dep,5],'white')
    for xx in np.linspace(start+11,start+w-11,max(2,round(w/24))):
        box([xx,-dep/2+1.6,17],[20,2,22],'white')
        box([xx+7,-dep/2-.1,17],[1.4,1.5,6],'dark')
    # Tall overhead service canopy and transparent chamber.
    box([x,0,104],[w-.6,dep,25],'white','hood',h)
    box([x,-dep/2-.15,105],[w-5,.8,20],'steel','hood',None)
    for xx in [start+1.5,start+w-1.5]:
        for yy in [-dep/2+1.5,dep/2-1.5]:box([xx,yy,63],[3,3,63],'steel','hood',h)
    if i!=1:box([x,dep/2,63],[w-6,.7,59],'glass','glass',None)
    box([x,-dep/2,63],[w-6,.7,59],'glass','glass',None)
    # Module interfaces are open for material transfer.
    # Glove ports and a continuous reinforced lower rail in print hood.
    box([x,-dep/2,49],[w-3,2.5,3],'steel','hood',h)
    ports=max(2,round(w/26))
    for xx in np.linspace(start+12,start+w-12,ports):
        shape('ring',[xx,-dep/2-1,58],[6,8,2.5],'white',i,'hood',[math.pi/2,0,0],h)
        for z in [40,84]:box([xx-9,-dep/2-1,z],[3,2,4],'steel','hood',None)
    # Second access face; symmetric glove count is provisional.
    if i!=1: # No glove ports on the elbow's internal module interface.
        box([x,dep/2,49],[w-3,2.5,3],'steel','hood',h)
        for xx in np.linspace(start+12,start+w-12,ports):
            shape('ring',[xx,dep/2+1,58],[6,8,2.5],'white',i,'hood',[math.pi/2,0,0],h)
    # Lower transport level, with a separate upper processing deck on the long leg.
    track_x=(start+x)/2 if i==1 else x
    track_len=(x-start+2) if i==1 else w-2
    box([track_x,0,37],[track_len,21,8],'#c58332','process')
    for yy in [-11,11]:box([track_x,yy,40],[track_len,2,4],'steel','process')
    lower_nests=[x] if i<2 or i==4 else []
    def nest(xx,z,col='teal'):
        box([xx,0,z],[20,17,4],col,'process')
        for aa in [-6,0,6]:
            for bb in [-5,0,5]:cyl([xx+aa,bb,z+5],1.6,7,'white','process')
    for xx in lower_nests:nest(xx,42)
    if i in [2,3]:
        lo=start+70 if i==2 else start
        hi=start+w if i==2 else start+w-13
        mid=(lo+hi)/2
        for xx in [lo+4,hi-4]:
            for yy in [-14,14]:box([xx,yy,47],[3,3,31],'steel','process')
        for yy in [-13,13]:box([mid,yy,61],[hi-lo,3,4],'teal','process')
        box([mid,0,59],[hi-lo,25,3],'teal','process')
        nest(mid,62)
    if i==0:
        box([start-10,0,31],[22,26,4],'steel','detail',None)
        for yy in [-12,12]:box([start-10,yy,34],[22,1.2,2],'steel','detail',None)
        box([x+12,9,52],[5,5,38],'steel','process')
        box([x,9,67],[28,6,5],'white','process')
    elif i==1:
        # At the elbow, stop the short-leg run and transfer directly right.
        box([x+10,0,43],[3,29,8],'steel','process')
        box([start+w-2,0,63],[2,dep-5,58],'glass','glass',None)
        box([start+w-2,0,36],[3,dep-5,6],'steel','body')
    elif i==2:
        # Partition at the long-leg entrance AFTER the right turn; normal along X.
        gate_x=start+3
        for yy in [-17,17]:box([gate_x,yy,60],[4,3,56],'steel','process')
        box([gate_x,0,89],[6,38,4],'white','process')
        shape('box',[gate_x,0,76],[2.5,28,22],'#477b93',i,'partition',printpart='06_partition')
        # First long-leg station moved right: longitudinal heater fins, then two rollers.
        heater=start+23
        peel=start+47
        nest(heater,42)
        nest(peel,42)
        for yy in [-15,15]:box([heater,yy,47],[4,4,30],'steel','process')
        box([heater,0,57],[19,30,3],'white','process')
        for yy in [-10,-5,0,5,10]:box([heater,yy,54.5],[17,1.8,4],'#cc9253','process')
        # Two transverse rollers, with vacuum pickup and paper waste receptacle.
        for roller_x in [peel-5,peel+4]:
            for yy in [-16,16]:box([roller_x,yy,51],[3,4,38],'steel','process')
            cyl([roller_x,0,57],3.5,31,'steel','process',rot=[math.pi/2,0,0])
        box([peel,0,69],[22,36,4],'white','process')
        for yy in [-6,6]:
            cyl([peel,yy,61],1.5,14,'steel','process')
            cyl([peel,yy,54.5],3,3,'dark','process')
        box([peel,0,52.8],[17,17,1.8],'#eee5b8','process')
        # Paper bin is a provisional visual location behind the station.
        box([peel,26,35],[22,13,4],'dark','process')
        for yy in [20,32]:box([peel,yy,43],[22,2,16],'steel','process')
        for xx in [peel-10,peel+10]:box([xx,26,43],[2,13,16],'steel','process')
        box([peel,26,38],[16,9,2],'#eee5b8','process')
        # Shared elevator: ascent and descent use the same X/Y position after paper removal.
        lift=start+78
        for yy in [-17,17]:box([lift,yy,55],[3,3,46],'#c58332','process')
        box([lift,0,40.5],[21,32,3],'#c58332','lift')
        # Upper filling bridge and five needles.
        fill=x+38
        for yy in [-17,17]:box([fill,yy,58],[4,4,53],'steel','process')
        box([fill,0,83],[13,38,4],'white','process')
        box([fill,0,77],[10,32,5],'teal','process')
        for yy in [-12,-6,0,6,12]:cyl([fill,yy,71],1,10,'steel','process')
        box([fill,22,52],[20,10,40],'white','process')
    elif i==3:
        # Stoppering head and return/lower transfer zone.
        stop=x+6
        for yy in [-17,17]:box([stop,yy,59],[4,4,55],'steel','process')
        box([stop,0,85],[14,38,4],'white','process')
        box([stop,0,77],[12,32,5],'#9274ca','process')
        for yy in [-10,-5,0,5,10]:cyl([stop,yy,71],1.4,10,'steel','process')
        # Stopper feed track approaches from the outlet end, above the nest rails.
        box([(stop+start+w)/2,22,79],[start+w-stop+2,7,3],'#9274ca','process')
        box([stop,11,79],[7,24,3],'#9274ca','process')
        for yy in [18.5,25.5]:box([(stop+start+w)/2,yy,81],[start+w-stop+2,1.5,3],'steel','process')
        box([start+w-5,22,55],[3,3,48],'steel','process')
    else:
        # Bowl feeder near discharge, offset to keep the lower exit clear.
        bx=x+5;by=17
        cyl([bx,by,47],7,30,'steel','process')
        cyl([bx,by,62],11,7,'dark','process')
        cyl([bx,by,66],16,4,'steel','process')
        shape('ring',[bx,by,73],[13,16,12],'steel',i,'process',printpart=b)
        shape('ring',[bx,by,68.7],[9,10.5,2],'#9274ca',i,'process',printpart=b)
        for aa in np.linspace(0,2*math.pi,12,endpoint=False):
            cyl([bx+7*math.cos(aa),by+7*math.sin(aa),69],1.8,3,'#9274ca','process')
        left=bx-14
        box([(start+left)/2,22,79],[left-start+3,7,3],'#9274ca','process')
        for yy in [18.5,25.5]:box([(start+left)/2,yy,81],[left-start+3,1.5,3],'steel','process')
        box([start+6,22,55],[3,3,48],'steel','process')
    # Side-mounted HMI and signal tower (screen bracket thickened in printable version).
    if i in [1,2]:
        xx=x
        box([xx,-dep/2-4,38],[4,10,12],'steel','detail')
        box([xx,-dep/2-8,52],[3,3,30],'steel','detail')
        box([xx,-dep/2-9,69],[23,4,17],'dark','detail')
        box([xx,-dep/2-11.2,69],[19,.8,13],'#a9e8ed','screen',None)
        for j in range(3):box([xx-4,-dep/2-11.7,66+j*3],[8,.3,1],'white','screen',None)
    for j,c in enumerate(['dark','green','amber','red']):cyl([start+w-5,-dep/2-1,91+j*3],1.8,3,c,'hood',h)
    cyl([start+7,dep/2-7,120],3.5,8,'steel','hood',h)
    if i==1:
        # Long-leg lower deck extends left into the delid corner.
        # After layout rotation: X=-151..-89, Y=-10.5..10.5, deck top Z=41.
        box([x,10,37],[21,62,8],'#c58332','process')
        for xx in [x-11,x+11]:box([xx,10,40],[2,62,4],'steel','process')
    if i==4:
        # Provisional 20-degree gravity ramp. Connected to the base for printing.
        angle=math.radians(20);pitch=[0,angle,0]
        ramp=np.array([start+w+29,0,29.0])
        box([start+w-2,0,36],[10,28,10],'steel','process')
        shape('box',ramp.tolist(),[64,28,3],'steel',i,'process',pitch,b)
        for yy in [-14,14]:
            shape('box',(ramp+np.array([0,yy,3])).tolist(),[64,2.5,6],'steel',i,'process',pitch,b)
        R=tm.transformations.euler_matrix(*pitch)[:3,:3]
        tray=ramp+R@np.array([4,0,3.2])
        shape('box',tray.tolist(),[21,22,4],'teal',i,'process',pitch,b)
        for dx in [-7,0,7]:
            for yy in [-7,-2,3,8]:
                q=tray+R@np.array([dx,yy,4])
                shape('cylinder',q.tolist(),[1.5,5],'white',i,'process',pitch,b)
    start+=w

data={'units':'mm','width':391,'revision':9,'stages':[{'name':n,'x':float((layout(i)@np.array([x,0,0,1]))[0]),'y':float((layout(i)@np.array([x,0,0,1]))[1]),'width':w} for i,(n,x,w) in enumerate(zip(names,centers,widths))],'items':items,'notice':'外觀展示重建，非原廠 CAD；L 形與雙面手套孔依使用者描述；短邊比例及對稱孔位待確認；兩個 HMI，D/L 暫置短邊。末端整個 nest 滑出，斜坡暫定20度，尚未核對操作手冊。上下層高差、去膜與升降轉接機構、震動盤及供塞軌道為示意，依使用者流程建立，尚未核對原廠機構。模型尺寸為設計值，不代表原機比例。內部機構、背面、各段尺寸均為示意。'}
(OUT/'model.json').write_text(json.dumps(data,ensure_ascii=False))
# GLB convention uses metres and Y up.
scene.apply_transform(tm.transformations.rotation_matrix(-math.pi/2,[1,0,0]));scene.apply_scale(.001)
(OUT/'flexfill-display.glb').write_bytes(scene.export(file_type='glb'))
for name,meshes in solids.items():
    result=tm.boolean.union(meshes,engine='manifold')
    if isinstance(result,tm.Scene):result=result.to_mesh()
    lo=result.bounds[0];result.apply_translation(-lo)
    result.export(PRINT/f'{name}.stl')
    components=len(result.split())
    reports.append(dict(file=name+'.stl',watertight=bool(result.is_watertight),connected_components=components,dimensions_mm=result.extents.round(2).tolist(),volume_mm3=round(float(result.volume),2)))
    assert result.is_watertight and result.volume>0
    assert components==1,(name,components)
(OUT/'print-validation.json').write_text(json.dumps(reports,indent=2))
print(json.dumps({'objects':len(items),'print_parts':reports},indent=2))
