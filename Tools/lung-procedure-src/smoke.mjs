import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import lungMeshData from './src/lung-mesh-data.js';
import procedureMeshData from './src/procedure-mesh-data.js';
import {compressionWeight,collapsedLungPosition,collapsedAirwayPosition} from './src/effusion-shape.js';
import {airway,segments,fixedTargets,routeSections,lobeRoutes} from './src/airway-data.js';
import {presetLesionPosition} from './src/lesion-placement.js';

const source = readFileSync(new URL('./src/main.js', import.meta.url), 'utf8');
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Effusion deformation is shared with the education model.
assert.equal(compressionWeight(1.2),0,'The apex stays expanded');
assert.ok(compressionWeight(-1.4)>compressionWeight(-.3),'Dependent lung compresses more');
const lowerBronchus=[-1.45,-1.1,.2];
assert.ok(collapsedAirwayPosition(...lowerBronchus,1,0).every((v,i)=>Math.abs(v-collapsedLungPosition(...lowerBronchus,'R',1)[i])<1e-8),'Distal bronchi must follow the lung');

// Procedure meshes: every part decodes and the skin stays within the chest crop.
const packed = gunzipSync(Buffer.from(procedureMeshData, 'base64'));
assert.equal(packed.toString('ascii', 0, 5), 'PROC1');
const parts = {};
for (let at = 6, g = 0; g < packed[5]; g++) {
  const key = packed.toString('ascii', at, at + 4);
  const nv = packed.readUInt32LE(at + 4), ni = packed.readUInt32LE(at + 8), wide = packed[at + 12];
  const origin = [0, 1, 2].map(k => packed.readFloatLE(at + 13 + k * 4)), step = packed.readFloatLE(at + 25);
  at += 29;
  const max = [0, 1, 2].map(k => { let m = -Infinity; for (let i = 0; i < nv; i++) m = Math.max(m, origin[k] + packed.readUInt16LE(at + (i * 3 + k) * 2) * step); return m; });
  at += nv * 6;
  let largest = 0;
  for (let i = 0; i < ni; i++) largest = Math.max(largest, wide ? packed.readUInt32LE(at + i * 4) : packed.readUInt16LE(at + i * 2));
  at += ni * (wide ? 4 : 2);
  assert.ok(nv > 100 && ni % 3 === 0 && largest < nv, `${key} must hold valid geometry`);
  parts[key] = { origin, max, nv };
}
for (const key of ['AIRW', 'ESOP', 'DIAP', 'AZYG', 'VAGN', 'PHRN', 'ARTS', 'BONE', 'CART', 'SKIN', 'SKCW'])assert.ok(parts[key], `${key} must be packed`);
const chestTop = (1440 - 1238) * .0136, chestBottom = (1015 - 1238) * .0136, chestHalf = 172 * .0136;
assert.ok(parts.SKIN.origin[1] >= chestBottom - .01 && parts.SKIN.max[1] <= chestTop + .01, 'The exterior is cropped to the chest');
assert.ok(Math.max(-parts.SKIN.origin[0], parts.SKIN.max[0]) <= chestHalf + .01, 'The arms are cut at the shoulders');

// Lobe meshes for containment checks.
const lungs = gunzipSync(Buffer.from(lungMeshData, 'base64'));
const lobeMeshes = {};
for (let at = 6, g = 0; g < lungs[5]; g++) {
  const lobe = lungs.toString('ascii', at, at + 3);
  const nv = lungs.readUInt32LE(at + 3), ni = lungs.readUInt32LE(at + 7); at += 11;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) positions[i] = lungs.readFloatLE(at + i * 4);
  at += nv * 12;
  const faces = new Uint32Array(ni);
  for (let i = 0; i < ni; i++) faces[i] = lungs.readUInt32LE(at + i * 4);
  at += ni * 4;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  lobeMeshes[lobe] = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}
const nearestSurface = (point, mesh) => {
  const p = mesh.geometry.getAttribute('position');
  let best = Infinity;
  for (let i = 0; i < p.count; i++) best = Math.min(best, distance(point, [p.getX(i), p.getY(i), p.getZ(i)]));
  return best;
};
const inside = (point, mesh) => {
  const hits = new THREE.Raycaster(new THREE.Vector3(...point), new THREE.Vector3(0, 0, 1), 1e-5, 10).intersectObject(mesh, false);
  let crossings = 0, last = -1;
  for (const hit of hits) if (Math.abs(hit.distance - last) > 1e-4) { crossings++; last = hit.distance; }
  return crossings % 2 === 1;
};

// Routes: shared trachea, no jumps, ending on the segment target.
const trachea = airway.trachea;
assert.ok(trachea.length >= 10 && trachea[0][1] > 1.8 && trachea.at(-1)[1] < 1, 'The trachea runs from the neck to the carina');
for (const [key, segment] of Object.entries(segments)) {
  const [route] = routeSections(key);
  assert.deepEqual(route.slice(0, trachea.length), trachea, `${key} must start on the shared trachea`);
  for (let i = 1; i < route.length; i++) assert.ok(distance(route[i - 1], route[i]) < .15, `${key} route must be continuous at point ${i}`);
  assert.ok(distance(route.at(-1), fixedTargets[key]) < 1e-9, `${key} lesion and route must coincide`);
  const tip = route.at(-1), lobe = lobeMeshes[segment.lobe];
  assert.ok(inside(tip, lobe) || nearestSurface(tip, lobe) < .3, `${key} tip must lie in or beside its lobe`);
  assert.ok(key[0] === 'R' ? tip[0] < 0 : tip[0] > 0, `${key} must stay on its own side`);
}
for (const lobe of Object.keys(lobeRoutes)) assert.equal(segments[lobeRoutes[lobe]].lobe, lobe, `${lobe} must follow one of its own segments`);
for (const key of ['TR', 'SC']) assert.ok(fixedTargets[key].every(Number.isFinite), `${key} needs a valid site`);
assert.ok(fixedTargets.TR[0] < trachea.at(-1)[0] && fixedTargets.SC[1] < trachea.at(-1)[1], 'Node sites sit right of the trachea and below the carina');

// Preset lesions stay reachable from their selected route.
for (const key of Object.keys(fixedTargets).filter(key => key !== 'TR' && key !== 'SC')) {
  const route = routeSections(key).flatMap((section, i) => {
    const sampled = new THREE.CatmullRomCurve3(section.map(p => new THREE.Vector3(...p))).getPoints(Math.max(12, section.length * 8));
    return i ? sampled.slice(1) : sampled;
  });
  for (const size of [1, 3, 5, 8]) {
    const target = new THREE.Vector3(...presetLesionPosition(key, size));
    const nearest = Math.min(...route.map(p => p.distanceTo(target)));
    assert.ok(nearest <= size * .065 + .24, `${key} ${size} cm lesion must remain reachable from its route (${nearest.toFixed(3)})`);
  }
}
for (const id of ['drainSide', 'drainProgress', 'drainPlay', 'drainReset', 'drainExit']) assert.ok(readFileSync(new URL('./index.html', import.meta.url), 'utf8').includes('id="' + id + '"'), id + ' control must exist');
assert.ok(source.includes('R:{outside:') && source.includes('L:{outside:'), 'Both drainage sides need an entry path');
// EBUS-TBNA lymph node stations.
const { stations } = await import('./src/node-stations.js');
const expectedStations = ['2R', '2L', '4R', '4L', '7', '10R', '10L', '11R', '11L'].flatMap(k => k === '11R' ? ['11Rs', '11Ri'] : [k]);
assert.deepEqual(Object.keys(stations).sort(), expectedStations.sort(), 'All IASLC stations used for EBUS must be present');
const stationKeys = Object.keys(stations);
for (const key of stationKeys) {
  const s = stations[key];
  assert.ok([...s.node, ...s.wall].every(Number.isFinite) && s.route.length >= 2, `${key} needs a node, a wall point and a scope route`);
  assert.deepEqual(s.route[0], trachea[0], `${key} scope must start in the trachea`);
  for (let i = 1; i < s.route.length; i++) assert.ok(distance(s.route[i - 1], s.route[i]) < .15, `${key} scope route must be continuous`);
  const needle = distance(s.wall, s.node);
  assert.ok(needle > .06 && needle < .45, `${key} needle path must be short (${(needle * 73.5).toFixed(0)} mm)`);
  assert.ok(distance(s.route.at(-1), s.node) > distance(s.route.at(-1), s.wall), `${key} node must lie outside the airway wall`);
  assert.ok(key.includes('L') ? s.node[0] > -.05 : key.includes('R') ? s.node[0] < .05 : true, `${key} must stay on its own side`);
}
for (let i = 0; i < stationKeys.length; i++) for (let j = i + 1; j < stationKeys.length; j++) {
  const a = stations[stationKeys[i]], b = stations[stationKeys[j]];
  assert.ok(distance(a.node, b.node) >= a.radius + b.radius, `${stationKeys[i]} and ${stationKeys[j]} nodes must not overlap`);
}
for (const id of ['tbnaStation', 'tbnaProgress', 'tbnaPlay', 'tbnaReset', 'tbnaExit']) assert.ok(readFileSync(new URL('./index.html', import.meta.url), 'utf8').includes('id="' + id + '"'), id + ' control must exist');
assert.ok(!source.includes('airway-mesh-data'), 'The procedure model uses the BodyParts3D airway');
console.log('Procedure meshes, traced airway routes, and lesion reachability smoke test passed');
