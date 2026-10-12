import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const base=process.cwd();
const files={
  vesicular:['open-vesicular.wav','audio/wav'],
  wheeze:['open-wheeze.mp3','audio/mpeg'],
  fine:['open-fine.wav','audio/wav'],
  coarse:['open-coarse.wav','audio/wav'],
  stridor:['open-stridor.mp3','audio/mpeg']
};
const sources=Object.fromEntries(Object.entries(files).map(([key,[file,type]])=>
  [key,`data:${type};base64,${readFileSync(join(base,'assets','audio',file)).toString('base64')}`]));
writeFileSync(join(base,'src','audio-data.js'),`export default ${JSON.stringify(sources)};\n`);
