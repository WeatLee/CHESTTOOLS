const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.checked = false;
    this.style = { display: '' };
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

const ids = [
  'weightInput', 'ageInput', 'dateInput', 'pregnantInput', 'prescriptionTbody',
  'routeTip', 'alertZone', 'dangerAlert', 'infoAlert', 'warnAlert',
  'timelineBox', 'timelineDuration', 'timelineEndDate'
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
elements.weightInput.value = '60';
elements.ageInput.value = '18';

const regimes = ['1HP', '3HP', '4R', '3HR', '6H', '9H'].map((value, index) => {
  const radio = new FakeElement();
  radio.value = value;
  radio.checked = index === 0;
  return radio;
});

const document = {
  getElementById(id) { return elements[id] || null; },
  getElementsByName(name) { return name === 'regime' ? regimes : []; }
};

const html = fs.readFileSync(path.join(__dirname, '..', 'Tools', 'LTBI.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline script should exist');
vm.runInNewContext(match[1], { document, console, Number, String, Math, Date });

function selectRegime(value) {
  for (const radio of regimes) radio.checked = radio.value === value;
  regimes.find((radio) => radio.value === value).dispatch('change');
}

function recalc() {
  elements.weightInput.dispatch('input');
}

assert.match(elements.prescriptionTbody.innerHTML, /600 mg（150 mg × 4 顆）/);

elements.weightInput.value = '40';
recalc();
assert.match(elements.prescriptionTbody.innerHTML, /450 mg（150 mg × 3 顆）/);

selectRegime('3HP');
assert.match(elements.prescriptionTbody.innerHTML, /600 mg（15\.0 mg\/kg）/);
assert.match(elements.prescriptionTbody.innerHTML, /750 mg（150 mg × 5 顆）/);

elements.ageInput.value = '10';
elements.weightInput.value = '20';
recalc();
assert.match(elements.prescriptionTbody.innerHTML, /500 mg（25\.0 mg\/kg）/);
assert.match(elements.prescriptionTbody.innerHTML, /450 mg（150 mg × 3 顆）/);

selectRegime('4R');
assert.match(elements.prescriptionTbody.innerHTML, /300 mg（15\.0 mg\/kg）/);

elements.ageInput.value = '12';
selectRegime('1HP');
assert.match(elements.dangerAlert.textContent + elements.dangerAlert.innerHTML, /未滿 13 歲/);
assert.match(elements.prescriptionTbody.innerHTML, /不適用/);

elements.ageInput.value = '30';
elements.pregnantInput.checked = true;
selectRegime('3HP');
assert.match(elements.dangerAlert.innerHTML, /孕婦不使用 1HP／3HP/);

elements.pregnantInput.checked = false;
elements.weightInput.value = '60';
elements.dateInput.value = '2026/01/01';
selectRegime('1HP');
assert.match(elements.timelineEndDate.innerHTML, /2026\/01\/28/);
assert.match(elements.timelineEndDate.innerHTML, /2026\/02\/09/);

selectRegime('3HP');
assert.match(elements.timelineEndDate.innerHTML, /2026\/03\/19/);
assert.match(elements.timelineEndDate.innerHTML, /2026\/04\/30/);

assert.doesNotMatch(html, /\[cite:/);
console.log('LTBI tests passed');
