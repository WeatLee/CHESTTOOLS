import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { createQr } from './qr.ts';
import {getQrMarkCanvas,getQrMarkRegion} from './qr-mark.ts';

type Source = { min: THREE.Vector3; max: THREE.Vector3; color: THREE.Color };
type Piece = { x:number;y:number;z:number;w:number;h:number;d:number;row:number;col:number;color:THREE.Color;source:Source };

/** Static relief from the actual geometry, sampled toward the scene's sun.
 * This is a height field, not a QR image. It adds bounded contact shade while
 * keeping light modules light enough to scan. Reused for every destination. */
export function makeReliefSampler(blocks:Source[]){
  const size=256,side=CONFIG.interaction.qrSide,half=side/2,step=side/size;
  const heights=new Float32Array(size*size).fill(-100);
  for(const block of blocks){
    const x0=Math.max(0,Math.floor((block.min.x+half)/step)),x1=Math.min(size-1,Math.floor((block.max.x+half)/step));
    const z0=Math.max(0,Math.floor((block.min.z+half)/step)),z1=Math.min(size-1,Math.floor((block.max.z+half)/step));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)heights[z*size+x]=Math.max(heights[z*size+x],block.max.y);
  }
  return(x:number,y:number,z:number)=>{
    for(let rise=.14;rise<9;rise+=.14){
      const col=Math.floor((x-rise*.3+half)/step),row=Math.floor((z+rise*.7+half)/step);
      if(col<0||row<0||col>=size||row>=size)break;
      if(heights[row*size+col]>y+rise+.045)return .84;
    }
    return 1;
  };
}

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
export function makePhysicalQr(blocks: Source[], url: string | null, isGround: boolean,relief?:(x:number,y:number,z:number)=>number) {
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
      visible.push({x:(left+right)/2,y:(block.min.y+block.max.y)/2,z:(back+front)/2,w:right-left,h:block.max.y-block.min.y,d:front-back,row,col,color:block.color,source:block});
    }
  }
  const group = new THREE.Group();
  const sidesGeometry = new THREE.BoxGeometry(1,1,1);
  // BoxGeometry group 2 is +Y. Replace those triangles with a separate, flush top face.
  const indices = Array.from(sidesGeometry.index!.array);
  sidesGeometry.setIndex(indices.filter((_,i)=>i<12||i>=18)); sidesGeometry.clearGroups();
  const sides = new THREE.InstancedMesh(sidesGeometry,new THREE.MeshStandardMaterial({roughness:.84}),visible.length);
  const topsGeometry = new THREE.PlaneGeometry(1,1); topsGeometry.rotateX(-Math.PI/2);
  // Keep the hue of the actual lung, roof, path and foliage. QR modules only
  // constrain brightness; the overhead view still shows individual objects.
  const topMaterial=new THREE.MeshBasicMaterial({toneMapped:false});
  topMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec4 blockBounds; varying vec2 vTopCoord; varying vec4 vBlockBounds;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vTopCoord=(instanceMatrix*vec4(position,1.0)).xz;
      vBlockBounds=blockBounds;
    `);
    shader.fragmentShader='varying vec2 vTopCoord; varying vec4 vBlockBounds;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 inset=min(vTopCoord-vBlockBounds.xy,vBlockBounds.zw-vTopCoord);
      float rim=smoothstep(0.0,0.018,min(inset.x,inset.y));
      diffuseColor.rgb*=mix(0.88,1.0,rim);
    `);
  };
  topMaterial.customProgramCacheKey=()=> 'physical-object-relief-v1';
  const tops = new THREE.InstancedMesh(topsGeometry,topMaterial,visible.length);
  const bounds=new Float32Array(visible.length*4);
  const matrix = new THREE.Matrix4(), light = new THREE.Color('#fff4e6');
  const pivot = isGround ? 0 : CONFIG.lung.centerY;
  visible.forEach((v,i)=>{
    const x=v.x,y=v.y-pivot,z=v.z;
    matrix.makeScale(v.w,v.h,v.d);matrix.setPosition(x,y,z); sides.setMatrixAt(i,matrix); sides.setColorAt(i,v.color);
    matrix.makeScale(v.w,1,v.d);matrix.setPosition(x,y+v.h/2,z); tops.setMatrixAt(i,matrix);
    const r=v.row-border,c=v.col-border;
    const quiet=r<0||r>=n||c<0||c>=n;
    const finder=!quiet&&((r<8&&c<8)||(r<8&&c>=n-8)||(r>=n-8&&c<8));
    const dark=Boolean(qr&&!quiet&&qr.modules.get(r,c));
    const tint=v.color.clone();
    // Two separated luminance ranges, with source colour and height variation
    // inside each range. Colours never switch when the camera moves.
    const h=THREE.MathUtils.clamp((v.y+v.h/2+3)/9,0,1);
    // ICQR-style: dark modules stay saturated mid-tones of the object's own hue
    // (rose lung, olive grass, terracotta roof); light modules fade toward paper.
    if(dark){const hsl={h:0,s:0,l:0};tint.getHSL(hsl);tint.setHSL(hsl.h,THREE.MathUtils.clamp(hsl.s*1.3+.12,0,.85),.2+h*.05);}
    else tint.lerp(light,quiet?1:.78);
    if(!quiet)tint.multiplyScalar(relief?.(v.x,v.y+v.h/2,v.z)??1);
    // Bounded brightness keeps real material variation from confusing local
    // thresholding, especially across the three locator rings on small screens.
    const luminance=(color:THREE.Color)=>color.r*.2126+color.g*.7152+color.b*.0722;
    const value=luminance(tint);
    if(dark){const ceiling=finder?.115:.165;if(value>ceiling)tint.multiplyScalar(ceiling/value);}
    else if(!quiet){const floor=finder?.86:.78;if(value<floor)tint.lerp(light,(floor-value)/(luminance(light)-value));}
    tops.setColorAt(i,tint);
    bounds.set(quiet||finder?[-100,-100,100,100]:[v.source.min.x,v.source.min.z,v.source.max.x,v.source.max.z],i*4);
  });
  topsGeometry.setAttribute('blockBounds',new THREE.InstancedBufferAttribute(bounds,4));
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

