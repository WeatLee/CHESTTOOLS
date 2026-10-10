// Schematic bronchial centerlines in patient coordinates: right is negative x.
// The same paths drive the visible airway, fixed lesion sites and bronchoscope.
export const airway = {
  trachea:[[0,2,.04],[0,1.38,.04],[0,.72,.04]],
  rightMain:[[0,.72,.04],[-.25,.53,.09],[-.50,.36,.14],[-.73,.08,.18],[-.84,-.07,.20]],
  leftMain:[[0,.72,.04],[.32,.48,.07],[.72,.18,.12]],
  RUL:[[-.50,.36,.14],[-.72,.61,.22],[-.86,.88,.25]],
  RML:[[-.73,.08,.18],[-.97,-.02,.31],[-1.18,-.17,.42],[-1.33,-.30,.47]],
  RLL:[[-.84,-.07,.20],[-1.02,-.58,.24],[-1.16,-1.03,.26]],
  LUL:[[.72,.18,.12],[.77,.40,-.10],[.78,.58,-.28]],
  LLL:[[.72,.18,.12],[.92,0,.17],[1.19,-.45,.24],[1.35,-.85,.27]]
};

// at is the exact control point on the parent lobar branch. Combined left
// segments reflect a common 8-segment teaching convention; variants exist.
export const segments = {
  RS1: {lobe:'RUL',at:2,label:'S1 頂段',points:[[-.86,.88,.25],[-.98,1.13,.22],[-1.06,1.31,.17]]},
  RS2: {lobe:'RUL',at:1,label:'S2 後段',points:[[-.72,.61,.22],[-.91,.79,-.04],[-1.08,.94,-.25]]},
  RS3: {lobe:'RUL',at:2,label:'S3 前段',points:[[-.86,.88,.25],[-1.06,.78,.39],[-1.24,.68,.48]]},
  RS4: {lobe:'RML',at:3,label:'S4 外側段',points:[[-1.33,-.30,.47],[-1.50,-.37,.43],[-1.64,-.45,.35]]},
  RS5: {lobe:'RML',at:2,label:'S5 內側段',points:[[-1.18,-.17,.42],[-1.12,-.38,.48],[-1.04,-.57,.49]]},
  RS6: {lobe:'RLL',at:1,label:'S6 上段',points:[[-1.02,-.58,.24],[-1.20,-.47,-.04],[-1.34,-.41,-.31]]},
  RS7: {lobe:'RLL',at:2,label:'S7 內側基底段',points:[[-1.16,-1.03,.26],[-1.07,-1.20,.16],[-1.00,-1.32,.03]]},
  RS8: {lobe:'RLL',at:2,label:'S8 前基底段',points:[[-1.16,-1.03,.26],[-1.28,-1.23,.37],[-1.38,-1.36,.47]]},
  RS9: {lobe:'RLL',at:2,label:'S9 外側基底段',points:[[-1.16,-1.03,.26],[-1.42,-1.20,.18],[-1.61,-1.32,.13]]},
  RS10:{lobe:'RLL',at:2,label:'S10 後基底段',points:[[-1.16,-1.03,.26],[-1.29,-1.21,-.01],[-1.39,-1.34,-.29]]},
  LS12:{lobe:'LUL',at:2,label:'S1+2 尖後段',points:[[.78,.58,-.28],[.94,.91,-.31],[1.08,1.18,-.26]]},
  LS3: {lobe:'LUL',at:1,label:'S3 前段',points:[[.77,.40,-.10],[1.01,.65,.17],[1.22,.77,.35]]},
  LS4: {lobe:'LUL',at:1,label:'S4 上舌段',points:[[.77,.40,-.10],[1.05,.09,.12],[1.25,-.10,.35]]},
  LS5: {lobe:'LUL',at:1,label:'S5 下舌段',points:[[.77,.40,-.10],[1.00,-.23,.09],[1.18,-.48,.31]]},
  LS6: {lobe:'LLL',at:1,label:'S6 上段',points:[[.92,0,.17],[1.13,-.31,-.09],[1.31,-.43,-.35]]},
  LS78:{lobe:'LLL',at:3,label:'S7+8 前內側基底段',points:[[1.35,-.85,.27],[1.30,-1.10,.40],[1.24,-1.31,.43]]},
  LS9: {lobe:'LLL',at:3,label:'S9 外側基底段',points:[[1.35,-.85,.27],[1.54,-1.11,.20],[1.66,-1.31,.13]]},
  LS10:{lobe:'LLL',at:3,label:'S10 後基底段',points:[[1.35,-.85,.27],[1.45,-1.11,-.03],[1.50,-1.30,-.28]]}
};

export const lobeNames={RUL:'右上葉',RML:'右中葉',RLL:'右下葉',LUL:'左上葉',LLL:'左下葉'};
export const segmentNames=Object.fromEntries(Object.entries(segments).map(([key,value])=>[key,`${lobeNames[value.lobe]} ${value.label}`]));
export const fixedTargets={
  RUL:[-.99,.83,.34],RML:[-1.39,-.39,.49],RLL:[-1.29,-1.10,.34],
  LUL:[.96,.62,-.18],LLL:[1.44,-.95,.36],
  TR:[-.32,1.25,.04],SC:[0,.39,-.20],
  ...Object.fromEntries(Object.entries(segments).map(([key,{points}])=>[key,points.at(-1)]))
};

export function routeSections(key){
  const segment=segments[key];
  const lobe=segment?.lobe||key;
  const right=lobe[0]==='R';
  const main=right?airway.rightMain:airway.leftMain;
  const mainStop={RUL:3,RML:4,RLL:5,LUL:3,LLL:3}[lobe];
  if(!mainStop)return null;
  const sections=[airway.trachea,main.slice(0,mainStop),segment?airway[lobe].slice(0,segment.at+1):airway[lobe]];
  if(segment)sections.push(segment.points);
  return sections;
}
