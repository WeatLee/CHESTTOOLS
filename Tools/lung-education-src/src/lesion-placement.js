import {fixedTargets,segments} from './airway-data.js';

// Large demonstration lesions need more room than the distal bronchial tips.
// Keep the selected segment, but move its marker toward the lobe interior as
// diameter increases so the sphere stays within the lung silhouette.
const lobeInterior={
  RUL:[-.78,.35,-.08],RML:[-.95,-.27,-.07],RLL:[-1.03,-.75,-.10],
  LUL:[.72,.35,-.08],LLL:[.95,-.75,-.10]
};

export function presetLesionPosition(key,size){
  const origin=fixedTargets[key];
  const core=lobeInterior[segments[key]?.lobe||key];
  if(!core)return [...origin];
  const blend=Math.min(.84,Math.max(0,(size-1)/7*.84));
  return origin.map((coordinate,i)=>coordinate+(core[i]-coordinate)*blend);
}
