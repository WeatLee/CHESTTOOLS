import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base=process.cwd();
let html=readFileSync(join(base,'index.html'),'utf8');
html=html.replace('href="style.css"','href="lung-education/style.css"');
html=html.replace('<script src="app.js"></script>','<script type="module" src="lung-education/main.js"></script>');
if(!html.includes('src="lung-education/main.js"'))throw new Error('Web packaging failed');
writeFileSync(join(base,'web','lung-education.html'),html);
copyFileSync(join(base,'style.css'),join(base,'web','lung-education','style.css'));
console.log('Created web/lung-education.html and web/lung-education assets');
