import {airway,fixedTargets,routeSections} from './airway-data.js';

// Large demonstration lesions need more room than the distal bronchial tips.
// Move the marker back along its own route as diameter grows, so the sphere
// stays inside the lung and the scope can still reach it.
function routeCore(key){
  const sections=routeSections(key);
  if(!sections)return null;
  const route=sections.flat().slice(airway.trachea.length);
  return route[Math.round((route.length-1)*.55)];
}

export function presetLesionPosition(key,size){
  const origin=fixedTargets[key];
  const core=routeCore(key);
  if(!core)return [...origin];
  const blend=Math.min(.84,Math.max(0,(size-1)/7*.84));
  return origin.map((coordinate,i)=>coordinate+(core[i]-coordinate)*blend);
}
