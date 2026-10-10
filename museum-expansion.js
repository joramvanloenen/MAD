// MAD extended galleries: architecture, connecting white passageways and hidden cellar.
// All fixtures are ordinary Three.js meshes; no extra WebGL contexts.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const material=(hex,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color:hex,roughness,metalness});
const plaster=material(0xf4f4f0),soffit=material(0xe3e8e5);
const concrete=material(0xc6ccc9),black=material(0x282e30,.5,.25);
const cellarStone=material(0x25282b,.92),iron=material(0x494f52,.49,.54);
const gold=material(0xa99372,.6,.38);
function brick(scene,w,h,d,m,x,y,z){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;
}
function trigger(scene,w,h,d,x,y,z){
  const o=brick(scene,w,h,d,new THREE.MeshBasicMaterial({
    color:0xffffff,colorWrite:false,transparent:true,opacity:0,depthWrite:false
  }),x,y,z);o.castShadow=false;o.receiveShadow=false;
  return o;
}
function wallTitle(scene,text,x,y,z,rotationY=0){
  const c=document.createElement('canvas');c.width=1024;c.height=192;
  const ctx=c.getContext('2d');ctx.clearRect(0,0,1024,192);
  ctx.font='700 65px Arial';ctx.fillStyle='#303634';ctx.textAlign='center';
  ctx.fillText(text,512,125);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const o=new THREE.Mesh(new THREE.PlaneGeometry(3.5,.66),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  o.position.set(x,y,z);o.rotation.y=rotationY;scene.add(o);
}
/** Short physical hallway beyond the ACTUAL cutout in the eastern perimeter. */
export function buildWhiteTransition(scene){
  const hit=trigger(scene,.08,3.0,2.75,25.95,1.6,0);
  // No closing wall at the first door: visitor looks through six metres of
  // bright architecture ending in a misty, overexposed transition.
  brick(scene,7.05,.18,3.15,plaster,22.83,-.06,0);
  brick(scene,7.05,.18,3.15,plaster,22.83,3.71,0);
  for(const side of [-1,1])
    brick(scene,7.05,3.7,.12,plaster,22.83,1.83,side*1.58);
  for(const x of [20.8,22.6,24.4]){
    for(const z of [-1.48,1.48])brick(scene,.10,3.55,.13,soffit,x,1.78,z);
    brick(scene,.12,.09,3.07,soffit,x,3.54,0);
    const light=new THREE.PointLight(0xffffff,23,6.5,1.8);
    light.position.set(x,3.2,0);scene.add(light);
  }
  const fadeMat=new THREE.MeshBasicMaterial({
    color:0xf9fdff,transparent:true,opacity:.05,depthWrite:false,
    side:THREE.DoubleSide
  });
  for(let i=0;i<6;i++){
    const m=fadeMat.clone();m.opacity=.04+i*.09;
    brick(scene,.006,3.39,3.0,m,23.2+i*.43,1.65,0).castShadow=false;
  }
  brick(scene,.03,3.45,3.07,
    new THREE.MeshBasicMaterial({color:0xf9ffff,toneMapped:false}),
    26.42,1.72,0);
  return {mesh:hit,kind:'portal'};
}
/** White-washed corridor extending north from the existing gallery. */
export function buildNorthWingPassage(scene){
  brick(scene,3.55,.15,6.45,plaster,15.95,-.055,-14.83);
  brick(scene,3.55,.13,6.45,plaster,15.95,3.65,-14.83);
  for(const x of [14.16,17.74])
    brick(scene,.13,3.6,6.45,plaster,x,1.8,-14.83);
  for(const z of [-13.1,-15.1,-16.7]){
    brick(scene,3.35,.1,.09,soffit,15.95,3.40,z);
    const light=new THREE.PointLight(0xffffff,17,5,1.7);
    light.position.set(15.95,3.25,z);scene.add(light);
  }
  const end=brick(scene,3.3,3.42,.025,
    new THREE.MeshBasicMaterial({color:0xf4f9f7,toneMapped:false}),
    15.95,1.71,-18.08);
  const hit=trigger(scene,3,2.85,.07,15.95,1.5,-17.35);
  wallTitle(scene,'NEW WING',15.95,3.14,-12.04,0);
  end.castShadow=false;
  return {mesh:hit,kind:'zone',to:'wing'};
}
/** Three more rooms in a second wing, with sightlines through open portals. */
export function buildNewWing(scene){
  const barriers=[];
  for(const x of [-7.2,6.8]){
    for(const [a,b] of [[-11.62,-3.1],[3.1,11.62]]){
      const len=b-a,z=(a+b)/2;
      brick(scene,.24,7.5,len,plaster,x,3.75,z);
      barriers.push({x,z,hx:.30,hz:len/2});
    }
    brick(scene,.25,4.15,6.2,plaster,x,5.925,0);
  }
  for(const [name,x] of [['DISCOVERY',-13],['IDEAS',0],['NEW MEDIA',13]]){
    wallTitle(scene,name,x,5.85,-11.63);
  }
  return barriers;
}
export function buildStairToUpper(scene){
  // Upper gallery stairs: 16 solid treads with a handrail and a framed,
  // visitor-triggerable transition at the foot of the first step.
  const x=15.2,zStart=5.9,num=16,h=.19,len=.49;
  for(let i=0;i<num;i++){
    const z=zStart-i*len;
    brick(scene,2.5,(i+1)*h,len,concrete,x,(i+1)*h/2,z);
    brick(scene,2.62,.055,len+.02,plaster,x,(i+1)*h+.018,z);
  }
  for(const side of [-1,1]){
    brick(scene,.065,3.2,9.0,iron,x+side*1.32,1.9,2.05);
    for(let i=0;i<9;i++){
      const z=zStart-i*.88,y=.4+i*.34;
      brick(scene,.05,1.0,.05,iron,x+side*1.32,y,z);
    }
  }
  const hit=trigger(scene,2.6,2.8,.65,x,1.45,7.05);
  return {mesh:hit,kind:'zone',to:'upper',via:'stairs-up'};
}
/** Discreet secret at ground level, flush with the west gallery wall. */
export function buildSecretEntrance(scene){
  const m=material(0xe9e8e2,.95),outline=material(0xbbb8b0,.6);
  // Real hole is cut in index.html's west wall, this flush pivot closes it.
  brick(scene,.14,2.65,2.55,m,-19.28,1.325,4.42);
  for(const z of [3.13,5.71])
    brick(scene,.03,2.71,.02,outline,-19.19,1.36,z);
  brick(scene,.03,.025,2.58,outline,-19.19,2.68,4.42);
  const rivet=brick(scene,.046,.18,.07,gold,-19.185,1.18,5.41);
  rivet.castShadow=false;
  // A dim visible stair flight behind the concealed opening.
  for(let i=0;i<11;i++){
    const depth=.60,z=4.42,x=-20.25-i*.52,y=-(i+1)*.24;
    brick(scene,depth,.10,2.27,concrete,x,y,z);
    if(i===0||i===10)
      brick(scene,.05,2.0,2.3,cellarStone,x,y-.65,z);
  }
  for(const z of [3.16,5.67])
    brick(scene,6.7,3.0,.16,cellarStone,-23.7,-.65,z);
  return {mesh:trigger(scene,.15,2.45,2.2,-19.08,1.33,4.42),
    kind:'secret',to:'cellar'};
}
function cellarPainting(scene,x,y,z,seed){
  const c=document.createElement('canvas');c.width=240;c.height=320;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#16171b';ctx.fillRect(0,0,240,320);
  let v=(seed*16807+13)>>>0;
  const rnd=()=>{v=(v*1664525+1013904223)>>>0;return v/4294967296};
  // Abstract ghostly marks, NOT supposedly real community artwork.
  for(let i=0;i<44;i++){
    const t=rnd();
    ctx.strokeStyle=t>.50?'rgba(150,65,68,.18)':'rgba(196,178,154,.10)';
    ctx.lineWidth=1+rnd()*13;
    ctx.beginPath();ctx.moveTo(rnd()*240,rnd()*320);
    ctx.bezierCurveTo(rnd()*240,rnd()*320,rnd()*240,rnd()*320,
      rnd()*240,rnd()*320);ctx.stroke();
  }
  ctx.fillStyle='rgba(202,206,190,.09)';
  ctx.beginPath();ctx.ellipse(125,135,40,78,rnd(),0,Math.PI*2);ctx.fill();
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  brick(scene,1.30,1.75,.09,black,x,y,z);
  const art=new THREE.Mesh(new THREE.PlaneGeometry(1.24,1.69),
    new THREE.MeshBasicMaterial({map:tex}));
  art.position.set(x,y,z+.07);scene.add(art);
}
export function buildCellar(scene){
  // Cellar is a separate subterranean gallery scene with vaulted low ceiling,
  // stone walls, warm conservation lamps and mysterious abstract study works.
  const info=material(0x7e766c,.8);
  for(const z of [-11.72,11.72])brick(scene,38,.35,.2,cellarStone,0,3.45,z);
  brick(scene,38,.42,23.5,cellarStone,0,3.9,0);
  for(const x of [-14,-7,0,7,14]){
    brick(scene,.4,3.7,.52,cellarStone,x,1.8,-11.45);
    brick(scene,.4,3.7,.52,cellarStone,x,1.8,11.45);
    for(const z of [-8,0,8]){
      const l=new THREE.PointLight(0xffbe77,8,6,2);
      l.position.set(x,2.9,z);scene.add(l);
      brick(scene,.45,.10,.35,gold,x,3.04,z);
    }
  }
  for(const [x,z,seed] of [[-13,-11.5,5],[-6,-11.5,22],[2,-11.5,13],
     [10,-11.5,37]]){
    cellarPainting(scene,x,1.75,z+.16,seed);
  }
  // Atmospheric curtain in a far alcove and irregular plinth forms.
  brick(scene,5.2,3.2,.18,info,15.2,1.65,-11.35);
  for(const [x,z] of [[-10,-2],[0,4],[12,-3]]){
    brick(scene,1.1,.50,1.10,cellarStone,x,.25,z);
    brick(scene,.4,1.1,.35,iron,x,.95,z);
  }
  // Return stair with ascending visible treads behind a marked exit.
  for(let i=0;i<12;i++){
    const x=-17+i*.42;
    brick(scene,.43,(i+1)*.25,2.4,concrete,x,(i+1)*.125,4.4);
  }
  wallTitle(scene,'AFTER HOURS',0,3.05,-11.62);
  return {mesh:trigger(scene,.40,2.6,2.3,-17.15,1.4,4.4),
    kind:'zone',to:'gallery',via:'stairs-up'};
}
export function buildUpperGallery(scene){
  const barriers=[];
  // Upper floor: two linked exhibition halls and a balustraded overlook.
  for(const z of [-5.7,5.7]){
    brick(scene,21.5,.25,.22,plaster,-8.1,4.6,z);
    barriers.push({x:-8.1,z,hx:10.7,hz:.17});
  }
  // Slim guard around an implied atrium; cannot be walked through.
  for(const z of [-5.45,5.45]){
    brick(scene,11.6,.06,.08,black,10.5,1.28,z);
    for(let x=5.1;x<=15.9;x+=1.5)
      brick(scene,.04,1.15,.05,iron,x,.61,z);
  }
  for(const [name,x] of [['UPPER GALLERY',-10],['THE LOOKOUT',10]]){
    wallTitle(scene,name,x,5.95,-11.63);
  }
  // Stair exit/return at the upper landing.
  const hit=trigger(scene,2.6,2.7,.40,15.5,1.4,5.7);
  brick(scene,3.1,.24,2.5,concrete,15.5,.12,7.2);
  return {barriers,portal:{mesh:hit,kind:'zone',to:'wing',via:'stairs-down'}};
}
