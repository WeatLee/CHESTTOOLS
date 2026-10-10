const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'Tools', 'acls.html'), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline, 'ACLS inline script exists');

function makeHarness(initialStore = {}) {
  const storage = new Map(Object.entries(initialStore));
  const nodes = new Map();
  const alarms = [];
  let now = new Date(2026, 9, 11, 23, 59, 30).getTime();
  class Clock extends Date {
    constructor(value) { super(value === undefined ? now : value); }
    static now() { return now; }
  }
  class Element {
    constructor() {
      this.style = {};
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.dataset = {};
      this.classList = { add() {}, remove() {}, toggle() {} };
      this.children = new Map();
    }
    querySelector(selector) {
      if (!this.children.has(selector)) this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    querySelectorAll() { return []; }
    setAttribute(name, value) { this[name] = value; }
    appendChild() {}
    remove() {}
    click() {}
  }
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const context = {
    Date: Clock,
    document: {
      getElementById: get,
      querySelector: () => null,
      createElement: () => new Element(),
      body: new Element(),
      addEventListener() {},
    },
    window: {},
    navigator: { vibrate: (pattern) => alarms.push(pattern) },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    requestAnimationFrame: (callback) => callback(),
    setInterval() {},
    setTimeout() {},
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    File: class { constructor(parts, name) { this.parts = parts; this.name = name; } },
    confirm: () => true,
  };
  const source = inline[1].replace(/\}\)\(\);\s*$/, 'window.__test={getEvents:()=>events,cpr,add,saveEdit,openEdit,bosminTick,end,txtContent,exportFile,downloadTxt,renderReminderSettings};})();');
  vm.runInNewContext(source, context);
  return {
    app: context.window.__test,
    get,
    alarms,
    storage,
    setNow: (value) => { now = value; },
    now: () => now,
  };
}

test('first CPR time correction shifts later events by the same amount, even across midnight', () => {
  const h = makeHarness();
  h.app.cpr();
  h.setNow(h.now() + 20000);
  h.app.add({ kind: 'drug', drug: 'bosmin', label: 'Bosmin', detail: '已給藥' });
  const before = h.app.getEvents().map((e) => e.time);
  h.app.openEdit(h.app.getEvents()[0].id);
  h.get('editTime').value = '00:00:10';
  h.app.saveEdit();
  assert.deepEqual(h.app.getEvents().map((e) => e.time), before.map((t) => t + 40000));
  assert.equal(h.app.getEvents()[1].time - h.app.getEvents()[0].time, 20000);
});

test('Bosmin reminder is optional and fires once per recorded dose', () => {
  const h = makeHarness({ 'chesttools-acls-reminders-v1': JSON.stringify({ sound: false, vibrate: true }) });
  h.app.cpr();
  h.app.add({ kind: 'drug', drug: 'bosmin', label: 'Bosmin', detail: '已給藥' });
  h.setNow(h.now() + 181000);
  h.app.bosminTick();
  h.app.bosminTick();
  assert.equal(h.alarms.length, 1);
  assert.equal(h.get('bosminHeadValue').textContent, '00:00');
  h.app.add({ kind: 'drug', drug: 'bosmin', label: 'Bosmin', detail: '已給藥' });
  h.setNow(h.now() + 181000);
  h.app.bosminTick();
  assert.equal(h.alarms.length, 2);
});

test('correcting or cancelling a Bosmin entry updates the reminder', () => {
  const h = makeHarness();
  h.app.cpr();
  h.app.add({ kind: 'drug', drug: 'bosmin', label: 'Bosmin', detail: '已給藥' });
  const dose = h.app.getEvents()[1];
  h.app.openEdit(dose.id);
  h.get('editTime').value = '23:55:00';
  h.app.saveEdit();
  assert.equal(h.get('bosminHeadValue').textContent, '00:00');
  h.get('events').onclick({ target: { closest: () => ({ dataset: { remove: dose.id } }) } });
  assert.equal(h.get('bosminHeadValue').textContent, '--:--');
  assert.equal(h.app.getEvents().length, 1);
});

test('end creates a TXT record; next CPR starts a fresh timeline', () => {
  const h = makeHarness();
  h.app.cpr();
  h.app.add({ kind: 'drug', drug: 'nahco3', label: 'NaHCO₃', detail: '1.5 支', note: '1.5', unit: '支' });
  h.app.end();
  assert.match(h.app.txtContent(), /NaHCO₃  1\.5 支/);
  assert.match(h.app.txtContent(), /急救結束/);
  assert.match(h.app.exportFile().name, /^ACLS-\d{8}-\d{6}\.txt$/);
  assert.equal(h.get('exportStatus').textContent, 'TXT 已產生，尚未儲存。');
  h.app.cpr();
  assert.equal(h.app.getEvents().length, 1);
  assert.equal(h.app.getEvents()[0].label, 'CPR 開始');
});

test('saved timeline reloads from browser storage', () => {
  const h = makeHarness();
  h.app.cpr();
  h.app.add({ kind: 'drug', drug: 'bosmin', label: 'Bosmin', detail: '已給藥' });
  const reloaded = makeHarness(Object.fromEntries(h.storage));
  assert.equal(reloaded.app.getEvents().length, 2);
  assert.match(reloaded.get('events').innerHTML, /Bosmin/);
});

test('service worker caches the ACLS page and uses it when network is unavailable', async () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'Tools', 'acls-sw.js'), 'utf8');
  const handlers = {};
  const saved = new Map();
  const cache = {
    addAll: async (files) => files.forEach((file) => saved.set(file, { url: file })),
    put: async (request, response) => saved.set(request, response),
  };
  const scope = {
    self: {
      addEventListener: (name, fn) => { handlers[name] = fn; },
      skipWaiting() {},
      clients: { claim() {} },
    },
    caches: {
      open: async () => cache,
      match: async (request) => saved.get(request),
      keys: async () => ['acls-console-v3', 'other-tool-cache'],
      delete: async () => true,
    },
    fetch: async () => { throw new Error('offline'); },
  };
  vm.runInNewContext(code, scope);
  let install;
  handlers.install({ waitUntil: (promise) => { install = promise; } });
  await install;
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/Tools/acls.html' }, respondWith: (promise) => { response = promise; } });
  assert.equal((await response).url, './acls.html');
});
