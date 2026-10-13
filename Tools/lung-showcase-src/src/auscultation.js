// Demo 4: breath sounds. The patient picks a sound type and a listening spot on a
// front or back chest map (or taps the marker on the 3D chest). The sound comes
// from the scene's own audio engine (main.js); this file supplies the map, the
// markers, the explanations and a waveform. Stridor is only audible at the
// larynx and neck trachea, never over the lungs.
import audioData from '../../lung-procedure-src/src/audio-data.js';

const SOUNDS = [
  { id: 'normal', label: '正常呼吸音', title: '正常的呼吸音', text: '吸氣聲比較長、比較柔和，呼氣聲短而輕，像微風吹過。越靠近氣管，聲音越大、越粗。' },
  { id: 'wheeze', label: '哮鳴音', sub: 'Wheezing', title: '哮鳴音（Wheezing）', text: '像吹口哨的「咻咻」聲，常在呼氣時比較明顯，表示比較小的氣道變窄。常見於氣喘、慢性阻塞性肺病（COPD）。' },
  { id: 'fine', label: '細濕囉音', sub: 'Fine crackles', title: '細濕囉音（Fine crackles）', text: '像用手指在耳邊搓頭髮、或撕開魔鬼氈的「沙沙」聲，多出現在深吸氣的後半段，常在兩側肺底。常見於肺纖維化、肺水腫。' },
  { id: 'coarse', label: '粗濕囉音', sub: 'Coarse crackles', title: '粗濕囉音（Coarse crackles）', text: '比較粗的「咕嚕咕嚕」水泡聲，常見於痰多、肺炎；咳嗽後聲音可能改變。' },
  { id: 'stridor', label: '喘鳴音', sub: 'Stridor', title: '喘鳴音（Stridor）', badge: '只在喉嚨與氣管', text: '吸氣時尖銳、高音調的聲音，表示喉嚨或上段氣管變窄（例如異物、水腫、腫瘤），需要儘快處理。這個聲音只有在喉嚨與頸部氣管聽得最清楚，兩側肺野是聽不到的。' }
];
const SOUND_BY_ID = Object.fromEntries(SOUNDS.map(sound => [sound.id, sound]));

const FRONT_CAMERA = [[0, .55, 8.9], [0, .45, 0]];
const BACK_CAMERA = [[0, .55, -8.9], [0, .45, 0]];

// Listening spots follow the standard chest-examination chart: front 1-6 and back 1-7 on each side.
// below = height under the lung apex, t = position across the lung (0 near the midline, 1 at the side),
// mapX / mapY = place on the flat chest map (viewBox 300 x 330, mapX measured from the midline).
const SPOTS = {
  front: [
    { n: 1, name: '鎖骨下方（上肺）', below: .45, t: .45, mapX: 36, mapY: 108, zone: 'bronchovesicular' },
    { n: 2, name: '第二～三肋間（上肺）', below: 1.1, t: .45, mapX: 36, mapY: 152, zone: 'vesicular' },
    { n: 3, name: '第四肋間（中肺）', below: 1.75, t: .45, mapX: 36, mapY: 196, zone: 'vesicular' },
    { n: 4, name: '乳頭內側（中下肺）', below: 2.35, t: .4, mapX: 30, mapY: 240, zone: 'vesicular' },
    { n: 5, name: '前腋線（中下肺，外側）', below: 2.35, t: .8, mapX: 88, mapY: 240, zone: 'vesicular' },
    { n: 6, name: '側胸下方（下肺）', below: 3.0, t: .76, mapX: 84, mapY: 280, zone: 'vesicular' }
  ],
  back: [
    { n: 1, name: '肩胛骨上方（上肺）', below: .65, t: .3, mapX: 34, mapY: 100, zone: 'bronchovesicular' },
    { n: 2, name: '肩胛骨內側（上肺）', below: 1.35, t: .3, mapX: 34, mapY: 140, zone: 'vesicular' },
    { n: 3, name: '肩胛骨下緣附近（中肺）', below: 2.0, t: .3, mapX: 34, mapY: 180, zone: 'vesicular' },
    { n: 4, name: '背部中下方（下肺）', below: 2.65, t: .3, mapX: 34, mapY: 220, zone: 'vesicular' },
    { n: 5, name: '背部下方（肺底）', below: 3.3, t: .3, mapX: 34, mapY: 260, zone: 'vesicular' },
    { n: 6, name: '後腋線（下肺，外側）', below: 2.65, t: .8, mapX: 92, mapY: 220, zone: 'vesicular' },
    { n: 7, name: '側背下方（肺底，外側）', below: 3.3, t: .74, mapX: 88, mapY: 260, zone: 'vesicular' }
  ]
};
const SIDE_NAME = { R: '右', L: '左' };

function buildPoints() {
  const points = [];
  for (const view of ['front', 'back']) {
    for (const side of ['R', 'L']) {
      const viewName = view === 'front' ? '前胸' : '背後';
      for (const spot of SPOTS[view]) {
        points.push({ id: `${view}-${side}-${spot.n}`, view, side, kind: 'row', below: spot.below, t: spot.t, zone: spot.zone, number: spot.n, name: `${SIDE_NAME[side]}${viewName}・第 ${spot.n} 點：${spot.name}`, mapX: spot.mapX, mapY: spot.mapY });
      }
    }
  }
  points.push({ id: 'air-larynx', view: 'front', side: null, kind: 'air', zone: 'tracheal', name: '喉嚨（喉部）', mapX: 0, mapY: 36, air: true });
  points.push({ id: 'air-trachea', view: 'front', side: null, kind: 'air', zone: 'tracheal', name: '頸部氣管（胸骨上方）', mapX: 0, mapY: 74, air: true });
  return points;
}

// 3D positions: found from the lungs' own outline, then projected onto the skin.
function locatePoints(api, points) {
  const { THREE } = api;
  const lungVertices = { R: [], L: [] };
  for (const [key, mesh] of Object.entries(api.lungMeshes)) {
    const array = mesh.userData.basePositions || mesh.geometry.getAttribute('position').array;
    for (let i = 0; i < array.length; i += 3) lungVertices[key[0]].push([array[i], array[i + 1], array[i + 2]]);
  }
  const top = { R: Math.max(...lungVertices.R.map(p => p[1])), L: Math.max(...lungVertices.L.map(p => p[1])) };
  const extent = (side, y) => {
    let low = Infinity, high = -Infinity;
    for (const p of lungVertices[side]) if (Math.abs(p[1] - y) < .09) { const a = Math.abs(p[0]); if (a < low) low = a; if (a > high) high = a; }
    return low < high ? [low, high] : [.3, 1.6];
  };
  const skin = api.groups.skinGroup.children.find(mesh => mesh.userData.part === 'exterior');
  const raycaster = new THREE.Raycaster();
  const hit = (x, y, view) => {
    raycaster.set(new THREE.Vector3(x, y, view === 'front' ? 8 : -8), new THREE.Vector3(0, 0, view === 'front' ? -1 : 1));
    const found = raycaster.intersectObject(skin, false)[0];
    if (!found) return null;
    const normal = found.face.normal.clone();
    if (normal.z * (view === 'front' ? 1 : -1) < 0) normal.negate();
    return { position: found.point.clone(), normal };
  };
  for (const point of points) {
    let x, y;
    if (point.air) { x = 0; y = point.id === 'air-larynx' ? 2.45 : 1.68; }
    else {
      const sign = point.side === 'R' ? -1 : 1;
      { y = top[point.side] - point.below; const [low, high] = extent(point.side, y); x = sign * (low + (high - low) * point.t); }
    }
    const found = hit(x, y, point.view);
    point.surface = found || { position: new THREE.Vector3(x, y, point.view === 'front' ? 1 : -1), normal: new THREE.Vector3(0, 0, point.view === 'front' ? 1 : -1) };
  }
}

// ---- waveform data ----
const peaksCache = new Map();
async function peaksFor(key) {
  if (peaksCache.has(key)) return peaksCache.get(key);
  const source = audioData[key];
  let peaks = null;
  if (source) {
    try {
      const buffer = await (await fetch(source)).arrayBuffer();
      const decoded = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(buffer);
      const data = decoded.getChannelData(0), bins = 160, per = Math.floor(data.length / bins);
      peaks = Array.from({ length: bins }, (_, i) => { let max = 0; for (let j = i * per; j < (i + 1) * per; j++) max = Math.max(max, Math.abs(data[j])); return max; });
      const biggest = Math.max(...peaks) || 1;
      peaks = peaks.map(value => value / biggest);
    } catch { peaks = null; }
  }
  peaksCache.set(key, peaks);
  return peaks;
}

export function createSoundDemo() {
  const points = buildPoints();
  let located = false, markers = null, active = null;
  let soundId = 'normal', view = 'front', selected = null, wavePeaks = null, waveKey = null;
  let ui = null;

  // What is heard at the chosen spot for the chosen sound.
  const heard = () => {
    if (!selected) return null;
    const stridorOverLung = soundId === 'stridor' && selected.zone !== 'tracheal';
    const effective = stridorOverLung ? 'normal' : soundId;
    const clip = effective === 'normal' ? (selected.zone === 'vesicular' ? 'vesicular' : null) : effective;
    return { effective, clip, stridorOverLung };
  };

  function listenCard() {
    const result = heard();
    const sound = SOUND_BY_ID[soundId];
    if (!selected) {
      ui.card.innerHTML = `<b>請先點一個聽診位置</b>點下方胸部圖上的圓點，或直接點 3D 胸部上的小圓點，就會播放聲音（手機請先確認沒有靜音）。`;
      return;
    }
    let title = `在「${selected.name}」`;
    let text;
    if (result.stridorOverLung) text = `這裡聽不到喘鳴音，聽到的是正常的呼吸音。喘鳴音只在<strong>喉嚨與頸部氣管</strong>聽得到，請改點圖上橘色的兩個位置。`;
    else if (soundId === 'normal' && selected.zone === 'tracheal') text = '氣管附近的呼吸音比較大聲、比較粗（示意用的合成聲音）。';
    else if (soundId === 'normal' && selected.zone === 'bronchovesicular') text = '靠近胸骨或脊椎的上肺，聲音介於氣管音與肺泡音之間（示意用的合成聲音）。';
    else text = sound.text;
    ui.card.innerHTML = `<b>${title}</b>${text}`;
  }

  async function refreshWave() {
    const result = heard();
    waveKey = result ? result.clip : null;
    wavePeaks = waveKey ? await peaksFor(waveKey) : null;
  }

  function select(point, c, { quiet = false } = {}) {
    selected = point;
    c.api.listen(point.zone, soundId);
    markerUpdate(c);
    mapUpdate();
    listenCard();
    refreshWave();
    if (!quiet) c.api.toast?.(point.name);
  }
  function chooseSound(id, c) {
    soundId = id;
    ui.types.querySelectorAll('button').forEach(button => button.classList.toggle('on', button.dataset.id === id));
    if (selected) c.api.listen(selected.zone, soundId);
    listenCard();
    refreshWave();
  }
  function chooseView(next, c) {
    view = next;
    ui.switch.querySelectorAll('button').forEach(button => button.classList.toggle('on', button.dataset.view === next));
    mapRender(c);
    markerUpdate(c);
    c.api.tweenCamera(...(next === 'front' ? FRONT_CAMERA : BACK_CAMERA), 1);
  }

  // ---- chest map (SVG) ----
  function mapRender(c) {
    const outline = view === 'front'
      ? 'M105 20 Q150 10 195 20 L196 52 Q236 64 252 92 L262 200 L246 300 L54 300 L38 200 L48 92 Q64 64 104 52 Z'
      : 'M105 20 Q150 10 195 20 L196 52 Q236 64 252 92 L262 200 L246 300 L54 300 L38 200 L48 92 Q64 64 104 52 Z';
    const extras = view === 'front'
      ? '<path d="M150 70 L150 170" stroke="#d8d3c6" stroke-width="2" fill="none"/><path d="M120 60 Q150 70 180 60" stroke="#d8d3c6" stroke-width="2" fill="none"/>'
      : '<path d="M150 56 L150 290" stroke="#d8d3c6" stroke-width="3" stroke-dasharray="2 5" fill="none"/><path d="M92 100 Q104 150 120 168 M208 100 Q196 150 180 168" stroke="#d8d3c6" stroke-width="2" fill="none"/>';
    const dots = points.filter(point => point.view === view).map(point => {
      const x = 150 + (point.side === 'R' ? -point.mapX : point.mapX);
      return `<g class="pt${point.air ? ' air' : ''}${selected === point ? ' on' : ''}" data-id="${point.id}" role="button" tabindex="0" aria-label="${point.name}">
        <circle class="hit" cx="${x}" cy="${point.mapY}" r="21"/><circle class="dot" cx="${x}" cy="${point.mapY}" r="13"/>
        <text x="${x}" y="${point.mapY + 4}">${point.air ? (point.id === 'air-larynx' ? '喉' : '氣') : point.number}</text></g>`;
    }).join('');
    const corner = view === 'front' ? ['病人右側', '病人左側'] : ['病人右側', '病人左側'];
    ui.map.innerHTML = `<path d="${outline}" fill="#f4f1e8" stroke="#cfc9b8" stroke-width="2"/>${extras}${dots}
      <text x="40" y="322">${corner[0]}</text><text x="260" y="322">${corner[1]}</text>`;
    ui.map.querySelectorAll('.pt').forEach(group => {
      const point = points.find(p => p.id === group.dataset.id);
      const go = () => select(point, c);
      group.addEventListener('click', go);
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); } });
    });
  }
  function mapUpdate() { ui.map.querySelectorAll('.pt').forEach(group => group.classList.toggle('on', selected && group.dataset.id === selected.id)); }

  // ---- 3D markers ----
  function markersBuild(api) {
    const { THREE } = api;
    const group = new THREE.Group();
    const ring = new THREE.MeshBasicMaterial({ color: 0x2f7a70, transparent: true, opacity: .85, depthTest: true });
    const air = new THREE.MeshBasicMaterial({ color: 0xc98a3a, transparent: true, opacity: .9 });
    const hits = [];
    for (const point of points) {
      const { position, normal } = point.surface;
      const mesh = new THREE.Mesh(new THREE.RingGeometry(.045, .075, 24), point.air ? air : ring);
      mesh.position.copy(position).addScaledVector(normal, .012);
      mesh.lookAt(position.clone().add(normal));
      mesh.userData.point = point;
      const hit = new THREE.Mesh(new THREE.CircleGeometry(.16, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(mesh.position); hit.quaternion.copy(mesh.quaternion); hit.userData.point = point;
      group.add(mesh, hit); hits.push(hit);
      point.marker = mesh;
    }
    // The stethoscope head: a metal disc with a darker rim, moved to the chosen spot.
    const head = new THREE.Group();
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .035, 24), new THREE.MeshStandardMaterial({ color: 0xc9d1d4, metalness: .7, roughness: .3 })));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.11, .014, 8, 28), new THREE.MeshStandardMaterial({ color: 0x3b4a50, roughness: .5 }));
    rim.rotation.x = Math.PI / 2; head.add(rim);
    head.visible = false;
    group.add(head);
    api.scene.add(group);
    return { group, hits, head };
  }
  function markerUpdate(c) {
    if (!markers) return;
    for (const point of points) {
      point.marker.visible = point.view === view;
      point.marker.material = point === selected ? point.marker.material : point.marker.material;
      point.marker.scale.setScalar(point === selected ? 1.5 : 1);
    }
    if (selected && selected.view === view) {
      const { position, normal } = selected.surface;
      markers.head.visible = true;
      markers.head.position.copy(position).addScaledVector(normal, .05);
      markers.head.quaternion.setFromUnitVectors(new c.api.THREE.Vector3(0, 1, 0), normal);
    } else markers.head.visible = false;
  }
  function pointer(c) {
    const { THREE, camera, renderer } = c.api;
    const raycaster = new THREE.Raycaster();
    let down = null;
    const element = renderer.domElement;
    const onDown = event => { down = [event.clientX, event.clientY]; };
    const onUp = event => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 6 || !markers) { down = null; return; }
      down = null;
      const rect = element.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const candidates = markers.hits.filter(hit => hit.userData.point.view === view);
      const found = raycaster.intersectObjects(candidates, false)[0];
      if (found) select(found.object.userData.point, c);
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    return () => { element.removeEventListener('pointerdown', onDown); element.removeEventListener('pointerup', onUp); };
  }

  // ---- waveform ----
  function drawWave(time) {
    const canvas = ui?.wave;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1, width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, width, height);
    const result = heard();
    if (!result) { g.fillStyle = '#a9b6b2'; g.font = `${12 * ratio}px sans-serif`; g.fillText('尚未播放', 10 * ratio, height / 2 + 4 * ratio); return; }
    const audio = document.getElementById('teachingAudio');
    let phase;
    let bars;
    if (wavePeaks && audio && audio.duration) { phase = (audio.currentTime / audio.duration) % 1; bars = wavePeaks; }
    else {
      // Synthesized breath sounds: one slow in-and-out every 5 seconds, like the 3D lungs.
      phase = (time % 5000) / 5000;
      bars = Array.from({ length: 160 }, (_, i) => { const p = i / 160; return p < .42 ? Math.sin(Math.PI * p / .42) : p < .87 ? .58 * Math.sin(Math.PI * (p - .42) / .45) : 0; });
    }
    const step = width / bars.length;
    bars.forEach((value, i) => {
      const barHeight = Math.max(2 * ratio, value * height * .86);
      g.fillStyle = i / bars.length < phase ? '#3f7a72' : '#b9d1cc';
      g.fillRect(i * step, (height - barHeight) / 2, Math.max(1, step - 1), barHeight);
    });
    g.fillStyle = '#c4572f';
    g.fillRect(phase * width, 0, 2 * ratio, height);
  }

  let removePointer = null;
  return {
    id: 'sound', no: 5, tab: '呼吸音',
    title: '呼吸音與聽診',
    when: '醫師用聽診器在胸前與背後不同的位置聽，從呼吸聲的變化，初步判斷肺部與氣道的狀況。你也可以自己選聲音、選位置，聽聽看有什麼不同。',
    noPlayer: true, staticSteps: true,
    camera: FRONT_CAMERA,
    pictures: [{ src: 'lung-showcase/images/auscultation.webp', caption: '用聽診器聽診的情形' }],
    steps: [
      { at: 0, title: '選一種聲音', text: '正常、哮鳴音、細濕囉音、粗濕囉音、喘鳴音，點一下就能切換。' },
      { at: 1, title: '選聽診的位置', text: '點胸部圖上的圓點（前胸、背後各有每側 6～7 個位置），或直接點 3D 胸部上的小圓點。' },
      { at: 2, title: '聽聲音、看波形', text: '聲音會一直循環播放，下方的波形會跟著移動。喘鳴音只有在喉嚨和頸部氣管（橘色圓點）聽得到。' }
    ],
    progress: () => 0, playing: () => false, pause() {}, resume() {}, replay() {}, seek() {},
    frame(c) { drawWave(performance.now()); },
    enter(c) {
      const api = c.api;
      if (!located) { locatePoints(api, points); located = true; }
      if (!markers) markers = markersBuild(api);
      markers.group.visible = true;
      selected = null; soundId = 'normal'; view = 'front';
      c.tick('showSkin', true);
      c.tick('idleBreathing', true);
      c.tick('showHeart', false);
      c.tick('showLungs', false);
      c.tick('showBronchi', false);
      api.setSkinAlpha(1);
      api.keepBreathing(true);
      api.setCamera(...FRONT_CAMERA);
      // controls
      const extra = document.getElementById('extra');
      extra.innerHTML = `
        <div class="sound-types" id="soundTypes"></div>
        <div class="chest-switch" id="chestSwitch"><button type="button" data-view="front" class="on">前胸（正面）</button><button type="button" data-view="back">背後</button></div>
        <svg class="chest-map" id="chestMap" viewBox="0 0 300 330" role="group" aria-label="聽診位置圖"></svg>
        <div class="listen-card" id="listenCard"></div>
        <canvas class="wave" id="wave" aria-label="聲音波形"></canvas>
        <details class="sound-credit"><summary>聽診音來源與授權</summary>
          <p>正常肺泡音、細濕囉音、粗濕囉音：<a href="https://github.com/SJTU-YONGFU-RESEARCH-GRP/SPRSound" target="_blank" rel="noopener">SPRSound，上海兒童醫學中心</a>，<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。哮鳴音：<a href="https://commons.wikimedia.org/wiki/File:Wheeze2O.ogg" target="_blank" rel="noopener">James Heilman, MD</a>，<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>。喘鳴音：<a href="https://commons.wikimedia.org/wiki/File:Stridor_2OGG.ogg" target="_blank" rel="noopener">James Heilman, MD；Ian Furst 後製</a>，<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>。均從原錄音截取約 5 秒，僅供衛教示意。氣管與靠近胸骨、脊椎的正常呼吸音為程式合成的示意聲音。</p>
        </details>`;
      ui = { types: extra.querySelector('#soundTypes'), switch: extra.querySelector('#chestSwitch'), map: extra.querySelector('#chestMap'), card: extra.querySelector('#listenCard'), wave: extra.querySelector('#wave') };
      for (const sound of SOUNDS) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.id = sound.id;
        button.className = sound.id === 'normal' ? 'on' : '';
        button.innerHTML = `<span>${sound.label}</span>${sound.sub ? `<small>${sound.sub}</small>` : ''}${sound.badge ? `<small class="badge-air">${sound.badge}</small>` : ''}`;
        button.addEventListener('click', () => chooseSound(sound.id, c));
        ui.types.appendChild(button);
      }
      ui.switch.querySelectorAll('button').forEach(button => button.addEventListener('click', () => chooseView(button.dataset.view, c)));
      mapRender(c);
      listenCard();
      markerUpdate(c);
      removePointer?.();
      removePointer = pointer(c);
    },
    exit(c) {
      c.api.stopListening();
      c.api.setSkinAlpha(null);
      c.api.keepBreathing(false);
      if (markers) markers.group.visible = false;
      removePointer?.(); removePointer = null;
      selected = null; ui = null;
    }
  };
}
