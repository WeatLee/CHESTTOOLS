const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.listeners = {};
  }
  addEventListener(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }
  dispatch(type) {
    for (const listener of this.listeners[type] || []) listener({ target: this });
  }
}

const ids = ['add_date', 'date_results', 'diff_date_a', 'diff_date_b', 'diff_result'];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
const document = { getElementById: (id) => elements[id] || null };

const html = fs.readFileSync(path.join(__dirname, '..', 'Tools', 'date-calc.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'inline script should exist');
vm.runInNewContext(script[1], { document, Date, String, Number, Math, parseInt });

assert.match(elements.date_results.innerHTML, /14天/);
assert.match(elements.date_results.innerHTML, /21天/);
assert.match(elements.date_results.innerHTML, /28天/);
assert.match(elements.date_results.innerHTML, /56天/);
assert.match(elements.date_results.innerHTML, /84天/);
assert.match(elements.date_results.innerHTML, /30天/);
assert.match(elements.date_results.innerHTML, /60天/);
assert.match(elements.date_results.innerHTML, /90天/);
assert.equal((elements.date_results.innerHTML.match(/schedule-row/g) || []).length, 8);

elements.add_date.value = '20260815';
elements.add_date.dispatch('input');
assert.match(elements.date_results.innerHTML, /14天/);
assert.match(elements.date_results.innerHTML, /2026\/08\/29/);

elements.diff_date_a.value = '20260815';
elements.diff_date_b.value = '20260801';
elements.diff_date_a.dispatch('input');
assert.equal(elements.diff_result.textContent, 14);

console.log('date-calc tests passed');
