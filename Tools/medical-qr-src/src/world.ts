import * as THREE from 'three';
import{CONFIG}from './config.ts';
import{makeHospital,makeLung}from './geometry.ts';
import{captureBlocks,makePhysicalQr,makeReliefSampler}from './physical-qr.ts';
export function createWorld(host:HTMLElement,onSubject:()=>void,onReady:()=>void){
 const mobile=()=>innerWidth<=720,scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-7,7,6,-6,.1,80);camera.position.set(...CONFIG.scene.cameraPosition);camera.lookAt(...CONFIG.scene.target);
 const frontPosition=camera.position.clone(),frontQuaternion=camera.quaternion.clone();
 const topCamera=new THREE.PerspectiveCamera();topCamera.position.set(0,18,0);topCamera.up.set(0,0,-1);topCamera.lookAt(0,CONFIG.interaction.qrPlaneY,0);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile()?CONFIG.scene.mobilePixelRatioCap:CONFIG.scene.pixelRatioCap));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;host.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#fff1e8','#c29f91',1.6));
 const sun=new THREE.DirectionalLight('#fff0dc',2.7);sun.position.set(-3,10,7);sun.castShadow=true;sun.shadow.mapSize.setScalar(CONFIG.scene.shadowMapSize);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
 const fill=new THREE.DirectionalLight('#fff1eb',1.20);fill.position.set(6,4,-5);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.08}));ground.rotation.x=-Math.PI/2;ground.position.y=CONFIG.hospital.groundY-.56;ground.receiveShadow=true;scene.add(ground);
 // Lightweight depth separation: nine taps, no image background and no bloom.
 // Disabled on narrow/mobile viewports and completely bypassed for QR accuracy.
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,samples:4});
 target.texture.colorSpace=THREE.SRGBColorSpace;target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const postMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:target.texture},depthMap:{value:target.depthTexture},pixel:{value:new THREE.Vector2(1,1)},nearClip:{value:camera.near},farClip:{value:camera.far},focus:{value:17.0},amount:{value:CONFIG.hospital.blurAmount}},
 vertexShader:`varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
 fragmentShader:`uniform sampler2D image;uniform sampler2D depthMap;uniform vec2 pixel;uniform float nearClip;uniform float farClip;uniform float focus;uniform float amount;varying vec2 vUV;
 void main(){float z=mix(nearClip,farClip,texture2D(depthMap,vUV).x);float blur=smoothstep(focus+0.45,focus+4.5,z)*amount;vec2 d=pixel*blur;vec4 c=texture2D(image,vUV)*0.20;c+=texture2D(image,vUV+vec2(d.x,0.0))*0.12;c+=texture2D(image,vUV-vec2(d.x,0.0))*0.12;c+=texture2D(image,vUV+vec2(0.0,d.y))*0.12;c+=texture2D(image,vUV-vec2(0.0,d.y))*0.12;c+=texture2D(image,vUV+d)*0.08;c+=texture2D(image,vUV-d)*0.08;c+=texture2D(image,vUV+vec2(d.x,-d.y))*0.08;c+=texture2D(image,vUV+vec2(-d.x,d.y))*0.08;gl_FragColor=c;
 #include <colorspace_fragment>
 }`});
 const postQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial);postScene.add(postQuad);
 const sourceHospital=makeHospital(),sourceLung=makeLung();
 sourceLung.group.position.set(.1,CONFIG.lung.centerY,0);sourceLung.group.scale.setScalar(CONFIG.lung.scale);sourceLung.group.rotation.y=CONFIG.lung.initialYaw;
 const hospitalSources=captureBlocks(sourceHospital.group),lungSources=captureBlocks(sourceLung.group);
 const relief=makeReliefSampler([...hospitalSources,...lungSources]);
 for(const root of [sourceHospital.group,sourceLung.group])root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
 let physicalHospital=makePhysicalQr(hospitalSources,null,true,relief),physicalLung=makePhysicalQr(lungSources,null,false,relief);
 const hospital={group:physicalHospital.group,blockCount:physicalHospital.count},lung={group:physicalLung.group,voxelCount:physicalLung.count};
 scene.add(hospital.group,lung.group);
 let qrValid=false,alignFrom={yaw:0,pitch:CONFIG.lung.displayTilt,y:CONFIG.lung.centerY};
 const primaryStats={calls:0,triangles:0};
 let mode=0,qrMode=false,transitioning=false,reduced=false,visible=true,disposed=false,dragging=false,yaw=0,pitch=CONFIG.lung.displayTilt,dirty=true,aspect=1;
 let transition:{start:number;from:number;to:number;duration:number;done:()=>void}|undefined;
 let origin={x:0,y:0},last={x:0,y:0},moved=false;
 renderer.domElement.style.cursor='pointer';
 renderer.domElement.addEventListener('pointerdown',e=>{if(transitioning||e.button!==0||!e.isPrimary)return;dragging=true;moved=false;origin=last={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>5)moved=true;if(moved&&!qrMode){yaw+=dx*.008;pitch=THREE.MathUtils.clamp(pitch+dy*.004,-.4,.4);lung.group.rotation.set(pitch,yaw,0);dirty=true;}});
 // The whole stage is a tap target, including empty space and the hospital.
 // Dragging rotates the lung without triggering the camera on release.
 renderer.domElement.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(!moved&&!transitioning)onSubject();});
 renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;});
 function applyMode(){
  const normalHeight=mobile()?CONFIG.scene.mobileViewHeight:CONFIG.scene.viewHeight,buffer=renderer.getDrawingBufferSize(new THREE.Vector2()),pixels=Math.max(1,Math.floor(Math.min(buffer.x,buffer.y)/(physicalHospital.moduleCount+CONFIG.qr.quietZone*2+8))),topHeight=physicalHospital.step*buffer.y/pixels,h=THREE.MathUtils.lerp(normalHeight,topHeight,mode);camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.position.copy(frontPosition).lerp(topCamera.position,mode);camera.quaternion.copy(frontQuaternion).slerp(topCamera.quaternion,mode);camera.updateProjectionMatrix();
  // Cubes keep their face colours throughout. Settle the rotating lung onto
  // its calibrated grid while the camera rises; geometry never flattens or dissolves.
  const settle=THREE.MathUtils.smoothstep(mode,0,.55);
  lung.group.rotation.set(alignFrom.pitch*(1-settle),alignFrom.yaw*(1-settle),0);
  lung.group.position.y=THREE.MathUtils.lerp(alignFrom.y,CONFIG.lung.centerY,settle);
  dirty=true;
 }
 function resize(){const r=host.getBoundingClientRect();aspect=r.width/r.height;renderer.setSize(r.width,r.height);const buffer=renderer.getDrawingBufferSize(new THREE.Vector2());target.setSize(buffer.x,buffer.y);postMaterial.uniforms.pixel.value.set(1/buffer.x,1/buffer.y);applyMode();}const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const frames:number[]=[],clock=new THREE.Clock();let lastFrame=performance.now(),lastShadow=0,ready=false;
 function animate(now:number){if(disposed)return;requestAnimationFrame(animate);if(!visible)return;const t=clock.getElapsedTime();
  if(transition){const progress=Math.min(1,(now-transition.start)/transition.duration),ease=progress*progress*(3-2*progress);mode=THREE.MathUtils.lerp(transition.from,transition.to,ease);applyMode();if(progress===1){const done=transition.done;transition=undefined;transitioning=false;qrMode=mode===1;done();}}
  if(!qrMode&&!transitioning&&!reduced&&!dragging){yaw+=CONFIG.lung.rotationSpeed*THREE.MathUtils.clamp((now-lastFrame)/1000,0,.05);lung.group.rotation.set(pitch,yaw,0);lung.group.position.y=CONFIG.lung.centerY+Math.sin(t*.9)*CONFIG.lung.hoverAmplitude;dirty=true;}
  const elapsed=now-lastFrame;lastFrame=now;if(dirty){if(now-lastShadow>CONFIG.scene.shadowRefreshMs){renderer.shadowMap.needsUpdate=true;lastShadow=now;}if(mode===0&&!mobile()&&CONFIG.hospital.blurAmount>0){const direction=camera.getWorldDirection(new THREE.Vector3());postMaterial.uniforms.focus.value=lung.group.position.clone().sub(camera.position).dot(direction);renderer.setRenderTarget(target);renderer.render(scene,camera);primaryStats.calls=renderer.info.render.calls;primaryStats.triangles=renderer.info.render.triangles;renderer.setRenderTarget(null);renderer.render(postScene,postCamera);}else{renderer.setRenderTarget(null);renderer.render(scene,camera);primaryStats.calls=renderer.info.render.calls;primaryStats.triangles=renderer.info.render.triangles;}dirty=false;if(ready){frames.push(elapsed);if(frames.length>240)frames.shift();}if(!ready){ready=true;onReady();}}
 }
 requestAnimationFrame(animate);const visibility=()=>{visible=!document.hidden;lastFrame=performance.now();dirty=true;};document.addEventListener('visibilitychange',visibility);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('scene-error')!.hidden=false;});
 return{
  setQrCanvas(canvas:HTMLCanvasElement|null,url:string|null=null){
   qrValid=Boolean(canvas&&url);scene.remove(hospital.group,lung.group);physicalHospital.dispose();physicalLung.dispose();
   physicalHospital=makePhysicalQr(hospitalSources,qrValid?url:null,true,relief);physicalLung=makePhysicalQr(lungSources,qrValid?url:null,false,relief);
   hospital.group=physicalHospital.group;hospital.blockCount=physicalHospital.count;lung.group=physicalLung.group;lung.voxelCount=physicalLung.count;
   scene.add(hospital.group,lung.group);renderer.shadowMap.needsUpdate=true;applyMode();
  },
  setQrMode(value:boolean){qrMode=value;mode=value?1:0;applyMode();if(!value){yaw=alignFrom.yaw;pitch=alignFrom.pitch;}},
  transitionToQr(value:boolean,done:()=>void){if(transitioning)return;dragging=false;if(value){yaw=THREE.MathUtils.euclideanModulo(yaw+Math.PI,Math.PI*2)-Math.PI;alignFrom={yaw,pitch,y:lung.group.position.y};}transitioning=true;if(reduced){mode=value?1:0;qrMode=value;transitioning=false;applyMode();done();return;}transition={start:performance.now(),from:mode,to:value?1:0,duration:CONFIG.interaction.transitionDuration*1000,done};},
  setReduced(value:boolean){reduced=value;if(value){lung.group.position.y=CONFIG.lung.centerY;applyMode();}dirty=true;},
  stats(){const sorted=[...frames].sort((a,b)=>a-b);return{drawCalls:primaryStats.calls,triangles:primaryStats.triangles,postprocessingPasses:mode===0&&!mobile()&&CONFIG.hospital.blurAmount>0?1:0,lungVoxels:lung.voxelCount,hospitalBlocks:hospital.blockCount,frameSamples:frames.length,medianFrameMs:sorted.length?sorted[Math.floor(sorted.length/2)]:null,p95FrameMs:sorted.length?sorted[Math.floor(sorted.length*.95)]:null,canvas:{width:renderer.domElement.width,height:renderer.domElement.height},qrMode,reduced,cameraMode:mode,qrConstruction:"physical-cube-top-faces",qrSurfaceStyle:"source-colours-and-height-relief",qrValid,qrModules:physicalHospital.moduleCount,qrModuleSize:physicalHospital.step,qrTextureCount:0,qrPlaneCount:0,qrMarkFaces:physicalHospital.markFaces+physicalLung.markFaces,lungTilt:lung.group.rotation.x,lungPose:{y:lung.group.position.y,scaleY:lung.group.scale.y,yaw:lung.group.rotation.y}};},
  dispose(){disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});target.dispose();target.depthTexture?.dispose();postMaterial.dispose();postQuad.geometry.dispose();renderer.dispose();},
 };
}
