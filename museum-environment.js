// MAD — contemporary gallery environment, no external texture assets.
// Built for the existing Three.js/WebGL museum and GitHub Pages.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const std=(c,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});
const mk=(w,h,d,material,x,y,z)=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=true;return o;
};
function woodTexture(depot=false){
  const c=document.createElement('canvas');c.width=1024;c.height=1024;
  const ctx=c.getContext('2d');
  ctx.fillStyle=depot?'#97988d':'#cbb092';ctx.fillRect(0,0,1024,1024);
  // Horizontal oak strips with fractional row offsets and fine longitudinal grain.
  let seed=39401;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const rowH=94;
  for(let y=0;y<1024;y+=rowH){
    const rowTint=rnd()-.5;let x=-300+(rnd()*200);
    while(x<1100){
      const width=240+Math.round(rnd()*250),n=rowTint+(rnd()-.5)*.24;
      const base=depot?[154,153,143]:[207,178,145];
      const factor=n*32;
      const rgb=base.map(v=>Math.max(0,Math.min(255,Math.round(v+factor))));
      ctx.fillStyle='rgb('+rgb.join(',')+')';
      ctx.fillRect(x+1,y+1,width-2,rowH-2);
      ctx.globalAlpha=.09;
      for(let j=0;j<25;j++){
        const gy=y+3+rnd()*(rowH-7);
        ctx.strokeStyle=rnd()>.5?'#563e27':'#fff6de';
        ctx.lineWidth=.4+rnd()*1.2;ctx.beginPath();
        ctx.moveTo(x+3,gy);ctx.bezierCurveTo(x+width*.35,gy+(rnd()-.5)*3,x+width*.7,gy+(rnd()-.5)*3,x+width-4,gy+(rnd()-.5)*2);ctx.stroke();
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='rgba(83,65,49,.18)';ctx.fillRect(x,y+rowH-1,width,1);
      ctx.fillRect(x+width-1,y,1,rowH);
      x+=width;
    }
  }
  const tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2.6,1.8);
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  return tex;
}
function titlePanel(text,w=3.6){
  const c=document.createElement('canvas');c.width=1024;c.height=190;
  const x=c.getContext('2d');
  x.clearRect(0,0,1024,190);x.font='700 66px Arial';x.textAlign='center';x.fillStyle='#252c2a';x.fillText(text,512,117);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w,w*190/1024),
    new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));
}
export function buildMuseumEnvironment(scene,room,{quality='high'}={}){
  const colliders=[], lights=[];
  const isDepot=room==='depot';
  const wall=std(isDepot?0xc8c9c3:0xf1f0ea,.97);
  const trim=std(isDepot?0x8c918e:0xdfdcd4,.74);
  const black=std(0x484e4b,.48,.32);
  const upholstery=std(0x2b2e2d,1);
  const timber=std(0xa97851,.73);
  const white=std(0xe6e4de,.85);
  const brushed=std(0x929895,.3,.66);
  const floorMat=isDepot
    // Real archive depots use smooth, light resin/concrete floors; the
    // galvanized sliding floor rails remain visible on top.
    ? new THREE.MeshStandardMaterial({color:0xd9dcd8,roughness:.48,metalness:.02})
    : new THREE.MeshStandardMaterial({map:woodTexture(false),roughness:.66,metalness:0});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(38.85,23.7),floorMat);
  floor.rotation.x=-Math.PI/2;floor.position.y=.004;floor.receiveShadow=true;
  scene.add(floor);

  // Flush wall skirting and ceiling shadow-gap details.
  for(const z of [-11.72,11.72]){
    scene.add(mk(38.4,.17,.09,trim,0,.105,z));
    scene.add(mk(38.4,.045,.09,black,0,7.69,z));
  }
  // West wall has continuous skirting; the east wall must have a REAL
  // 3.22 m gap where the recessed Depot door opens (Z -1.61 to +1.61).
  scene.add(mk(.09,.17,23.2,trim,-19.2,.105,0));
  for(const [zStart,zEnd] of [[-11.6,-1.61],[1.61,11.6]]){
    scene.add(mk(.09,.17,zEnd-zStart,trim,19.2,.105,(zStart+zEnd)/2));
  }
  // The ceiling trim is above the doorway and stays continuous.
  for(const x of [-19.2,19.2]){
    scene.add(mk(.09,.045,23.2,black,x,7.69,0));
  }

  if(!isDepot){
    // Two internal dividing partitions. Their broad central openings make
    // three contiguous galleries with sightlines through the complete museum.
    for(const x of [-6.5,7.5]){
      for(const [za,zb] of [[-11.8,-5.55],[5.55,11.8]]){
        const z=(za+zb)/2,len=zb-za;
        scene.add(mk(.3,7.7,len,wall,x,3.85,z));
        colliders.push({x,z,hx:.33,hz:len/2});
      }
      scene.add(mk(.46,1.05,11.1,wall,x,7.32,0));
      for(const z of [-5.58,5.58]){
        scene.add(mk(.50,6.8,.14,trim,x,3.45,z));
      }
      scene.add(mk(.52,.095,11.1,trim,x,6.72,0));
    }
    for(const [name,x] of [['SALON',-12],['ATRIUM',0],['STUDIO',12]]){
      const label=titlePanel(name,2.5);
      label.position.set(x,6.1,-11.64);scene.add(label);
    }
  }else{
    // The archive has long flush LED luminaires instead of dramatic
    // spotlight-only lighting, matching real conservation storage rooms.
    const led=new THREE.MeshBasicMaterial({color:0xf4f7f1,toneMapped:false});
    for(const x of [-15,-9,-3,3,9,15]){
      scene.add(mk(.16,.075,19.4,trim,x,7.78,0));
      scene.add(mk(.10,.024,19.2,led,x,7.73,0));
    }
    // Archive sliding mesh racks are assembled by museum-depot.js, which also
    // mounts the real archived paintings and provides their interactive rails.
    const depotPanel=titlePanel('THE DEPOT   /   ARCHIVE',4.3);
    depotPanel.position.set(0,6,-11.66);scene.add(depotPanel);
  }

  // Black ceiling tracks with individual tilted white spotlight cylinders.
  const fixtureGeo=new THREE.CylinderGeometry(.095,.13,.30,12);
  const shadeMaterial=std(0xe5e8e2,.38,.14);
  let ix=0;
  for(const x of [-15,-10,-4,0,4,10,15]){
    for(const z of [-8.0,8.0]){
      const rail=mk(.042,.04,7.1,black,x,7.76,z<0?-8.25:8.25);
      scene.add(rail);
      for(let dz=-2.55;dz<=2.55;dz+=2.55){
        const spotZ=z+dz*.42;
        const fixture=new THREE.Mesh(fixtureGeo,shadeMaterial);
        fixture.position.set(x,7.46,spotZ);
        fixture.rotation.x=(z<0?-.33:.33);
        scene.add(fixture);
        scene.add(mk(.016,.21,.016,black,x,7.66,spotZ));
        // Keep the track fixtures visible, but only a few REAL spot lights
        // on mobile. Each spotlight adds a costly shader-uniform array entry.
        // Dozens of active spotlights exceed common mobile fragment limits.
        if(quality==='eco' && !(ix++%6===0))continue;
        const target=new THREE.Object3D();
        target.position.set(x,2.55,z<0?-10.7:10.7);
        scene.add(target);
        const light=new THREE.SpotLight(0xfff0d8,room==='gallery'?75:48,13,.48,.8,1.7);
        light.position.copy(fixture.position);
        light.target=target;
        light.castShadow=quality!=='eco'&&(ix++%11===0);
        if(light.castShadow){
          light.shadow.mapSize.set(512,512);
          light.shadow.bias=-.0007;
          light.shadow.normalBias=.025;
          light.shadow.camera.near=.4;light.shadow.camera.far=15;
        }
        scene.add(light);lights.push(light);
      }
    }
  }
  // Broad diffuse fill from virtual clerestory luminaires.
  for(const x of [-12,0,12]){
    const light=new THREE.PointLight(0xfff8ea,isDepot?13:19,12,1.8);
    light.position.set(x,7.4,0);scene.add(light);lights.push(light);
    scene.add(mk(1.45,.04,.55,white,x,7.76,0));
  }
  if(!isDepot){
    // Low-profile contemplation benches with sculpted metal legs.
    for(const x of [-13.4,13.4]){
      scene.add(mk(2.6,.14,.66,upholstery,x,.59,.1));
      for(const dx of [-.96,.96]){
        scene.add(mk(.055,.50,.47,black,x+dx,.28,.1));
      }
      colliders.push({x,z:.1,hx:1.35,hz:.40});
    }
    // All display cases are now real, interactive artwork spots built by
    // museum-vitrines.js. No duplicate decorative case is created here.
  }
  return {colliders,lights,dispose(){
    // Materials and geometries are disposed by the parent scene traversal.
  }};
}
