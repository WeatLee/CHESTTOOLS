import {CONFIG} from './config.ts';

let markCanvas: HTMLCanvasElement | null = null;
let loading: Promise<void> | undefined;

// The original department artwork is retained intact. Only its left-hand logo
// is displayed, matching the crop in the existing physician business card SVG.
export function loadQrMark() {
  return loading ??= new Promise<void>((resolve,reject)=>{
    const image = new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,512);
      const sourceWidth=320, sourceHeight=image.naturalHeight;
      const fit=448/Math.max(sourceWidth,sourceHeight),w=sourceWidth*fit,h=sourceHeight*fit;
      ctx.drawImage(image,0,0,sourceWidth,sourceHeight,(512-w)/2,(512-h)/2,w,h);
      markCanvas=canvas;resolve();
    };
    image.onerror=()=>reject(new Error('無法載入高醫胸內標誌，請重新整理頁面。'));
    image.src=new URL('./assets/kmuh-pulmonary-mark.png',import.meta.url).href;
  });
}
export function getQrMarkCanvas(){return markCanvas;}
export function getQrMarkRegion(n:number){
  const size=Math.max(5,Math.min(13,Math.floor(n*.21)|1));
  const start=(n-size)/2;
  return {start,size,worldSide:CONFIG.interaction.qrSide*size/(n+CONFIG.qr.quietZone*2)};
}
