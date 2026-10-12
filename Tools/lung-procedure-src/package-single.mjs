import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.cwd();
const output = join(base, 'portable-v1.5');
mkdirSync(output, { recursive: true });
let html = readFileSync(join(base, 'index.html'), 'utf8');
const css = readFileSync(join(base, 'style.css'), 'utf8');
const js = readFileSync(join(base, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
html = html.replace('<script src="app.js"></script>', () => `<script>${js}</script>`);
if (html.includes('src="app.js"') || html.includes('href="style.css"')) {
  throw new Error('Single-file packaging failed');
}
writeFileSync(join(output, 'LungEducation.html'), html, 'utf8');
copyFileSync(join(base, 'THIRD_PARTY_NOTICES.txt'), join(output, 'THIRD_PARTY_NOTICES.txt'));
writeFileSync(join(output, 'Start.cmd'), '@echo off\r\nstart "" "%~dp0LungEducation.html"\r\n');
console.log('Created portable-v1.5/LungEducation.html');
