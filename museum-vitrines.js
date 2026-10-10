// MAD gallery vitrines: exhibition-capable showcases on solid museum plinths.
// Slots are permanent IDs; the associated artwork persists in the collection.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

export const VITRINE_SPOTS=[
  {id:'v1',type:'vitrine',x:-16.6,z:6,rot:0},
  {id:'v2',type:'vitrine',x:-12.1,z:-7.1,rot:0},
  {id:'v3',type:'vitrine',x:-2.0,z:-7.6,rot:0},
  {id:'v4',type:'vitrine',x:3.1,z:8.1,rot:0},
  {id:'v5',type:'vitrine',x:13.0,z:-7.0,rot:0},
  {id:'v6',type:'vitrine',x:16.5,z:6.2,rot:0}
];
export const VITRINE = Object.freeze({
  width:1.28,depth:1.28,baseTop:.71,glassTop:1.91,
  maxArtWidth:.96,maxArtHeight:.94,maxArtDepth:.96
});

const painted=new THREE.MeshStandardMaterial({color:0xe0e0d9,roughness:.75,metalness:.03});
const lidMaterial=new THREE.MeshStandardMaterial({color:0x252b2b,roughness:.43,metalness:.43});
const metal=new THREE.MeshStandardMaterial({color:0x9fa9a4,roughness:.35,metalness:.75});
const glassMaterial=new THREE.MeshPhysicalMaterial({
  color:0xe2f1f0,transparent:true,opacity:.13,roughness:.09,
  metalness:0,depthWrite:false,side:THREE.DoubleSide,
  clearcoat:.45,clearcoatRoughness:.07
});

function cuboid(group,width,height,depth,material,x,y,z){
  const obj=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
  obj.position.set(x,y,z);
  obj.castShadow=material!==glassMaterial;
  obj.receiveShadow=material!==glassMaterial;
  group.add(obj);return obj;
}

/**
 * Build an interactive version of the museum showcase. Returns the solid base
 * and an invisible-but-raycastable volume at visitor eye level, so looking at
 * the glass on mobile lets visitors press USE to create or inspect artwork.
 */
export function createVitrine(group,{archive=false}={}){
  const {width:w,depth:d,baseTop,glassTop}=VITRINE;
  const base=cuboid(group,w,baseTop,d,painted,0,baseTop/2,0);
  const shelfY=baseTop+.055;
  cuboid(group,w+.018,.045,d+.018,painted,0,baseTop+.019,0);
  // The raised inner shelf keeps small sculptures from looking like they float.
  cuboid(group,1.03,.035,1.03,painted,0,shelfY,0);
  const glassBottom=baseTop+.04;
  const glassH=glassTop-glassBottom-.065;
  const glassY=glassBottom+glassH/2;
  for(const sign of [-1,1]){
    cuboid(group,.014,glassH,d,glassMaterial,sign*w/2,glassY,0);
    cuboid(group,w,glassH,.014,glassMaterial,0,glassY,sign*d/2);
    // Thin vertical glass joinery and small stainless corners.
    for(const side of [-1,1]){
      cuboid(group,.018,glassH,.018,metal,sign*(w/2-.018),glassY,
        side*(d/2-.018));
    }
  }
  cuboid(group,w+.08,.075,d+.08,lidMaterial,0,glassTop,0);
  // Narrow lip below the black cap adds realistic thickness.
  cuboid(group,w+.04,.025,d+.04,metal,0,glassTop-.046,0);
  // Solid, barely visible reflection strip along front top glass.
  cuboid(group,w-.1,.008,.008,metal,0,glassTop-.12,d/2-.015);

  // Interaction collider has no rendered pixels and no shadow. Do not set
  // visible=false: Three.js raycasting must still detect this object.
  const target=cuboid(group,w*1.035,1.75,d*1.035,
    new THREE.MeshBasicMaterial({
      color:0xffffff,transparent:true,opacity:0,
      depthWrite:false,colorWrite:false
    }),0,1.01,0);
  target.castShadow=false;target.receiveShadow=false;
  target.userData.museumVitrine=true;
  base.userData.museumVitrineBase=true;
  return {base,target,collider:{hx:w/2+.16,hz:d/2+.16},shelfY};
}

/** Uniformly fit ANY submitted artwork within the sealed glass volume. */
export function fitArtToVitrine(artObject,sizeFactor=1){
  if(!artObject)return 1;
  artObject.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(artObject);
  const size=new THREE.Vector3();
  const center=new THREE.Vector3();
  bounds.getSize(size);bounds.getCenter(center);
  if(!Number.isFinite(size.x+size.y+size.z))return 1;
  const scale=Math.min(
    VITRINE.maxArtWidth/Math.max(.001,size.x),
    VITRINE.maxArtHeight/Math.max(.001,size.y),
    VITRINE.maxArtDepth/Math.max(.001,size.z),
    1.08
  )*Math.max(.65,Math.min(1.05,Number(sizeFactor)||1));
  // The bottom of the art rests on the small inner shelf (rather than at the
  // normal 2.15m pedestal mounting height).
  artObject.scale.setScalar(scale);
  artObject.position.set(-center.x*scale,
    VITRINE.baseTop+.075-bounds.min.y*scale,
    -center.z*scale);
  return scale;
}
