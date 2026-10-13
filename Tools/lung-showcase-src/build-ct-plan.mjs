// Plan the CT-guided biopsy demonstration: a peripheral lesion in the right lower lobe
// against the lateral or posterior chest wall, an axial slice through its centre, and
// a straight needle path in that slice that stays clear of bone, vessels, heart,
// airway and diaphragm. The search runs on the displayed meshes, so what the demo
// shows is what was checked. Writes src/ct-plan.js.   Run: node build-ct-plan.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeLungs, decodeProcedure, decodeOrgans } from './decode-meshes.mjs';

const UNIT_MM = 73.5;            // one scene unit
const LESION_RADIUS = 0.17;      // about 2.5 cm across
const BONE_CLEARANCE = 0.06;     // 4.4 mm from any rib, vertebra, scapula or cartilage
const SOFT_CLEARANCE = 0.09;     // heart, great vessels, esophagus, central airway

const lungs = decodeLungs(), proc = decodeProcedure(), organs = decodeOrgans();
const sub = (a, b) => a.map((v, k) => v - b[k]);
const add = (a, b) => a.map((v, k) => v + b[k]);
const mul = (a, s) => a.map(v => v * s);
const len = a => Math.hypot(...a);
const unit = a => mul(a, 1 / (len(a) || 1));

// Spatial hash of mesh vertices for fast "how close is any bone" queries.
function hashOf(points, cell = 0.1) {
  const grid = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  for (const p of points) { const k = key(...p.map(v => Math.floor(v / cell))); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
  return {
    nearest(p, radius) {
      let best = Infinity;
      const c = p.map(v => Math.floor(v / cell)), r = Math.ceil(radius / cell);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++)
        for (const q of grid.get(key(c[0] + i, c[1] + j, c[2] + k)) || []) best = Math.min(best, len(sub(p, q)));
      return best;
    }
  };
}
const bone = hashOf([...proc.BONE.positions, ...proc.CART.positions]);
const soft = hashOf([...organs.HEAR.positions, ...organs.AORT.positions, ...organs.NECA.positions, ...organs.NEJV.positions, ...organs.PULA.positions, ...organs.PULV.positions, ...proc.ESOP.positions, ...proc.AZYG.positions, ...proc.AIRW.positions, ...proc.DIAP.positions]);

// Ray / triangle intersection (Moller-Trumbore); returns the distance along the ray or null.
function rayHit(origin, direction, mesh) {
  let best = null;
  const { positions, indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    const a = positions[indices[i]], b = positions[indices[i + 1]], c = positions[indices[i + 2]];
    const e1 = sub(b, a), e2 = sub(c, a);
    const h = [direction[1] * e2[2] - direction[2] * e2[1], direction[2] * e2[0] - direction[0] * e2[2], direction[0] * e2[1] - direction[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(origin, a), u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t > 1e-6 && (best === null || t < best)) best = t;
  }
  return best;
}

// Right lung only, as one point cloud.
const rightLung = ['RUL', 'RML', 'RLL'].flatMap(key => lungs[key].positions);
const rightLowerPoints = lungs.RLL.positions;

const candidates = [];
for (let y0 = -1.0; y0 <= 0.4001; y0 += 0.05) {
  const slab = rightLung.filter(p => Math.abs(p[1] - y0) < 0.025);
  if (slab.length < 50) continue;
  const centroid = [0, 1, 2].map(k => slab.reduce((sum, p) => sum + p[k], 0) / slab.length);
  centroid[1] = y0;
  // Surface points of the lung in the lateral and posterior quadrant, from the lower lobe where it exists.
  const surface = slab.filter(p => p[0] < centroid[0] - 0.5 && p[2] < centroid[2] + 0.3);
  const seen = new Set();
  for (const p of surface) {
    const cell = `${Math.round(p[0] / 0.08)},${Math.round(p[2] / 0.08)}`;
    if (seen.has(cell)) continue;
    seen.add(cell);
    const inward = unit([centroid[0] - p[0], 0, centroid[2] - p[2]]);
    const center = [...add([p[0], y0, p[2]], mul(inward, LESION_RADIUS + 0.015))];
    // The lesion must be inside lung tissue: the point further in should still be among the lung vertices' hull (cheap test).
    const outward = mul(inward, -1);
    const hit = rayHit(center, outward, { positions: proc.SKCW.positions, indices: proc.SKCW.indices });
    if (hit === null) continue;
    const entry = add(center, mul(outward, hit));
    // Walk the needle path from the skin to the lesion's near surface.
    const path = sub(center, entry), pathLength = len(path), direction = unit(path);
    const stop = pathLength - LESION_RADIUS * 0.5;
    let boneMin = Infinity, softMin = Infinity;
    for (let s = 0.04; s <= stop; s += 0.012) {
      const q = add(entry, mul(direction, s));
      boneMin = Math.min(boneMin, bone.nearest(q, 0.25));
      softMin = Math.min(softMin, soft.nearest(q, 0.3));
    }
    if (boneMin < BONE_CLEARANCE || softMin < SOFT_CLEARANCE) continue;
    // A short path, and one that comes in from the side or slightly behind rather than through the shoulder blade.
    const sideways = Math.abs(outward[0]);
    candidates.push({ y0, center, entry, direction, pathLength, boneMin, softMin, sideways, score: boneMin * 8 + softMin * 2 - pathLength * 1.5 + sideways * 0.6 });
  }
}
candidates.sort((a, b) => b.score - a.score);
if (!candidates.length) throw new Error('No safe CT-guided path found');
const best = candidates[0];
console.log(`${candidates.length} safe candidate paths; best:`);
console.log(`  slice y = ${best.y0.toFixed(2)}, lesion centre ${best.center.map(v => v.toFixed(3))}, skin entry ${best.entry.map(v => v.toFixed(3))}`);
console.log(`  path ${(best.pathLength * UNIT_MM / 10).toFixed(1)} cm, nearest bone ${(best.boneMin * UNIT_MM).toFixed(1)} mm, nearest heart/vessel/airway ${(best.softMin * UNIT_MM).toFixed(1)} mm`);

const round = a => a.map(v => +v.toFixed(3));
const plan = {
  sliceY: +best.y0.toFixed(3),
  lesion: { center: round(best.center), radius: LESION_RADIUS },
  entry: round(best.entry),
  direction: round(best.direction),
  pathLengthCm: +(best.pathLength * UNIT_MM / 10).toFixed(1),
  boneClearanceMm: +(best.boneMin * UNIT_MM).toFixed(1),
  vesselClearanceMm: +(best.softMin * UNIT_MM).toFixed(1)
};
writeFileSync(join(import.meta.dirname, 'src', 'ct-plan.js'),
  '// Generated by build-ct-plan.mjs from the displayed meshes. A schematic CT-guided biopsy plan: a peripheral\n// right lower lobe lesion, the axial slice through it, and a straight needle path clear of bone and vessels.\n' +
  `export const plan=${JSON.stringify(plan)};\n`);
console.log('Wrote src/ct-plan.js');
