/** Schematic footprint from the user-supplied campus map.
 * X increases away from Ziyou Road; +Z points toward Shih-Chuan Road.
 * Dimensions are illustrative, not surveyed. Every building stays orthogonal.
 */
export const HOSPITAL_LAYOUT={
 buildings:[
  {id:'E',x:-2.30,z:-3.36,width:2.80,depth:.82,height:5.05,tall:true},
  {id:'A',x:-2.30,z:-1.50,width:2.80,depth:.82,height:5.05,tall:true},
  {id:'H_LINK',x:-2.30,z:-2.43,width:.66,depth:1.08,height:5.05,tall:true},
  {id:'B',x:-1.30,z:.0,width:1.48,depth:1.58,height:3.05,tall:false},
  {id:'C',x:.55,z:.02,width:1.62,depth:2.12,height:3.05,tall:false},
  {id:'W',x:2.25,z:-1.21,width:1.30,depth:1.44,height:2.72,tall:false},
  {id:'S',x:2.66,z:.45,width:2.08,depth:.97,height:1.72,tall:false},
  {id:'FRONT',x:2.18,z:1.12,width:3.38,depth:.62,height:.96,tall:false},
  {id:'T',x:3.62,z:.28,width:.86,depth:2.20,height:.96,tall:false},
 ],
 monument:{x:-3.03,z:3.15,radius:.83,height:.87,yaw:-Math.PI/4},
};
