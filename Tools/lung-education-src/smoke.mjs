import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import lungMeshData from './src/lung-mesh-data.js';
import {compressionWeight,collapsedLungPosition,collapsedAirwayPosition} from './src/effusion-shape.js';
import {airway,segments,fixedTargets,routeSections} from './src/airway-data.js';
import airwayMeshData from './src/airway-mesh-data.js';

const source = readFileSync(new URL('./src/main.js', import.meta.url), 'utf8');
assert.equal(compressionWeight(1.2),0,'The apex stays expanded');
assert.ok(compressionWeight(-.3)>.4,'The lower half of the upper lobe also compresses');
assert.ok(compressionWeight(-1.4)>compressionWeight(-.3),'Dependent lung compresses more');
assert.deepEqual(collapsedAirwayPosition(0,1.2,.04,1,0),[0,1.2,.04],'The upper trachea stays anchored');
const lowerBronchus=[-1.45,-1.1,.2];
const airwayCollapse=collapsedAirwayPosition(...lowerBronchus,1,0);
const lungCollapse=collapsedLungPosition(...lowerBronchus,'R',1);
assert.ok(airwayCollapse.every((value,i)=>Math.abs(value-lungCollapse[i])<1e-8),'Distal bronchi must follow the lung');
assert.ok(airwayCollapse[0]>lowerBronchus[0]&&airwayCollapse[1]>lowerBronchus[1],'Dependent bronchi move inward and upward');
const samePoint = (a, b) => a.every((coordinate, i) => Math.abs(coordinate - b[i]) < 1e-6);
for (const side of ['rightMain', 'leftMain']) {
  assert.ok(samePoint(airway.trachea.at(-1), airway[side][0]), `${side} must begin at the carina`);
}

const connections = { RUL:['rightMain',2], RML:['rightMain',3], RLL:['rightMain',4], LUL:['leftMain',2], LLL:['leftMain',2] };
for (const [lobe, [main, index]] of Object.entries(connections)) {
  const branch = airway[lobe];
  assert.ok(samePoint(airway[main][index], branch[0]), `${lobe} must begin on ${main}`);
  assert.ok(branch.length >= 2 && branch.every(point => point.length === 3 && point.every(Number.isFinite)), `${lobe} needs valid 3D points`);
  const curve = new THREE.CatmullRomCurve3(branch.map(point => new THREE.Vector3(...point)));
  new THREE.TubeGeometry(curve, 24, .068, 8, false).dispose();
}
const targets=fixedTargets;
const packed=gunzipSync(Buffer.from(lungMeshData,'base64'));
const view=new DataView(packed.buffer,packed.byteOffset,packed.byteLength);
assert.equal(packed.toString('ascii',0,5),'LUNG1');
let offset=6;
const lobeMeshes={};
for(let group=0;group<view.getUint8(5);group++){
  const lobe=packed.toString('ascii',offset,offset+3);offset+=3;
  const vertices=view.getUint32(offset,true),indices=view.getUint32(offset+4,true);offset+=8;
  const target=targets[lobe];
  assert.ok(new THREE.Vector3(...airway[lobe].at(-1)).distanceTo(new THREE.Vector3(...target))<.32,`${lobe} target must stay near its lobar bronchus`);
  let nearest=Infinity;
  const positions=new Float32Array(vertices*3);
  const segmentDistances=Object.fromEntries(Object.entries(segments).filter(([,s])=>s.lobe===lobe).map(([key])=>[key,Infinity]));
  for(let i=0;i<vertices;i++){
    const x=view.getFloat32(offset,true),y=view.getFloat32(offset+4,true),z=view.getFloat32(offset+8,true);
    positions.set([x,y,z],i*3);
    const dx=x-target[0],dy=y-target[1],dz=z-target[2];
    nearest=Math.min(nearest,Math.hypot(dx,dy,dz));offset+=12;
    for(const key of Object.keys(segmentDistances)){
      const p=targets[key];segmentDistances[key]=Math.min(segmentDistances[key],Math.hypot(x-p[0],y-p[1],z-p[2]));
    }
  }
  const faces=new Uint32Array(indices);
  for(let i=0;i<indices;i++){faces[i]=view.getUint32(offset,true);offset+=4;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(faces,1));
  geometry.computeBoundingSphere();lobeMeshes[lobe]=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  assert.ok(nearest<.35,`${lobe} target must stay near its lobe surface (distance ${nearest.toFixed(3)})`);
  for(const [key,distance] of Object.entries(segmentDistances))assert.ok(distance<.7,`${key} target must be inside or close to ${lobe} (distance ${distance.toFixed(3)})`);
}
const front=new THREE.Vector3(0,0,1);
for(const [key,{lobe,points}] of Object.entries(segments)){
  const point=new THREE.Vector3(...points.at(-1));
  const ray=new THREE.Raycaster(point,front,1e-5,10);
  const hits=ray.intersectObject(lobeMeshes[lobe],false);
  let crossings=0,last=-1;
  for(const hit of hits)if(Math.abs(hit.distance-last)>1e-4){crossings++;last=hit.distance;}
  assert.ok(crossings%2===1,`${key} terminal airway must be within its lung lobe`);
  const nearestFront=new THREE.Raycaster(point,front,1e-5,10).intersectObjects(Object.entries(lobeMeshes).filter(([name])=>name[0]===lobe[0]).map(([,mesh])=>mesh),false)[0];
  assert.ok(nearestFront?.distance>.043,`${key} terminal airway must not cross the front lung surface`);
}
for(const side of ['R','L']){
  const collapsedMeshes={};
  for(const [lobe,mesh] of Object.entries(lobeMeshes)){
    if(lobe[0]!==side)continue;
    const geometry=mesh.geometry.clone(),position=geometry.getAttribute('position');
    for(let i=0;i<position.count;i++)position.setXYZ(i,...collapsedLungPosition(position.getX(i),position.getY(i),position.getZ(i),side,1));
    geometry.computeBoundingSphere();
    collapsedMeshes[lobe]=new THREE.Mesh(geometry,mesh.material);
  }
  for(const [key,{lobe,points}] of Object.entries(segments)){
    if(lobe[0]!==side)continue;
    const point=new THREE.Vector3(...collapsedAirwayPosition(...points.at(-1),side==='R'?1:0,side==='L'?1:0));
    const inside=Object.values(collapsedMeshes).some(mesh=>{
      const hits=new THREE.Raycaster(point,front,1e-5,10).intersectObject(mesh,false);
      let crossings=0,last=-1;
      for(const hit of hits)if(Math.abs(hit.distance-last)>1e-4){crossings++;last=hit.distance;}
      return crossings%2===1;
    });
    assert.ok(inside,`${key} terminal airway must stay inside a massively collapsed lung`);
  }
  for(const mesh of Object.values(collapsedMeshes))mesh.geometry.dispose();
}
for(const [key,segment] of Object.entries(segments)){
  assert.ok(samePoint(airway[segment.lobe][segment.at],segment.points[0]),`${key} must meet its lobar parent`);
  const sections=routeSections(key);
  assert.equal(sections.length,4,`${key} needs tracheal, main, lobar, and segmental route`);
  for(let i=1;i<sections.length;i++)assert.ok(samePoint(sections[i-1].at(-1),sections[i][0]),`${key} route must be continuous`);
  assert.ok(new THREE.Vector3(...sections.at(-1).at(-1)).distanceTo(new THREE.Vector3(...targets[key]))<.001,`${key} lesion and route must coincide`);
}
const airwayPacked=gunzipSync(Buffer.from(airwayMeshData,'base64'));
assert.equal(airwayPacked.toString('ascii',0,5),'AIRW1');
const airwayVertices=airwayPacked.readUInt32LE(8);
assert.ok(airwayVertices>30000,'The unified airway mesh needs enough detail for segmental branches');
const floats=new Float32Array(airwayPacked.buffer,airwayPacked.byteOffset+12,airwayVertices*6);
const parents=Int32Array.from({length:airwayVertices/3},(_,i)=>i);
const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
const seen=new Map();
for(let i=0;i<airwayVertices;i++){
  const point=[0,1,2].map(j=>Math.round(floats[i*6+j]*10000)).join(',');
  const face=Math.floor(i/3);
  if(seen.has(point))parents[find(face)]=find(seen.get(point));else seen.set(point,face);
}
assert.equal(new Set(parents.map((_,i)=>find(i))).size,1,'The airway must be one connected surface');
assert.ok(!source.includes('new THREE.SphereGeometry(1,64,48)'),'No spherical effusion should remain');
console.log('Airway segments, routes, unified mesh, and effusion contour smoke test passed');
