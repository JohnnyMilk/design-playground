import * as THREE from 'three';
import {OrbitControls} from '../dist/assets/OrbitControls.js';
const host=document.getElementById('viewer'),status=document.getElementById('status'),button=document.getElementById('download');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#1b2b39');
const camera=new THREE.PerspectiveCamera(40,1,.1,1000);camera.position.set(240,210,230);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xe5f7ff,0x35465c,2.8));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(90,180,130);scene.add(light);
const group=new THREE.Group();group.rotation.x=-Math.PI/2;scene.add(group);
const allowed=new Set(['body','process','detail','lift','partition','screen']);
let parts=[],base=null,range=null,scale=1;
function geometry(d){if(d.kind==='box')return new THREE.BoxGeometry(...d.size);if(d.kind==='cylinder'){const g=new THREE.CylinderGeometry(d.size[0],d.size[0],d.size[1],20);g.rotateX(Math.PI/2);return g;}const shape=new THREE.Shape();shape.absarc(0,0,d.size[1],0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,d.size[0],0,Math.PI*2,true);shape.holes.push(hole);const g=new THREE.ExtrudeGeometry(shape,{depth:d.size[2],bevelEnabled:false,curveSegments:20});g.translate(0,0,-d.size[2]/2);return g;}
function fit(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(fit).observe(host);
function tick(){requestAnimationFrame(tick);controls.update();renderer.render(scene,camera);}tick();
try{
const response=await fetch('../dist/assets/model.json');if(!response.ok)throw Error('無法讀取原始模型');const data=await response.json();
const bounds=new THREE.Box3();
for(const d of data.items.filter(x=>allowed.has(x.category))){const mesh=new THREE.Mesh(geometry(d));mesh.position.set(...d.pos);mesh.rotation.set(...d.rotation,'ZYX');mesh.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(mesh);bounds.union(b);parts.push({d,mesh});}
const pad=3;scale=200/(bounds.max.x-bounds.min.x+pad*2);
const x0=bounds.min.x-pad,y0=bounds.min.y-pad,z0=bounds.min.z;
const dx=(bounds.max.x-bounds.min.x+2*pad)*scale,dy=(bounds.max.y-bounds.min.y+2*pad)*scale,dz=(bounds.max.z-bounds.min.z)*scale+3.5;
range={dx,dy,dz,x0,y0,z0};
for(const {d,mesh} of parts){mesh.position.set((d.pos[0]-x0)*scale,(d.pos[1]-y0)*scale,(d.pos[2]-z0)*scale+3.5);mesh.scale.setScalar(scale);mesh.updateMatrixWorld(true);mesh.material=new THREE.MeshStandardMaterial({color:d.color,metalness:.24,roughness:.56,side:THREE.DoubleSide});group.add(mesh);}
base=new THREE.Mesh(new THREE.BoxGeometry(dx,dy,3.5),new THREE.MeshStandardMaterial({color:0x354a59,roughness:.8}));base.position.set(dx/2,dy/2,1.75);group.add(base);
controls.target.set(dx/2,25,-dy/2);camera.position.set(dx/2+190,160,dy/2+190);controls.update();
document.getElementById('size').textContent='外廓約 '+dx.toFixed(0)+' × '+dy.toFixed(0)+' × '+dz.toFixed(0)+' mm';
status.textContent='已載入 '+parts.length+' 個保留元件。可旋轉預覽；按下按鈕產生封閉的一體式 STL。';button.disabled=false;
}catch(e){status.textContent='載入失敗：'+e.message;}
button.onclick=async()=>{button.disabled=true;status.textContent='正在將模型融合為單一列印網格，請稍候…';await new Promise(r=>setTimeout(r,80));try{const blob=voxelSTL();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Flexfill_200mm_OnePiece.stl';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent='STL 已產生（'+(blob.size/1048576).toFixed(1)+' MB）。請使用切片軟體檢查並設定支撐。';}catch(e){status.textContent='產生失敗：'+e.message;}finally{button.disabled=false;}};
function voxelSTL(){
const step=1,nx=Math.ceil(range.dx/step)+2,ny=Math.ceil(range.dy/step)+2,nz=Math.ceil(range.dz/step)+2,total=nx*ny*nz;
if(total>10000000)throw Error('模型網格過大');
const vox=new Uint8Array(total),idx=(x,y,z)=>x+nx*(y+ny*z);
for(let z=0;z<4;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++)vox[idx(x,y,z)]=1;
for(const {d,mesh} of parts){
mesh.updateMatrix();const b=mesh.geometry.boundingBox?mesh.geometry.boundingBox.clone():new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);b.applyMatrix4(mesh.matrix);const inv=mesh.matrix.clone().invert(),p=new THREE.Vector3();
const x1=Math.max(0,Math.floor(b.min.x)),x2=Math.min(nx-1,Math.ceil(b.max.x));
const y1=Math.max(0,Math.floor(b.min.y)),y2=Math.min(ny-1,Math.ceil(b.max.y));
const z1=Math.max(0,Math.floor(b.min.z)),z2=Math.min(nz-1,Math.ceil(b.max.z));
for(let z=z1;z<=z2;z++)for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
if(vox[idx(x,y,z)])continue;
p.set(x+.5,y+.5,z+.5).applyMatrix4(inv);
let inside=false;
if(d.kind==='box')inside=Math.abs(p.x)<=d.size[0]/2&&Math.abs(p.y)<=d.size[1]/2&&Math.abs(p.z)<=d.size[2]/2;
else if(d.kind==='cylinder')inside=p.x*p.x+p.y*p.y<=d.size[0]*d.size[0]&&Math.abs(p.z)<=d.size[1]/2;
else {const r=Math.hypot(p.x,p.y);inside=r>=d.size[0]&&r<=d.size[1]&&Math.abs(p.z)<=d.size[2]/2;}
if(inside)vox[idx(x,y,z)]=1;
}
}
const dirs=[[1,0,0],[0,1,0],[0,0,1],[-1,0,0],[0,-1,0],[0,0,-1]];
const corners=[[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]];
let faces=0;
for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(vox[idx(x,y,z)])for(const [a,b,c] of dirs){const xx=x+a,yy=y+b,zz=z+c;if(xx<0||yy<0||zz<0||xx>=nx||yy>=ny||zz>=nz||!vox[idx(xx,yy,zz)])faces++;}
const buffer=new ArrayBuffer(84+faces*2*50),view=new DataView(buffer);view.setUint32(80,faces*2,true);
let at=84;function tri(normal,a,b,c){for(const v of normal){view.setFloat32(at,v,true);at+=4;}for(const p of [a,b,c])for(const v of p){view.setFloat32(at,v,true);at+=4;}view.setUint16(at,0,true);at+=2;}
for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(vox[idx(x,y,z)])for(let k=0;k<6;k++){const [a,b,c]=dirs[k],xx=x+a,yy=y+b,zz=z+c;if(xx>=0&&yy>=0&&zz>=0&&xx<nx&&yy<ny&&zz<nz&&vox[idx(xx,yy,zz)])continue;const pts=corners[k].map(v=>[x+v[0],y+v[1],z+v[2]]);tri(dirs[k],pts[0],pts[1],pts[2]);tri(dirs[k],pts[0],pts[2],pts[3]);}
return new Blob([buffer],{type:'model/stl'});
}