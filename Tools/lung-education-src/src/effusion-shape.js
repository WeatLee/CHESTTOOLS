export function compressionWeight(y){
  const t=Math.max(0,Math.min(1,(.85-y)/2.25));
  return t*t*(3-2*t);
}

function smoothstep(value,low,high){
  const t=Math.max(0,Math.min(1,(value-low)/(high-low)));
  return t*t*(3-2*t);
}

export function collapsedLungPosition(x,y,z,side,strength){
  const weight=compressionWeight(y)*strength;
  const hilumX=side==='R' ? -.73 : .73;
  return [x+(hilumX-x)*.20*weight,y+.25*weight,z*(1-.16*weight)];
}

export function collapsedAirwayPosition(x,y,z,rightStrength,leftStrength){
  // Blend the two sides at the carina. Intrapulmonary branches follow the
  // collapsed lung, while the trachea and central junction stay anchored.
  const leftMix=smoothstep(x,-.18,.18);
  const centerFade=smoothstep(Math.abs(x),.10,.45);
  const strength=(rightStrength*(1-leftMix)+leftStrength*leftMix)*centerFade;
  return collapsedLungPosition(x,y,z,x<0?'R':'L',strength);
}
