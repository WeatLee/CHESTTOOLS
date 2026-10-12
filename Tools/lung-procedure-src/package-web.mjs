import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base=process.cwd();
const release='20261012tbna9';
let html=readFileSync(join(base,'index.html'),'utf8');
html=html.replace('href="style.css"',`href="lung-procedure/style.css?v=${release}"`);
html=html.replace('<script src="app.js"></script>',`<script type="module" src="lung-procedure/main.js?v=${release}"></script>`);
if(!html.includes(`src="lung-procedure/main.js?v=${release}"`))throw new Error('Web packaging failed');
writeFileSync(join(base,'web','lung-procedure.html'),html);
copyFileSync(join(base,'style.css'),join(base,'web','lung-procedure','style.css'));
console.log('Created web/lung-procedure.html and web/lung-procedure assets');
