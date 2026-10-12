// Trace bronchoscope routes through the BodyParts3D airway lumen.
// The airway is voxelized at 1 mm, and a clearance-weighted shortest path
// runs from the upper trachea to the deepest point of each segmental tree.
// Run: node build-airway-routes.mjs PATH_TO/body-parts-source/procedure-subset
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node build-airway-routes.mjs PATH_TO_PROCEDURE_SUBSET');
const scale = 0.0136;
const toScene = ([x, y, z]) => [x * scale, (z - 1238) * scale, (-y - 106) * scale].map(v => +v.toFixed(3));

// Segment keys follow airway-data.js; each lists its BodyParts3D tree names.
const segmentTrees = {
  RS1: ['Right apical segmental bronchial tree'],
  RS2: ['Right posterior segmental bronchial tree'],
  RS3: ['Right anterior segmental bronchial tree'],
  RS4: ['Lateral segmental bronchial tree'],
  RS5: ['Medial segmental bronchial tree'],
  RS6: ['Right superior segmental bronchial tree'],
  RS7: ['Right medial basal segmental bronchial tree'],
  RS8: ['Right anterior basal segmental bronchial tree'],
  RS9: ['Right lateral basal segmental bronchial tree'],
  RS10: ['Right posterior basal segmental bronchial tree', 'Laterobasal part of right posterior basal segmental bronchial tree', 'Mediobasal part of right posterior basal segmental bronchial tree'],
  LS12: ['Left apical segmental bronchial tree', 'Left posterior segmental bronchial tree', 'Apicoposterior segmental bronchial tree'],
  LS3: ['Left anterior segmental bronchial tree'],
  LS4: ['Superior lingular bronchial tree'],
  LS5: ['Inferior lingular bronchial tree'],
  LS6: ['Left superior segmental bronchial tree'],
  LS78: ['Left anterior basal segmental bronchial tree', 'Left medial basal segmental bronchial tree'],
  LS9: ['Left lateral basal segmental bronchial tree'],
  LS10: ['Left posterior basal segmental bronchial tree']
};
const central = ['Trachea', 'Right main bronchus', 'Left main bronchus'];
const skip = new Set(['FJ6588', 'FJ2539']);

function readObj(path) {
  const v = [], f = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) v.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith('f ')) {
      const face = line.trim().split(/\s+/).slice(1).map(p => parseInt(p, 10) - 1);
      for (let i = 1; i < face.length - 1; i++) f.push([face[0], face[i], face[i + 1]]);
    }
  }
  return { v, f };
}
const pieces = readdirSync(join(root, 'airway')).filter(n => n.endsWith('.obj') && !skip.has(n.split('_')[0])).map(n => ({
  name: n.replace(/^FJ\w+?_BP\d+_FMA\d+_/, '').replace(/\.obj$/, ''), mesh: readObj(join(root, 'airway', n))
}));

// Grid in source millimetres.
const lo = [-135, -205, 1105], step = 1;
const dims = [270, 200, 300];
const [NX, NY, NZ] = dims;
const at = (i, j, k) => (k * NY + j) * NX + i;
const label = new Uint8Array(NX * NY * NZ); // 0 outside, 1 central, 2+ segment
const labelOf = name => {
  if (central.includes(name)) return 1;
  const index = Object.values(segmentTrees).findIndex(names => names.includes(name));
  return index < 0 ? 0 : index + 2;
};

// Ray parity along z for each closed piece; overlapping pieces are OR-ed.
for (const { name, mesh } of pieces) {
  const value = labelOf(name);
  if (!value) { console.warn('unassigned airway piece', name); continue; }
  const columns = new Map();
  for (const [a, b, c] of mesh.f) {
    const A = mesh.v[a], B = mesh.v[b], C = mesh.v[c];
    const minI = Math.ceil((Math.min(A[0], B[0], C[0]) - lo[0]) / step - .5), maxI = Math.floor((Math.max(A[0], B[0], C[0]) - lo[0]) / step - .5);
    const minJ = Math.ceil((Math.min(A[1], B[1], C[1]) - lo[1]) / step - .5), maxJ = Math.floor((Math.max(A[1], B[1], C[1]) - lo[1]) / step - .5);
    for (let i = minI; i <= maxI; i++) for (let j = minJ; j <= maxJ; j++) {
      const x = lo[0] + (i + .5) * step, y = lo[1] + (j + .5) * step;
      const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(d) < 1e-12) continue;
      const w1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d;
      const w2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d;
      const w3 = 1 - w1 - w2;
      if (w1 < 0 || w2 < 0 || w3 < 0) continue;
      const z = w1 * A[2] + w2 * B[2] + w3 * C[2];
      const key = i * 4096 + j;
      (columns.get(key) || columns.set(key, []).get(key)).push(z);
    }
  }
  for (const [key, zs] of columns) {
    const i = Math.floor(key / 4096), j = key % 4096;
    if (i < 0 || j < 0 || i >= NX || j >= NY) continue;
    zs.sort((p, q) => p - q);
    for (let n = 0; n + 1 < zs.length; n += 2) {
      const k0 = Math.max(0, Math.ceil((zs[n] - lo[2]) / step - .5)), k1 = Math.min(NZ - 1, Math.floor((zs[n + 1] - lo[2]) / step - .5));
      for (let k = k0; k <= k1; k++) { const idx = at(i, j, k); if (!label[idx] || value > 1) label[idx] = value; }
    }
  }
}

// Integer clearance by breadth-first search from the outside.
const clearance = new Uint8Array(label.length).fill(255);
let frontier = [];
for (let idx = 0; idx < label.length; idx++) if (!label[idx]) { clearance[idx] = 0; }
for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
  const idx = at(i, j, k);
  if (label[idx] && (!label[idx - 1] || !label[idx + 1] || !label[idx - NX] || !label[idx + NX] || !label[idx - NX * NY] || !label[idx + NX * NY])) { clearance[idx] = 1; frontier.push(idx); }
}
for (let d = 2; frontier.length; d++) {
  const next = [];
  for (const idx of frontier) for (const n of [idx - 1, idx + 1, idx - NX, idx + NX, idx - NX * NY, idx + NX * NY]) {
    if (clearance[n] === 255) { clearance[n] = d; next.push(n); }
  }
  frontier = next;
}

// Dijkstra over airway voxels and a thin band around them, so small gaps
// between neighbouring BodyParts3D pieces can be bridged at a high cost.
const band = new Uint8Array(label.length);
for (let k = 2; k < NZ - 2; k++) for (let j = 2; j < NY - 2; j++) for (let i = 2; i < NX - 2; i++) {
  const idx = at(i, j, k);
  if (!label[idx]) continue;
  band[idx] = 2;
  if (clearance[idx] !== 1) continue;
  for (let dk = -2; dk <= 2; dk++) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const n = at(i + di, j + dj, k + dk);
    if (!band[n]) band[n] = 1;
  }
}
const done = new Uint8Array(label.length), dist = new Float64Array(label.length).fill(Infinity), parent = new Int32Array(label.length).fill(-1);
const offsets = [];
for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
  if (di || dj || dk) offsets.push([di + dj * NX + dk * NX * NY, Math.hypot(di, dj, dk)]);
}
// Binary heap on typed arrays; JS array entries exhaust memory here.
let keys = new Float64Array(1 << 20), vals = new Int32Array(1 << 20), size = 0;
const swap = (a, b) => { const k = keys[a]; keys[a] = keys[b]; keys[b] = k; const v = vals[a]; vals[a] = vals[b]; vals[b] = v; };
const push = (d, idx) => {
  if (size === keys.length) { const k = new Float64Array(size * 2), v = new Int32Array(size * 2); k.set(keys); v.set(vals); keys = k; vals = v; }
  keys[size] = d; vals[size] = idx; let n = size++;
  while (n) { const p = (n - 1) >> 1; if (keys[p] <= keys[n]) break; swap(p, n); n = p; }
};
const pop = () => {
  const top = [keys[0], vals[0]];
  size--; keys[0] = keys[size]; vals[0] = vals[size];
  for (let n = 0; ;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < size && keys[l] < keys[m]) m = l; if (r < size && keys[r] < keys[m]) m = r; if (m === n) break; swap(m, n); n = m; }
  return top;
};
const heap = { get length() { return size; } };

// Start at the centre of the trachea near its upper end.
const startK = Math.round((1388 - lo[2]) / step);
let sum = [0, 0], count = 0;
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (label[at(i, j, startK)] === 1) { sum[0] += i; sum[1] += j; count++; }
const start = at(Math.round(sum[0] / count), Math.round(sum[1] / count), startK);
dist[start] = 0; push(0, start);
while (heap.length) {
  const [d, idx] = pop();
  if (done[idx]) continue;
  done[idx] = 1;
  for (const [o, len] of offsets) {
    const n = idx + o;
    if (!band[n] || done[n]) continue;
    const c = band[n] === 2 ? 1 + 6 / (clearance[n] * clearance[n]) : 40;
    const nd = d + len * c;
    if (nd < dist[n]) { dist[n] = nd; parent[n] = idx; push(nd, n); }
  }
}

const toMm = idx => { const i = idx % NX, j = Math.floor(idx / NX) % NY, k = Math.floor(idx / (NX * NY)); return [lo[0] + (i + .5) * step, lo[1] + (j + .5) * step, lo[2] + (k + .5) * step]; };
function trace(end) { const path = []; for (let idx = end; idx >= 0; idx = parent[idx]) path.push(toMm(idx)); return path.reverse(); }
function smooth(path, every = 5) {
  const avg = path.map((_, n) => { const w = path.slice(Math.max(0, n - 3), n + 4); return [0, 1, 2].map(k => w.reduce((s, p) => s + p[k], 0) / w.length); });
  const out = [avg[0]];
  let run = 0;
  for (let n = 1; n < avg.length; n++) { run += Math.hypot(...[0, 1, 2].map(k => avg[n][k] - avg[n - 1][k])); if (run >= every) { out.push(avg[n]); run = 0; } }
  if (out.at(-1) !== avg.at(-1)) out.push(avg.at(-1));
  return out.map(toScene);
}

const routes = {}, report = [];
Object.keys(segmentTrees).forEach((key, n) => {
  // The tip is the reachable voxel lying farthest along the segment's main
  // axis, from its entry (the voxel nearest the trachea) towards its centroid.
  // The costliest voxel instead favours narrow side twigs.
  const members = [];
  for (let idx = 0; idx < label.length; idx++) if (label[idx] === n + 2 && dist[idx] < Infinity) members.push(idx);
  if (!members.length) throw new Error(`No reachable voxel for ${key}`);
  const voxels = members.length;
  const entry = toMm(members.reduce((a, b) => dist[a] < dist[b] ? a : b));
  const centroid = [0, 1, 2].map(k => members.reduce((s, idx) => s + toMm(idx)[k], 0) / voxels);
  const axis = centroid.map((v, k) => v - entry[k]);
  const reach = idx => toMm(idx).reduce((s, v, k) => s + (v - entry[k]) * axis[k], 0);
  const best = members.reduce((a, b) => reach(a) > reach(b) ? a : b);
  const path = trace(best);
  const bridged = path.filter(p => { const idx = at(...p.map((v, k) => Math.floor((v - lo[k]) / step))); return !label[idx]; }).length;
  routes[key] = smooth(path);
  report.push(`${key.padEnd(5)} voxels ${String(voxels).padStart(6)} path ${String(path.length).padStart(4)} mm, outside lumen ${bridged} mm`);
});

// Equally central voxels let left and right paths drift a few millimetres
// apart inside the wide trachea. Average them into one shared centreline down
// to the carina, where the two sides finally separate, and start every route on it.
const trachea = [];
for (let n = 0; n < Math.min(routes.RS1.length, routes.LS12.length); n++) {
  const a = routes.RS1[n], b = routes.LS12[n];
  if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > .15) break;
  trachea.push(a.map((v, k) => +((v + b[k]) / 2).toFixed(3)));
}
const carinaY = trachea.at(-1)[1];
for (const key of Object.keys(routes)) {
  const below = routes[key].findIndex(p => p[1] < carinaY - .03);
  routes[key] = [...trachea, ...routes[key].slice(below)];
}
console.log(report.join('\n'));
const header = '// Generated by build-airway-routes.mjs from BodyParts3D v4.3 (CC BY-SA 2.1 JP).\n// Scene units; patient right is negative x and anterior is positive z.\n';
writeFileSync(join(import.meta.dirname, 'src', 'airway-routes.js'), `${header}export const trachea=${JSON.stringify(trachea)};\nexport const routes=${JSON.stringify(routes)};\n`);
console.log('Wrote src/airway-routes.js; trachea points', trachea.length);
