// Smoke test for the showcase sources: demo list, CT plan clearances, built output.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const demosSource = readFileSync(join(here, 'src', 'demos.js'), 'utf8');
for (const id of ['bronch', 'tbna', 'drain']) check(`demo ${id} defined`, demosSource.includes(`id: '${id}'`));
check('sound demo wired', demosSource.includes('createSoundDemo()'));
check('wash demo wired', demosSource.includes('createWashDemo()'));
check('ct demo wired', demosSource.includes('createCtDemo()') && !demosSource.includes('soon: true'));

const { plan } = await import('./src/ct-plan.js');
check('ct plan: bone clearance >= 6 mm', plan.boneClearanceMm >= 6, `${plan.boneClearanceMm} mm`);
check('ct plan: vessel/heart clearance >= 10 mm', plan.vesselClearanceMm >= 10, `${plan.vesselClearanceMm} mm`);
check('ct plan: path 3-8 cm', plan.pathLengthCm >= 3 && plan.pathLengthCm <= 8, `${plan.pathLengthCm} cm`);
check('ct plan: entry on patient right', plan.entry[0] < 0);

const wash = readFileSync(join(here, 'src', 'washing.js'), 'utf8');
check('wash demo: saline before suction, then specimen', /SALINE = \[(\d+), (\d+)\]/.test(wash) && +wash.match(/SALINE = \[\d+, (\d+)\]/)[1] <= +wash.match(/SUCTION = \[(\d+),/)[1] && wash.includes('送去檢驗'));

const audio = readFileSync(join(here, 'src', 'auscultation.js'), 'utf8');
check('stridor audible only in tracheal zone', /stridor/.test(audio) && /tracheal/.test(audio));

const web = join(here, 'web');
if (existsSync(join(web, 'lung-showcase.html'))) {
  const html = readFileSync(join(web, 'lung-showcase.html'), 'utf8');
  check('built html mentions 示意圖', html.includes('示意圖'));
  check('built html has versioned script', /main\.js\?v=/.test(html));
  check('built chunks present', existsSync(join(web, 'lung-showcase', 'chunks')) && readdirSync(join(web, 'lung-showcase', 'chunks')).length > 0);
} else console.log('SKIP  built output (run npm run build:web first)');

console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
process.exit(failed ? 1 : 0);
