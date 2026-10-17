import * as THREE from 'three';
import { CONFIG } from './config.ts';
import {HOSPITAL_LAYOUT} from './hospital-layout.ts';
type Block={p:[number,number,number];s:[number,number,number];c:string;r?:number};
function noise(x:number,y:number,z:number){const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);}
function shade(c:string,n:number){return new THREE.Color(c).multiplyScalar(n).getStyle();}
// A 44-triangle chamfered cube (six faces, twelve edges, eight corners).
// The stock rounded cube subdivides all faces; these tiny voxels need only a bevel.
function bevelCube(){
 const points:number[]=[],normals:number[]=[],o=.5,r=.475;
 function polygon(vertices:number[][]){const a=new THREE.Vector3(...vertices[0] as [number,number,number]),b=new THREE.Vector3(...vertices[1] as [number,number,number]),c=new THREE.Vector3(...vertices[2] as [number,number,number]);const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),center=new THREE.Vector3();vertices.forEach(v=>center.add(new THREE.Vector3(...v as [number,number,number])));if(normal.dot(center)<0){vertices.reverse();normal.negate();}for(let j=1;j<vertices.length-1;j++)for(const v of [vertices[0],vertices[j],vertices[j+1]]){points.push(...v);normals.push(normal.x,normal.y,normal.z);}}
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const u=(axis+1)%3,v=(axis+2)%3;polygon([[-r,-r],[r,-r],[r,r],[-r,r]].map(([x,y])=>{const p=[0,0,0];p[axis]=sign*o;p[u]=x;p[v]=y;return p;}));}
 for(let along=0;along<3;along++)for(const s of [-1,1])for(const t of [-1,1]){const u=(along+1)%3,v=(along+2)%3;polygon([[-r,o,r],[r,o,r],[r,r,o],[-r,r,o]].map(([x,y,z])=>{const p=[0,0,0];p[along]=x;p[u]=s*y;p[v]=t*z;return p;}));}
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])polygon([[x*o,y*r,z*r],[x*r,y*o,z*r],[x*r,y*r,z*o]]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return geometry;
}
function instances(blocks:Block[],options:{shadow?:boolean;bevel?:boolean;emissive?:boolean}={}){
 const mat=new THREE.MeshStandardMaterial({roughness:options.bevel?.80:.91,metalness:0,...(options.emissive?{emissive:'#ffd58c',emissiveIntensity:1.5}:{})});
 const geometry=options.bevel?bevelCube():new THREE.BoxGeometry(1,1,1);
 const mesh=new THREE.InstancedMesh(geometry,mat,blocks.length),o=new THREE.Object3D();
 blocks.forEach((b,i)=>{o.position.set(...b.p);o.rotation.y=b.r??0;o.scale.set(...b.s);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,new THREE.Color(b.c));});
 mesh.castShadow=options.shadow??true;mesh.receiveShadow=!options.emissive;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();return mesh;
}
export function makeLung(){
 const group=new THREE.Group(),blocks:Block[]=[],v=CONFIG.lung.voxelSize;
 // Tapered apices and broad lower lobes follow the supplied voxel reference.
 const inside=(x:number,y:number,z:number)=>{const side=x<0?-1:1,ny=(y+.04)/1.72,center=side*(1.09-.26*ny),nx=(x-center)/(.93*(1-.22*ny)),nz=z/(.69*(1-.10*ny));if(nx*nx+ny*ny+nz*nz>1)return false;if(side===1&&x<.38&&y<-.15&&y>-.7&&z>.15)return false;return true;};
 const rx=Math.ceil(2.25/v),ry=Math.ceil(1.8/v),rz=Math.ceil(.8/v),neighbors=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 for(let ix=-rx;ix<=rx;ix++)for(let iy=-ry;iy<=ry;iy++)for(let iz=-rz;iz<=rz;iz++){
  const x=ix*v,y=iy*v,z=iz*v;if(!inside(x,y,z)||neighbors.every(([a,b,c])=>inside(x+a*v,y+b*v,z+c*v)))continue;
  const coral=new THREE.Color('#f47d78').lerp(new THREE.Color('#ffafa0'),Math.max(0,Math.min(1,(y+1.7)/3.4))*.55);const color=coral.multiplyScalar(.92+noise(ix,iy,iz)*.15).getStyle();
  blocks.push({p:[x,y,z],s:[v*.99,v*.99,v*.99],c:color});
 }
 const pink=instances(blocks,{bevel:true});group.add(pink);
 const airway:Block[]=[],seen=new Set<string>();
 function branch(a:[number,number,number],b:[number,number,number],width=1){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),steps=Math.ceil(start.distanceTo(end)/(v*.45));for(let i=0;i<=steps;i++){const p=start.clone().lerp(end,i/steps);p.x=Math.round(p.x/v)*v;p.y=Math.round(p.y/v)*v;p.z=Math.round(p.z/v)*v;const key=p.toArray().join(',');if(seen.has(key))continue;seen.add(key);airway.push({p:[p.x,p.y,p.z],s:[v*width,v*.98,v*width],c:i%3?'#fff0d9':'#f4dec4'});}}
 branch([0,.43,.83],[0,2.42,.83],1.35);
 airway.push({p:[0,2.5,.83],s:[v*2.4,v*1.2,v*2.3],c:'#ffe8bf'},{p:[0,2.62,.83],s:[v*1.5,v*.65,v*1.5],c:'#f4a394'});
 for(const s of [-1,1]){
  branch([0,.43,.83],[s*.61,.12,.85],1.25);branch([s*.61,.12,.85],[s*1.08,-.13,.85],1.15);branch([s*1.08,-.13,.85],[s*1.49,-.30,.63],1.0);
  branch([s*.61,.12,.85],[s*.73,-.54,.86],1.15);branch([s*.73,-.54,.86],[s*1.03,-1.09,.69],1.0);branch([s*1.03,-1.09,.69],[s*1.24,-1.23,.60],.8);
  branch([s*.73,-.54,.86],[s*.38,-.88,.72],.95);branch([s*.38,-.88,.72],[s*.38,-1.19,.64],.85);
  branch([s*.61,.12,.85],[s*.98,.63,.85],1.02);branch([s*.98,.63,.85],[s*1.27,.84,.62],.92);branch([s*1.27,.84,.62],[s*1.35,1.02,.53],.82);
 }
 // Seat the airway tree in the space between the lungs. The lateral branches
 // enter the lung volume instead of sitting on its anterior surface.
 for(const block of airway)block.p[2]-=.78;
 group.add(instances(airway,{bevel:true}));
 const decoration:Block[]=[];for(let i=0;i<CONFIG.lung.decorations;i++){const a=i*2.39996,r=2.08+(i%3)*.18;decoration.push({p:[Math.cos(a)*r,-1.55+i/CONFIG.lung.decorations*3.5,Math.sin(a)*.4],s:[v*.9,v*.9,v*.9],c:i%2?'#f59487':'#f7a79a'});}
 const particles=instances(decoration,{shadow:false,bevel:true});group.add(particles);return{group,pink,particles,voxelCount:blocks.length+airway.length};
}
export function makeHospital(){
 const group=new THREE.Group(),structures=new THREE.Group(),ground:Block[]=[],art:Block[]=[],lamps:Block[]=[];
 const put=(a:Block[],x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>a.push({p:[x,y,z],s:[w,h,d],c});
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>put(art,x,y,z,w,h,d,c);
 // Entire site rebuilt from the supplied map: roads meet along west and south edges.
 put(ground,0,-.24,0,10.5,.62,10.5,'#af9678');
 for(let x=-5.1;x<=5.1;x+=.3)for(let z=-5.1;z<=5.1;z+=.3){
  const road=x< -4.10||z>3.94;
  const garden=!road&&(z>2.45||x>4.45||z< -4.25);
  if(x>1.6&&x<2.9&&z>2.12&&z<3.45)continue;
  put(ground,x,.10,z,.294,.18,.294,road?'#737975':garden?shade('#8ba44d',.94+noise(x,z,2)*.10):'#d9cfba');
 }
 for(let t=-5.1;t<=5.1;t+=.3)for(let r=0;r<3;r++)for(const side of [-1,1]){
  const c=shade('#b49978',.91+noise(t,r,side)*.19);
  put(ground,t,-.08-r*.18,side*5.23,.295,.175,.10,c);put(ground,side*5.23,-.08-r*.18,t,.10,.175,.295,c);
 }
 // Distinct rectangular footprints, never an inferred W-shaped facade.
 for(const b of HOSPITAL_LAYOUT.buildings){
  const wall=b.tall?'#d3b095':b.id==='S'||b.id==='T'||b.id==='FRONT'?'#d6b3a0':'#dec19c';
  box(b.x,b.height/2+.2,b.z,b.width,b.height,b.depth,wall);
  box(b.x,b.height+.24,b.z,b.width+.06,.12,b.depth+.06,'#e5cfad');
  for(let y=.48;y<b.height-.1;y+=b.tall?.29:.33){
   for(const sign of [-1,1]){
    for(let xx=-b.width/2+.19;xx<b.width/2-.05;xx+=.25)box(b.x+xx,y,b.z+sign*(b.depth/2+.018),.125,.145,.03,'#4b6264');
    for(let zz=-b.depth/2+.18;zz<b.depth/2-.05;zz+=.25)box(b.x+sign*(b.width/2+.018),y,b.z+zz,.03,.145,.13,'#4b6264');
    if(!b.tall)box(b.x,y+.115,b.z+sign*(b.depth/2+.04),b.width,.055,.085,'#eed3aa');
   }
  }
  // Small rooftop service box; low roof clutter leaves the footprint readable.
  if(b.id!=='FRONT'&&b.id!=='T')box(b.x+.12,b.height+.37,b.z-.12,.34,.18,.30,'#d2c4ad');
 }
 // Equal-height parallel ward slabs joined at their centres: H in plan.
 // Lower connections follow map adjacency; they do not merge all wards into a wall.
 box(-1.30,.69,-.79,.42,.98,.52,'#d6b79b');
 box(-.39,.66,.10,.40,.92,.52,'#d6b79b');
 box(1.59,.61,.40,.44,.82,.47,'#d6b79b');
 // Entrance belongs at the A/B side, opening toward the two bordering roads.
 box(-1.82,.49,1.01,1.50,.61,.50,'#d3ac98');
 box(-1.82,.86,1.30,1.67,.12,.72,'#efd3a6');
 for(const x of [-2.51,-1.13])box(x,.49,1.57,.08,.70,.08,'#c7af8f');
 // Blue and yellow facade panels, unlettered per the user request.
 for(const [x,z,h,c] of [[-.72,.817,2.65,'#416c94'],[2.74,-.474,2.30,'#dbb142']] as const){
  box(x,h/2+.38,z,.28,h,.055,c);
  for(let i=0;i<6;i++)box(x,.65+i*(h-.4)/6,z+.033,.08,.11,.018,c==='#416c94'?'#dce2d7':'#dc8c88');
 }
 // ER forecourt stays open between the west road and the L-shaped low frontage.
 for(let x=-3.80;x<2.9;x+=.18)for(let z=1.62;z<3.68;z+=.18){if(x>1.55&&x<2.98&&z<3.45)continue;put(ground,x,.205,z,.176,.025,.176,noise(x,z,8)>.5?'#e8deca':'#e2d7c0');}
 // Short approach lane and a red-edged emergency canopy face the forecourt.
 box(-1.75,.82,1.42,1.62,.11,.79,'#e4d0b4');
 box(-1.75,.80,1.83,1.62,.075,.06,'#aa6957');
 for(const x of [-2.40,-1.10])box(x,.51,1.76,.065,.56,.065,'#c8b596');
 // Photographed main entrance: solid ochre fascia above a recessed glazed lobby.
 box(.55,1.23,1.105,1.66,.65,.12,'#c2a27b');
 box(.55,.54,1.135,1.39,.49,.04,'#455b57');
 for(const x of [-.03,.37,.77,1.17])box(x,.54,1.17,.035,.49,.045,'#c1b6a0');
 // Planted foreground and a descending access lane beside it, per the aerial close-up.
 for(let x=.38;x<1.25;x+=.18)for(let z=2.89;z<3.45;z+=.18)box(x,.265,z,.175,.11,.175,'#8d9f53');
 for(let x=.38;x<1.30;x+=.18)box(x,.34,2.87,.175,.15,.12,'#b7b091');
 for(let i=0;i<13;i++){const z=3.43-i*.10;box(2.23,.213-i*.010,z,1.18,.027,.105,'#74796f');}
 for(const x of [1.55,2.91])box(x,.38,2.80,.12,.36,1.42,'#baa28a');
 box(2.23,.42,2.14,1.40,.54,.13,'#b69d85');box(2.23,.26,2.219,1.11,.23,.024,'#3f4a42');
 // The entrance stone faces diagonally toward the street corner.
 const m=HOSPITAL_LAYOUT.monument,start=art.length;
 for(let y=.22;y<m.height;y+=.11){const half=m.radius*Math.sqrt(Math.max(0,1-((y-.15)/m.height)**2));for(let x=-half;x<half;x+=.11)box(m.x+x,y,m.z,.108,.108,.35,'#e6d2ae');}
 box(m.x,.20,m.z,1.96,.12,.60,'#d9c9aa');
 for(let i=start;i<art.length;i++){const b=art[i],x=b.p[0]-m.x,z=b.p[2]-m.z;b.p[0]=m.x+x*Math.cos(m.yaw)+z*Math.sin(m.yaw);b.p[2]=m.z-x*Math.sin(m.yaw)+z*Math.cos(m.yaw);b.r=m.yaw;}
 // Parking bays west of B; service access remains between the separate buildings.
 for(let z=-3.8;z<-1.8;z+=.38){put(ground,-3.45,.205,z,.69,.015,.026,'#f0e6ce');}
 for(let x=-4.8;x<5;x+=.8)put(ground,x,.21,4.65,.38,.015,.035,'#e9dcbf');
 for(let z=-4.8;z<4.5;z+=.8)put(ground,-4.65,.21,z,.035,.015,.38,'#e9dcbf');
 for(let x=-3.8;x<-2.3;x+=.20)put(ground,x,.215,4.08,.10,.015,.52,'#f3ead4');
 function car(x:number,z:number,c:string){box(x,.38,z,.51,.23,.26,c);box(x,.54,z,.29,.14,.24,c);box(x,.57,z+.13,.19,.08,.02,'#829b9a');for(const dx of [-.17,.17])for(const dz of [-.14,.14])box(x+dx,.27,z+dz,.09,.10,.04,'#535852');}
 car(-3.43,-3.2,'#eee6d6');car(-3.43,-2.45,'#e4d7b9');car(-2.0,2.26,'#f1eee1');box(-2.0,.59,2.405,.15,.055,.016,'#b75f52');box(-2.0,.59,2.405,.055,.15,.018,'#b75f52');car(.2,4.35,'#82918c');car(3.4,4.8,'#e9dfc6');car(-4.6,-.5,'#bcb5a0');
 function tree(x:number,z:number,i:number){box(x,.62,z,.12,.90,.12,'#a28255');for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<4;dy++){if(dx*dx+dz*dz+(dy-1.3)**2>6.3||noise(dx+i,dy,dz)<.14)continue;box(x+dx*.16,.91+dy*.16,z+dz*.16,.157,.157,.157,shade('#78a044',.80+noise(dx+i,dy,dz)*.33));}}
 [[-3.82,-3.6],[-3.86,-1.8],[-3.88,.8],[3.5,3.60],[4.4,3.70],[4.5,3.2],[4.6,.2],[4.5,-2.5],[1,-4.4],[-1,-4.4]].forEach(([x,z],i)=>tree(x,z,i));
 for(let x=-3.8;x<4.8;x+=.22)for(const z of [3.70,-4.55]){if(z>3&&x<1.5)continue;box(x,.29,z,.215,.24,.22,shade('#8ca64b',.9+noise(x,z,1)*.15));}
 for(const [x,z] of [[-2.9,2.5],[-.8,3.25],[1.7,3.55],[4,3.5],[-3.9,-.1]]){box(x,.51,z,.06,.60,.06,'#ad9672');put(lamps,x,.85,z,.18,.20,.18,'#ffe1a5');}
 group.add(instances(ground));structures.add(instances(art));structures.add(instances(lamps,{shadow:false,emissive:true}));group.add(structures);group.scale.setScalar(CONFIG.hospital.scale);group.position.y=CONFIG.hospital.groundY;
 return{group,structures,blockCount:ground.length+art.length+lamps.length};
}
