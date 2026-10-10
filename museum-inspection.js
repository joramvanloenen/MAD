// Orbitable close-up artwork viewer for MAD.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {artMesh} from './art-presentation.js?v=20261010-mixed6';
import {createVitrine,fitArtToVitrine} from './museum-vitrines.js';

export function makeArtworkInspector(holder){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xd9d8d1);
  const cam=new THREE.PerspectiveCamera(38,1,.05,100);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
  renderer.domElement.style.touchAction='none';
  holder.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb6a793,2.0));
  const spot=new THREE.SpotLight(0xfff2df,83,12,.6,.85,2);
  spot.position.set(-2.5,5,5);spot.target.position.set(0,0,0);
  scene.add(spot,spot.target);
  const key=new THREE.DirectionalLight(0xe8f3ff,1.3);
  key.position.set(5,3,-4);scene.add(key);
  const stage=new THREE.Group();scene.add(stage);
  let yaw=0,pitch=.10,radius=5.0,active=false;
  let down=null,last=0;
  function setCamera(){
    cam.position.set(
      radius*Math.sin(yaw)*Math.cos(pitch),
      radius*Math.sin(pitch),
      radius*Math.cos(yaw)*Math.cos(pitch)
    );
    cam.lookAt(0,0,0);
  }
  function clear(){
    for(const child of [...stage.children]){
      stage.remove(child);
      child.traverse?.(o=>{
        o.geometry?.dispose();
        const mats=Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{m?.map?.dispose();m?.dispose()});
      });
    }
  }
  function open(art,mounting='plinth'){
    clear();
    const wall=mounting==='wall',inVitrine=mounting==='vitrine';
    const artwork=artMesh(art,wall);
    stage.position.y=0;
    if(inVitrine){
      createVitrine(stage);
      fitArtToVitrine(artwork,art.scaleFactor||1);
      stage.position.y=-.96; // put the miniature inside the visible glass case
    }else if(wall){
      const wallMesh=new THREE.Mesh(
        new THREE.BoxGeometry(5,5,.3),
        new THREE.MeshStandardMaterial({color:0xf4f2eb,roughness:.95})
      );
      wallMesh.position.z=-.25;stage.add(wallMesh);
      artwork.position.z=.1;artwork.scale.setScalar(.94);
    }else{
      const ped=new THREE.Mesh(
        new THREE.BoxGeometry(2.7,.76,2.7),
        new THREE.MeshStandardMaterial({color:0xe5e4e0,roughness:.73})
      );
      ped.position.y=-1.58;stage.add(ped);
      artwork.scale.setScalar(.8);
      artwork.position.y=-.26;
    }
    stage.add(artwork);
    yaw=0;pitch=.1;radius=wall?6.1:inVitrine?3.7:5.0;
    setCamera();
    active=true;
  }
  renderer.domElement.addEventListener('pointerdown',e=>{
    down={x:e.clientX,y:e.clientY};
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!down)return;
    yaw+=(e.clientX-down.x)*.007;
    pitch=Math.max(-.9,Math.min(.9,pitch+(e.clientY-down.y)*.007));
    down={x:e.clientX,y:e.clientY};
    setCamera();
  });
  renderer.domElement.addEventListener('pointerup',()=>down=null);
  renderer.domElement.addEventListener('pointercancel',()=>down=null);
  renderer.domElement.addEventListener('wheel',e=>{
    e.preventDefault();radius=Math.max(2.0,Math.min(11,radius+e.deltaY*.006));setCamera();
  },{passive:false});
  function render(t){
    requestAnimationFrame(render);
    if(!active||!holder.isConnected||!holder.offsetWidth)return;
    if(t-last<28)return;last=t;
    const width=holder.clientWidth,height=holder.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);
    cam.aspect=width/height;cam.updateProjectionMatrix();
    renderer.render(scene,cam);
  }
  requestAnimationFrame(render);
  setCamera();
  return {open,close(){active=false},dispose(){clear();renderer.dispose()}};
}
