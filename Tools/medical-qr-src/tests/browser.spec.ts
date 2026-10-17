import{test,expect}from '@playwright/test';
import {CONFIG} from '../src/config.ts';
import{PNG}from 'pngjs';import jsQR from 'jsqr';import fs from 'node:fs/promises';import ZXing from '@zxing/library';
const{RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader}=ZXing;
function decode(bytes:Buffer){const p=PNG.sync.read(bytes),data=new Uint8ClampedArray(p.data);return{p,data,text:jsQR(data,p.width,p.height)?.data};}
function zxing(bytes:Buffer){const{p,data}=decode(bytes),gray=new Uint8ClampedArray(p.width*p.height);for(let i=0;i<gray.length;i++)gray[i]=data[i*4];return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,p.width,p.height)))).getText();}
function hasMark(bytes:Buffer){const {data}=decode(bytes);let cyan=0;for(let i=0;i<data.length;i+=4)if(data[i]<190&&data[i+1]>200&&data[i+2]>200)cyan++;return cyan>50;}
async function diagnostics(page:any){return page.evaluate(()=>(window as any).kmuhDiagnostics);}
async function ready(page:any){await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE');}
async function qr(page:any){await page.locator('#toggle').click();await expect(page.locator('body')).toHaveAttribute('data-state','QR_IDLE',{timeout:15000});}

test('desktop: continuous overhead camera, rapid click guard, fixed physical voxel QR, copy and download',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');await ready(page);await page.locator('#reduce-motion').check();
 const stats=await diagnostics(page);expect(stats.lungTilt).toBeCloseTo(CONFIG.lung.displayTilt);expect(stats.qrMarkFaces).toBeGreaterThan(0);expect(stats.lungVoxels).toBeGreaterThan(1000);expect(stats.hospitalBlocks).toBeGreaterThan(3000);
 await page.screenshot({path:'docs/screenshots/revision-front.png',fullPage:true});await page.locator('#reduce-motion').uncheck();
 const poseBefore=(await diagnostics(page)).lungPose;await page.waitForTimeout(400);const poseAfter=(await diagnostics(page)).lungPose;expect(Math.abs(poseAfter.y-poseBefore.y)).toBeLessThan(.13);expect(poseAfter.scaleY).toBe(poseBefore.scaleY);expect(poseAfter.yaw).toBeGreaterThan(poseBefore.yaw);
 await page.evaluate(()=>{for(let i=0;i<12;i++)(document.getElementById('toggle') as HTMLButtonElement).click();});
 await expect(page.locator('body')).toHaveAttribute('data-state','TO_QR');await expect(page.locator('#toggle')).toBeDisabled();
 await page.waitForFunction(()=>{const d=(window as any).kmuhDiagnostics;return d.cameraMode>0&&d.cameraMode<1;});
 await page.screenshot({path:'docs/screenshots/revision-transition.png',fullPage:true});
 await expect(page.locator('body')).toHaveAttribute('data-state','QR_IDLE',{timeout:15000});expect((await diagnostics(page)).cameraMode).toBe(1);const construction=await diagnostics(page);expect(construction.qrConstruction).toBe('physical-cube-top-faces');expect(construction.qrPlaneCount).toBe(0);expect(construction.qrTextureCount).toBe(0);expect(construction.lungPose.yaw).toBe(0);await expect(page.locator('#qr-layer')).toBeHidden();
 let bytes=await page.locator('#scene canvas').screenshot();expect(hasMark(bytes)).toBe(true);expect(decode(bytes).text).toBe(CONFIG.defaultUrl);expect(zxing(bytes)).toBe(CONFIG.defaultUrl);
 await page.locator('#url-input').fill('https://weatlee.github.io/CHESTTOOLS/');bytes=await page.locator('#scene canvas').screenshot();expect(decode(bytes).text).toBe('https://weatlee.github.io/CHESTTOOLS/');
 await page.screenshot({path:'docs/screenshots/revision-aerial.png',fullPage:true});
 await page.getByRole('button',{name:'複製網址'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('https://weatlee.github.io/CHESTTOOLS/');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下載 QR PNG'}).click();const file=await(await pending).path();const png=await fs.readFile(file!);expect(hasMark(png)).toBe(true);expect(decode(png).text).toBe('https://weatlee.github.io/CHESTTOOLS/');expect(zxing(png)).toBe('https://weatlee.github.io/CHESTTOOLS/');
 await page.locator('#url-input').fill('javascript:alert(1)');await expect(page.locator('#url-error')).toBeVisible();await expect(page.getByRole('button',{name:'下載 QR PNG'})).toBeDisabled();expect(decode(await page.locator('#scene canvas').screenshot()).text).toBeUndefined();
 await page.locator('#url-input').fill('https://example.com');await page.locator('#toggle').click();await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE',{timeout:15000});expect((await diagnostics(page)).cameraMode).toBe(0);
 await page.waitForTimeout(2400);await fs.writeFile('docs/performance-desktop-v03.json',JSON.stringify(await diagnostics(page),null,2));expect(errors).toEqual([]);
});

test('mobile: warm diorama, overhead QR short and long, system reduced motion',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage();await page.goto('http://127.0.0.1:4321/');await ready(page);await expect(page.locator('#reduce-motion')).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'docs/screenshots/revision-mobile-front.png',fullPage:true});await page.locator('#scene canvas').tap({position:{x:12,y:12}});await expect(page.locator('body')).toHaveAttribute('data-state','QR_IDLE');
 for(const url of ['https://example.com','https://example.com/clinic?note='+'pulmonary-'.repeat(22)]){await page.locator('#url-input').fill(url);const bytes=await page.locator('#scene canvas').screenshot();expect(decode(bytes).text).toBe(url);expect(zxing(bytes)).toBe(url);}
 await page.locator('#url-input').fill('https://example.com');await page.screenshot({path:'docs/screenshots/revision-mobile-aerial.png',fullPage:true});
 const r=await page.locator('#scene canvas').boundingBox();await page.locator('#scene canvas').tap({position:{x:r!.width/2,y:r!.height/2}});await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE');await fs.writeFile('docs/performance-mobile-v03.json',JSON.stringify(await diagnostics(page),null,2));await context.close();
});

test('scene click anywhere, drag guard, static QR and keyboard return',async({page})=>{
 await page.goto('/');await ready(page);await page.locator('#reduce-motion').uncheck();const canvas=page.locator('#scene canvas'),r=await canvas.boundingBox();
 await canvas.click({position:{x:12,y:12}});await expect(page.locator('body')).toHaveAttribute('data-state','TO_QR');await expect(page.locator('body')).toHaveAttribute('data-state','QR_IDLE',{timeout:15000});const before=await canvas.screenshot();await page.waitForTimeout(180);expect((await canvas.screenshot()).equals(before)).toBe(true);
 await canvas.click({position:{x:12,y:12}});await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE',{timeout:15000});await page.locator('#reduce-motion').check();await canvas.click({position:{x:r!.width*.5,y:r!.height*.8}});await expect(page.locator('body')).toHaveAttribute('data-state','QR_IDLE');await page.locator('#toggle').focus();await page.keyboard.press('Enter');await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE');
 await page.mouse.move(r!.x+r!.width*.5,r!.y+r!.height*.4);await page.mouse.down();await page.mouse.move(r!.x+r!.width*.65,r!.y+r!.height*.42,{steps:8});await page.mouse.up();await expect(page.locator('body')).toHaveAttribute('data-state','LUNG_IDLE');
});

test('WebGL unavailable: two-dimensional fallback remains scannable',async({browser})=>{const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:any,...args:any[]){if(String(type).includes('webgl'))return null;return(get as any).call(this,type,...args);} as any;});await page.goto('http://127.0.0.1:4321/');await expect(page.locator('#scene-error')).toBeVisible();await qr(page);await expect(page.locator('#qr-layer')).toBeVisible();expect(decode(await page.locator('#qr-canvas').screenshot()).text).toBe(CONFIG.defaultUrl);await context.close();});

test('built nested static path retains physical overhead QR',async({page})=>{
 const{createServer}=await import('node:http'),path=await import('node:path'),root=path.resolve('dist'),prefix='/demo/kmuh/';
 const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url!,'http://localhost').pathname;if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}const file=path.resolve(root,decodeURIComponent(pathname.slice(prefix.length))||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const mime:any={'.html':'text/html','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise<void>(resolve=>server.listen(4323,'127.0.0.1',resolve));
 try{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4323/demo/kmuh/');await ready(page);await qr(page);expect(decode(await page.locator('#scene canvas').screenshot()).text).toBe(CONFIG.defaultUrl);}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
