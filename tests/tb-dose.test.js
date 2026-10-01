const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.placeholder = '';
    this.style = { display: '' };
    this.className = '';
    this.textContent = '';
    this.children = [];
    this.listeners = {};
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === '') this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
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
  'err', 'tbody', 'resultWrap', 'renalAlert', 'weight', 'renalBelow30', 'hemodialysis',
  'buildBtn', 'clearBtn', 'runTests', 'testlog',
  'opt-INH', 'opt-RMP', 'opt-EMB', 'opt-PZA', 'opt-AK3', 'opt-TRAC4'
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
elements.weight.value = '60';
for (const id of ['opt-INH', 'opt-RMP', 'opt-EMB', 'opt-PZA']) elements[id].checked = true;

const document = {
  getElementById(id) {
    return elements[id] || null;
  },
  createElement() {
    return new FakeElement();
  }
};

const htmlPath = path.join(__dirname, '..', 'Tools', 'tb-dose.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline script should exist');
vm.runInNewContext(match[1], { document, console, Number, String, Math, Error });

function click(id) {
  elements[id].dispatch('click');
}

function rows() {
  return elements.tbody.children.map((tr) => tr.children.map((td) => td.textContent));
}

click('buildBtn');
let output = rows();
assert.equal(output.length, 4);
assert.deepEqual(output.find((row) => row[0].startsWith('INH')).slice(1, 7), ['5 (4–6)', '100', '3', '300', '5.0', '每日 1 次']);
assert.deepEqual(output.find((row) => row[0].startsWith('EMB')).slice(3, 7), ['3', '1,200', '20.0', '每日 1 次']);
assert.deepEqual(output.find((row) => row[0].startsWith('PZA')).slice(3, 7), ['3', '1,500', '25.0', '每日 1 次']);

elements.renalBelow30.checked = true;
elements.renalBelow30.dispatch('change');
click('buildBtn');
output = rows();
assert.equal(output.find((row) => row[0].startsWith('INH'))[6], '每日 1 次');
assert.equal(output.find((row) => row[0].startsWith('EMB'))[6], '每週 3 次');
assert.equal(output.find((row) => row[0].startsWith('PZA'))[6], '每週 3 次');
assert.match(elements.renalAlert.innerHTML, /每次劑量不減/);

elements.hemodialysis.checked = true;
elements.hemodialysis.dispatch('change');
assert.equal(elements.renalBelow30.checked, false);
click('buildBtn');
output = rows();
assert.equal(output.find((row) => row[0].startsWith('INH'))[6], '每日 1 次；透析日於透析後');
assert.equal(output.find((row) => row[0].startsWith('PZA'))[6], '每週 3 次；透析後');

elements.renalBelow30.checked = true;
elements.renalBelow30.dispatch('change');
assert.equal(elements.hemodialysis.checked, false);
elements['opt-TRAC4'].checked = true;
elements['opt-TRAC4'].dispatch('change');
click('buildBtn');
output = rows();
assert.equal(output.length, 4);
assert.ok(output.every((row) => row[3] === '—' && /不建議使用固定複方/.test(row[7])));

click('runTests');
assert.doesNotMatch(elements.testlog.textContent, /❌/);
assert.match(elements.testlog.textContent, /CCr <30：固定複方阻擋/);

console.log('tb-dose tests passed');
