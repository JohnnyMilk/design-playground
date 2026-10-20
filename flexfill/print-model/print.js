import * as THREE from 'three';
import {OrbitControls} from '../dist/assets/OrbitControls.js';
const host=document.querySelector('#viewer'),status=document.querySelector('#status'),select=document.querySelector('#mode');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#1b2b39');
const camera=new THREE.PerspectiveCamera(40,1,.1,2000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xe5f7ff,0x35465c,2.8));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(90,180,130);scene.add(light);
const group=new THREE.Group();group.rotation.x=-Math.PI/2;scene.add(group);
new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);
function tick(){requestAnimationFrame(tick);controls.update();renderer.render(scene,camera);}tick();
const colors=['#bccbd3','#49bcae','#e1b473','#ac91d6','#a9c3d2'];
const cache=new Map();let report,request=0;const PRINT_SCALE=1.5;
function scaledName(file){return file.replace('200mm','300mm').replace('Alignment_Key','300mm_Alignment_Key');}
async function download300(file){
 const response=await fetch('./models/'+file);if(!response.ok)throw Error('STL 無法讀取');const buffer=await response.arrayBuffer(),view=new DataView(buffer);const count=view.getUint32(80,true);if(buffer.byteLength!==84+count*50)throw Error('STL 格式不符');
 for(let i=0;i<count;i++)for(let j=0;j<9;j++){const pos=84+i*50+12+j*4;view.setFloat32(pos,view.getFloat32(pos,true)*PRINT_SCALE,true);}
 const url=URL.createObjectURL(new Blob([buffer],{type:'model/stl'}));const a=document.createElement('a');a.href=url;a.download=scaledName(file);a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

async function loadSTL(file){
 if(cache.has(file))return cache.get(file);
 const response=await fetch('./models/'+file);if(!response.ok)throw Error('STL 下載失敗：'+file);
 const buffer=await response.arrayBuffer(),view=new DataView(buffer);if(buffer.byteLength<84)throw Error('STL 不完整');
 const count=view.getUint32(80,true);if(buffer.byteLength!==84+count*50)throw Error('STL 長度錯誤');
 const positions=new Float32Array(count*9);
 for(let i=0;i<count;i++)for(let j=0;j<9;j++)positions[i*9+j]=view.getFloat32(84+i*50+12+j*4,true);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();cache.set(file,geometry);return geometry;
}
async function show(){
 const token=++request;status.textContent='正在讀取實際 STL…';
 try{
 const mode=select.value,indices=mode==='assembled'?[1,2,3]:[Number(mode)];
 const geometries=await Promise.all(indices.map(i=>loadSTL(report.files[i].file)));if(token!==request)return;
 for(const m of [...group.children]){group.remove(m);m.material.dispose();}
 indices.forEach((index,j)=>{const mesh=new THREE.Mesh(geometries[j],new THREE.MeshStandardMaterial({color:colors[index],metalness:.08,roughness:.7}));mesh.scale.setScalar(PRINT_SCALE);if(mode==='assembled')mesh.position.fromArray(report.files[index].assembly_offset_mm.map(v=>v*PRINT_SCALE));group.add(mesh);});
 group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),length=Math.max(size.x,size.y,size.z);
 controls.target.copy(center);const vertical=THREE.MathUtils.degToRad(camera.fov)/2,horizontal=Math.atan(Math.tan(vertical)*camera.aspect),distance=size.length()/2/Math.sin(Math.min(vertical,horizontal))*1.1;camera.position.copy(center).add(new THREE.Vector3(.8,.85,-.95).normalize().multiplyScalar(distance));camera.near=.1;camera.far=2000;camera.updateProjectionMatrix();controls.update();
 const d=mode==='assembled'?[size.x,size.z,size.y]:report.files[indices[0]].dimensions_mm.map(v=>v*PRINT_SCALE);
 document.querySelector('#size').textContent=d.map(x=>x.toFixed(2)).join(' × ')+' mm';
 status.textContent='已載入實際 STL。拖曳旋轉、滾輪縮放。'+(mode==='assembled'?'顏色區分三個完整基座模組；接縫間隙 0.24 mm。':'與下方下載檔案使用相同網格。');
 }catch(error){status.textContent='載入失敗：'+error.message;}
}
select.addEventListener('change',show);
try{
 const response=await fetch('./validation.json');if(!response.ok)throw Error('驗證報告無法讀取');report=await response.json();
 const tbody=document.querySelector('#files');
 for(const f of report.files){const tr=document.createElement('tr');const values=[f.label,f.dimensions_mm.map(x=>(x*PRINT_SCALE).toFixed(2)).join(' × '),'沿用 20 cm 已驗證網格，等比放大'];for(const value of values){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}const td=document.createElement('td'),a=document.createElement('a');a.href='#';a.textContent='下載 30 cm STL';a.addEventListener('click',async e=>{e.preventDefault();a.textContent='產生中…';try{await download300(f.file);}catch(error){status.textContent='下載失敗：'+error.message;}finally{a.textContent='下載 30 cm STL';}});td.appendChild(a);tr.appendChild(td);tbody.appendChild(tr);}
 select.disabled=false;await show();
}catch(error){status.textContent='載入失敗：'+error.message;}
