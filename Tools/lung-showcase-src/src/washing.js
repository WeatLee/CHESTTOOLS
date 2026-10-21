// Demo 6: bronchoscopic washing (bronchial wash) of an inflamed right upper lobe.
// The scope drive is the engine's own bronchoscope (main.js); this file adds what is specific to washing:
// the inflamed area, saline going in, the fluid being sucked back, and the syringe and collection bottle.
// Everything is schematic. Progress is 0-100 (about 25 s in all).
const SPEED = 4.2;                 // progress units per second
const ARRIVE = 42;                 // the scope has reached the right upper lobe airway here
const SALINE = [58, 72];           // saline goes in
const SUCTION = [75, 90];          // fluid is sucked back
const R = .34;                     // radius of the inflamed area (model units)
const seg = (v, from, to) => Math.min(1, Math.max(0, (v - from) / (to - from)));
const HOME = [[0, .15, 7.9], [0, -.1, 0]];
const CLOSE = [[-2.2, 1.35, 4.2], [-.95, .5, .3]];

export function createWashDemo() {
  let objects = null, state = { p: 0, playing: true, last: 0 }, sent = -1, closeUp = false, cleanup = [];

  function build(api) {
    const T = api.THREE;
    const group = new T.Group();
    const overlay = (color, opacity, radius = 1) => {
      const mesh = new T.Mesh(new T.SphereGeometry(radius, 24, 16), new T.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
      mesh.renderOrder = 21;
      return mesh;
    };
    // Inflamed area: a red core with a few bumps, a soft halo and some yellowish secretion.
    const zone = new T.Group();
    const core = overlay(0xd8564f, .5, R);
    const halo = overlay(0xff9c8c, .16, R * 1.28);
    zone.add(core, halo);
    for (const [x, y, z, r] of [[.17, .1, .05, .13], [-.15, .13, -.07, .11], [.03, -.18, .1, .12], [-.1, -.09, .14, .09]]) {
      const bump = overlay(0xc9443f, .42, r);
      bump.position.set(x, y, z);
      zone.add(bump);
    }
    const pus = [[.06, .02, .2, .045], [-.12, .08, .16, .035], [.14, -.07, .12, .04], [-.05, -.14, .19, .03], [.1, .14, .1, .03]].map(([x, y, z, r]) => {
      const blob = overlay(0xe8d684, .85, r);
      blob.position.set(x, y, z);
      zone.add(blob);
      return blob;
    });
    group.add(zone);
    // Saline / washing fluid inside the inflamed area.
    const pool = overlay(0x4f93ad, .55, R * .86);
    pool.renderOrder = 22;
    group.add(pool);
    const dropMaterial = color => new T.MeshBasicMaterial({ color, transparent: true, opacity: .95, depthTest: false, depthWrite: false });
    const salineDrops = Array.from({ length: 10 }, () => { const d = new T.Mesh(new T.SphereGeometry(.024, 10, 8), dropMaterial(0x4f93ad)); d.renderOrder = 46; group.add(d); return d; });
    const returnDrops = Array.from({ length: 14 }, () => { const d = new T.Mesh(new T.SphereGeometry(.024, 10, 8), dropMaterial(0xd2c07a)); d.renderOrder = 46; group.add(d); return d; });
    api.scene.add(group);
    return { group, zone, halo, core, pus, pool, salineDrops, returnDrops, T };
  }

  // ---- 3D extras, one call per frame ----
  function update3D(api, p, time) {
    const o = objects, T = o.T;
    const centre = api.lesionCenter();
    o.zone.position.copy(centre);
    o.halo.scale.setScalar(1 + .06 * Math.sin(time * 2.4));
    const clean = seg(p, SUCTION[0], 92);
    o.core.material.opacity = .5 - .12 * clean;
    for (const blob of o.pus) blob.material.opacity = .85 * (1 - clean);
    // fluid in the area: grows while saline goes in, turns cloudy, then is sucked out
    const fill = seg(p, SALINE[0], SALINE[1]), empty = seg(p, SUCTION[0], SUCTION[1]);
    const level = fill * (1 - empty);
    o.pool.position.copy(centre);
    o.pool.visible = level > .01;
    o.pool.scale.setScalar(Math.max(.01, level));
    o.pool.material.color.set(0x4f93ad).lerp(new T.Color(0xcfc27c), seg(p, SALINE[1], SUCTION[0] + 6) * .85);
    const scope = api.scopeState();
    const inSaline = p >= SALINE[0] && p < SALINE[1], inSuction = p >= SUCTION[0] && p < SUCTION[1];
    const t = time * 1.5;
    o.salineDrops.forEach((d, i) => {
      d.visible = !!scope && inSaline;
      if (!d.visible) return;
      const f = (t + i / o.salineDrops.length) % 1;
      const side = new T.Vector3(-scope.dir.y, scope.dir.x, 0).normalize();
      d.position.copy(scope.tip).addScaledVector(scope.dir, .02 + f * .26).addScaledVector(side, Math.sin(i * 2.3) * .035 * f);
      d.scale.setScalar(1 - .3 * f);
    });
    o.returnDrops.forEach((d, i) => {
      d.visible = !!scope && inSuction;
      if (!d.visible) return;
      const f = (time * .42 + i / o.returnDrops.length) % 1;
      const at = scope.path[Math.max(0, Math.min(scope.path.length - 1, Math.round((1 - f) * (scope.path.length - 1))))];
      d.position.copy(at);
      d.scale.setScalar(.9 + .3 * Math.sin(i + time * 3));
    });
  }

  // ---- syringe and collection bottle (rectangular inset) ----
  function drawTrap(p, time) {
    const canvas = document.getElementById('ctCanvas');
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    g.fillStyle = '#10201f'; g.fillRect(0, 0, W, H);
    const fill = seg(p, SALINE[0], SALINE[1]), empty = seg(p, SUCTION[0], SUCTION[1]);
    const cloudy = seg(p, SALINE[1], SUCTION[0] + 6);
    g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.textAlign = 'center';
    // syringe (left): barrel, plunger, saline
    const sx = 70, sy = 130, sw = 100, sh = 190;
    g.strokeStyle = '#dfe8e6'; g.strokeRect(sx, sy, sw, sh);
    const left = 1 - fill;                         // saline left in the barrel
    const top = sy + sh - sh * left * .92 - 3;
    g.fillStyle = 'rgba(95,170,205,.85)'; g.fillRect(sx + 3, top, sw - 6, sh * left * .92);
    g.fillStyle = '#c9d3d1'; g.fillRect(sx + 6, top - 12, sw - 12, 12);
    g.strokeStyle = '#c9d3d1'; g.beginPath(); g.moveTo(sx + sw / 2, top - 12); g.lineTo(sx + sw / 2, sy - 40); g.stroke();
    g.fillRect(sx + 12, sy - 48, sw - 24, 10);
    g.strokeStyle = '#dfe8e6'; g.beginPath(); g.moveTo(sx + sw / 2, sy + sh); g.lineTo(sx + sw / 2, sy + sh + 28); g.stroke();
    g.fillStyle = '#cfe8e2'; g.font = 'bold 24px sans-serif'; g.fillText('無菌生理食鹽水', sx + sw / 2, sy + sh + 66);
    g.font = '20px sans-serif'; g.fillText('由支氣管鏡的孔道注入', sx + sw / 2, sy + sh + 94);
    // trap bottle (right): fills with cloudy fluid during suction
    const bx = 300, by = 150, bw = 130, bh = 170;
    g.strokeStyle = '#dfe8e6'; g.beginPath(); g.roundRect(bx, by, bw, bh, 14); g.stroke();
    g.beginPath(); g.moveTo(bx + 20, by); g.lineTo(bx + 20, by - 34); g.moveTo(bx + bw - 20, by); g.lineTo(bx + bw - 20, by - 34); g.stroke();
    const collected = empty * .55;                  // fraction of the bottle that is filled
    if (collected > .005) {
      g.fillStyle = `rgba(${Math.round(190 + 25 * cloudy)},${Math.round(176 + 10 * cloudy)},${Math.round(110 - 15 * cloudy)},.88)`;
      g.beginPath(); g.roundRect(bx + 4, by + bh - bh * collected - 4, bw - 8, bh * collected, 10); g.fill();
    }
    if (p >= SUCTION[0] && p < SUCTION[1]) { // fluid running in
      g.strokeStyle = 'rgba(225,210,140,.9)'; g.lineWidth = 4; g.setLineDash([8, 8]); g.lineDashOffset = time * 40;
      g.beginPath(); g.moveTo(bx + 20, by - 34); g.lineTo(bx + 20, by + 24); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = '#cfe8e2'; g.font = 'bold 24px sans-serif'; g.fillText('收集瓶', bx + bw / 2, by + bh + 38);
    g.font = '20px sans-serif'; g.fillText('接上抽吸', bx + bw / 2, by + bh + 66);
    if (p >= 90) { g.fillStyle = '#f5d67a'; g.font = 'bold 24px sans-serif'; g.fillText('送去檢驗', bx + bw / 2, by + bh + 98); }
    g.fillStyle = '#9db8b3'; g.font = '20px sans-serif'; g.textAlign = 'left';
    g.fillText(p < SALINE[0] ? '準備沖洗用的器材' : p < SUCTION[0] ? '先注入少量無菌生理食鹽水' : p < 90 ? '再用抽吸把液體吸回來' : '沖洗液已收集', 24, 40);
  }

  const demo = {
    id: 'wash', no: 6, tab: '支氣管鏡沖洗',
    title: '支氣管鏡沖洗（Bronchoscopic washing）',
    when: '當肺部有發炎或感染，例如肺炎、痰液很多或懷疑結核菌時，醫師可以用支氣管鏡直接到發炎的位置，用少量無菌生理食鹽水沖洗，再把液體吸出來收集，送去培養或檢驗，找出真正的致病原。這裡以右上肺發炎為例。',
    camera: HOME,
    pictures: [{ src: 'lung-showcase/images/wash-room.webp', caption: 'AI 生成之示意圖：支氣管鏡室，醫師站在床頭，鏡子由鼻孔進入，旁邊的螢幕顯示氣管內部' }],
    steps: [
      { at: 0, title: '進入氣管', text: '局部麻醉後，細長的支氣管鏡從鼻腔或口腔進入，經過喉嚨到達氣管，沿著氣管往下，朝要作檢查的肺部前進。' },
      { at: 22, title: '進入右側主支氣管，看到右上葉支氣管', text: '接著往要檢查的支氣管前進 (此示意圖是在右側的主支氣管)，進入後往外側看到右上葉支氣管的開口，支氣管鏡轉進去。' },
      { at: ARRIVE, title: '到達右上葉發炎處', text: '到達發炎處（此示意圖為右上肺葉）。支氣管鏡會先停在這裡，紅色標示的是發炎的位置。' },
      { at: SALINE[0] - 2, title: '注入無菌生理食鹽水', text: '從支氣管鏡的孔道注入少量無菌生理食鹽水（藍色），沖洗這一區的支氣管。' },
      { at: SUCTION[0] - 2, title: '回收檢體', text: '接著用抽吸把沖洗的液體吸回來，收集在收集瓶中，作為檢體。' },
      { at: 90, title: '檢查完成', text: '檢體收集完成後，慢慢退出支氣管鏡。檢體會做進一步的檢驗，結果可以幫助醫師選擇適合的治療。' }
    ],
    progress: () => state.p,
    playing: () => state.playing,
    pause() { state.playing = false; },
    resume() { state.playing = true; },
    replay() { state.p = 0; state.playing = true; },
    seek(c, value) { state.p = value; state.playing = false; },
    frame(c) {
      if (!objects) return;
      const now = performance.now(), time = now / 1000;
      const dt = state.last ? Math.min(.05, (now - state.last) / 1000) : 0;
      state.last = now;
      if (state.playing) { state.p = Math.min(100, state.p + dt * SPEED); if (state.p >= 100) state.playing = false; }
      const p = state.p;
      const v = Math.min(90, p / ARRIVE * 90);   // the engine's scope reaches the airway at 90
      if (Math.abs(v - sent) > .01) { sent = v; c.setVal('procedure', v); }
      const wantClose = p >= ARRIVE - 4;
      if (wantClose !== closeUp) { closeUp = wantClose; c.api.tweenCamera(...(wantClose ? CLOSE : HOME), 1.4); }
      update3D(c.api, p, time);
      // Bottom-left inset: the syringe and the collection bottle, once the washing starts.
      const trap = document.getElementById('ctPanel');
      trap.hidden = p < SALINE[0] - 4;
      if (!trap.hidden) drawTrap(p, time);
    },
    enter(c) {
      const api = c.api;
      if (!objects) objects = build(api);
      objects.group.visible = true;
      state = { p: 0, playing: true, last: 0 }; sent = -1; closeUp = false;
      c.setVal('locationSelect', 'RUL', 'change'); // right upper lobe
      c.setVal('size', 3);
      api.hideLesion(true);                         // the inflamed area is drawn here instead of the yellow tumour
      api.setCamera(...HOME);
      c.setVal('procedure', 0);                     // enters the scope mode
      document.getElementById('pip').hidden = true;
      const trap = document.getElementById('ctPanel');
      trap.classList.remove('big');
      trap.style.left = '10px'; trap.style.right = 'auto';
      const caption = trap.querySelector('span');
      const oldCaption = caption.textContent;
      caption.textContent = '沖洗與收集（示意）';
      cleanup.push(() => { trap.style.left = ''; trap.style.right = ''; caption.textContent = oldCaption; });
    },
    exit(c) {
      if (objects) objects.group.visible = false;
      c.api.hideLesion(false);
      document.getElementById('pip').hidden = true;
      document.getElementById('ctPanel').hidden = true;
      cleanup.forEach(fn => fn()); cleanup = [];
    }
  };
  return demo;
}
