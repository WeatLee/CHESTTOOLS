import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import ZXing from '@zxing/library';
const home='https://weatlee.github.io/CHESTTOOLS/';
function scan(bytes,url){
 const png=PNG.sync.read(bytes),data=new Uint8ClampedArray(png.data),gray=new Int32Array(png.width*png.height);
 assert.equal(jsQR(data,png.width,png.height)?.data,url);
 for(let i=0;i<gray.length;i++)gray[i]=(data[i*4]<<16)|(data[i*4+1]<<8)|data[i*4+2];
 assert.equal(new ZXing.QRCodeReader().decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(gray,png.width,png.height)))).getText(),url);
 assert.ok(data.some((v,i)=>i%4===0&&v<190&&data[i+1]>200&&data[i+2]>200),'department mark present');
}
for(const channel of (process.env.QA_CHANNEL?[process.env.QA_CHANNEL]:['msedge','chrome'])){
 const browser=await chromium.launch({channel,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const mobile of (process.env.QA_MOBILE?[true]:[false,true])){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},reducedMotion:mobile?'reduce':'no-preference',isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
   await page.goto('http://127.0.0.1:8797/');
   assert.equal(requests.some(url=>url.includes('/medical-qr/')),false,'3D is lazy-loaded');
   const card=page.getByRole('link',{name:/醫學 QR Code 生成器/});assert.equal(await card.count(),1);
   await page.locator('#share-tools-button').click();
   const frame=await(await page.locator('#share-lung-frame').elementHandle()).contentFrame();
   await frame.waitForFunction(()=>document.body?.dataset.state==='LUNG_IDLE'&&document.getElementById('loading')?.hidden);
   assert.equal(await frame.locator('#url-input').inputValue(),home);
   assert.equal(await frame.locator('.world-heading').isVisible(),false);
   assert.ok(await frame.locator('#scene canvas').isVisible());
   const label=mobile?'mobile':'desktop';
   await page.screenshot({path:`docs/screenshots/chesttools-${channel}-${label}-lung.png`,fullPage:false});
   await frame.locator('#scene canvas').click({position:{x:12,y:12}});
   await frame.waitForFunction(()=>document.body?.dataset.state==='QR_IDLE');
   scan(await frame.locator('#scene canvas').screenshot(),home);
   await page.screenshot({path:`docs/screenshots/chesttools-${channel}-${label}-qr.png`,fullPage:false});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await frame.locator('#toggle').focus();await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.getElementById('share-tools-dialog').open);
   assert.equal(await page.locator('#share-lung-frame').getAttribute('src'),'about:blank');
   assert.equal(await page.locator('#share-tools-button').evaluate(el=>el===document.activeElement),true);
   await page.locator('#share-tools-button').click();
   const reopened=await(await page.locator('#share-lung-frame').elementHandle()).contentFrame();
   await reopened.waitForFunction(()=>document.body?.dataset.state==='LUNG_IDLE'&&document.getElementById('loading')?.hidden);
   await page.getByRole('button',{name:'關閉分享視窗'}).click();
   await card.click();await page.waitForFunction(()=>document.getElementById('loading')?.hidden);
   assert.match(await page.title(),/醫學 QR Code 生成器/);
   const url='https://example.com/education?topic=lung';
   await page.locator('#url-input').fill(url);await page.locator('#reduce-motion').check();await page.locator('#toggle').click();
   await page.waitForFunction(()=>document.body?.dataset.state==='QR_IDLE');scan(await page.locator('#scene canvas').screenshot(),url);
   assert.deepEqual(errors,[]);await context.close();console.log(`${channel} ${label}: lazy share, lung → QR, both scanners + mark, iframe Escape, cleanup, reopen, generator OK`);
  }
  const page=await browser.newPage({reducedMotion:'reduce'});
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:get.call(this,type,...args);};});
  await page.goto('http://127.0.0.1:8797/');await page.locator('#share-tools-button').click();
  const frame=await(await page.locator('#share-lung-frame').elementHandle()).contentFrame();
  await frame.locator('#scene-error').waitFor({state:'visible'});await frame.locator('#toggle').click();await frame.locator('#qr-layer').waitFor({state:'visible'});
  scan(await frame.locator('#qr-canvas').screenshot(),home);await page.close();console.log(`${channel} WebGL fallback share QR OK`);
 }finally{await browser.close();}
}
console.log('Selected CHESTTOOLS integration scenarios passed');



