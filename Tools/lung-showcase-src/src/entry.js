// Start page first; the 3D scene and the demos are only loaded when an examination is opened.
import { HUB, renderHub } from './hub.js';

const $ = id => document.getElementById(id);
renderHub($('hub'));

const bar = { back: $('demoBack'), prev: $('demoPrev'), next: $('demoNext'), name: $('demoBarName') };
let showcasePromise = null;
let showcase = null;
let routeToken = 0;

const loadShowcase = () => showcasePromise ||= Promise.all([import('./main.js'), import('./showcase.js')])
  .then(([engine, module]) => (showcase = module.startShowcase(engine.api)));

function setView(view) {
  document.body.dataset.view = view;
}

function showHub() {
  showcase?.leave();
  setView('hub');
  document.title = '胸腔內科檢查衛教';
  window.scrollTo(0, 0);
}

function updateBar(id) {
  const index = HUB.findIndex(item => item.id === id);
  const inList = index >= 0;
  bar.prev.hidden = bar.next.hidden = !inList;
  if (!inList) return;
  const prev = HUB[index - 1], next = HUB[index + 1];
  bar.prev.hidden = !prev; bar.next.hidden = !next;
  if (prev) { bar.prev.href = `#${prev.id}`; bar.prev.setAttribute('aria-label', `上一項：${prev.name}`); bar.prev.title = prev.name; }
  if (next) { bar.next.href = `#${next.id}`; bar.next.setAttribute('aria-label', `下一項：${next.name}`); bar.next.title = next.name; }
}

async function route() {
  const id = location.hash.slice(1);
  const token = ++routeToken;
  if (!id || id === 'home') { showHub(); return; }
  setView('demo');
  updateBar(id);
  window.scrollTo(0, 0);
  try {
    const instance = await loadShowcase();
    if (token === routeToken) instance.open(id);
  } catch (error) {
    window.dispatchEvent(new Event('showcase-load-error'));
  }
}

window.addEventListener('hashchange', route);
route();
