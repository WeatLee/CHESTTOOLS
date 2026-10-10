export function compressionWeight(y){
  const t=Math.max(0,Math.min(1,(.85-y)/2.25));
  return t*t*(3-2*t);
}
