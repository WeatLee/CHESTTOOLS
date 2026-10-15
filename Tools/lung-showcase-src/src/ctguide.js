// Demo 5: CT-guided lung biopsy. A synthetic axial "CT" slice is built from the same
// meshes as the 3D model (never from a real scan), and the needle follows a path that
// was checked against bone, vessels and the heart (build-ct-plan.mjs). The slice and the 3D
// view advance together.
import { plan } from './ct-plan.js';

const UNIT_MM = 73.5;
const SPEED = 3.4;                 // progress units per second (about 30 s in all)
const SIZE = 512;
const seg = (v, from, to) => Math.min(1, Math.max(0, (v - from) / (to - from)));

// ---- slicing a mesh with the plane y = y0 ----
function sliceSegments(positions, index, y0) {
  const out = [];
  const pointOn = (a, b) => {
    const t = (positions[a + 1] - y0) / (positions[a + 1] - positions[b + 1]);
    return [positions[a] + t * (positions[b] - positions[a]), positions[a + 2] + t * (positions[b + 2] - positions[a + 2])];
  };
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const sa = positions[a + 1] < y0, sb = positions[b + 1] < y0, sc = positions[c + 1] < y0;
    if (sa === sb && sb === sc) continue;
    const found = [];
    if (sa !== sb) found.push(pointOn(a, b));
    if (sb !== sc) found.push(pointOn(b, c));
    if (sc !== sa) found.push(pointOn(c, a));
    if (found.length === 2) out.push(found[0], found[1]);
  }
  return out;
}

// Join segment end points into loops (shared edges give the same point from both triangles).
function loopsFrom(segments) {
  const key = p => `${Math.round(p[0] * 3000)},${Math.round(p[1] * 3000)}`;
  const neighbours = new Map();
  for (let i = 0; i < segments.length; i += 2) {
    const a = key(segments[i]), b = key(segments[i + 1]);
    if (a === b) continue;
    (neighbours.get(a) || neighbours.set(a, []).get(a)).push({ key: b, point: segments[i + 1] });
    (neighbours.get(b) || neighbours.set(b, []).get(b)).push({ key: a, point: segments[i] });
  }
  const loops = [], visited = new Set();
  const pointOf = new Map();
  for (let i = 0; i < segments.length; i += 2) { pointOf.set(key(segments[i]), segments[i]); pointOf.set(key(segments[i + 1]), segments[i + 1]); }
  for (const start of neighbours.keys()) {
    if (visited.has(start)) continue;
    const loop = [];
    let current = start, previous = null;
    while (current && !visited.has(current)) {
      visited.add(current);
      loop.push(pointOf.get(current));
      const next = (neighbours.get(current) || []).find(n => n.key !== previous && !visited.has(n.key));
      previous = current;
      current = next?.key;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (const p of sorted.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// ---- the synthetic CT picture ----
function collect(api) {
  const g = api.groups, found = [];
  const take = (group, kind, filter) => group.children.forEach(mesh => { if (mesh.geometry?.index && (!filter || filter(mesh))) found.push({ kind, mesh }); });
  Object.values(api.lungMeshes).forEach(mesh => found.push({ kind: 'lung', mesh }));
  take(g.skeletonGroup, 'bone');
  take(g.skinGroup, 'skin', mesh => mesh.userData.part === 'chest wall');
  take(g.heartGroup, 'heart', mesh => mesh.userData.organ === 'HEAR');
  take(g.heartGroup, 'vessel', mesh => ['AORT', 'NECA', 'NEJV', 'PULA', 'PULV'].includes(mesh.userData.organ));
  take(g.mediastinumGroup, 'soft');
  take(g.archBranchGroup, 'vessel');
  take(g.subclavianVeinGroup, 'vessel');
  take(g.bronchiGroup, 'airway', mesh => mesh.userData.airwayDeformable);
  return found;
}

function makeBase(api) {
  const y0 = plan.sliceY;
  const slices = collect(api).map(item => {
    const position = item.mesh.geometry.getAttribute('position').array, index = item.mesh.geometry.index.array;
    return { kind: item.kind, segments: sliceSegments(position, index, y0) };
  });
  // Frame the picture around the chest wall.
  const wallPoints = slices.filter(s => s.kind === 'skin').flatMap(s => s.segments);
  const hull = convexHull(wallPoints);
  const xs = hull.map(p => p[0]), zs = hull.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), back = Math.min(...zs), front = Math.max(...zs);
  const scale = Math.min(SIZE * 0.9 / (right - left), SIZE * 0.9 / (front - back));
  const toPixel = p => [SIZE / 2 + (p[0] - (left + right) / 2) * scale, SIZE / 2 - (p[1] - (back + front) / 2) * scale];

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE);
  const pathOf = loops => { const path = new Path2D(); for (const loop of loops) { loop.forEach((p, i) => { const [x, y] = toPixel(p); i ? path.lineTo(x, y) : path.moveTo(x, y); }); path.closePath(); } return path; };
  // Outlines are stroked and the outside is flood-filled, so a badly joined loop cannot leave a false wedge.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = SIZE;
  const mg = maskCanvas.getContext('2d', { willReadFrequently: true });
  const fillKind = (kind, color) => {
    mg.clearRect(0, 0, SIZE, SIZE);
    mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.lineCap = 'round';
    mg.beginPath();
    let any = false;
    for (const s of slices) if (s.kind === kind) for (let i = 0; i < s.segments.length; i += 2) {
      const [x1, y1] = toPixel(s.segments[i]), [x2, y2] = toPixel(s.segments[i + 1]);
      mg.moveTo(x1, y1); mg.lineTo(x2, y2); any = true;
    }
    if (!any) return;
    mg.stroke();
    const wall = mg.getImageData(0, 0, SIZE, SIZE).data;
    const outside = new Uint8Array(SIZE * SIZE), stack = [];
    const push = i => { if (!outside[i] && wall[i * 4 + 3] < 128) { outside[i] = 1; stack.push(i); } };
    for (let k = 0; k < SIZE; k++) { push(k); push((SIZE - 1) * SIZE + k); push(k * SIZE); push(k * SIZE + SIZE - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % SIZE;
      if (x > 0) push(i - 1);
      if (x < SIZE - 1) push(i + 1);
      if (i >= SIZE) push(i - SIZE);
      if (i < SIZE * (SIZE - 1)) push(i + SIZE);
    }
    const [r, gr, b] = [1, 3, 5].map(k => parseInt(color.slice(k, k + 2), 16));
    const image = g.getImageData(0, 0, SIZE, SIZE), data = image.data;
    for (let i = 0; i < outside.length; i++) if (!outside[i]) { data[i * 4] = r; data[i * 4 + 1] = gr; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
    g.putImageData(image, 0, 0);
  };
  // Body wall: darker fat under the skin, lighter muscle inside it.
  const hullPath = new Path2D();
  hull.forEach((p, i) => { const [x, y] = toPixel(p); i ? hullPath.lineTo(x, y) : hullPath.moveTo(x, y); });
  hullPath.closePath();
  g.fillStyle = '#555'; g.fill(hullPath);
  g.save();
  const cx = SIZE / 2, cy = SIZE / 2;
  g.translate(cx, cy); g.scale(.93, .93); g.translate(-cx, -cy);
  g.fillStyle = '#868686'; g.fill(hullPath);
  g.restore();
  fillKind('lung', '#262626');
  fillKind('airway', '#000');
  fillKind('heart', '#9b9b9b');
  fillKind('vessel', '#adadad');
  fillKind('soft', '#8d8d8d');
  fillKind('bone', '#e4e4e4');
  // The lesion: a solid mass with a slightly irregular edge.
  const [lx, ly] = toPixel([plan.lesion.center[0], plan.lesion.center[2]]);
  const radius = plan.lesion.radius * scale;
  g.fillStyle = '#8f8f8f';
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const wobble = 1 + .09 * Math.sin(angle * 5 + 1) + .05 * Math.sin(angle * 9 + 2);
    const x = lx + Math.cos(angle) * radius * wobble, y = ly + Math.sin(angle) * radius * wobble;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath(); g.fill();
  // Grain and a little blur, so it reads as an image rather than a diagram.
  const image = g.getImageData(0, 0, SIZE, SIZE), data = image.data;
  let seed = 12345;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gray = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] + (random() - .5) * (data[i * 4] < 60 ? 16 : 22);
  const blurred = new Float32Array(gray.length);
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
    const i = y * SIZE + x;
    blurred[i] = (gray[i] * 4 + gray[i - 1] * 2 + gray[i + 1] * 2 + gray[i - SIZE] * 2 + gray[i + SIZE] * 2 + gray[i - SIZE - 1] + gray[i - SIZE + 1] + gray[i + SIZE - 1] + gray[i + SIZE + 1]) / 16;
  }
  for (let i = 0; i < gray.length; i++) { const v = Math.max(0, Math.min(255, blurred[i] || gray[i])); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; }
  g.putImageData(image, 0, 0);
  return { canvas, toPixel, scale };
}

export function createCtDemo() {
  const lesionCenter = plan.lesion.center, radius = plan.lesion.radius;
  const direction = plan.direction, entry = plan.entry;
  const pathLength = Math.hypot(...lesionCenter.map((v, k) => v - entry[k]));
  const stopDistance = pathLength - radius * 1.05;   // sheath tip rests at the near edge of the mass
  const biopsyReach = radius * 1.1;                  // the cutting needle reaches about the middle of the mass
  const along = (distance, origin = entry) => origin.map((v, k) => v + direction[k] * distance);
  const depthCm = (pathLength * UNIT_MM / 10).toFixed(1);

  let state = { p: 0, playing: true, last: 0 };
  let base = null, objects = null, key = '';
  let cleanup = [];

  // How far the sheath has gone, and the cutting needle, at progress p.
  const sheathAt = p => p < 34 ? 0 : stopDistance * seg(p, 34, 62) * (1 - 0 * seg(p, 84, 100));
  const withdrawal = p => seg(p, 84, 96);
  const needleDepth = p => p >= 84 ? stopDistance * (1 - withdrawal(p)) : sheathAt(p);
  const biopsyExtension = p => {
    if (p < 64 || p >= 82) return 0;
    const cycle = (p - 64) / 6;                       // three quick passes
    const phase = cycle - Math.floor(cycle);
    return biopsyReach * (phase < .5 ? seg(phase, 0, .25) : 1 - seg(phase, .5, .75));
  };
  const scanCount = p => 1 + (p >= 40) + (p >= 50) + (p >= 60) + (p >= 74);
  const flash = p => [40, 50, 60, 74].some(t => p >= t && p < t + 1.4);

  function build3D(api) {
    const { THREE } = api;
    const group = new THREE.Group();
    const lesion = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), new THREE.MeshStandardMaterial({ color: 0xd6a14f, roughness: .6, emissive: 0x67441a, emissiveIntensity: .12 }));
    lesion.position.set(...lesionCenter);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf3d38a, transparent: true, opacity: .16, depthWrite: false }));
    halo.position.copy(lesion.position);
    // The slice: a pale plane at the scan level.
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4), new THREE.MeshBasicMaterial({ color: 0x3f7a72, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2; plane.position.set(0, plan.sliceY, -.45);
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-2.8, -2.45], [2.8, -2.45], [2.8, 1.55], [-2.8, 1.55]].map(([x, z]) => new THREE.Vector3(x, plan.sliceY, z))), new THREE.LineBasicMaterial({ color: 0x3f7a72 }));
    // Skin mark and planned line.
    const mark = new THREE.Mesh(new THREE.RingGeometry(.04, .07, 20), new THREE.MeshBasicMaterial({ color: 0x1f2d3a, side: THREE.DoubleSide }));
    mark.position.set(...entry); mark.lookAt(new THREE.Vector3(...entry).sub(new THREE.Vector3(...direction)));
    const planned = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...entry), new THREE.Vector3(...lesionCenter)]), new THREE.LineDashedMaterial({ color: 0xf0b73c, dashSize: .08, gapSize: .05, depthTest: false }));
    planned.computeLineDistances(); planned.renderOrder = 40;
    const needle = new THREE.Group();
    group.add(plane, outline, lesion, halo, mark, planned, needle);
    group.visible = false;
    api.scene.add(group);
    return { group, plane, outline, lesion, mark, planned, needle };
  }

  function updateNeedle(api, p) {
    const { THREE } = api;
    const needle = objects.needle;
    for (const child of [...needle.children]) { needle.remove(child); child.geometry?.dispose(); }
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: .7, roughness: .25 });
    const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7a72, roughness: .5 });
    const direction3 = new THREE.Vector3(...direction);
    const tube = (from, to, r, material, ghost = true) => {
      const curve = new THREE.LineCurve3(new THREE.Vector3(...from), new THREE.Vector3(...to));
      const geometry = new THREE.TubeGeometry(curve, 4, r, 10, false);
      const mesh = new THREE.Mesh(geometry, material); needle.add(mesh);
      if (ghost) { const x = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xdfe3e6, transparent: true, opacity: .3, depthTest: false, depthWrite: false })); x.renderOrder = 45; needle.add(x); }
    };
    const hub = (at) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .12, 14), hubMaterial);
      mesh.position.set(...at); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction3); needle.add(mesh);
    };
    // Local anaesthetic: a thin needle to the chest wall.
    if (p >= 24 && p < 34) {
      const f = p < 30 ? seg(p, 24, 30) : 1 - seg(p, 30, 34);
      const depth = .38 * f, tail = along(depth - .45);
      tube(tail, along(depth), .008, steel);
    }
    // The sheath (coaxial needle), going in a little at a time.
    if (p >= 34) {
      const depth = needleDepth(p);
      tube(along(depth - 1.1), along(depth), .02, steel);
      hub(along(depth - 1.16));
      const extension = biopsyExtension(p);
      if (extension > .005) tube(along(depth), along(depth + extension), .011, new THREE.MeshStandardMaterial({ color: 0xc4572f, metalness: .4, roughness: .4 }));
    }
    objects.planned.visible = p >= 12 && p < 36;
    objects.mark.visible = p >= 4;
  }

  // ---- the slice picture ----
  function drawCt(p) {
    const canvas = document.getElementById('ctCanvas');
    if (!canvas || !base) return;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, SIZE, SIZE);
    const scanIn = seg(p, 0, 8);
    g.globalAlpha = scanIn;
    g.drawImage(base.canvas, 0, 0);
    g.globalAlpha = 1;
    // A scan line sweeps down the picture while the first scan is made.
    if (p < 8) { g.fillStyle = '#7fe0d0'; g.fillRect(0, scanIn * SIZE, SIZE, 2); }
    if (flash(p)) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, SIZE, SIZE); }
    const px = point => base.toPixel([point[0], point[2]]);
    const [ex, ey] = px(entry), [tx, ty] = px(lesionCenter);
    const unitPx = base.scale;
    // Planned path and its length.
    if (p >= 12 && p < 36) {
      g.save(); g.setLineDash([8, 6]); g.strokeStyle = '#f0b73c'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx, ty); g.stroke(); g.restore();
      g.fillStyle = '#f0b73c'; g.font = 'bold 15px sans-serif';
      g.fillText(`約 ${depthCm} 公分`, (ex + tx) / 2 - 30, (ey + ty) / 2 - 10);
    }
    // Skin marker (a bright dot on the skin).
    if (p >= 4) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, 4, 0, Math.PI * 2); g.fill(); }
    // The needle(s): a bright line with a faint halo, the way metal looks on CT.
    const drawNeedle = (fromDepth, toDepth, width) => {
      const a = px(along(fromDepth)), b = px(along(toDepth));
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = width + 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = width; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    };
    if (p >= 24 && p < 34) { const f = p < 30 ? seg(p, 24, 30) : 1 - seg(p, 30, 34); drawNeedle(-.45, .38 * f, 2); }
    if (p >= 34) {
      const depth = needleDepth(p);
      drawNeedle(-.5, depth, 3);
      const extension = biopsyExtension(p);
      if (extension > .005) { g.strokeStyle = '#ffb27a'; g.lineWidth = 3; const a = px(along(depth)), b = px(along(depth + extension)); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    }
    // Letters, the scan number and a scale bar.
    g.fillStyle = '#cfe8e2'; g.font = 'bold 18px sans-serif';
    g.fillText('R', 10, SIZE / 2 + 6); g.fillText('L', SIZE - 24, SIZE / 2 + 6); g.fillText('前', SIZE / 2 - 8, 24); g.fillText('後', SIZE / 2 - 8, SIZE - 36);
    g.font = '14px sans-serif';
    g.fillText(`掃描 ${scanCount(p)}`, 12, 24);
    const barLength = 50 / UNIT_MM * unitPx;
    g.fillRect(SIZE - 22 - barLength, SIZE - 30, barLength, 3);
    g.fillText('5 公分', SIZE - 22 - barLength, SIZE - 38);
  }

  const demo = {
    id: 'ct', no: 3, tab: 'CT 導引穿刺',
    title: '電腦斷層（CT）導引穿刺切片',
    when: '當腫瘤長在肺的外圍、靠近胸壁，支氣管鏡不容易到達時，醫師會在電腦斷層的導引下，用細針從胸壁穿刺取樣。檢查時病人躺在檢查台上，醫師邊看影像邊調整針的方向。',
    camera: [[-6.8, 1.7, 5.8], [-.3, -.2, 0]],
    pictures: [{ src: 'lung-showcase/images/ct-table.webp', caption: 'AI 生成之示意圖：病人躺在檢查台上，醫師看著影像引導針進入' }],
    steps: [
      { at: 0, title: '檢查前掃描', text: '病人躺在檢查台上，皮膚貼上有刻度的標記貼。先做電腦斷層掃描，找到腫瘤（黃色）的位置。' },
      { at: 12, title: '規劃安全的針道', text: `在影像上選一條最短、又能避開肋骨、大血管和心臟的路徑，量出皮膚到腫瘤約 ${depthCm} 公分。` },
      { at: 24, title: '局部麻醉', text: '消毒、鋪單後，把麻醉藥打在皮膚到胸膜的路徑上，讓穿刺時比較不痛。' },
      { at: 34, title: '沿著影像導引進針', text: '導引針一小段一小段往前推，每推一段就再掃描一次，確認針尖方向正確，直到靠近腫瘤邊緣。' },
      { at: 62, title: '取得組織', text: '取樣針從導引針裡伸出，快速取出細長的組織條，通常會取 2～3 條，送去做病理檢查。' },
      { at: 84, title: '退針與觀察', text: '把針拔出，按壓傷口。檢查後會再拍胸部影像，觀察有沒有氣胸或出血。' }
    ],
    progress: () => state.p,
    playing: () => state.playing,
    pause() { state.playing = false; },
    resume() { state.playing = true; },
    replay() { state.p = 0; state.playing = true; },
    seek(c, value) { state.p = value; state.playing = false; },
    frame(c) {
      if (!objects) return;
      const now = performance.now();
      const dt = state.last ? Math.min(.05, (now - state.last) / 1000) : 0;
      state.last = now;
      if (state.playing) { state.p = Math.min(100, state.p + dt * SPEED); if (state.p >= 100) state.playing = false; }
      const p = state.p, next = p.toFixed(2);
      if (next !== key) { key = next; updateNeedle(c.api, p); }
      drawCt(p);
    },
    enter(c) {
      const api = c.api;
      if (!base) base = makeBase(api);
      if (!objects) objects = build3D(api);
      objects.group.visible = true;
      state = { p: 0, playing: true, last: 0 }; key = '';
      c.tick('showSkeleton', true);
      c.tick('showSkin', true);
      c.tick('showHeart', false);
      c.tick('idleBreathing', false);
      c.setVal('opacity', 42);
      api.setSkinAlpha(.22);
      api.setCamera(...this.camera);
      const panel = document.getElementById('ctPanel');
      panel.hidden = false;
      panel.classList.remove('big');
      const toggle = () => panel.classList.toggle('big');
      panel.addEventListener('click', toggle);
      cleanup.push(() => panel.removeEventListener('click', toggle));
    },
    exit(c) {
      if (objects) objects.group.visible = false;
      c.api.setSkinAlpha(null);
      cleanup.forEach(fn => fn()); cleanup = [];
      document.getElementById('ctPanel').hidden = true;
    }
  };
  return demo;
}
