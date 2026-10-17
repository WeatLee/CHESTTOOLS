import QRCode from 'qrcode';
import { CONFIG } from './config.ts';
import {getQrMarkCanvas,getQrMarkRegion} from './qr-mark.ts';
export function validateUrl(value: string): string {
  if (!value || /\s/.test(value)) throw new Error('請輸入完整網址，不可包含空白。');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('請輸入有效的 http:// 或 https:// 網址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('網址必須以 http:// 或 https:// 開頭。');
  if (new TextEncoder().encode(value).length > CONFIG.qr.maxBytes) throw new Error('網址過長，請縮短內容後再試。');
  return value;
}
export function createQr(value: string) {
  validateUrl(value);
  // Fixed standards-compliant mask avoids false finder patterns observed with the default destination.
  try { return QRCode.create(value, { errorCorrectionLevel: CONFIG.qr.errorCorrection, maskPattern: 1 }); }
  catch { throw new Error('此網址超過 QR 容量，請縮短網址。'); }
}
export function paintQr(canvas: HTMLCanvasElement, qr: ReturnType<typeof createQr>, pixels = CONFIG.qr.pngModulePixels) {
  const n = qr.modules.size, border = CONFIG.qr.quietZone;
  canvas.width = canvas.height = (n + border * 2) * pixels;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立 QR 圖像。');
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = CONFIG.qr.light; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CONFIG.qr.dark;
  for (let y=0; y<n; y++) for(let x=0;x<n;x++) if(qr.modules.get(y,x)) ctx.fillRect((x+border)*pixels,(y+border)*pixels,pixels,pixels);
  const mark=getQrMarkCanvas();
  if(mark){const {start,size}=getQrMarkRegion(n);ctx.imageSmoothingEnabled=true;ctx.drawImage(mark,(start+border)*pixels,(start+border)*pixels,size*pixels,size*pixels);}
}
