import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import audioData from './audio-data.js';
import {collapsedLungPosition,collapsedAirwayPosition} from './effusion-shape.js';
import {airway,segments,lobeNames,segmentNames,fixedTargets,routeSections} from './airway-data.js';
import {presetLesionPosition} from './lesion-placement.js';
if(audioData.broncho)window.privateAudioData=audioData;

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
camera.position.set(0, .15, 7.9);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -.1, 0);
controls.enableDamping = true;
controls.minDistance = 4.6;
controls.maxDistance = 13;
controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0xb7ada4, 1.55));
const light = new THREE.DirectionalLight(0xffffff, 1.65); light.position.set(-3, 5, 7); scene.add(light);
const backLight = new THREE.DirectionalLight(0xd5e6e0, .65); backLight.position.set(3, 2, -5); scene.add(backLight);

const palette = { RUL:0x84a5c3, RML:0xd9a557, RLL:0x91b18b, LUL:0xab91bc, LLL:0xbf8188 };
const names = {...lobeNames,...segmentNames};
const lungMeshes = {};
const lungMaterials = {};
const lungGroup = new THREE.Group(); scene.add(lungGroup);
const fissureGroup = new THREE.Group(); scene.add(fissureGroup);
const fissureMeshes = [];
let anatomyLoaded = false;
const bronze = 0xc9ab93;
const bronchiGroup = new THREE.Group(); scene.add(bronchiGroup);
const heartGroup = new THREE.Group(); scene.add(heartGroup);
const nerveGroup = new THREE.Group(); scene.add(nerveGroup);
const procedureGroup = new THREE.Group(); scene.add(procedureGroup);
const effusionGroup=new THREE.Group();scene.add(effusionGroup);
function rebuildEffusion(){
  const oldGeometries=new Set();
  for(const old of [...effusionGroup.children]){effusionGroup.remove(old);old.material.dispose();oldGeometries.add(old.geometry);}
  for(const geometry of oldGeometries)geometry.dispose();
  const levels=[0,-1.05,-.57,.06];
  for(const [key,lung] of Object.entries(lungMeshes)){
    // One uncompressed contour per lobe serves all three water levels.
    const shell=lung.geometry.clone();
    const base=lung.userData.basePositions;
    if(base){shell.getAttribute('position').array.set(base);shell.computeVertexNormals();}
  for(const amount of [1,2,3]){
    const side=key[0],level=levels[amount];
    const material=new THREE.ShaderMaterial({
      uniforms:{level:{value:level},side:{value:side==='R'?-1:1}},
      vertexShader:`varying vec3 localPoint; void main(){localPoint=position;vec3 raised=position+normal*.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(raised,1.);}`,
      fragmentShader:`uniform float level;uniform float side;varying vec3 localPoint;
        void main(){float lateral=clamp((side*localPoint.x-.35)/1.55,0.,1.);
          float edge=level+.17*lateral*lateral+.06*clamp(-localPoint.z,0.,1.);
          if(localPoint.y>edge)discard;
          float body=1.-smoothstep(edge-.34,edge,localPoint.y);
          gl_FragColor=vec4(.36,.57,.65,.26+.22*body);
        }`,
      transparent:true,depthWrite:true,side:THREE.FrontSide,toneMapped:false
    });
    // A stationary shell follows the original pleural contour. As the lung
    // compresses beneath it, the fluid fills the space instead of becoming a ball.
    const overlay=new THREE.Mesh(shell,material);
    overlay.userData={side,lobe:key,amount};overlay.renderOrder=4;effusionGroup.add(overlay);
  }
  }
  updateEffusion();
}
function updateEffusion(){const value=+$('effusionAmount').value,side=$('effusionSide').value;
  $('effusionValue').textContent=['','少量','中量','大量'][value];
  for(const mesh of effusionGroup.children)mesh.visible=$('showEffusion').checked&&mesh.userData.amount===value&&(side==='both'||side===mesh.userData.side);
  for(const [key,mesh] of Object.entries(lungMeshes)){
    deformLungForEffusion(mesh,key[0],effusionStrength(key[0]));
  }
  deformAirwayForEffusion();
  updateTumor();
}
function effusionStrength(side){
  if(!$('showEffusion').checked||!($('effusionSide').value==='both'||$('effusionSide').value===side))return 0;
  return +$('effusionAmount').value===3?1:+$('effusionAmount').value===2?.32:0;
}
function compressPointForEffusion(point,side,strength){
  return point.fromArray(collapsedLungPosition(point.x,point.y,point.z,side,strength));
}
function uncompressPointForEffusion(point,side,strength){
  if(!strength)return point;
  const compressed=point.clone();
  for(let i=0;i<7;i++){
    const projected=compressPointForEffusion(point.clone(),side,strength);
    point.add(compressed.clone().sub(projected));
  }
  return point;
}
function deformLungForEffusion(mesh,side,strength){
  const position=mesh.geometry.getAttribute('position');
  const base=mesh.userData.basePositions ||= new Float32Array(position.array);
  const current=position.array;
  for(let i=0;i<current.length;i+=3){
    const p=collapsedLungPosition(base[i],base[i+1],base[i+2],side,strength);
    current[i]=p[0];current[i+1]=p[1];current[i+2]=p[2];
  }
  position.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
}
function deformAirwayPoint(point){
  return point.fromArray(collapsedAirwayPosition(point.x,point.y,point.z,effusionStrength('R'),effusionStrength('L')));
}
function deformAirwayForEffusion(){
  const right=effusionStrength('R'),left=effusionStrength('L');
  for(const mesh of bronchiGroup.children){
    if(!mesh.userData.airwayDeformable)continue;
    const position=mesh.geometry.getAttribute('position');
    const base=mesh.userData.basePositions ||= new Float32Array(position.array);
    const current=position.array;
    for(let i=0;i<base.length;i+=3){
      const p=collapsedAirwayPosition(base[i],base[i+1],base[i+2],right,left);
      current[i]=p[0];current[i+1]=p[1];current[i+2]=p[2];
    }
    position.needsUpdate=true;
    mesh.geometry.computeBoundingSphere();
  }
}

// A broad diaphragmatic base and tapered apex give the lungs their characteristic silhouette.
function lungPoint(side, s, phi) {
  const width = .88 * Math.pow(Math.max(.0001, 1-s), .53) * (1+.35*s);
  const depth = .67 * Math.pow(Math.max(.0001, 1-s), .38);
  const xLocal = Math.cos(phi) * width;
  const z = Math.sin(phi) * depth;
  let x = side * 1.05 + xLocal;
  let y = -1.52 + 3.22*s + .065*Math.cos(phi)**2*(1-s)**3;
  // The left anterior border indents for the heart; a lower lingula remains.
  if (side === 1 && xLocal < 0 && z > 0 && y < .10 && y > -1.25) {
    const notch = Math.sin(Math.PI*(y+1.25)/1.35);
    x += .44*notch*Math.pow(Math.max(0,-xLocal/width),2);
  }
  return new THREE.Vector3(x,y,z);
}
function lungNormal(side,s,phi) {
  const ds=lungPoint(side,Math.min(.999,s+.003),phi).sub(lungPoint(side,Math.max(0,s-.003),phi));
  const dp=lungPoint(side,s,phi+.003).sub(lungPoint(side,s,phi-.003));
  return ds.cross(dp).normalize();
}
function frontFraction(phi) { return THREE.MathUtils.clamp(phi/Math.PI,0,1); }
function rightOblique(phi) { return .12+.27*frontFraction(phi); }
function leftOblique(phi) { return .43-.26*frontFraction(phi); }
function lobeAt(side,s,phi) {
  if (side===-1) {
    if (phi<=Math.PI) return s>.55?'RUL':s>rightOblique(phi)?'RML':'RLL';
    return s>.55+.22*Math.sin(phi-Math.PI)?'RUL':'RLL';
  }
  if (phi<=Math.PI) return s>leftOblique(phi)?'LUL':'LLL';
  const q=(phi-Math.PI)/Math.PI;
  return s>.17+.26*q+.29*Math.sin(Math.PI*q)?'LUL':'LLL';
}
function watercolorTexture() {
  const c=document.createElement('canvas'); c.width=c.height=512;
  const ctx=c.getContext('2d'); ctx.fillStyle='#fffdfa';ctx.fillRect(0,0,512,512);
  let seed=73129;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<950;i++) {
    const x=rnd()*512,y=rnd()*512,rx=4+rnd()*65,ry=3+rnd()*35;
    ctx.save();ctx.translate(x,y);ctx.rotate(rnd()*Math.PI);ctx.fillStyle=i%4===0?'rgba(143,74,67,.035)':'rgba(115,84,80,.024)';
    ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  for(let i=0;i<16000;i++){const v=Math.floor(160+rnd()*75);ctx.fillStyle=`rgba(${v},${v-17},${v-18},.035)`;ctx.fillRect(rnd()*512,rnd()*512,1.2,1.2);}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}
const lungWash=watercolorTexture();
function addTriangle(bucket, side, vertices) {
  for(const [s,phi] of vertices){const p=lungPoint(side,s,phi),n=lungNormal(side,s,phi);bucket.pos.push(p.x,p.y,p.z);bucket.norm.push(n.x,n.y,n.z);bucket.uv.push(phi/(2*Math.PI),s);}
}
function makeLung(side) {
  const buckets=Object.fromEntries((side===-1?['RUL','RML','RLL']:['LUL','LLL']).map(k=>[k,{pos:[],norm:[],uv:[]}]));
  const rings=96,slices=144;
  for(let j=0;j<rings;j++)for(let i=0;i<slices;i++){
    const s0=.999*j/rings,s1=.999*(j+1)/rings,p0=2*Math.PI*i/slices,p1=2*Math.PI*(i+1)/slices;
    const bucket=buckets[lobeAt(side,(s0+s1)/2,(p0+p1)/2)];
    addTriangle(bucket,side,[[s0,p0],[s1,p0],[s1,p1]]);
    addTriangle(bucket,side,[[s0,p0],[s1,p1],[s0,p1]]);
  }
  for(const [key,data] of Object.entries(buckets)){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(data.pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.norm,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
    const mat=new THREE.MeshStandardMaterial({color:0xbc6968,map:lungWash,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:1,depthWrite:true});
    const mesh=new THREE.Mesh(geo,mat);mesh.userData.lobe=key;lungMeshes[key]=mesh;lungMaterials[key]=mat;lungGroup.add(mesh);
  }
}
function fissure(side, cut) {
  const points=[];
  for(let i=1;i<72;i++){const phi=Math.PI*i/72,s=cut(phi),p=lungPoint(side,s,phi),n=lungNormal(side,s,phi);points.push(p.addScaledVector(n,.012));}
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.012,6,false),new THREE.MeshStandardMaterial({color:0x8c5554,roughness:1,transparent:true,opacity:.72}));
  fissureGroup.add(mesh);fissureMeshes.push(mesh);
}
function showFallbackLungs(){
  for(const [key,mesh] of Object.entries(lungMeshes)){
    lungGroup.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
    delete lungMeshes[key];delete lungMaterials[key];
  }
  makeLung(-1);makeLung(1);
  fissure(-1,()=>.55);fissure(-1,rightOblique);fissure(1,leftOblique);
  updateView();rebuildEffusion();
}

async function loadAnatomicalLungs() {
  const {default:lungMeshData}=await import('./lung-mesh-data.js');
  const bytes=Uint8Array.from(atob(lungMeshData),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer=await new Response(stream).arrayBuffer();
  const view=new DataView(buffer);
  const magic=String.fromCharCode(...new Uint8Array(buffer,0,5));
  if(magic!=='LUNG1')throw new Error('Invalid lung mesh data');
  let at=6;
  const count=view.getUint8(5);
  const oldShells=new Set();
  for(const old of [...effusionGroup.children]){effusionGroup.remove(old);old.material.dispose();oldShells.add(old.geometry);}
  for(const geometry of oldShells)geometry.dispose();
  for(const mesh of Object.values(lungMeshes)){
    lungGroup.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
  }
  for(let g=0;g<count;g++){
    const key=String.fromCharCode(...new Uint8Array(buffer,at,3));at+=3;
    const nv=view.getUint32(at,true),ni=view.getUint32(at+4,true);at+=8;
    const positions=new Float32Array(nv*3),uvs=new Float32Array(nv*2),indices=new Uint32Array(ni);
    for(let i=0;i<nv;i++){
      const x=view.getFloat32(at,true),y=view.getFloat32(at+4,true),z=view.getFloat32(at+8,true);at+=12;
      positions.set([x,y,z],i*3);uvs.set([x*.24+.5,y*.24+.5],i*2);
    }
    for(let i=0;i<ni;i++){indices[i]=view.getUint32(at,true);at+=4;}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    geo.setIndex(new THREE.BufferAttribute(indices,1));
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:0xc78a83,map:lungWash,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:1,depthWrite:true});
    const mesh=new THREE.Mesh(geo,mat);mesh.userData.lobe=key;
    lungMeshes[key]=mesh;lungMaterials[key]=mat;lungGroup.add(mesh);
  }
  anatomyLoaded=true;
  updateView();
  rebuildEffusion();
  const status=$('loadingStatus');if(status)status.remove();
}
loadAnatomicalLungs().catch(error=>{
  console.error(error);showFallbackLungs();
  const status=$('loadingStatus');if(status){status.textContent='肺部網格載入失敗，已改用簡化模型';setTimeout(()=>status.remove(),3000);}
});

function tube(points, radius, color, parent, opacity=1) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mat = new THREE.MeshStandardMaterial({ color, roughness:.75, transparent:opacity<1, opacity });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*8),radius,9,false),mat);
  parent.add(mesh); return mesh;
}
function seamlessAorta(){
  // One continuous sweep replaces three adjoining source pieces. Their
  // separate end caps and normals made a visible ring at the arch junction.
  const points=[
    [.23,-.45,.17],[.23,0,.18],[.08,.30,.30],[.06,.60,.24],
    [.08,.84,.15],[.25,1.00,-.12],[.37,.82,-.43],[.32,.59,-.62],
    [.31,.28,-.73],[.29,0,-.70],[.17,-.50,-.53],[.17,-1.00,-.27],[.14,-1.55,-.12]
  ];
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  const length=176,sides=20,geometry=new THREE.TubeGeometry(curve,length,1,sides,false);
  const position=geometry.getAttribute('position');
  for(let ring=0;ring<=length;ring++){
    const t=ring/length,center=curve.getPointAt(t);
    const radius=.132-.033*THREE.MathUtils.smoothstep(t,.42,.82);
    for(let j=0;j<=sides;j++){
      const i=ring*(sides+1)+j;
      const x=position.getX(i)-center.x,y=position.getY(i)-center.y,z=position.getZ(i)-center.z;
      position.setXYZ(i,center.x+x*radius,center.y+y*radius,center.z+z*radius);
    }
  }
  position.needsUpdate=true;geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb06866,roughness:1,side:THREE.DoubleSide}));
  mesh.userData.organ='AORT';return mesh;
}
function oval(parent, color, pos, scale, rotation=0) {
  const obj = new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshStandardMaterial({color,roughness:.85}));
  obj.position.set(...pos); obj.scale.set(...scale); obj.rotation.z=rotation; parent.add(obj); return obj;
}
const presetTargets=fixedTargets;
function populateLocationMenu(){
  const select=$('locationSelect');
  select.replaceChildren();
  for(const lobe of Object.keys(lobeNames)){
    const group=document.createElement('optgroup');group.label=lobeNames[lobe];
    const whole=document.createElement('option');whole.value=lobe;whole.textContent='整個肺葉（固定示範點）';group.appendChild(whole);
    for(const [key,segment] of Object.entries(segments))if(segment.lobe===lobe){
      const option=document.createElement('option');option.value=key;option.textContent=segment.label;group.appendChild(option);
    }
    select.appendChild(group);
  }
  for(const [key,label] of [['TR','氣管旁（TBNA）'],['SC','隆突下（TBNA）']]){
    const option=document.createElement('option');option.value=key;option.textContent=label;select.appendChild(option);
  }
}
populateLocationMenu();
// The main, lobar and segmental bronchi are baked as one watertight union.
// One surface removes the crossing caps and patch spheres at bifurcations.
async function loadAirwayMesh(){
  const {default:data}=await import('./airway-mesh-data.js');
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const buffer=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const view=new DataView(buffer);
  if(String.fromCharCode(...new Uint8Array(buffer,0,5))!=='AIRW1')throw new Error('Invalid airway mesh');
  const count=view.getUint32(8,true),packed=new Float32Array(buffer,12,count*6);
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3);
  for(let i=0;i<count;i++){positions.set(packed.subarray(i*6,i*6+3),i*3);normals.set(packed.subarray(i*6+3,i*6+6),i*3);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:bronze,roughness:.75,side:THREE.DoubleSide}));
  mesh.userData.airwayDeformable=true;
  bronchiGroup.add(mesh);
  for(const old of guideTubes){bronchiGroup.remove(old);old.geometry.dispose();old.material.dispose();}
  deformAirwayForEffusion();
}
const guideTubes=[];
guideTubes.push(tube(airway.trachea,.115,bronze,bronchiGroup));
for(const [key,radius] of [['rightMain',.103],['leftMain',.095],...['RUL','RML','RLL','LUL','LLL'].map(key=>[key,.064]),...Object.keys(segments).map(key=>[key,.038])]){
  guideTubes.push(tube(airway[key]||segments[key].points,radius,bronze,bronchiGroup));
}
for(const guide of guideTubes)guide.userData.airwayDeformable=true;
loadAirwayMesh().catch(error=>console.error('Airway mesh fallback',error));
for(let y=.85;y<1.96;y+=.115){const ring=new THREE.Mesh(new THREE.TorusGeometry(.123,.008,6,30),new THREE.MeshStandardMaterial({color:0xe2c5ad,roughness:1}));ring.rotation.x=Math.PI/2;ring.position.set(0,y,.04);bronchiGroup.add(ring);}

oval(heartGroup,0xb97873,[.18,-.65,-.07],[.44,.66,.35],-.24);
// Ascending aorta crosses into a short arch towards the patient's left (viewer right).
tube([[.12,-.23,-.09],[.27,.20,-.13],[.25,.78,-.16],[.44,.95,-.18],[.68,.78,-.23],[.71,.39,-.29]],.105,0xb86d68,heartGroup);
tube([[.36,.36,.08],[.12,.31,.21],[-.17,.21,.18]],.085,0x738fa4,heartGroup);
tube([[.38,.34,.08],[.69,.25,.18],[.85,.21,.14]],.075,0x738fa4,heartGroup);
tube([[-.43,1.35,-.25],[-.46,.62,-.19],[-.37,-.08,-.16]],.07,0x7998aa,heartGroup);
tube([[.15,-.58,-.1],[-.13,-.57,.02],[-.51,-.60,.07]],.043,0xb77c74,heartGroup);
tube([[.30,-.58,-.1],[.65,-.60,.04],[.91,-.62,.07]],.043,0xb77c74,heartGroup);
tube([[-.28,1.32,-.32],[-.33,.65,-.29],[-.43,.11,-.27],[-.48,-.42,-.25]],.023,0xe4c98c,nerveGroup);
tube([[.30,1.32,-.32],[.41,.66,-.34],[.53,.08,-.31],[.52,-.43,-.3]],.023,0xe4c98c,nerveGroup);

async function loadAnatomicalOrgans(){
  const {default:organMeshData}=await import('./organ-mesh-data.js');
  const bytes=Uint8Array.from(atob(organMeshData),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer=await new Response(stream).arrayBuffer(),view=new DataView(buffer);
  if(String.fromCharCode(...new Uint8Array(buffer,0,5))!=='ORGN1')throw new Error('Invalid organ mesh data');
  let at=6;
  const colors={HEAR:0xb77d79,AORT:0xb06866,NECA:0xb97370,NEJV:0x7894a8,PULA:0x6488a0,PULV:0xb97c77};
  const meshes=[];
  for(let g=0;g<view.getUint8(5);g++){
    const key=String.fromCharCode(...new Uint8Array(buffer,at,4));at+=4;
    const nv=view.getUint32(at,true),ni=view.getUint32(at+4,true);at+=8;
    const positions=new Float32Array(nv*3),indices=new Uint32Array(ni);
    for(let i=0;i<positions.length;i++){positions[i]=view.getFloat32(at,true);at+=4;}
    for(let i=0;i<ni;i++){indices[i]=view.getUint32(at,true);at+=4;}
    if(key==='AORT')continue;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geo.setIndex(new THREE.BufferAttribute(indices,1));geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:colors[key],roughness:1,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geo,mat);mesh.userData.organ=key;meshes.push(mesh);
  }
  meshes.push(seamlessAorta());
  for(const old of [...heartGroup.children]){heartGroup.remove(old);old.geometry?.dispose();old.material?.dispose();}
  for(const mesh of meshes)heartGroup.add(mesh);
  // The source set only includes the upper left common carotid outside this chest crop.
  const leftCarotid=tube([[.18,.91,-.08],[.22,1.31,-.06],[.25,1.78,-.05],[.26,2.02,-.05]],.042,colors.NECA,heartGroup);
  leftCarotid.userData.organ='NECA';
  updateView();
}
loadAnatomicalOrgans().catch(error=>console.error('Anatomical organ fallback',error));

const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const lesions=[];
let activeIndex=0;
let placement=false, dragging=false, playing=false, lastTime=0, currentPreset='natural';
let scopeMesh=null, forcepsMesh=null, toastTimer;
let breathBlend=0,breathAudio=null,breathGain=null,stethGain=null,stethFilter=null;
let auscultation=false,auscZone=null;
let teachingAudio=null,teachingAudioKey=null,teachingAudioPending=false,teachingAudioBlocked=false;
function setAudioGain(node,value){if(breathAudio&&node)node.gain.setTargetAtTime(value,breathAudio.currentTime,.06);}
function setBreathGain(value){setAudioGain(breathGain,value);}
async function enableBreathAudio(){
  if(!breathAudio){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('Audio unavailable');
    breathAudio=new AudioContext();
    const rate=breathAudio.sampleRate,buffer=breathAudio.createBuffer(1,rate*3,rate),samples=buffer.getChannelData(0);
    let seed=48621;for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=(seed/2147483648-1)*.55;}
    const source=breathAudio.createBufferSource();source.buffer=buffer;source.loop=true;
    const high=breathAudio.createBiquadFilter();high.type='highpass';high.frequency.value=110;
    const low=breathAudio.createBiquadFilter();low.type='lowpass';low.frequency.value=950;
    breathGain=breathAudio.createGain();breathGain.gain.value=0;
    source.connect(high);high.connect(low);low.connect(breathGain);breathGain.connect(breathAudio.destination);
    const stethHigh=breathAudio.createBiquadFilter();stethHigh.type='highpass';stethHigh.frequency.value=65;
    stethFilter=breathAudio.createBiquadFilter();stethFilter.type='lowpass';stethFilter.frequency.value=650;
    stethGain=breathAudio.createGain();stethGain.gain.value=0;
    source.connect(stethHigh);stethHigh.connect(stethFilter);stethFilter.connect(stethGain);stethGain.connect(breathAudio.destination);
    source.start();
  }
  if(breathAudio.state==='suspended')await breathAudio.resume();
}
function syncTeachingAudio(key,volume){
  if(!key){if(teachingAudio&&!teachingAudio.paused)teachingAudio.pause();return;}
  if(key!==teachingAudioKey){
    if(teachingAudio){teachingAudio.pause();teachingAudio.remove();}
    teachingAudio=new Audio(audioData[key]);teachingAudio.loop=true;teachingAudio.preload='auto';
    teachingAudio.id='teachingAudio';teachingAudio.hidden=true;document.body.appendChild(teachingAudio);
    teachingAudioKey=key;teachingAudioPending=false;teachingAudioBlocked=false;
  }
  teachingAudio.volume=Math.min(1,volume*.8);
  if(teachingAudio.paused&&!teachingAudioPending&&!teachingAudioBlocked){
    teachingAudioPending=true;
    teachingAudio.play().then(()=>{teachingAudioPending=false;}).catch(()=>{teachingAudioPending=false;teachingAudioBlocked=true;toast('點擊模型後即可播放聽診錄音');});
  }
}

function newLesion(data={}){
  const mesh=oval(scene,0xd6a14f,[0,0,0],[.16,.16,.16]);
  mesh.material.emissive=new THREE.Color(0x67441a);mesh.material.emissiveIntensity=.1;
  mesh.material.depthTest=false;mesh.material.depthWrite=false;mesh.material.transparent=true;mesh.material.opacity=.96;mesh.renderOrder=21;
  const halo=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0xf3d38a,transparent:true,opacity:.13,depthTest:false,depthWrite:false}));
  halo.renderOrder=20;scene.add(halo);
  const location=data.location||((data.type==='node')?'TR':names[data.lobe]?data.lobe:'RUL');
  return {location,mode:data.mode||'preset',size:Number(data.size)||3,
    point:new THREE.Vector3(...(data.point||[-1.05,.66,.58])),normal:new THREE.Vector3(...(data.normal||[0,0,1])),
    mesh,halo};
}
function activeLesion(){return lesions[activeIndex];}
function saveCase(){localStorage.setItem('lungDemoCase',JSON.stringify({version:3,activeIndex,lesions:lesions.map(l=>({location:l.location,mode:l.mode,size:l.size,point:l.point.toArray(),normal:l.normal.toArray()}))}));}
function restoreCase(){try{const v=JSON.parse(localStorage.getItem('lungDemoCase'));if(Array.isArray(v?.lesions)){for(const item of v.lesions.slice(0,3))lesions.push(newLesion(item));activeIndex=Math.min(v.activeIndex||0,lesions.length-1);}else if(v){lesions.push(newLesion({location:v.lobe,size:v.size,point:v.point,normal:v.normal}));}}catch{}if(!lesions.length)lesions.push(newLesion());activeIndex=Math.max(0,activeIndex);}
function renderLesionTabs(){const box=$('lesionTabs');box.replaceChildren();lesions.forEach((l,i)=>{const b=document.createElement('button');b.className='lesion-tab'+(i===activeIndex?' active':'');b.textContent=`病灶 ${i+1}`;b.addEventListener('click',()=>{if(placement)togglePlacement();activeIndex=i;syncLesionUI();updateTumor();});box.appendChild(b);});$('addLesion').disabled=lesions.length>=3;$('removeLesion').disabled=lesions.length<=1;}
function syncLesionUI(){const l=activeLesion();$('locationSelect').value=l.location;$('size').value=l.size;$('sizeValue').textContent=l.size.toFixed(1)+' cm';$('placeBtn').hidden=l.location==='TR'||l.location==='SC';$('placementState').textContent=l.mode==='free'?'目前：自由設定位置':'目前：固定示範位置';renderLesionTabs();}
function updateTumor(){
  const visible=$('showTumor').checked;
  for(const l of lesions){const radius=l.size*.065;
    const pos=l.mode==='free'?l.point.clone().addScaledVector(l.normal,-Math.max(.12,radius+.045)):new THREE.Vector3(...presetLesionPosition(l.location,l.size));
    compressPointForEffusion(pos,l.location[0],effusionStrength(l.location[0]));
    l.mesh.position.copy(pos);l.mesh.scale.setScalar(radius);l.halo.position.copy(pos);l.halo.scale.setScalar(radius*1.08);
    l.mesh.visible=visible;l.halo.visible=visible;l.halo.material.opacity=l===activeLesion() ? .22 : .08;
  }
  saveCase();updateProcedure();
}
restoreCase();syncLesionUI();
function updateView(){
  const colored=currentPreset==='lobes',alpha=+$('opacity').value/100;
  for(const [key,mat] of Object.entries(lungMaterials)){
    mat.color.setHex(colored?palette[key]:anatomyLoaded?0xc78a83:0xbc6968);
    mat.opacity=alpha;mat.depthWrite=alpha>.9;
    lungMeshes[key].visible=$('showLungs').checked&&alpha>0;mat.needsUpdate=true;
  }
  fissureGroup.visible=!anatomyLoaded&&$('showLungs').checked&&alpha>.05;
  for(const mesh of fissureMeshes)mesh.material.opacity=alpha*.8;
  bronchiGroup.visible=$('showBronchi').checked;
  heartGroup.visible=$('showHeart').checked;
  const organControls={AORT:'showAorta',NECA:'showCarotids',NEJV:'showJugulars',PULA:'showPulmArtery',PULV:'showPulmVein'};
  for(const mesh of heartGroup.children){const id=organControls[mesh.userData.organ];if(id)mesh.visible=$(id).checked;}
  nerveGroup.visible=$('showNerves').checked;
  $('opacityValue').textContent=$('opacity').value+'%';
  $('labels').style.display=$('showLabels').checked?'block':'none';
  updateTumor();
}
function preset(name){currentPreset=name;document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));$('opacity').value= name==='inside'||name==='scope'?18:100;$('showLungs').checked=true;$('showBronchi').checked=true;$('showHeart').checked=name!=='inside'&&name!=='scope';$('showNerves').checked=false;updateView();if(name==='scope'){$('scopePanel').open=true;$('procedure').value=0;updateProcedure();setAuscZone(null);}else{playing=false;$('playBtn').textContent='▶ 播放';}}
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
for(const id of ['showLungs','showBronchi','showHeart','showAorta','showCarotids','showJugulars','showPulmArtery','showPulmVein','showNerves','showLabels','opacity'])$(id).addEventListener('input',updateView);
function updateBreathVolumeLabel(){$('breathVolumeValue').textContent=$('breathVolume').value+'%';}
$('breathVolume').addEventListener('input',updateBreathVolumeLabel);
$('breathSound').addEventListener('change',async()=>{
  $('breathVolumeRow').hidden=!$('breathSound').checked&&!auscultation;
  if(!$('breathSound').checked){setBreathGain(0);return;}
  try{await enableBreathAudio();}catch{$('breathSound').checked=false;$('breathVolumeRow').hidden=true;toast('這個瀏覽器暫時無法播放呼吸音');}
});
function startBreathSound(){
  if((!$('breathSound').checked&&!auscultation)||breathAudio?.state==='running')return;
  enableBreathAudio().catch(()=>{$('breathSound').checked=false;$('breathVolumeRow').hidden=true;toast('這個瀏覽器暫時無法播放呼吸音');});
}
function setAuscZone(zone){
  auscZone=zone;
  const labels={tracheal:'氣管音（tracheal）',bronchovesicular:'支氣管肺泡音（bronchovesicular）',vesicular:'肺泡音（vesicular）'};
  const synthetic=$('auscultationSound').value==='normal'&&(zone==='tracheal'||zone==='bronchovesicular'&&!audioData.broncho);
  $('auscultationReadout').textContent=currentPreset==='scope'?'支氣管鏡展示時，聽診暫停。':zone?`目前：${labels[zone]}${synthetic?'（音色示意）':''}`:'將聽診器移到氣管或肺部。';
}
function setAuscMode(on){
  auscultation=on;setAuscZone(null);
  $('auscultationMode').classList.toggle('on',on);
  $('auscultationMode').setAttribute('aria-pressed',String(on));
  $('auscultationMode').textContent=on?'🩺 結束聽診':'🩺 開啟聽診';
  viewport.classList.toggle('auscultating',on);
  $('breathVolumeRow').hidden=!$('breathSound').checked&&!on;
  if(!on)syncTeachingAudio(null,0);
  if(on)startBreathSound();
}
$('auscultationMode').addEventListener('click',()=>{if(!auscultation&&placement)togglePlacement();setAuscMode(!auscultation);});
$('auscultationSound').addEventListener('change',()=>{syncTeachingAudio(null,0);teachingAudioKey=null;setAuscZone(auscZone);});
const originalAudio={...audioData};
const personalKeys=['broncho','coarse','fine','stridor','vesicular','wheeze'];
const personalUrls=new Map();
function personalKey(filename){
  const name=filename.toLowerCase();
  if(name.startsWith('bronch'))return 'broncho';
  if(name.startsWith('coarse'))return 'coarse';
  if(name.startsWith('fine'))return 'fine';
  if(name.startsWith('stridor'))return 'stridor';
  if(name.startsWith('vesicular'))return 'vesicular';
  if(name.startsWith('wheez'))return 'wheeze';
  return null;
}
function openPersonalDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('chesttools-personal-audio',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('clips');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function resetTeachingAudio(){
  if(teachingAudio){teachingAudio.pause();teachingAudio.removeAttribute('src');teachingAudio.load();teachingAudio.remove();teachingAudio=null;}
  teachingAudioKey=null;teachingAudioPending=false;teachingAudioBlocked=false;
}
async function refreshPersonalAudio(db){
  const clips=await new Promise((resolve,reject)=>{
    const transaction=db.transaction('clips','readonly');
    const request=transaction.objectStore('clips').getAll();
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  resetTeachingAudio();
  for(const url of personalUrls.values())URL.revokeObjectURL(url);
  personalUrls.clear();
  for(const key of personalKeys){if(originalAudio[key])audioData[key]=originalAudio[key];else delete audioData[key];}
  for(const item of clips){
    if(!personalKeys.includes(item.key)||!(item.blob instanceof Blob))continue;
    const url=URL.createObjectURL(item.blob);
    personalUrls.set(item.key,url);audioData[item.key]=url;
  }
  const stridorOption=$('auscultationSound').querySelector('option[value="stridor"]');
  stridorOption.disabled=!audioData.stridor;
  stridorOption.textContent=personalUrls.has('stridor')?'Stridor（個人音檔）':audioData.stridor?'Stridor（真實錄音）':'Stridor（匯入個人音檔後可用）';
  if(stridorOption.disabled&&$('auscultationSound').value==='stridor')$('auscultationSound').value='normal';
  $('personalAudioStatus').textContent=personalUrls.size?`已載入 ${personalUrls.size}/6 段個人短音檔；只存在此瀏覽器。`:'尚未載入個人音檔。';
  setAuscZone(auscZone);
}
async function loadPersonalAudio(){
  try{const db=await openPersonalDb();await refreshPersonalAudio(db);db.close();}
  catch{$('personalAudioStatus').textContent='此瀏覽器無法保存音檔；請確認未停用網站儲存空間。';}
}
$('personalAudioFiles').addEventListener('change',async event=>{
  const files=Array.from(event.target.files||[]);
  const matched=files.map(file=>({key:personalKey(file.name),file})).filter(item=>item.key&&item.file.name.toLowerCase().endsWith('.mp3'));
  if(!matched.length){$('personalAudioStatus').textContent='未找到對應音檔；請選取 clips 資料夾中的 MP3。';return;}
  try{
    const db=await openPersonalDb();
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction('clips','readwrite');
      const store=transaction.objectStore('clips');
      for(const {key,file} of matched)store.put({key,blob:file},key);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
    });
    await refreshPersonalAudio(db);db.close();
    toast(`已載入 ${matched.length} 段個人音檔`);
  }catch{$('personalAudioStatus').textContent='儲存失敗，請檢查瀏覽器儲存空間。';}
  event.target.value='';
});
$('clearPersonalAudio').addEventListener('click',async()=>{
  try{
    const db=await openPersonalDb();
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction('clips','readwrite');
      transaction.objectStore('clips').clear();
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
    });
    await refreshPersonalAudio(db);db.close();toast('已清除本機聽診音檔');
  }catch{$('personalAudioStatus').textContent='清除失敗，請檢查瀏覽器儲存空間。';}
});
loadPersonalAudio();
window.addEventListener('pointerdown',startBreathSound,{passive:true});
window.addEventListener('keydown',startBreathSound,{passive:true});
startBreathSound();
document.addEventListener('visibilitychange',()=>{if(document.hidden)setBreathGain(0);});
for(const id of ['showEffusion','effusionSide','effusionAmount'])$(id).addEventListener('input',updateEffusion);
$('size').addEventListener('input',()=>{activeLesion().size=+$('size').value;syncLesionUI();updateTumor();});
$('showTumor').addEventListener('input',updateTumor);
$('locationSelect').addEventListener('change',()=>{const l=activeLesion();l.location=$('locationSelect').value;l.mode='preset';if(placement)togglePlacement();syncLesionUI();updateTumor();});
$('addLesion').addEventListener('click',()=>{if(lesions.length>=3)return;if(placement)togglePlacement();lesions.push(newLesion({location:['RUL','LLL','RLL'][lesions.length]}));activeIndex=lesions.length-1;syncLesionUI();updateTumor();});
$('removeLesion').addEventListener('click',()=>{if(lesions.length<=1)return;if(placement)togglePlacement();const [l]=lesions.splice(activeIndex,1);scene.remove(l.mesh,l.halo);l.mesh.geometry.dispose();l.mesh.material.dispose();l.halo.geometry.dispose();l.halo.material.dispose();activeIndex=Math.min(activeIndex,lesions.length-1);syncLesionUI();updateTumor();});
function togglePlacement(){placement=!placement;if(placement&&auscultation)setAuscMode(false);$('placeBtn').classList.toggle('on',placement);$('placeBtn').textContent=placement?'完成調整':'自由調整肺內位置';renderer.domElement.style.cursor=placement?'crosshair':'grab';controls.enabled=!placement;if(placement)toast('點選或拖曳肺葉位置');}
$('placeBtn').addEventListener('click',togglePlacement);
$('resetView').addEventListener('click',()=>{camera.position.set(0,.15,7.9);controls.target.set(0,-.1,0);controls.update();});
$('procedure').addEventListener('input',()=>{
  const progress=$('procedure').value;
  if(currentPreset!=='scope'){
    preset('scope');
    $('procedure').value=progress;
  }
  playing=false;$('playBtn').textContent='▶ 播放';updateProcedure();
});
$('playBtn').addEventListener('click',()=>{if(currentPreset!=='scope')preset('scope');playing=!playing;$('playBtn').textContent=playing?'Ⅱ 暫停':'▶ 播放';});
$('resetProcedure').addEventListener('click',()=>{$('procedure').value=0;playing=false;$('playBtn').textContent='▶ 播放';updateProcedure();});

function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
function setLesionHit(hit){
  const key=hit.object.userData.lobe;
  if(!key)return false;
  const l=activeLesion();l.location=key;l.mode='free';
  l.point.copy(uncompressPointForEffusion(lungGroup.worldToLocal(hit.point.clone()),key[0],effusionStrength(key[0])));
  l.normal.copy(hit.face.normal).normalize();
  const centerX=key[0]==='R'?-1.05:1.05;
  if(l.normal.dot(l.point.clone().sub(new THREE.Vector3(centerX,-.1,0)))<0)l.normal.negate();
  syncLesionUI();
  updateTumor();return true;
}
function pick(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(Object.values(lungMeshes),false);
  return hits.length?setLesionHit(hits[0]):false;
}
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!placement)return;
  dragging=true;controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
  if(!pick(e))toast('請點在肺葉表面');
});
renderer.domElement.addEventListener('pointermove',e=>{if(dragging)pick(e);});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!auscultation||currentPreset==='scope')return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects([...Object.values(lungMeshes),...bronchiGroup.children],false);
  if(!hits.length){setAuscZone(null);return;}
  const p=hits[0].point;
  const zone=Math.abs(p.x)<.32&&p.y>.65?'tracheal':Math.abs(p.x)<.87&&p.y>-.35?'bronchovesicular':'vesicular';
  if(zone!==auscZone)setAuscZone(zone);
});
renderer.domElement.addEventListener('pointerleave',()=>setAuscZone(null));
renderer.domElement.addEventListener('pointerdown',()=>{teachingAudioBlocked=false;});
function endDrag(){
  if(!dragging)return;
  dragging=false;controls.enabled=!placement;
}
renderer.domElement.addEventListener('pointerup',endDrag);
renderer.domElement.addEventListener('pointercancel',endDrag);

function disposeProcedure(){for(const m of [scopeMesh,forcepsMesh])if(m){procedureGroup.remove(m);m.geometry.dispose();m.material.dispose();}scopeMesh=forcepsMesh=null;}
function scopeCenterline(key){
  const sections=routeSections(key)||routeSections('RUL');
  const points=[];
  for(const section of sections){
    const curve=new THREE.CatmullRomCurve3(section.map(p=>new THREE.Vector3(...p)));
    const sampled=curve.getPoints(Math.max(12,section.length*8));
    points.push(...(points.length?sampled.slice(1):sampled));
  }
  return points;
}
function updateProcedure(){
  disposeProcedure();
  const v=+$('procedure').value,l=activeLesion(),isNode=l.location==='TR'||l.location==='SC';
  const points=(l.location==='TR'?new THREE.LineCurve3(new THREE.Vector3(0,2,.04),new THREE.Vector3(0,1.25,.04)).getPoints(44):
    l.location==='SC'?new THREE.CatmullRomCurve3(airway.trachea.map(p=>new THREE.Vector3(...p))).getPoints(48):scopeCenterline(l.location)).map(deformAirwayPoint);
  const target=l.mesh.position;
  const lesionRadius=l.size*.065;
  const distances=points.map(point=>point.distanceTo(target));
  const nearest=Math.min(...distances);
  const sampleAllowed=isNode||nearest<=lesionRadius+.24;
  let scopeEnd=points.at(-1).clone(),cut=points.length-1;
  if(!isNode&&sampleAllowed){
    // Stop at the first approach to the lesion surface. This keeps the scope
    // inside its chosen bronchial route even when a large lesion moves inward.
    const stopDistance=lesionRadius+.12;
    const entering=distances.findIndex((distance,i)=>i>0&&distance<=stopDistance);
    if(entering>0){
      cut=entering;
      let low=0,high=1;
      for(let i=0;i<12;i++){
        const mid=(low+high)/2;
        const distance=points[cut-1].clone().lerp(points[cut],mid).distanceTo(target);
        if(distance>stopDistance)low=mid;else high=mid;
      }
      scopeEnd=points[cut-1].clone().lerp(points[cut],(low+high)/2);
    }else{
      cut=distances.indexOf(nearest);
      scopeEnd=points[cut].clone();
    }
  }else{
    let retreat=isNode?.12:Math.max(.18,Math.min(.62,lesionRadius+.08));
    while(cut>0&&retreat>0){const segment=points[cut].distanceTo(points[cut-1]);if(segment>=retreat){scopeEnd=points[cut].clone().lerp(points[cut-1],retreat/segment);retreat=0;}else{retreat-=segment;cut--;scopeEnd=points[cut].clone();}}
  }
  const scopePath=[...points.slice(0,cut),scopeEnd];
  if(v>0){
    const travel=Math.min(1,v/90);
    const n=Math.max(2,Math.round(travel*(scopePath.length-1))+1);
    const partial=new THREE.CatmullRomCurve3(scopePath.slice(0,n));
    scopeMesh=new THREE.Mesh(new THREE.TubeGeometry(partial,Math.max(8,n*2),.025,8,false),new THREE.MeshStandardMaterial({color:0x20282b,roughness:.38,depthTest:false,transparent:true,opacity:.98}));
    scopeMesh.renderOrder=12;procedureGroup.add(scopeMesh);
    if(v>90&&sampleAllowed){
      const direction=target.clone().sub(scopeEnd).normalize();
      const extension=Math.min(scopeEnd.distanceTo(target),isNode ? .62 : .34)*(v-90)/10;
      const tip=scopeEnd.clone().addScaledVector(direction,extension);
      forcepsMesh=tube([scopeEnd.toArray(),tip.toArray()],isNode ? .014 : .018,0xc5ced3,procedureGroup);
      forcepsMesh.material.metalness=.58;forcepsMesh.material.roughness=.27;
      forcepsMesh.material.depthTest=false;forcepsMesh.material.transparent=true;forcepsMesh.renderOrder=23;
    }
  }
  procedureGroup.visible=currentPreset==='scope';
  $('stepText').textContent=isNode?
    (v<90?`鏡身沿氣管前進至${l.location==='TR'?'氣管旁':'隆突下'}病灶附近。`:'TBNA 示意：細針從氣道壁直接伸出取樣。'):
    (v===0?'鏡身從氣管開始，沿所選肺段的支氣管前進。':v<31?'步驟 1：沿氣管前進。':v<65?'步驟 2：進入所選側主支氣管。':v<90?`步驟 3：到達${names[l.location]}支氣管。`:sampleAllowed?'步驟 4：由所選支氣管短距離伸出取樣（示意）。':'病灶離可見支氣管過遠；不畫長距離穿刺路徑。');
}

const labelData=[['RUL',[-1.17,.93,.46]],['RML',[-.69,-.35,.43]],['RLL',[-1.36,-1.07,.45]],['LUL',[1.21,.92,.45]],['LLL',[1.37,-1.02,.45]],['氣管',[0,1.54,.2]],['心臟',[.24,-.62,.5]]];
const labelElements=labelData.map(([name])=>{const el=document.createElement('div');el.className='label';el.textContent=names[name]||name;$('labels').appendChild(el);return el;});
function positionLabels(){const r=viewport.getBoundingClientRect();labelData.forEach(([,p],i)=>{const v=new THREE.Vector3(...p).project(camera);const el=labelElements[i];el.style.left=((v.x+1)*.5*r.width)+'px';el.style.top=((-v.y+1)*.5*r.height)+'px';el.style.display=v.z<1?'block':'none';});}
function fit(){const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
fit();const resize=new ResizeObserver(fit);resize.observe(viewport);
let firstFrame=true;
function updateBreathing(time,delta){
  const teachingActive=currentPreset!=='scope'&&!document.hidden;
  const ambientActive=teachingActive&&!auscultation;
  breathBlend+=(Number(ambientActive)-breathBlend)*Math.min(1,delta*1.6);
  const phase=(time%5000)/5000;
  const inhale=phase<.42,exhale=phase>=.42&&phase<.87;
  const fill=inhale ? .5-.5*Math.cos(Math.PI*phase/.42) : exhale ? .5+.5*Math.cos(Math.PI*(phase-.42)/.45) : 0;
  const flow=inhale ? Math.sin(Math.PI*phase/.42) : exhale ? .58*Math.sin(Math.PI*(phase-.42)/.45) : 0;
  const motion=$('idleBreathing').checked?fill*breathBlend:0;
  lungGroup.scale.set(1+.034*motion,1+.036*motion,1+.04*motion);
  fissureGroup.scale.copy(lungGroup.scale);
  effusionGroup.scale.copy(lungGroup.scale);
  const volume=+$('breathVolume').value/100;
  const listening=teachingActive&&auscultation&&!!auscZone;
  const chosen=$('auscultationSound').value;
  const normalKey=auscZone==='vesicular'?'vesicular':auscZone==='bronchovesicular'&&audioData.broncho?'broncho':null;
  const realKey=listening?(chosen==='normal'?normalKey:chosen):null;
  setBreathGain(ambientActive&&$('breathSound').checked ? .045*volume*flow*breathBlend : 0);
  if(stethFilter&&breathAudio)stethFilter.frequency.setTargetAtTime(auscZone==='tracheal'?1800:850,breathAudio.currentTime,.1);
  setAudioGain(stethGain,listening&&chosen==='normal'&&!normalKey ? (auscZone==='tracheal'?.075:.048)*volume*flow : 0);
  syncTeachingAudio(realKey,volume);
}
function animate(time){requestAnimationFrame(animate);const delta=Math.min(.05,(time-lastTime)/1000||0);lastTime=time;if(playing){$('procedure').value=Math.min(100,+$('procedure').value+delta*25);updateProcedure();if(+$('procedure').value>=100){playing=false;$('playBtn').textContent='▶ 播放';}}updateBreathing(time,delta);controls.update();positionLabels();renderer.render(scene,camera);if(firstFrame){firstFrame=false;}}
updateView();rebuildEffusion();updateProcedure();requestAnimationFrame(animate);
