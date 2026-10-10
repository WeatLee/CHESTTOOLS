import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import lungMeshData from './src/lung-mesh-data.js';
import {compressionWeight} from './src/effusion-shape.js';

const source = readFileSync(new URL('./src/main.js', import.meta.url), 'utf8');
assert.equal(compressionWeight(1.2),0,'The apex stays expanded');
assert.ok(compressionWeight(-.3)>.4,'The lower half of the upper lobe also compresses');
assert.ok(compressionWeight(-1.4)>compressionWeight(-.3),'Dependent lung compresses more');
const match = source.match(/const airway = (\{[\s\S]*?\n\});/);
assert.ok(match, 'Airway centerlines not found');
const airway = Function(`return (${match[1]})`)();

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
const targetMatch=source.match(/const presetTargets=(\{[\s\S]*?\n\});/);
assert.ok(targetMatch,'Preset lesion targets not found');
const targets=Function(`return (${targetMatch[1]})`)();
const packed=gunzipSync(Buffer.from(lungMeshData,'base64'));
const view=new DataView(packed.buffer,packed.byteOffset,packed.byteLength);
assert.equal(packed.toString('ascii',0,5),'LUNG1');
let offset=6;
for(let group=0;group<view.getUint8(5);group++){
  const lobe=packed.toString('ascii',offset,offset+3);offset+=3;
  const vertices=view.getUint32(offset,true),indices=view.getUint32(offset+4,true);offset+=8;
  const target=targets[lobe];
  assert.ok(new THREE.Vector3(...airway[lobe].at(-1)).distanceTo(new THREE.Vector3(...target))<.32,`${lobe} target must stay near its lobar bronchus`);
  let nearest=Infinity;
  for(let i=0;i<vertices;i++){
    const dx=view.getFloat32(offset,true)-target[0];
    const dy=view.getFloat32(offset+4,true)-target[1];
    const dz=view.getFloat32(offset+8,true)-target[2];
    nearest=Math.min(nearest,Math.hypot(dx,dy,dz));offset+=12;
  }
  offset+=indices*4;
  assert.ok(nearest<.35,`${lobe} target must stay near its lobe surface (distance ${nearest.toFixed(3)})`);
}
console.log('Airway centerline and geometry smoke test passed');
