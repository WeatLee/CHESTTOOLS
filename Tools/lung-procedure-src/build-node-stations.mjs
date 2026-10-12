// Place EBUS-TBNA lymph node stations (IASLC map) beside the traced airway.
// Each node starts at a textbook position relative to the trachea, carina or
// bronchial divisions, then is pushed clear of the displayed airway, heart,
// great vessels, azygos, esophagus and hand-drawn aorta (the same packed
// meshes the page shows). Run after build-procedure-mesh and build-airway-routes:
//   node build-node-stations.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import organData from './src/organ-mesh-data.js';
import procedureData from './src/procedure-mesh-data.js';
import { trachea, routes } from './src/airway-routes.js';
import { aortaPoints, aortaRadius } from './src/aorta-path.js';

const NODE = .1;   // node radius, ~7 mm: an enlarged node about 1.5 cm across
const GAP = .015;  // clearance kept from neighbouring structures

// --- obstacle point clouds (scene units) ------------------------------------
function organParts() {
  const b = gunzipSync(Buffer.from(organData, 'base64')), parts = {};
  for (let at = 6, g = 0; g < b[5]; g++) {
    const key = b.toString('ascii', at, at + 4), nv = b.readUInt32LE(at + 4), ni = b.readUInt32LE(at + 8); at += 12;
    const pts = []; for (let i = 0; i < nv; i++) pts.push([0, 1, 2].map(k => b.readFloatLE(at + (i * 3 + k) * 4)));
    at += nv * 12 + ni * 4; parts[key] = pts;
  }
  return parts;
}
function procedureParts() {
  const b = gunzipSync(Buffer.from(procedureData, 'base64')), parts = {};
  for (let at = 6, g = 0; g < b[5]; g++) {
    const key = b.toString('ascii', at, at + 4), nv = b.readUInt32LE(at + 4), ni = b.readUInt32LE(at + 8), wide = b[at + 12];
    const o = [0, 1, 2].map(k => b.readFloatLE(at + 13 + k * 4)), st = b.readFloatLE(at + 25); at += 29;
    const pts = []; for (let i = 0; i < nv; i++) pts.push([0, 1, 2].map(k => o[k] + b.readUInt16LE(at + (i * 3 + k) * 2) * st));
    at += nv * 6 + ni * (wide ? 4 : 2); parts[key] = pts;
  }
  return parts;
}
const organs = organParts(), proc = procedureParts();
const obstacles = [
  ...['HEAR', 'NECA', 'NEJV', 'PULA', 'PULV'].map(k => [k, organs[k]]),
  ...['AIRW', 'AZYG', 'ESOP', 'ARTS'].map(k => [k, proc[k]])
];
// Spatial hash for nearest-vertex queries.
const CELL = .06, hash = new Map();
const keyOf = p => p.map(v => Math.floor(v / CELL)).join(',');
for (const [name, pts] of obstacles) for (const p of pts) { const k = keyOf(p); (hash.get(k) || hash.set(k, []).get(k)).push([p, name]); }
function near(p, radius) {
  const out = [], r = Math.ceil(radius / CELL), c = p.map(v => Math.floor(v / CELL));
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
    for (const item of hash.get([c[0] + i, c[1] + j, c[2] + k].join(',')) || []) {
      const d = Math.hypot(...item[0].map((v, n) => v - p[n])); if (d < radius) out.push([item, d]);
    }
  }
  return out;
}
// Hand-drawn aorta as dense samples of its centripetal Catmull–Rom centreline.
const aorta = (() => {
  const P = aortaPoints, out = [];
  for (let s = 0; s < P.length - 1; s++) {
    const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
    for (let t = 0; t < 1; t += .04) {
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out.map((p, i, all) => ({ p, r: aortaRadius(i / all.length) }));
})();
const sub = (a, b) => a.map((v, k) => v - b[k]), add = (a, b) => a.map((v, k) => v + b[k]);
const scaleV = (a, s) => a.map(v => v * s), len = a => Math.hypot(...a), unit = a => scaleV(a, 1 / (len(a) || 1));

// --- airway landmarks ----------------------------------------------------------
const carina = trachea.at(-1);
const atHeight = (route, y) => route.reduce((best, p) => Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best);
// Paths inside a wide bronchus drift a few millimetres apart before they truly
// branch, so a division is where they part by more than ~6 mm, minus one step.
const diverge = (a, b) => { const r1 = routes[a], r2 = routes[b]; let i = 0; while (i < r1.length && i < r2.length && len(sub(r1[i], r2[i])) < .08) i++; return r1[Math.max(0, i - 2)]; };
const along = (route, from, distance) => { let i = route.reduce((best, p, n) => len(sub(p, from)) < len(sub(route[best], from)) ? n : best, 0), run = 0; while (i + 1 < route.length && run < distance) { run += len(sub(route[i + 1], route[i])); i++; } return route[i]; };
// Airway radius at a centreline point: distance to the nearest airway vertex.
const airwayRadius = p => Math.min(...near(p, .3).filter(([[, n]]) => n === 'AIRW').map(([, d]) => d), .2);

const right = routes.RS6, left = routes.LS6;
const rul = diverge('RS1', 'RS6'), rml = diverge('RS4', 'RS6'), lul = diverge('LS3', 'LS6');
// [key, label, description, route, airway anchor, outward direction, options]
const plan = [
  ['2R', '2R 右上氣管旁', '氣管右側，頭臂靜脈與氣管交會處以上', trachea, atHeight(trachea, 1.62), [-1, 0, .25]],
  ['2L', '2L 左上氣管旁', '氣管左側，主動脈弓上緣以上', trachea, atHeight(trachea, 1.62), [1, 0, .15]],
  ['4R', '4R 右下氣管旁', '氣管右前側，頭臂靜脈交會處到奇靜脈下緣', trachea, atHeight(trachea, 1.08), [-1, 0, .4]],
  ['4L', '4L 左下氣管旁', '左氣管支氣管角，主動脈弓內側、左肺動脈上緣以上', left, along(left, carina, .08), [.6, .8, 0]],
  ['7', '7 隆突下', '隆突下方，左右主支氣管之間', trachea, carina, [0, -1, -.05], { start: add(carina, [0, -.34, -.02]), reach: .45 }],
  ['10R', '10R 右肺門', '右主支氣管旁，奇靜脈下緣以下、右上葉支氣管開口以上', right, along(right, carina, .1), [-.3, .5, .8]],
  ['10L', '10L 左肺門', '左主支氣管上緣，主動脈弓與左肺動脈下方', left, along(left, carina, .3), [.2, .8, -.3]],
  ['11Rs', '11Rs 右葉間（上）', '右上葉支氣管與中間支氣管之間', right, rul, [-1, -.3, -.4]],
  ['11Ri', '11Ri 右葉間（下）', '右中葉與右下葉支氣管之間', right, rml, [-.6, -.3, .7]],
  ['11L', '11L 左葉間', '左上葉與左下葉支氣管之間', left, lul, [1, -.15, -.1]]
];

const stations = {}, report = [], placed = [];
for (const [key, label, description, route, anchor, outward, options = {}] of plan) {
  const wallRadius = airwayRadius(anchor);
  let c = options.start || add(anchor, scaleV(unit(outward), wallRadius + NODE + GAP));
  for (let iter = 0; iter < 120; iter++) {
    // One push per step: the deepest overlap, along the mean escape direction.
    // Summing every overlapping vertex lets dense vessel meshes fling the node away.
    let direction = [0, 0, 0], deepest = 0;
    for (const [[p], d] of near(c, NODE + GAP)) { const depth = NODE + GAP - d; direction = add(direction, scaleV(unit(sub(c, p)), depth)); deepest = Math.max(deepest, depth); }
    let push = deepest ? scaleV(unit(direction), deepest) : [0, 0, 0];
    // Stations placed earlier are obstacles too, so neighbouring nodes do not merge.
    for (const q of placed) { const dq = len(sub(c, q)); if (dq < 2 * NODE + GAP) push = add(push, scaleV(unit(sub(c, q)), 2 * NODE + GAP - dq)); }
    const s = aorta.reduce((best, a) => len(sub(c, a.p)) < len(sub(c, best.p)) ? a : best);
    const da = len(sub(c, s.p)); if (da < s.r + NODE + GAP) push = add(push, scaleV(unit(sub(c, s.p)), s.r + NODE + GAP - da));
    // Stay within needle reach of the airway wall.
    // Hilar nodes abut both bronchus and vessels: hold the node against its
    // bronchus (it may slide around it) rather than letting vessels push it away.
    const reach = len(sub(c, anchor)) - (options.reach || wallRadius + NODE + .035); if (reach > 0) push = add(push, scaleV(unit(sub(anchor, c)), reach * 2));
    if (len(push) < 1e-4) break;
    c = add(c, scaleV(push, .5));
    // Keep the node on its own side of the airway: within ~57° of the
    // textbook direction, so 4L cannot slide round to the right, and so on.
    const o = unit(outward);
    for (let turn = 0; turn < 20; turn++) {
      const v = sub(c, anchor), dist = len(v);
      if (dist < 1e-6 || v.reduce((s, x, k) => s + x * o[k], 0) / dist >= .55) break;
      c = add(anchor, scaleV(unit(add(unit(v), scaleV(o, .15))), dist));
    }
  }
  // The scope stops at the route point nearest the node; the needle leaves the wall toward it.
  const stopIndex = route.reduce((best, p, i) => len(sub(p, c)) < len(sub(route[best], c)) ? i : best, 0);
  const stop = route[stopIndex], r = airwayRadius(stop);
  // A node squeezed into a bronchial crotch can still touch the wall; move it
  // out along the needle line so it sits fully outside the airway.
  if (len(sub(c, stop)) < r + NODE + .015) c = add(stop, scaleV(unit(sub(c, stop)), r + NODE + .015));
  const wall = add(stop, scaleV(unit(sub(c, stop)), r));
  const clearance = Math.min(...near(c, .4).map(([, d]) => d), ...aorta.map(a => len(sub(c, a.p)) - a.r)) - NODE;
  // Needle path between wall and node: closest non-airway structure.
  let needleClear = Infinity;
  for (let t = .15; t <= .85; t += .05) {
    const q = add(wall, scaleV(sub(c, wall), t));
    for (const [[, n], d] of near(q, .2)) if (n !== 'AIRW') needleClear = Math.min(needleClear, d);
    for (const a of aorta) needleClear = Math.min(needleClear, len(sub(q, a.p)) - a.r);
  }
  placed[placed.length] = c;
  const round3 = p => p.map(v => +v.toFixed(3));
  stations[key] = { label, description, route: route.slice(0, stopIndex + 1), wall: round3(wall), node: round3(c), radius: NODE };
  report.push(`${key.padEnd(5)} anchor ${JSON.stringify(round3(anchor))} node ${JSON.stringify(round3(c))} clearance ${(clearance * 73.5).toFixed(1)} mm, needle ${(len(sub(c, wall)) * 73.5).toFixed(0)} mm, needle clearance ${(needleClear * 73.5).toFixed(1)} mm`);
}
console.log(report.join('\n'));
writeFileSync(join(import.meta.dirname, 'src', 'node-stations.js'),
  '// Generated by build-node-stations.mjs. IASLC lymph node stations for the EBUS-TBNA demonstration;\n// positions are schematic, cleared of the displayed structures. Scene units.\n' +
  `export const stations=${JSON.stringify(stations)};\n`);
console.log('Wrote src/node-stations.js');
