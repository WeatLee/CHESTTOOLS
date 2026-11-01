// Builds the patient-education text of one examination (edu/<id>.html) from the Obsidian drafts.
// Usage: node build-edu.mjs <vault folder> <id>      (the drafts stay the master copy; see 00 規則)
// The page loads edu/<id>.html when that examination is opened (src/edu.js).
// Fails when a 【待確認】 is left over after the agreed substitutions below, so an unfinished field
// can never reach the web by accident.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [vault, id] = process.argv.slice(2);
if (!vault || !id) throw new Error('usage: node build-edu.mjs <vault folder> <id>');

const PAGES = {
  wash: {
    own: '專屬/支氣管鏡沖洗.md',
    // Sections of the shared pages that do not apply to this examination.
    skipSections: ['切片與 EBUS-TBNA 另外要注意'],
    skipQuestions: [/^19\./],
    consents: ['無痛支氣管鏡檢查', '肺部軟式支氣管鏡術'],
    updated: null
  }
};
const cfg = PAGES[id];
if (!cfg) throw new Error(`no page definition for "${id}"`);

// Placeholders the user will fill in later (phone numbers etc.): written so that the sentence still reads well.
const substitutions = [];
const SUBS = [
  [/聯絡電話：【待確認[^】]*】\n?/g, ''],                       // line removed until the number is known
  [/【待確認：電話】/g, '檢查室'],                                // "請在檢查前先聯絡檢查室"
  [/【待確認：用輪椅或病床】/g, '']                              // "病房會有工作人員送您到檢查室"
];

const read = rel => readFileSync(join(vault, rel), 'utf8').replace(/\r\n/g, '\n');
const stripFront = t => t.replace(/^---\n[\s\S]*?\n---\n/, '');

// ---- sections -------------------------------------------------------------
function sections(text, level) {
  const mark = '#'.repeat(level) + ' ';
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith(mark)) { cur = { title: line.slice(mark.length).trim(), lines: [] }; out.push(cur); }
    else if (cur) cur.lines.push(line);
  }
  return out.map(s => ({ title: s.title, body: s.lines.join('\n').trim() }));
}
const sectionOf = (rel, title, level = 2) => {
  const found = sections(stripFront(read(rel)), level).find(s => s.title === title);
  if (!found) throw new Error(`section not found: ${rel}#${title}`);
  return found.body;
};
// Heading of any level (Obsidian "![[page#heading]]").
function headingBody(rel, title) {
  const lines = stripFront(read(rel)).split('\n');
  const at = lines.findIndex(l => /^#{1,6} /.test(l) && l.replace(/^#+ /, '').trim() === title);
  if (at < 0) throw new Error(`heading not found: ${rel}#${title}`);
  const depth = lines[at].match(/^#+/)[0].length;
  const end = lines.findIndex((l, i) => i > at && /^#{1,6} /.test(l) && l.match(/^#+/)[0].length <= depth);
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n').trim();
}

// ---- markdown -> html -----------------------------------------------------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
  return s;
}
const images = [];
function embedImage(name) {
  const src = join(vault, '共用', 'attachments', name);
  if (!existsSync(src)) throw new Error(`image not found: ${name}`);
  const out = `images/edu-${id}-map.png`;
  images.push([src, out]);
  return `<figure class="edu-fig"><img src="lung-showcase/${out}" alt="高雄醫學大學附設中和紀念醫院院區配置圖" loading="lazy"></figure>`;
}

function render(md, headingLevel = 4) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  const indentOf = l => l.match(/^ */)[0].length;
  const listItem = l => l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);

  function list(start, baseIndent) {
    const ordered = /^\d+\./.test(listItem(lines[start])[2]);
    let out = `<${ordered ? 'ol' : 'ul'}>`;
    let k = start;
    while (k < lines.length) {
      const m = listItem(lines[k]);
      if (!m || m[1].length < baseIndent) break;
      if (m[1].length > baseIndent) {
        const nested = list(k, m[1].length);
        out = out.replace(/<\/li>$/, nested.html + '</li>');
        k = nested.next; continue;
      }
      out += `<li>${inline(m[3])}</li>`;
      k++;
    }
    return { html: out + `</${ordered ? 'ol' : 'ul'}>`, next: k };
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^---+$/.test(line.trim())) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,6}) (.*)$/))) { html += `<h${headingLevel}>${inline(m[2])}</h${headingLevel}>`; i++; continue; }
    if ((m = line.match(/^!\[\[([^\]]+\.(?:png|jpg|webp))\]\]$/))) { html += embedImage(m[1]); i++; continue; }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      html += `<div class="edu-table"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`
        + rows.slice(2).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
      continue;
    }
    if (line.startsWith('>')) {
      const block = [];
      while (i < lines.length && lines[i].startsWith('>')) { block.push(lines[i].replace(/^>\s?/, '')); i++; }
      const kind = block[0].match(/^\[!(\w+)\]/);
      if (kind && ['info', 'todo'].includes(kind[1])) continue;   // notes for the author, never on the web
      const cls = kind ? kind[1] : 'note';
      const body = kind ? block.slice(1) : block;
      html += `<div class="edu-callout ${cls}">${render(body.join('\n'), headingLevel)}</div>`;
      continue;
    }
    if (listItem(line)) {
      const result = list(i, indentOf(line));
      html += result.html; i = result.next; continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6} |\||>|---+$)/.test(lines[i]) && !listItem(lines[i]) && !/^!\[\[/.test(lines[i])) { para.push(inline(lines[i])); i++; }
    html += `<p>${para.join('<br>')}</p>`;
  }
  return html;
}

// Resolves Obsidian embeds ("![[page#heading]]") by pasting the referenced text.
function expand(md) {
  return md.replace(/^!\[\[([^\]#]+)(?:#([^\]]+))?\]\]$/gm, (whole, page, heading) => {
    if (/\.(png|jpg|webp)$/.test(page)) return whole;
    const rel = ['共用', '專屬', ''].map(d => (d ? d + '/' : '') + page + '.md').find(p => existsSync(join(vault, p)));
    if (!rel) throw new Error(`embed target not found: ${page}`);
    return heading ? headingBody(rel, heading) : stripFront(read(rel)).replace(/^# .*\n/, '').trim();
  });
}

function clean(text) {
  for (const [pattern, to] of SUBS) {
    text = text.replace(pattern, m => { substitutions.push(m.trim()); return to; });
  }
  return text;
}

// ---- the page ---------------------------------------------------------------
const details = (title, body, open = false, cls = '') =>
  `<details class="edu-sec${cls ? ' ' + cls : ''}"${open ? ' open' : ''}><summary>${title}</summary><div class="edu-body">${body}</div></details>`;

const own = stripFront(read(cfg.own));
const ownSections = sections(own, 2);
const intro = ownSections.filter(s => ['這項檢查是什麼', '為什麼要做這項檢查', '檢查怎麼進行', '麻醉與舒眠', '可能的不舒服與風險'].includes(s.title));
if (intro.length !== 5) throw new Error('exam page needs its five sections');

const prep = sections(stripFront(read('共用/檢查前準備.md')), 2).map(s => `<h4>${s.title}</h4>${render(clean(s.body))}`).join('');
const flow = sections(stripFront(read('共用/檢查當天流程與位置.md')), 2).map(s => `<h4>${s.title}</h4>${render(clean(s.body))}`).join('');
const afterAll = sections(stripFront(read('共用/檢查後注意事項.md')), 2);
const after = afterAll
  .filter(s => s.title !== '一般注意事項' && !cfg.skipSections.includes(s.title))
  .map(s => `<h4>${s.title}</h4>${render(clean(s.body))}`).join('');
// "一般注意事項" holds ### subsections of its own
const general = afterAll.find(s => s.title === '一般注意事項');
const generalHtml = sections('\n' + general.body, 3)
  .filter(s => !cfg.skipSections.includes(s.title))
  .map(s => `<h4>${s.title}</h4>${render(clean(s.body))}`).join('');

const faqText = stripFront(read('共用/常見問題.md'));
let faq = '', group = '';
for (const q of sections(faqText, 3)) {
  // the "## 檢查中" style group headings sit at the end of the previous question's text
  const lines = q.body.split(String.fromCharCode(10));
  const cut = lines.findIndex(l => l.startsWith('## ') || l.startsWith('> [!note]'));
  const answer = (cut < 0 ? lines : lines.slice(0, cut)).join(String.fromCharCode(10));
  const nextGroup = cut >= 0 && lines[cut].startsWith('## ') ? lines[cut].slice(3).trim() : '';
  if (!cfg.skipQuestions.some(re => re.test(q.title))) {
    if (group) { faq += `<h4>${group}</h4>`; group = ''; }
    faq += details(esc(q.title.replace(/^[0-9]+[.][ ]*/, '')), render(clean(expand(answer))));
  }
  if (nextGroup) group = nextGroup;
}
// the first group heading ("檢查前") comes before question 1
faq = '<h4>檢查前</h4>' + faq;
const faqNote = '<div class="edu-callout note"><p>與病情、檢查結果和治療有關的問題，請在回診時直接詢問您的醫師。</p></div>';

const consentText = stripFront(read('同意書說明.md'));
const askDoctor = sectionOf('同意書說明.md', '簽之前，您可以問醫師', 2);
const formsText = sectionOf('同意書說明.md', '同意書內文（取自高醫同意書）', 2);
const consentBlocks = sections(formsText, 3).filter(s => cfg.consents.some(c => s.title.includes(c)));
if (consentBlocks.length !== cfg.consents.length) throw new Error('consent sections not all found');
const consent = consentBlocks.map(b =>
  `<h4>${esc(b.title.split('：').pop())}</h4>${render(clean(b.body), 5)}`).join('')
  + `<h4>簽之前，您可以問醫師</h4>${render(clean(askDoctor))}`;

const html = [
  details('這項檢查是什麼', intro.map(s => `<h4>${s.title}</h4>${render(clean(s.body))}`).join(''), true),
  details('檢查前準備', prep),
  details('當天流程與位置', flow),
  details('檢查後注意事項', after + generalHtml, true),
  details('常見問題', faq + faqNote),
  details('同意書說明（取自高醫同意書，僅供閱讀）', consent, false, 'edu-consent')
].join('\n')
  + `<p class="edu-foot">最後更新：${new Date().toISOString().slice(0, 10)}<br>本頁文字僅供衛教參考，實際作法與注意事項，請以醫師及檢查人員的說明為準。頁面中的示意圖由 AI 生成，並非實際病情、病人影像或手術畫面。</p>`;

if (/【待確認/.test(html)) throw new Error('unfinished 【待確認】 left in the page: ' + html.match(/【待確認[^】]*】/g).join(' '));
const outDir = join(here, 'edu');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${id}.html`), html);
for (const [src, out] of images) copyFileSync(src, join(here, out));
console.log(`edu/${id}.html written (${html.length} chars)`);
console.log('substituted placeholders:', [...new Set(substitutions)].join(' | ') || 'none');
