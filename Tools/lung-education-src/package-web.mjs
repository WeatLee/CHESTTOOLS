import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base=process.cwd();
const release='20261011segments2';
let html=readFileSync(join(base,'index.html'),'utf8');
html=html.replace('href="style.css"',`href="lung-education/style.css?v=${release}"`);
html=html.replace('<script src="app.js"></script>',`<script type="module" src="lung-education/main.js?v=${release}"></script>`);
if(!html.includes(`src="lung-education/main.js?v=${release}"`))throw new Error('Web packaging failed');
writeFileSync(join(base,'web','lung-education.html'),html);
copyFileSync(join(base,'style.css'),join(base,'web','lung-education','style.css'));
console.log('Created web/lung-education.html and web/lung-education assets');
