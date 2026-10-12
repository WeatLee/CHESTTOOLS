import { rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const base=resolve(process.cwd());
const target=resolve(base,'web');
if(dirname(target)!==base||basename(target)!=='web')throw new Error('Unexpected web output path');
rmSync(target,{recursive:true,force:true});
