const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.style = { display: '' };
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

const ids = [
  'abgInput','fio2Input','naInput','clInput','albuminInput','hco3Display','abgError','abgOutput',
  'primaryResult','compensationResult','mixedResult','oxygenRow','oxygenResult','agOutput','agResult',
  'correctedRow','correctedAgResult','agInterpretation','causeBox','causeTitle','causeContent'
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
const document = { getElementById: (id) => elements[id] || null };

const html = fs.readFileSync(path.join(__dirname, '..', 'Tools', 'abg-calc.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'inline script should exist');
vm.runInNewContext(script[1], { document, Number, String, Math, Array });

function input(id, value) {
  elements[id].value = value;
  elements[id].dispatch('input');
}

input('abgInput', '7.29/26/80/12');
assert.equal(elements.primaryResult.textContent, '代謝性酸中毒');
assert.match(elements.compensationResult.textContent, /部分／適當代償/);
assert.equal(elements.hco3Display.value, '12.0');

input('fio2Input', '40%');
assert.match(elements.oxygenResult.textContent, /P\/F 200/);

input('naInput', '140');
input('clInput', '100');
assert.equal(elements.agResult.textContent, '28.0 mEq/L');
assert.match(elements.agInterpretation.textContent, /高AG代謝性酸中毒/);
assert.match(elements.causeTitle.textContent, /高anion gap/);

input('albuminInput', '2');
assert.equal(elements.correctedAgResult.textContent, '33.0 mEq/L');

input('abgInput', '7.35/60/32');
assert.equal(elements.primaryResult.textContent, '呼吸性酸中毒');
assert.match(elements.compensationResult.textContent, /完全代償/);
assert.equal(elements.oxygenRow.style.display, 'grid');

input('fio2Input', '');
assert.equal(elements.oxygenRow.style.display, 'none');

input('abgInput', '7.31/89/80/23');
assert.match(elements.abgError.textContent || elements.abgError.innerHTML, /數值不一致/);
assert.equal(elements.primaryResult.textContent, '無法可靠判讀');

input('abgInput', '7.29／26／12');
assert.equal(elements.primaryResult.textContent, '代謝性酸中毒');

console.log('abg-calc tests passed');
