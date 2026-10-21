import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Cache-busting version, new for every build so a cached page never pairs an old
// main.js with newer files (set SHOWCASE_RELEASE to pin one). Keep the previous release's chunks online
// for one release (see docs/WORKLOG.md, 2026-10-12).
const release = process.env.SHOWCASE_RELEASE || `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36)}`;
const base = process.cwd();
let html = readFileSync(join(base, 'index.html'), 'utf8');
html = html.replace('href="style.css"', `href="lung-showcase/style.css?v=${release}"`);
html = html.replace('src="main.js"', `src="lung-showcase/main.js?v=${release}"`);
if (!html.includes(`lung-showcase/main.js?v=${release}`) || !html.includes(`lung-showcase/style.css?v=${release}`)) throw new Error('Web packaging failed');
writeFileSync(join(base, 'web', 'lung-showcase.html'), html);
copyFileSync(join(base, 'style.css'), join(base, 'web', 'lung-showcase', 'style.css'));
// Optional illustrations (images/*.webp) are copied when present.
if (existsSync(join(base, 'images'))) {
  mkdirSync(join(base, 'web', 'lung-showcase', 'images'), { recursive: true });
  cpSync(join(base, 'images'), join(base, 'web', 'lung-showcase', 'images'), { recursive: true });
}
// QR codes (qr/<id>.png), made with the Medical QR page.
if (existsSync(join(base, 'qr'))) {
  mkdirSync(join(base, 'web', 'lung-showcase', 'qr'), { recursive: true });
  cpSync(join(base, 'qr'), join(base, 'web', 'lung-showcase', 'qr'), { recursive: true });
}
// Pre-recorded narration (voice/<lang>/*.mp3), built by build-voice.mjs.
if (existsSync(join(base, 'voice'))) {
  mkdirSync(join(base, 'web', 'lung-showcase', 'voice'), { recursive: true });
  cpSync(join(base, 'voice'), join(base, 'web', 'lung-showcase', 'voice'), { recursive: true });
}
console.log('Created web/lung-showcase.html and web/lung-showcase assets');
