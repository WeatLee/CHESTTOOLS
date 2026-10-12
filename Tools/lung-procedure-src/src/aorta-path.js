// Centreline of the seamless aorta drawn in main.js (scene units), shared with
// the lymph node layout and the mesh build so they agree on where it lies.
export const aortaPoints=[
  [.23,-.45,.17],[.23,0,.18],[.08,.30,.30],[.06,.60,.24],
  [.08,.84,.15],[.25,1.00,-.12],[.37,.82,-.43],[.32,.59,-.62],
  [.31,.28,-.73],[.29,0,-.70],[.17,-.50,-.53],[.17,-1.00,-.27],[.14,-1.55,-.12]
];
// Radius along the curve (t = 0 at the root): the descending aorta narrows.
export function aortaRadius(t){
  const s=Math.max(0,Math.min(1,(t-.42)/.4));
  return .132-.033*s*s*(3-2*s);
}
