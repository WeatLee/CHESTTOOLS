// Pack BodyParts3D v4.3 airway, mediastinal, skeletal and skin meshes for
// the procedure model. Source meshes: BodyParts3D v4.3, CC BY-SA 2.1 JP.
// Run: node build-procedure-mesh.mjs PATH_TO/body-parts-source/procedure-subset
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { voxelize } from './voxelize.mjs';
import { loadLungVolume } from './lung-volume.mjs';
import { aortaPoints, aortaRadius } from './src/aorta-path.js';
import { routes } from './src/airway-routes.js';

const root = process.argv[2];
if (!root) throw new Error('Usage: node build-procedure-mesh.mjs PATH_TO_PROCEDURE_SUBSET');

// Same transform as build-lung-mesh.py, so every part lines up with the lungs.
const scale = 0.0136;
const toScene = ([x, y, z]) => [x * scale, (z - 1238) * scale, (-y - 106) * scale];

// The chest crop used for the exterior and the parts that run beyond it.
const chest = { bottom: 1015, top: 1440, halfWidth: 172 };

function readObj(path) {
  const positions = [], indices = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith('f ')) {
      const face = line.trim().split(/\s+/).slice(1).map(part => parseInt(part, 10) - 1);
      for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1]);
    }
  }
  return { positions, indices };
}

function listObj(dir) {
  return readdirSync(join(root, dir)).filter(name => name.endsWith('.obj')).sort().map(name => ({
    path: join(root, dir, name),
    id: name.split('_')[0],
    name: name.replace(/^FJ\w+?_BP\d+_FMA\d+_/, '').replace(/\.obj$/, '')
  }));
}

function merge(parts) {
  const positions = [], indices = [];
  for (const part of parts) {
    const offset = positions.length;
    positions.push(...part.positions);
    for (const index of part.indices) indices.push(index + offset);
  }
  return { positions, indices };
}

// Keep triangles whose three corners pass the test; drop unused vertices.
function crop(mesh, keep) {
  const inside = mesh.positions.map(keep), map = new Map(), positions = [], indices = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri = mesh.indices.slice(i, i + 3);
    if (!tri.every(v => inside[v])) continue;
    for (const v of tri) {
      if (!map.has(v)) { map.set(v, positions.length); positions.push(mesh.positions[v]); }
      indices.push(map.get(v));
    }
  }
  return { positions, indices };
}

// Clip triangles against axis-aligned planes ({axis, max} or {axis, min}) so
// a crop ends on a clean edge instead of a sawtooth of whole triangles.
// Shared vertices are welded again so the surface still shades smoothly.
function clip(mesh, planes) {
  const positions = [], indices = [], weld = new Map();
  const vertex = p => {
    const key = p.map(v => v.toFixed(3)).join(',');
    if (!weld.has(key)) { weld.set(key, positions.length); positions.push(p); }
    return weld.get(key);
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    let poly = mesh.indices.slice(i, i + 3).map(v => mesh.positions[v]);
    for (const { axis, min, max } of planes) {
      const inside = p => min !== undefined ? p[axis] >= min : p[axis] <= max;
      const limit = min !== undefined ? min : max;
      const out = [];
      poly.forEach((current, n) => {
        const previous = poly[(n + poly.length - 1) % poly.length];
        if (inside(current) !== inside(previous)) {
          const t = (limit - previous[axis]) / (current[axis] - previous[axis]);
          out.push(previous.map((v, k) => v + t * (current[k] - v)));
        }
        if (inside(current)) out.push(current);
      });
      poly = out;
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    const ids = poly.map(vertex);
    for (let n = 1; n < ids.length - 1; n++) if (ids[0] !== ids[n] && ids[n] !== ids[n + 1] && ids[0] !== ids[n + 1]) indices.push(ids[0], ids[n], ids[n + 1]);
  }
  return { positions, indices };
}

// Vertex clustering: average the vertices inside each grid cell (mm) and drop
// collapsed or repeated triangles. Coarse but dependable for organic surfaces.
function decimate(mesh, cell) {
  if (!cell) return mesh;
  const cells = new Map(), remap = new Array(mesh.positions.length);
  mesh.positions.forEach((p, i) => {
    const key = p.map(v => Math.floor(v / cell)).join(',');
    let entry = cells.get(key);
    if (!entry) { entry = { index: cells.size, sum: [0, 0, 0], count: 0 }; cells.set(key, entry); }
    for (let k = 0; k < 3; k++) entry.sum[k] += p[k];
    entry.count++;
    remap[i] = entry.index;
  });
  const positions = [];
  for (const entry of cells.values()) positions[entry.index] = entry.sum.map(v => v / entry.count);
  const indices = [], seen = new Set();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3).map(v => remap[v]);
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    indices.push(a, b, c);
  }
  return { positions, indices };
}

// One mesh per FMA name; BodyParts3D repeats some parts under two catalogue trees.
// BodyParts3D parts from different sources overlap by a few millimetres, and
// the hand-drawn aorta in main.js does not follow the source arch exactly.
// pushOut moves each vertex found inside a neighbour along that neighbour's
// escape direction (plus a 1.5 mm margin), then spreads the displacement over
// adjacent vertices so the vessel bends instead of tearing.
function pushOut(mesh, rules, label) {
  const n = mesh.positions.length, moved = new Uint8Array(n);
  const disp = mesh.positions.map(() => [0, 0, 0]);
  const neighbours = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3);
    neighbours[a].add(b).add(c); neighbours[b].add(a).add(c); neighbours[c].add(a).add(b);
  }
  for (let round = 0; round < 8; round++) {
    let count = 0;
    mesh.positions.forEach((p0, i) => {
      for (const rule of rules) {
        let p = p0.map((v, k) => v + disp[i][k]);
        if (!rule.inside(p)) continue;
        const dir = rule.direction(p);
        let travelled = 0;
        while (rule.inside(p) && travelled < 10) { p = p.map((v, k) => v + dir[k] * .5); travelled += .5; }
        if (rule.inside(p)) continue;
        for (let k = 0; k < 3; k++) disp[i][k] += dir[k] * (travelled + (rule.margin ?? 1.5));
        moved[i] = 1; count++;
      }
    });
    // Neighbours follow with a decaying share of the push.
    for (let iteration = 0; iteration < 24; iteration++) {
      const next = disp.map(v => [...v]);
      for (let i = 0; i < n; i++) {
        if (moved[i]) continue;
        let sum = [0, 0, 0], m = 0;
        for (const j of neighbours[i]) { for (let k = 0; k < 3; k++) sum[k] += disp[j][k]; m++; }
        if (m) for (let k = 0; k < 3; k++) { const avg = sum[k] / m * .92; if (Math.abs(avg) > Math.abs(next[i][k])) next[i][k] = avg; }
      }
      disp.splice(0, n, ...next);
    }
    console.log(`${label} push-out round ${round + 1}: ${count} vertices inside neighbours`);
    if (!count) break;
  }
  return { positions: mesh.positions.map((p, i) => p.map((v, k) => v + disp[i][k])), indices: mesh.indices };
}

// BodyParts3D crops leave stray slivers (the bottom of the neck-only left
// carotid, 4-vertex specks of esophagus), which float as dots. Drop connected
// pieces with fewer than minVertices vertices.
function dropSmallPieces(mesh, minVertices) {
  const parent = mesh.positions.map((_, i) => i);
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = find(mesh.indices[i]);
    parent[find(mesh.indices[i + 1])] = a;
    parent[find(mesh.indices[i + 2])] = find(a);
  }
  const size = new Map();
  for (const v of new Set(mesh.indices)) size.set(find(v), (size.get(find(v)) || 0) + 1);
  const indices = [];
  for (let i = 0; i < mesh.indices.length; i += 3) if (size.get(find(mesh.indices[i])) >= minVertices) indices.push(mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]);
  const kept = mesh.indices.length / 3 - indices.length / 3;
  if (kept) console.log(`dropped ${kept} triangles in pieces under ${minVertices} vertices`);
  return crop({ positions: mesh.positions, indices }, () => true);
}

function firstPerName(files) {
  const seen = new Set();
  return files.filter(file => !seen.has(file.name) && seen.add(file.name));
}

const below = top => p => p[2] <= top;
const groups = [];
function add(key, files, { cell = 0, keep = null, planes = null, adjust = null } = {}) {
  let mesh = merge(files.map(file => readObj(file.path)));
  if (keep) mesh = crop(mesh, keep);
  if (planes) mesh = clip(mesh, planes);
  mesh = decimate(mesh, cell);
  // Adjust after simplifying, so clustering cannot pull vertices back inside.
  if (adjust) mesh = adjust(mesh);
  groups.push({ key, mesh });
}

const airway = listObj('airway').filter(file => !['FJ6588', 'FJ2539'].includes(file.id));
// Ten right-lung segment pieces stick out of the lung surface by 3-16 mm (the
// BodyParts3D parts come from different models). They showed as cream dots at
// the apex and tubes through the base. Trim peripheral triangles with a vertex
// 1 mm or more outside the lungs; after the pieces are welded, isolated stubs
// of fewer than 30 vertices are dropped. The trachea and main bronchi stay whole.
const lungVolume = loadLungVolume(root);
const isCentral = file => /^(Trachea|Left main bronchus|Right main bronchus)/.test(file.name);
const peripheral = merge(airway.filter(file => !isCentral(file)).map(file => readObj(file.path)));
const trimmed = crop(peripheral, p => lungVolume.distance(p) < 1);
console.log(`AIRW trimmed ${(peripheral.indices.length - trimmed.indices.length) / 3} of ${peripheral.indices.length / 3} peripheral triangles outside the lungs`);
groups.push({ key: 'AIRW', mesh: dropSmallPieces(decimate(merge([merge(airway.filter(isCentral).map(file => readObj(file.path))), trimmed]), 0.9), 30) });

const airwayVoxels = voxelize(airway.map(file => readObj(file.path)));
const vertebraFiles = firstPerName(listObj('skeleton')).filter(file => /vertebra/i.test(file.name));
const vertebraVoxels = voxelize(vertebraFiles.map(file => readObj(file.path)));
// Vertebral column axis per height: centroid of the solid vertebra voxels.
const spineAxis = new Map();
{
  const { grid, lo, dims: [NX, NY, NZ], step } = vertebraVoxels;
  for (let k = 0; k < NZ; k++) {
    let sx = 0, sy = 0, c = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (grid[(k * NY + j) * NX + i]) { sx += i; sy += j; c++; }
    if (c) spineAxis.set(k, [lo[0] + (sx / c + .5) * step, lo[1] + (sy / c + .5) * step]);
  }
}
const spineCentre = z => {
  const k = Math.round((z - vertebraVoxels.lo[2]) / vertebraVoxels.step);
  for (let r = 0; r < 40; r++) for (const kk of [k - r, k + r]) if (spineAxis.has(kk)) return spineAxis.get(kk);
  return [0, -40];
};
// The hand-drawn seamless aorta from main.js, converted back to millimetres.
const toMm = ([X, Y, Z]) => [X / scale, -Z / scale - 106, Y / scale + 1238];
const aortaSamples = (() => {
  // Centripetal Catmull–Rom like THREE.CatmullRomCurve3, densely sampled.
  const P = aortaPoints.map(toMm), out = [];
  for (let s = 0; s < P.length - 1; s++) {
    const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
    for (let t = 0; t < 1; t += .05) {
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out.map((p, i, all) => ({ p, r: aortaRadius(i / all.length) / scale }));
})();
const nearestAorta = p => aortaSamples.reduce((best, s) => { const d = Math.hypot(...p.map((v, k) => v - s.p[k])); return d < best.d ? { d, s } : best; }, { d: Infinity }).s;
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
// Airway centreline in millimetres: every traced route, densified to ~1 mm.
const centreline = Object.values(routes).flatMap(route => route.flatMap((p, i) => {
  if (!i) return [toMm(p)];
  const a = toMm(route[i - 1]), b = toMm(p), n = Math.max(1, Math.round(Math.hypot(...b.map((v, k) => v - a[k]))));
  return Array.from({ length: n }, (_, j) => a.map((v, k) => v + (b[k] - v) * (j + 1) / n));
}));
const nearestCentreline = p => centreline.reduce((best, c) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; return d < best.d ? { d, c } : best; }, { d: Infinity }).c;
const azygosRules = [
  // Leave the airway through its nearest wall: straight away from the centreline.
  // (Pushing straight up slid vertices along the vertical trachea into a sheet.)
  { inside: airwayVoxels.inside, direction: p => { const c = nearestCentreline(p); return unit(p.map((v, k) => v - c[k])); }, margin: 3 },
  { inside: vertebraVoxels.inside, direction: p => { const c = spineCentre(p[2]); return unit([p[0] - c[0], p[1] - c[1], 0]); } },
  { inside: p => { const s = nearestAorta(p); return Math.hypot(...p.map((v, k) => v - s.p[k])) < s.r; }, direction: p => { const s = nearestAorta(p); return unit(p.map((v, k) => v - s.p[k])); } }
];

const mediastinum = listObj('mediastinum');
const pick = pattern => mediastinum.filter(file => pattern.test(file.name));
add('ESOP', pick(/^Esophagus$/), { keep: below(chest.top), adjust: mesh => dropSmallPieces(mesh, 20) });
add('DIAP', pick(/^Diaphragm$/), { cell: 3 });
add('AZYG', pick(/azygos/i), { cell: 1.5, adjust: mesh => pushOut(mesh, azygosRules, 'AZYG') });
add('VAGN', pick(/vagus/i), { cell: 1.5, keep: below(chest.top), adjust: mesh => dropSmallPieces(mesh, 20) });
add('PHRN', pick(/phrenic/i), { keep: below(chest.top) });

// The neck-only left common carotid starts above the arch by 1.7 units; its
// bottom sliver floats beside the trachea, so the left carotid is drawn in
// code from the arch instead (main.js) and small pieces are dropped here.
add('ARTS', listObj('arteries'), { keep: below(chest.top), adjust: mesh => dropSmallPieces(mesh, 100) });

const skeleton = firstPerName(listObj('skeleton'));
const bones = skeleton.filter(file => !/costal cartilage/i.test(file.name));
add('BONE', bones, { cell: 2.2 });
add('CART', skeleton.filter(file => /costal cartilage/i.test(file.name)), { cell: 2.2 });

const chestPlanes = [{ axis: 2, min: chest.bottom }, { axis: 2, max: chest.top }, { axis: 0, min: -chest.halfWidth }, { axis: 0, max: chest.halfWidth }];
// The arms hang against the chest, so the straight crop keeps the upper arm
// beside the lateral chest wall, which blocks the pleural drainage view. A cut by distance from the midline either
// leaves arm or bites into the chest (pectoral and axillary skin), so skin is
// classified anatomically: a vertex beyond 140 mm from the midline is arm when
// it lies within 1.35× its distance to the nearest trunk bone (ribs, cartilage,
// sternum, vertebrae, scapula, clavicle) of the humerus. The bias catches arm
// skin pressed against the chest; the chest wall itself sits ~25 mm off the ribs
// and 50 mm or more from the humerus, so it is kept.
// Triangles with two or more arm vertices are dropped.
function nearestFinder(points, cell = 10) {
  const grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  for (const p of points) { const k = key(...p.map(v => Math.floor(v / cell))); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
  return p => {
    const c = p.map(v => Math.floor(v / cell));
    let best = Infinity;
    for (let r = 0; r <= 14; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        for (const q of grid.get(key(c[0] + i, c[1] + j, c[2] + k)) || []) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      }
      if (best <= r * cell) break;
    }
    return best;
  };
}
const humerusDistance = nearestFinder(firstPerName(listObj('humerus')).flatMap(file => readObj(file.path).positions));
const trunkDistance = nearestFinder(firstPerName(listObj('skeleton')).flatMap(file => readObj(file.path).positions));
function removeArms(mesh) {
  const arm = mesh.positions.map(p => Math.abs(p[0]) > 140 && humerusDistance(p) < 1.35 * trunkDistance(p));
  const indices = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri = mesh.indices.slice(i, i + 3);
    if (tri.filter(v => arm[v]).length < 2) indices.push(...tri);
  }
  console.log(`SKCW arm vertices removed: ${arm.filter(Boolean).length} of ${arm.length}`);
  return { positions: mesh.positions, indices };
}
// The default exterior keeps the armpit and upper arm (natural look); the
// pleural drainage view uses the chest wall alone so the arm does not block it.
add('SKIN', listObj('skin'), { planes: chestPlanes });
add('SKCW', listObj('skin'), { planes: chestPlanes, adjust: removeArms });

// Format: "PROC1", group count, then per group key, vertex/index counts,
// quantization origin and step, int16 positions and uint16/uint32 indices.
const chunks = [Buffer.from('PROC1', 'ascii'), Buffer.from([groups.length])];
for (const { key, mesh } of groups) {
  const scene = mesh.positions.map(toScene);
  const min = [0, 1, 2].map(k => Math.min(...scene.map(p => p[k])));
  const max = [0, 1, 2].map(k => Math.max(...scene.map(p => p[k])));
  const step = Math.max(...max.map((v, k) => v - min[k])) / 65000;
  const wide = scene.length > 65535;
  const header = Buffer.alloc(4 + 4 + 4 + 1 + 16);
  header.write(key, 0, 'ascii');
  header.writeUInt32LE(scene.length, 4);
  header.writeUInt32LE(mesh.indices.length, 8);
  header.writeUInt8(wide ? 1 : 0, 12);
  min.forEach((v, k) => header.writeFloatLE(v, 13 + k * 4));
  header.writeFloatLE(step, 25);
  const positions = Buffer.alloc(scene.length * 6);
  scene.forEach((p, i) => p.forEach((v, k) => positions.writeUInt16LE(Math.round((v - min[k]) / step), (i * 3 + k) * 2)));
  const indices = Buffer.alloc(mesh.indices.length * (wide ? 4 : 2));
  mesh.indices.forEach((v, i) => wide ? indices.writeUInt32LE(v, i * 4) : indices.writeUInt16LE(v, i * 2));
  chunks.push(header, positions, indices);
  console.log(key.padEnd(5), String(scene.length).padStart(7), 'vertices', String(mesh.indices.length / 3).padStart(7), 'triangles');
}
const packed = gzipSync(Buffer.concat(chunks), { level: 9 });
const target = join(import.meta.dirname, 'src', 'procedure-mesh-data.js');
writeFileSync(target, `// Modified BodyParts3D v4.3 geometry; CC BY-SA 2.1 JP.\nexport default '${packed.toString('base64')}';\n`);
console.log(`Wrote ${target} (${packed.length.toLocaleString()} compressed bytes)`);
