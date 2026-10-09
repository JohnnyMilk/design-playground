import {loadStationContent,escapeText} from './station-content.js?v=12';
import * as THREE from 'three';
import {OrbitControls} from './assets/OrbitControls.js';
const mount=document.querySelector('#canvas'),status=document.querySelector('#loading');
try{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;mount.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,3000);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=55;controls.maxDistance=950;controls.maxPolarAngle=Math.PI*.91;controls.autoRotateSpeed=.55;
 scene.add(new THREE.HemisphereLight(0xe2f6ff,0x536271,2.5));const sun=new THREE.DirectionalLight(0xffffff,3.4);sun.position.set(-150,370,180);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-310,right:310,top:230,bottom:-230,near:1,far:900});sun.shadow.bias=-.0007;scene.add(sun);const fill=new THREE.DirectionalLight(0xd5f7ff,1.4);fill.position.set(180,130,-170);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1600),new THREE.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-.4;ground.receiveShadow=true;scene.add(ground);
 const root=new THREE.Group();root.rotation.x=-Math.PI/2;scene.add(root);
 const response=await fetch('./assets/model.json?v=11');if(!response.ok)throw Error('model');const data=await response.json();const meshes=[];const materials=new Map();
 for(const d of data.items){let geo;if(d.kind==='box')geo=new THREE.BoxGeometry(...d.size);else if(d.kind==='cylinder'){geo=new THREE.CylinderGeometry(d.size[0],d.size[0],d.size[1],24);geo.rotateX(Math.PI/2);}else{const s=new THREE.Shape();s.absarc(0,0,d.size[1],0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,d.size[0],0,Math.PI*2,true);s.holes.push(hole);geo=new THREE.ExtrudeGeometry(s,{depth:d.size[2],bevelEnabled:false,curveSegments:20});geo.translate(0,0,-d.size[2]/2);}
 const key=d.color+d.category;let mat=materials.get(key);if(!mat){mat=new THREE.MeshStandardMaterial({color:d.color,metalness:d.category==='glass'?0:.35,roughness:d.category==='glass'?.15:.48,transparent:d.category==='glass',opacity:d.category==='glass'?.13:1,depthWrite:d.category!=='glass',side:THREE.DoubleSide});materials.set(key,mat);}const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...d.pos);mesh.rotation.set(...d.rotation,'ZYX');mesh.castShadow=d.category!=='glass';mesh.receiveShadow=true;mesh.userData=d;root.add(mesh);meshes.push(mesh);}
 const liftMeshes=meshes.filter(m=>m.userData.category==='lift');
 const partitionMeshes=meshes.filter(m=>m.userData.category==='partition');
 const gateControl=document.querySelector('#partition'),gateLabel=document.querySelector('#partition-state');let gateTarget=1;
 function setGate(v){gateTarget=v;gateControl.value=String(Math.round(v*100));gateLabel.textContent=v>.98?'升起 · nest 可通過':v<.02?'降下 · 擋住 nest':'升降中';}
 gateControl.oninput=()=>setGate(Number(gateControl.value)/100);
 document.querySelector('#partition-focus').onclick=()=>{document.querySelector('#hood').checked=false;visibility();select(1);const p=cameraConfig.partition||{position:[-225,178,245],target:[-92,57,0]};controls.target.set(...p.target);camera.position.set(...p.position);controls.update();};
 // Reference nameplate is rendered as lettering, not embedded in printable geometry.
 const c=document.createElement('canvas');c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#0b7d84';ctx.font='bold 108px Arial';ctx.fillText('flexfill',90,120);const tex=new THREE.CanvasTexture(c);const label=new THREE.Mesh(new THREE.PlaneGeometry(31,5),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));label.rotation.x=Math.PI/2;label.position.set(-13,-35.65,101);root.add(label);
 // Floor-level process path. In top view: inlet above left, outlet to the right.
 const route=[[-130,120],[-130,0],[240,0]];
 for(let j=0;j<route.length-1;j++){const a=new THREE.Vector3(route[j][0],5,-route[j][1]),b=new THREE.Vector3(route[j+1][0],5,-route[j+1][1]);const v=b.clone().sub(a);scene.add(new THREE.ArrowHelper(v.clone().normalize(),a,v.length(),0x00a49b,9,5));}
 function floorLabel(text,x,z){const c=document.createElement('canvas');c.width=512;c.height=96;const cx=c.getContext('2d');cx.fillStyle='#0c6470';cx.font='bold 38px sans-serif';cx.textAlign='center';cx.fillText(text,256,60);const m=new THREE.Mesh(new THREE.PlaneGeometry(73,14),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.2,z);scene.add(m);}
 floorLabel('入料 / DE-BAG',-130,-139);floorLabel('NEST 滑出',231,30);
 const flow=new THREE.Group();scene.add(flow);flow.visible=false;
 const path=[[-130,44,-105],[-130,44,0],[-72,44,0],[-72,44,0],[-48,44,0],[-48,44,0],[-17,44,0],[-17,65,0],[52.5,65,0],[73.5,65,0],[-17,65,0],[-17,44,0],[164,44,0],[221,23,0]];
 const flowNames=['短邊入料至 D/L 轉角','直接轉入長邊第一站','平行鰭片加熱','送往雙滾輪','吸盤取紙並移至廢紙區（示意）','去紙後轉送','共同升降台上升至上層','上層充填','上層打膠塞','完成後退回原升降位置','在原升降位置降至下層','下層向右出料','nest 沿斜坡滑出'];
 for(let j=0;j<path.length-1;j++){const a=new THREE.Vector3(...path[j]),b=new THREE.Vector3(...path[j+1]);const v=b.clone().sub(a);if(v.length()<.001)continue;flow.add(new THREE.ArrowHelper(v.clone().normalize(),a.add(new THREE.Vector3(0,0,20)),v.length(),j<9?0x008e95:0xd79438,Math.min(5,v.length()/3),3));}
 const feedPoints=[[137.5,81,-17],[117,81,-22],[73.5,81,-22],[73.5,77,0]];
 for(let j=0;j<feedPoints.length-1;j++){const a=new THREE.Vector3(...feedPoints[j]),v=new THREE.Vector3(...feedPoints[j+1]).sub(a);flow.add(new THREE.ArrowHelper(v.clone().normalize(),a,v.length(),0x9274ca,4,2));}
 const movingNest=new THREE.Mesh(new THREE.BoxGeometry(20,4,17),new THREE.MeshStandardMaterial({color:0xf4c257,transparent:true,opacity:.8}));flow.add(movingNest);
 let flowTime=0,followFlow=false;const flowStation=[0,1,2,2,2,2,2,3,3,3,2,4,4];const flowCheckbox=document.querySelector('#flow');
 flowCheckbox.onchange=()=>{followFlow=flowCheckbox.checked;flow.visible=flowCheckbox.checked;gateControl.disabled=flow.visible;if(!flow.visible)setGate(1);document.querySelector('#flow-status').hidden=!flow.visible;if(flow.visible){document.querySelector('#hood').checked=false;visibility();selected=-1;showStation(0);renderCameraButtons();view('front');}flowTime=0;};
 let selected=-1;
 const cameraConfig=await (async()=>{
  for(const url of ['https://raw.githubusercontent.com/JohnnyMilk/design-playground/main/flexfill/dist/cameras.json?t='+Date.now(),'./cameras.json?t='+Date.now()]){
   try{const response=await fetch(url,{cache:'no-store'});if(!response.ok)continue;const json=await response.json();
    const valid=v=>v&&typeof v.id==='string'&&typeof v.label==='string'&&[v.position,v.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite));
    if(Array.isArray(json.stations)&&json.stations.some(s=>s.id==='overview')&&json.stations.every(s=>typeof s.id==='string'&&Array.isArray(s.views)&&s.views.length>0&&s.views.every(valid)))return json;
   }catch(e){console.warn('Camera config fallback',e);}
  }
  return {defaultView:'perspective',stations:[{id:'overview',views:[{id:'perspective',label:'立體',position:[-342,354,444],target:[0,45,-28]}]},...data.stages.map((stage,i)=>({id:String(i+1).padStart(2,'0'),views:[{id:'perspective',label:'立體',position:[stage.x-145,150,-stage.y+200],target:[stage.x,55,-stage.y]}]}))]};
 })();
 const cameraBar=document.querySelector('.camera-bar');
 const stationContent=await loadStationContent();
 const desc=stationContent.stations.map(s=>[s.name,s.description]);
 const contentStatus=document.querySelector('#station-content-status');contentStatus.textContent=stationContent.warning;contentStatus.hidden=!stationContent.warning;
 const stations=document.querySelector('#stations'),detail=document.querySelector('#detail');
 const overview=detail.innerHTML;
 desc.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='station';b.setAttribute('aria-controls','detail');b.setAttribute('aria-expanded','false');b.innerHTML=`<span>0${i+1}</span><strong>${escapeText(s[0])}</strong>`;b.addEventListener('click',()=>select(i));stations.append(b);});
 function showStation(i){
  selected=i;
  const buttons=[...stations.querySelectorAll('.station')];
  buttons.forEach((b,n)=>{b.classList.toggle('active',n===i);b.setAttribute('aria-expanded',String(n===i));});
  detail.hidden=false;
  detail.innerHTML=i<0?overview:`<span class="mini">工作站 0${i+1}</span><h2>${escapeText(desc[i][0])}</h2><p>${escapeText(desc[i][1])}</p>`;
  if(i<0)stations.after(detail);else buttons[i].after(detail);
 }
 function select(i){followFlow=false;showStation(i);renderCameraButtons();view(cameraConfig.defaultView||'perspective');}
 function cameraGroup(){return cameraConfig.stations.find(s=>s.id===(selected<0?'overview':stationContent.stations[selected].id))||cameraConfig.stations.find(s=>s.id==='overview');}
 function renderCameraButtons(){
  cameraBar.querySelectorAll('[data-view]').forEach(b=>b.remove());
  const reset=cameraBar.querySelector('#reset');
  for(const preset of cameraGroup().views){const b=document.createElement('button');b.type='button';b.dataset.view=preset.id;b.textContent=preset.label;b.addEventListener('click',()=>view(preset.id));cameraBar.insertBefore(b,reset);}
 }
 function view(v){
  const group=cameraGroup(),preset=group.views.find(p=>p.id===v)||group.views.find(p=>p.id===cameraConfig.defaultView)||group.views[0];
  controls.target.set(...preset.target);camera.up.set(0,1,0);camera.position.set(...preset.position);controls.update();
  cameraBar.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===preset.id));
  document.querySelector('#mode-label').textContent=selected<0?'L 形配置 · 第 12 版':desc[selected][0];
 }
 renderCameraButtons();
 document.querySelector('#all').onclick=()=>select(-1);document.querySelector('#reset').onclick=()=>{document.querySelector('#hood').checked=true;document.querySelector('#glass').checked=true;document.querySelector('#rotate').checked=false;controls.autoRotate=false;flowCheckbox.checked=false;flow.visible=false;gateControl.disabled=false;setGate(1);document.querySelector('#flow-status').hidden=true;visibility();select(-1);};
 function visibility(){meshes.forEach(m=>{m.visible=m.userData.category==='glass'?document.querySelector('#glass').checked&&document.querySelector('#hood').checked:m.userData.category==='hood'?document.querySelector('#hood').checked:true;});label.visible=document.querySelector('#hood').checked;}
 document.querySelector('#glass').onchange=visibility;document.querySelector('#hood').onchange=visibility;document.querySelector('#rotate').onchange=e=>controls.autoRotate=e.target.checked;
 function resize(){const w=mount.clientWidth,h=mount.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(mount);resize();view('perspective');if(camera.aspect<1.15){camera.position.multiplyScalar(1.18);controls.update();}status.hidden=true;
 let last=performance.now();renderer.setAnimationLoop(()=>{const now=performance.now();const dt=Math.min((now-last)/1000,.1);last=now;if(flow.visible){flowTime+=dt;const step=Math.floor(flowTime/2.2)%(path.length-1),t=(flowTime%2.2)/2.2;if(followFlow&&selected!==flowStation[step]){showStation(flowStation[step]);renderCameraButtons();view('front');}setGate(step===1?1:0);movingNest.position.lerpVectors(new THREE.Vector3(...path[step]),new THREE.Vector3(...path[step+1]),t);liftMeshes.forEach(m=>{m.position.z=step===6||step===10?movingNest.position.y-3.5:step>=7&&step<=9?61.5:40.5;});document.querySelector('#flow-status').textContent='工作站 '+stationContent.stations[flowStation[step]].id+'｜'+desc[flowStation[step]][0]+' — '+desc[flowStation[step]][1]+'（'+flowNames[step]+'）';}partitionMeshes.forEach(m=>m.position.z+=(52+24*gateTarget-m.position.z)*Math.min(1,dt*7));if(!flow.visible)liftMeshes.forEach(m=>m.position.z=40.5);controls.update();renderer.render(scene,camera);});
}catch(e){console.error(e);status.textContent='3D 載入失敗。請使用支援 WebGL 的 Safari／Chrome 重新開啟；下方模型檔仍可下載。';}
