import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {airway,segments} from './src/airway-data.js';

// Bake a single union surface. Separate tube meshes leave dark seams and
// visible caps where a segment joins its lobar parent.
const resolution=150,extent=2.35;
const mc=new MarchingCubes(resolution,new THREE.MeshNormalMaterial(),false,false,260000);
mc.field.fill(-1);
mc.isolation=0;
const step=2*extent/resolution,half=resolution/2;
const branches=[
  ['trachea',.115],['rightMain',.103],['leftMain',.095],
  ...['RUL','RML','RLL','LUL','LLL'].map(key=>[key,.064]),
  ...Object.keys(segments).map(key=>[key,.038])
];
function stamp(a,b,r){
  const lo=a.clone().min(b).addScalar(-r-.035),hi=a.clone().max(b).addScalar(r+.035);
  const index=v=>Math.max(2,Math.min(resolution-3,Math.floor(v/step+half)));
  const [x0,y0,z0]=[lo.x,lo.y,lo.z].map(index),[x1,y1,z1]=[hi.x,hi.y,hi.z].map(index);
  const d=b.clone().sub(a),den=d.lengthSq();
  for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=(x-half)*step,py=(y-half)*step,pz=(z-half)*step;
    const t=Math.max(0,Math.min(1,((px-a.x)*d.x+(py-a.y)*d.y+(pz-a.z)*d.z)/den));
    const dist=Math.hypot(px-a.x-d.x*t,py-a.y-d.y*t,pz-a.z-d.z*t);
    const signed=r-dist,at=x+resolution*y+resolution*resolution*z;
    // A small smooth union rounds each bifurcation without a patch sphere.
    const old=mc.field[at],k=.027,h=Math.max(k-Math.abs(old-signed),0)/k;
    mc.field[at]=Math.max(old,signed)+h*h*k*.25;
  }
}
for(const [key,r] of branches){
  const points=airway[key]||segments[key].points;
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const sampled=curve.getPoints(Math.max(12,Math.ceil(curve.getLength()/.035)));
  for(let i=1;i<sampled.length;i++){
    // Segmental bronchi end close to the pleura. Narrow their last portion so
    // a full-width terminal cap cannot break through the visible lung surface.
    const u=(i-.5)/(sampled.length-1),fade=segments[key]?THREE.MathUtils.smoothstep(u,.68,1):0;
    stamp(sampled[i-1],sampled[i],r*(1-.88*fade));
  }
}
mc.update();
if(mc.count>=260000*3)throw new Error('Increase MarchingCubes maxPolyCount');
const coords=new Float32Array(mc.count*6);
for(let i=0;i<mc.count;i++){
  for(let j=0;j<3;j++)coords[i*6+j]=mc.positionArray[i*3+j]*extent;
  for(let j=0;j<3;j++)coords[i*6+3+j]=mc.normalArray[i*3+j];
}
const header=Buffer.alloc(12);header.write('AIRW1',0,'ascii');header.writeUInt32LE(mc.count,8);
const packed=gzipSync(Buffer.concat([header,Buffer.from(coords.buffer)]),{level:9});
writeFileSync(new URL('./src/airway-mesh-data.js',import.meta.url),`export default '${packed.toString('base64')}';\n`);
console.log(`Baked ${mc.count/3} airway triangles, ${packed.length} compressed bytes`);
