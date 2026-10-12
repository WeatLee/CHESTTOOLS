// Bronchoscope routes traced through the BodyParts3D airway lumen
// (build-airway-routes.mjs). Scene units: right is negative x, front is +z.
// Combined left segments reflect a common 8-segment teaching convention.
import {trachea, routes} from './airway-routes.js';

export const lobeNames={RUL:'右上葉',RML:'右中葉',RLL:'右下葉',LUL:'左上葉',LLL:'左下葉'};
export const segments={
  RS1:{lobe:'RUL',label:'S1 頂段'},
  RS2:{lobe:'RUL',label:'S2 後段'},
  RS3:{lobe:'RUL',label:'S3 前段'},
  RS4:{lobe:'RML',label:'S4 外側段'},
  RS5:{lobe:'RML',label:'S5 內側段'},
  RS6:{lobe:'RLL',label:'S6 上段'},
  RS7:{lobe:'RLL',label:'S7 內側基底段'},
  RS8:{lobe:'RLL',label:'S8 前基底段'},
  RS9:{lobe:'RLL',label:'S9 外側基底段'},
  RS10:{lobe:'RLL',label:'S10 後基底段'},
  LS12:{lobe:'LUL',label:'S1+2 尖後段'},
  LS3:{lobe:'LUL',label:'S3 前段'},
  LS4:{lobe:'LUL',label:'S4 上舌段'},
  LS5:{lobe:'LUL',label:'S5 下舌段'},
  LS6:{lobe:'LLL',label:'S6 上段'},
  LS78:{lobe:'LLL',label:'S7+8 前內側基底段'},
  LS9:{lobe:'LLL',label:'S9 外側基底段'},
  LS10:{lobe:'LLL',label:'S10 後基底段'}
};
for(const [key,segment] of Object.entries(segments))segment.points=routes[key];
export const segmentNames=Object.fromEntries(Object.entries(segments).map(([key,value])=>[key,`${lobeNames[value.lobe]} ${value.label}`]));

// A whole-lobe choice follows its most central segment, the one whose
// tip lies closest to the lobe's demonstration point.
const lobeTargets={RUL:[-.99,.83,.34],RML:[-1.39,-.39,.49],RLL:[-1.54,-.90,.20],LUL:[.96,.62,-.18],LLL:[1.44,-.95,.36]};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export const lobeRoutes=Object.fromEntries(Object.entries(lobeTargets).map(([lobe,target])=>{
  const keys=Object.keys(segments).filter(key=>segments[key].lobe===lobe);
  return [lobe,keys.reduce((best,key)=>distance(routes[key].at(-1),target)<distance(routes[best].at(-1),target)?key:best)];
}));

// Keep each lobe's demonstration point within forceps reach of its route by
// drawing it towards the nearest route point.
for(const [lobe,target] of Object.entries(lobeTargets)){
  const route=routes[lobeRoutes[lobe]];
  const near=route.reduce((best,p)=>distance(p,target)<distance(best,target)?p:best);
  const gap=distance(near,target),limit=.2;
  if(gap>limit)lobeTargets[lobe]=near.map((v,i)=>+(v+(target[i]-v)*limit/gap).toFixed(3));
}

// Lymph node demonstration sites sit beside the traced trachea and carina.
const carina=trachea.at(-1);
const paratracheal=trachea.reduce((best,p)=>Math.abs(p[1]-1.25)<Math.abs(best[1]-1.25)?p:best);
export const airway={trachea};
export const fixedTargets={
  ...lobeTargets,
  TR:[paratracheal[0]-.3,paratracheal[1],paratracheal[2]],
  SC:[carina[0],carina[1]-.3,carina[2]-.06],
  ...Object.fromEntries(Object.entries(routes).map(([key,points])=>[key,points.at(-1)]))
};

export function routeSections(key){
  const route=routes[key]||routes[lobeRoutes[key]];
  return route?[route]:null;
}
