import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import ZXing from '@zxing/library';
import { createQr,validateUrl } from '../src/qr.ts';
import {CONFIG} from '../src/config.ts';
const {RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader}=ZXing;
const urls=['https://example.com','https://weatlee.github.io/CHESTTOOLS/',
 'https://weatlee.github.io/CHESTTOOLS/Tools/lee-business-card.html','https://example.com/門診?name=李岱晃&note='+encodeURIComponent('pulmonary medicine '.repeat(18))];
function raster(url:string,px=8){const qr=createQr(url),n=qr.modules.size+8,width=n*px,data=new Uint8ClampedArray(width*width*4).fill(255);for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.get(y,x))for(let dy=0;dy<px;dy++)for(let dx=0;dx<px;dx++){const o=(((y+4)*px+dy)*width+(x+4)*px+dx)*4;data[o]=data[o+1]=data[o+2]=22;}return {qr,width,data};}
for(const url of urls)test(`QR H level roundtrip, both scanners: ${url.slice(0,65)}`,()=>{
 const {qr,width,data}=raster(url);
 assert.equal(jsQR(data,width,width)?.data,url);
 const gray=new Uint8ClampedArray(width*width);for(let i=0;i<gray.length;i++)gray[i]=data[i*4];
 const result=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,width,width))));assert.equal(result.getText(),url);
 assert.equal(qr.errorCorrectionLevel.bit,2);
 for(let y=0;y<32;y++)for(let x=0;x<width;x++)assert.equal(data[(y*width+x)*4],255);
});
test('valid HTTP URLs preserve exact payload',()=>{assert.equal(validateUrl('http://example.com/a?q=1#b'),'http://example.com/a?q=1#b');});
test('invalid/unsupported/oversize URLs fail before generation',()=>{for(const value of ['', 'example.com','javascript:alert(1)','data:text/plain,a','ftp://example.com','https://','https://example.com/a b','https://example.com/'+ 'a'.repeat(1801)])assert.throws(()=>createQr(value));});

test('terrain colours retain strong scan contrast',()=>{
 const luminance=(hex:string)=>{const rgb=hex.match(/[0-9a-f]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const dark=luminance(CONFIG.qr.dark),light=luminance(CONFIG.qr.light);assert.ok((light+.05)/(dark+.05)>=7);
});

