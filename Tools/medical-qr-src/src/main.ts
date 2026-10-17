import './style.css';
import {CONFIG} from './config.ts';
import {createQr,paintQr} from './qr.ts';
import {loadQrMark} from './qr-mark.ts';
import type {createWorld} from './world.ts';
type State='LUNG_IDLE'|'TO_QR'|'QR_IDLE'|'TO_LUNG';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=$<HTMLInputElement>('url-input'),canvas=$<HTMLCanvasElement>('qr-canvas'),toggle=$<HTMLButtonElement>('toggle'),error=$('url-error'),layer=$('qr-layer'),actions=$('qr-actions'),feedback=$('feedback'),reduce=$<HTMLInputElement>('reduce-motion');
const embedded=new URLSearchParams(location.search).get('embed')==='share';
const homeUrl='https://weatlee.github.io/CHESTTOOLS/';
document.body.classList.toggle('embedded-share',embedded);
input.value=embedded?homeUrl:CONFIG.defaultUrl;
if(embedded){
  input.readOnly=true;
  document.title='分享 CHESTTOOLS · 肺臟 QR';
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&parent!==window){parent.postMessage({type:'kmuh-share-close'},location.origin);}});
}
let state:State='LUNG_IDLE',valid=false,qrUrl='',world:ReturnType<typeof createWorld>|undefined;
function updateQr(){
  try{const qr=createQr(input.value);paintQr(canvas,qr);valid=true;qrUrl=input.value;error.textContent='';input.setAttribute('aria-invalid','false');}
  catch(e){valid=false;qrUrl='';error.textContent=(e as Error).message;input.setAttribute('aria-invalid','true');canvas.width=canvas.height=1;}
  $('url-note').textContent=input.value===CONFIG.defaultUrl?'目前連結至醫師名片，可自行更換。':'掃描後將開啟上方輸入的網址。';
  world?.setQrCanvas(valid?canvas:null,valid?qrUrl:null);feedback.textContent='';renderUi();
}
function renderUi(){
  const transitioning=state==='TO_QR'||state==='TO_LUNG', qr=state==='QR_IDLE';
  toggle.disabled=transitioning||(!valid&&state==='LUNG_IDLE');
  $('toggle-text').textContent=qr||state==='TO_LUNG'?'返回肺臟':'顯示 QR Code';
  layer.hidden=!(qr&&valid&&!world);actions.hidden=!qr;
  $<HTMLButtonElement>('copy').disabled=!valid;$<HTMLButtonElement>('download').disabled=!valid;
  $('scene-status').textContent=transitioning?'CAMERA / 視角轉換中':qr?'AERIAL / 空拍 QR 掃描模式':'LUNG / 緩慢旋轉的方塊肺臟';
  $('scene-hint').textContent=qr?'點一下返回肺臟':'點一下切換空拍 · 拖曳旋轉';
  document.querySelector('.world')!.classList.toggle('qr-mode',qr||transitioning);$('scene').setAttribute('aria-label',qr?'俯視地台上的可掃描 QR Code，點擊可返回平視肺臟':'可旋轉的珊瑚色方塊肺臟，下方為高醫微縮建築');document.body.dataset.state=state;
}
function changeMode(){
  if(state==='TO_QR'||state==='TO_LUNG')return;
  if(state==='LUNG_IDLE'&&!valid){input.focus();return;}
  const toQr=state==='LUNG_IDLE';state=toQr?'TO_QR':'TO_LUNG';renderUi();
  const finish=()=>{world?.setQrMode(toQr);state=toQr?'QR_IDLE':'LUNG_IDLE';renderUi();};
  if(world)world.transitionToQr(toQr,finish);else window.setTimeout(finish,CONFIG.interaction.modeLockMs);
}
input.addEventListener('input',updateQr);toggle.addEventListener('click',changeMode);$('qr-subject').addEventListener('click',changeMode);
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&state==='LUNG_IDLE')changeMode();});
$('copy').addEventListener('click',async()=>{if(!valid)return;try{await navigator.clipboard.writeText(qrUrl);feedback.textContent='網址已複製。';}catch{feedback.textContent='無法存取剪貼簿，請選取上方網址手動複製。';input.focus();input.select();}});
$('download').addEventListener('click',()=>{if(!valid)return;canvas.toBlob(blob=>{if(!blob){feedback.textContent='下載失敗，請重試。';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kmuh-qr.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.textContent='已下載含胸內標誌的 QR PNG。';},'image/png');});
const preference=matchMedia('(prefers-reduced-motion: reduce)');reduce.checked=preference.matches;let userMotion=false;
reduce.addEventListener('change',()=>{userMotion=true;world?.setReduced(reduce.checked);});preference.addEventListener('change',e=>{if(!userMotion){reduce.checked=e.matches;world?.setReduced(e.matches);}});
updateQr();
loadQrMark().then(()=>{updateQr();return import('./world.ts');}).then(({createWorld})=>{world=createWorld($('scene'),changeMode,()=>{$('loading').hidden=true;});world.setReduced(reduce.checked);world.setQrCanvas(valid?canvas:null,valid?qrUrl:null);world.setQrMode(state==='QR_IDLE');renderUi();}).catch(e=>{$('loading').hidden=true;$('scene-error').hidden=false;if((e as Error).message.includes('標誌'))feedback.textContent=(e as Error).message;console.warn('3D unavailable; QR fallback remains available',e);});
// Read-only local diagnostics for reproducible QA; no telemetry is transmitted.
Object.defineProperty(window,'kmuhDiagnostics',{get:()=>({state,valid,url:qrUrl,phase:'physical voxel anamorphosis',...world?.stats()})});
window.addEventListener('pagehide',()=>world?.dispose(),{once:true});
