import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { createQr } from './qr.ts';
import {getQrMarkCanvas,getQrMarkRegion} from './qr-mark.ts';

type Source = { min: THREE.Vector3; max: THREE.Vector3; color: THREE.Color };
type Piece = { x:number;y:number;z:number;w:number;h:number;d:number;row:number;col:number;color:THREE.Color };

/** Capture the existing architectural massing, including its instance colours. */
export function captureBlocks(root: THREE.Group): Source[] {
  root.updateMatrixWorld(true);
  const blocks: Source[] = [], instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
  root.traverse(mesh => {
    if (!(mesh instanceof THREE.InstancedMesh)) return;
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance); transform.multiplyMatrices(mesh.matrixWorld, instance);
      const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(transform);
      const color = new THREE.Color(); mesh.getColorAt(i, color);
      blocks.push({ min: bounds.min, max: bounds.max, color });
    }
  });
  return blocks;
}

/** Geometry, not projection: each block is split along exact QR module boundaries.
 * Its immutable top-face colour is visible from every camera angle.
 * No QR texture, QR plane, opacity change, or camera-dependent shading.
 * The department mark alone uses texture fragments on these same top faces.
 */
export function makePhysicalQr(blocks: Source[], url: string | null, isGround: boolean) {
  const qr = url ? createQr(url) : null;
  const n = qr?.modules.size ?? 41, border = CONFIG.qr.quietZone;
  const count = n + border * 2, step = CONFIG.interaction.qrSide / count, half = CONFIG.interaction.qrSide / 2;
  const visible: Piece[] = [];
  // Cut source blocks only at QR column boundaries. Thin window frames,
  // setbacks and facade details retain their original dimensions and colours.
  const sources = isGround ? [{min:new THREE.Vector3(-half,CONFIG.hospital.groundY-.54,-half),max:new THREE.Vector3(half,CONFIG.hospital.groundY-.4,half),color:new THREE.Color('#c5a887')},...blocks] : blocks;
  for(const block of sources){
    const x0=Math.max(0,Math.floor((block.min.x+half)/step)),x1=Math.min(count-1,Math.ceil((block.max.x+half)/step)-1);
    const z0=Math.max(0,Math.floor((block.min.z+half)/step)),z1=Math.min(count-1,Math.ceil((block.max.z+half)/step)-1);
    for(let col=x0;col<=x1;col++)for(let row=z0;row<=z1;row++){
      const left=Math.max(block.min.x,col*step-half),right=Math.min(block.max.x,(col+1)*step-half);
      const back=Math.max(block.min.z,row*step-half),front=Math.min(block.max.z,(row+1)*step-half);
      if(right-left<1e-6||front-back<1e-6)continue;
      visible.push({x:(left+right)/2,y:(block.min.y+block.max.y)/2,z:(back+front)/2,w:right-left,h:block.max.y-block.min.y,d:front-back,row,col,color:block.color});
    }
  }
  const group = new THREE.Group();
  const sidesGeometry = new THREE.BoxGeometry(1,1,1);
  // BoxGeometry group 2 is +Y. Replace those triangles with a separate, flush top face.
  const indices = Array.from(sidesGeometry.index!.array);
  sidesGeometry.setIndex(indices.filter((_,i)=>i<12||i>=18)); sidesGeometry.clearGroups();
  const sides = new THREE.InstancedMesh(sidesGeometry,new THREE.MeshStandardMaterial({roughness:.84}),visible.length);
  const topsGeometry = new THREE.PlaneGeometry(1,1); topsGeometry.rotateX(-Math.PI/2);
  const tops = new THREE.InstancedMesh(topsGeometry,new THREE.MeshBasicMaterial({toneMapped:false}),visible.length);
  const matrix = new THREE.Matrix4(), dark = new THREE.Color(CONFIG.qr.dark), light = new THREE.Color(CONFIG.qr.light);
  const pivot = isGround ? 0 : CONFIG.lung.centerY;
  visible.forEach((v,i)=>{
    const x=v.x,y=v.y-pivot,z=v.z;
    matrix.makeScale(v.w,v.h,v.d);matrix.setPosition(x,y,z); sides.setMatrixAt(i,matrix); sides.setColorAt(i,v.color);
    matrix.makeScale(v.w,1,v.d);matrix.setPosition(x,y+v.h/2,z); tops.setMatrixAt(i,matrix);
    const r=v.row-border,c=v.col-border;
    tops.setColorAt(i,qr && r>=0&&r<n&&c>=0&&c<n&&qr.modules.get(r,c)?dark:light);
  });
  sides.castShadow=true; sides.receiveShadow=true;
  for (const mesh of [sides,tops]) {mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
  // The mark is split across the existing physical top faces. It is not a
  // screen overlay or a floating plate; it becomes complete only overhead.
  const mark=getQrMarkCanvas();let markTexture:THREE.CanvasTexture|undefined;
  let markMesh:THREE.Mesh|undefined,markFaces=0;
  if(qr&&mark){
    const side=getQrMarkRegion(n).worldSide,halfMark=side/2,positions:number[]=[],uvs:number[]=[];
    for(const v of visible){
      const l=Math.max(v.x-v.w/2,-halfMark),r=Math.min(v.x+v.w/2,halfMark);
      const b=Math.max(v.z-v.d/2,-halfMark),f=Math.min(v.z+v.d/2,halfMark);
      if(l>=r||b>=f)continue;
      const y=v.y-pivot+v.h/2+.0005;
      for(const [x,z] of [[l,b],[l,f],[r,f],[l,b],[r,f],[r,b]]){
        positions.push(x,y,z);uvs.push((x+halfMark)/side,(halfMark-z)/side);
      }
      markFaces++;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    markTexture=new THREE.CanvasTexture(mark);markTexture.colorSpace=THREE.SRGBColorSpace;markTexture.anisotropy=4;
    markMesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:markTexture,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    group.add(markMesh);
  }
  group.position.y=pivot;
  return {group,count:visible.length,moduleCount:n,step,markFaces,dispose(){for(const mesh of [sides,tops]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();}if(markMesh){markMesh.geometry.dispose();(markMesh.material as THREE.Material).dispose();}markTexture?.dispose();}};
}
