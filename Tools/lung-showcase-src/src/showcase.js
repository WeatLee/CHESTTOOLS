// Guided showcase: tabs, step list and player that drive the 3D scene.
// The scene logic lives in main.js behind a set of hidden controls (#legacy);
// each demo here sets those controls, so the animations stay identical to the
// Procedure page while this page shows only captions and a play button.
import { DEMOS } from './demos.js';

const $ = id => document.getElementById(id);
const fire = (element, type) => element.dispatchEvent(new Event(type, { bubbles: true }));

export function startShowcase(api) {
  const ctx = {
    api,
    $,
    click: id => $(id).click(),
    setVal(id, value, type = 'input') { const element = $(id); element.value = String(value); fire(element, type); },
    tick(id, checked) { const element = $(id); if (element.checked !== checked) { element.checked = checked; fire(element, 'input'); } },
    toast: message => api.toast(message)
  };

  let current = -1;
  let entering = false;
  const tabs = $('tabs'), steps = $('steps'), seek = $('seek'), btnPlay = $('btnPlay');

  // ---- tabs ----
  DEMOS.forEach((demo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.dataset.demo = demo.id;
    button.innerHTML = `<b>${demo.no}</b>${demo.tab}`;
    button.addEventListener('click', () => enter(index));
    tabs.appendChild(button);
  });

  // ---- scene reset between demos ----
  function resetScene() {
    document.querySelector('[data-preset="natural"]').click(); // also ends the drain and TBNA modes
    for (const id of ['showSkin', 'showSkeleton', 'showDiaphragm', 'showMediastinum', 'showNerves', 'showLabels', 'showTumor', 'showEffusion', 'idleBreathing']) ctx.tick(id, false);
    for (const id of ['showLungs', 'showBronchi', 'showHeart']) ctx.tick(id, true);
    ctx.setVal('opacity', 100);
    api.hideExtras?.();
  }

  // ---- steps ----
  function renderSteps(demo) {
    steps.replaceChildren();
    demo.steps.forEach((step, index) => {
      const item = document.createElement('li');
      item.dataset.index = String(index);
      item.innerHTML = `<span class="n">${index + 1}</span><div><div class="t">${step.title}</div><div class="d">${step.text}</div></div>`;
      if (!demo.staticSteps) item.addEventListener('click', () => demo.seek?.(ctx, step.at + 0.5));
      steps.appendChild(item);
    });
  }
  const nowStep = $('nowStep'), dock = $('dock'), panel = $('panel'), stepsToggle = $('stepsToggle');
  let shownStep = -1;
  function showNow(demo, index) {
    if (index === shownStep) return;
    shownStep = index;
    const step = demo.steps[index];
    nowStep.querySelector('.n').textContent = String(index + 1);
    nowStep.querySelector('.t').textContent = step.title;
    nowStep.querySelector('.d').textContent = step.text;
  }
  function highlight(demo, progress) {
    let active = 0;
    demo.steps.forEach((step, index) => { if (progress >= step.at) active = index; });
    showNow(demo, active);
    [...steps.children].forEach((item, index) => {
      item.classList.toggle('active', index === active);
      item.classList.toggle('done', index < active);
    });
  }

  // ---- optional pictures under each demo (added later; hidden until the file exists) ----
  function renderGallery(demo) {
    const gallery = $('gallery');
    gallery.replaceChildren();
    for (const picture of demo.pictures || []) {
      const figure = document.createElement('figure');
      figure.className = 'slot';
      figure.hidden = true;
      const image = new Image();
      image.alt = picture.caption;
      image.loading = 'eager';
      image.addEventListener('load', () => { figure.hidden = false; });
      image.src = picture.src;
      const caption = document.createElement('figcaption');
      caption.textContent = `${picture.caption}（示意圖，非實際病情）`;
      if (picture.credit) { const credit = document.createElement('small'); credit.className = 'credit'; credit.textContent = picture.credit; caption.append(document.createElement('br'), credit); }
      figure.append(image, caption);
      gallery.appendChild(figure);
    }
  }

  // ---- enter / leave a demo ----
  async function enter(index, { fromHash = false } = {}) {
    if (entering) return;
    entering = true;
    try {
      const previous = DEMOS[current];
      previous?.exit?.(ctx);
      current = index;
      const demo = DEMOS[index];
      [...tabs.children].forEach((button, i) => button.classList.toggle('active', i === index));
      // Centre the chosen tab inside the tab strip only (scrollIntoView would scroll the whole page).
      const chosen = tabs.children[index];
      tabs.scrollTo({ left: chosen.offsetLeft - (tabs.clientWidth - chosen.offsetWidth) / 2, behavior: fromHash ? 'auto' : 'smooth' });
      $('demoNo').textContent = String(demo.no);
      $('demoTitle').textContent = demo.title;
      $('demoWhen').textContent = demo.when;
      $('extra').replaceChildren();
      document.querySelector('.player').hidden=!!demo.noPlayer;
      dock.hidden = !!(demo.noPlayer || demo.staticSteps);
      stepsToggle.hidden = !!demo.staticSteps;
      shownStep = -1;
      steps.classList.toggle('plain',!!demo.staticSteps);
      $('pip').hidden = true;
      $('ctPanel').hidden = true;
      renderSteps(demo);
      renderGallery(demo);
      seek.value = '0';
      history.replaceState(null, '', `#${demo.id}`);
      await api.ready;
      resetScene();
      demo.enter(ctx);
    } finally {
      entering = false;
    }
  }

  // ---- player ----
  const isPlaying = demo => demo.playing ? demo.playing(ctx) : /暫停/.test($(demo.play).textContent);
  const progressOf = demo => demo.progress ? demo.progress(ctx) : +$(demo.slider).value;
  btnPlay.addEventListener('click', () => {
    const demo = DEMOS[current];
    if (!demo) return;
    if (isPlaying(demo)) { demo.pause ? demo.pause(ctx) : ctx.click(demo.play); return; }
    if (progressOf(demo) >= 99.9) demo.replay ? demo.replay(ctx) : (ctx.click(demo.reset), ctx.click(demo.play));
    else demo.resume ? demo.resume(ctx) : ctx.click(demo.play);
  });
  $('btnReplay').addEventListener('click', () => {
    const demo = DEMOS[current];
    if (!demo) return;
    demo.replay ? demo.replay(ctx) : (ctx.click(demo.reset), ctx.click(demo.play));
  });
  seek.addEventListener('input', () => {
    const demo = DEMOS[current];
    if (!demo) return;
    demo.seek ? demo.seek(ctx, +seek.value) : ctx.setVal(demo.slider, seek.value);
  });
  $('viewReset').addEventListener('click', () => DEMOS[current]?.camera ? api.setCamera(...DEMOS[current].camera) : api.resetView());

  // On a phone the player moves under the picture and stays there; on a wide screen it sits in the panel.
  const phone = matchMedia('(max-width:959px)');
  const placePlayer = () => {
    const player = document.querySelector('.player');
    if (phone.matches) dock.appendChild(player); else panel.insertBefore(player, stepsToggle);
  };
  phone.addEventListener('change', placePlayer);
  placePlayer();
  // The picture is large on the first screen and shrinks after the first scroll (with a gap so it never flickers).
  const stickyTop = $('stickyTop');
  let compact = false;
  const syncCompact = () => {
    const y = window.scrollY;
    const next = phone.matches && (compact ? y > 40 : y > 140);
    if (next !== compact) { compact = next; stickyTop.classList.toggle('compact', compact); }
  };
  window.addEventListener('scroll', syncCompact, { passive: true });
  phone.addEventListener('change', syncCompact);
  stepsToggle.addEventListener('click', () => {
    const open = panel.classList.toggle('show-steps');
    stepsToggle.textContent = open ? '收起步驟 ▴' : '看全部步驟 ▾';
    stepsToggle.setAttribute('aria-expanded', String(open));
  });

  // The hint about gestures fades after the first touch or drag.
  const hint = document.querySelector('.gesture-hint');
  api.viewport.addEventListener('pointerdown', () => hint?.classList.add('fade'), { once: true });

  // A failed model load (for instance a cached page that asks for a replaced file) must say so.
  window.addEventListener('showcase-load-error', () => {
    const box = $('loadingStatus') || Object.assign(document.createElement('div'), { id: 'loadingStatus' });
    box.className = 'loading-status error';
    box.textContent = '3D 模型資料載入失敗。請按 Ctrl+F5（手機請重新整理，或清除此網站的快取）後再試一次。';
    if (!box.isConnected) $('viewer').appendChild(box);
  });

  // ---- per-frame UI sync ----
  function frame() {
    const demo = DEMOS[current];
    if (demo && !entering) {
      const progress = progressOf(demo);
      if (document.activeElement !== seek) seek.value = String(progress);
      if (!demo.staticSteps) highlight(demo, progress);
      btnPlay.textContent = isPlaying(demo) ? '⏸ 暫停' : progress >= 99.9 ? '↻ 再看一次' : '▶ 播放';
      demo.frame?.(ctx, progress);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- start on the demo named in the address, else the first ----
  const wanted = DEMOS.findIndex(demo => `#${demo.id}` === location.hash);
  enter(wanted >= 0 ? wanted : 0, { fromHash: true });
  window.addEventListener('hashchange', () => {
    const index = DEMOS.findIndex(demo => `#${demo.id}` === location.hash);
    if (index >= 0 && index !== current) enter(index, { fromHash: true });
  });
}
