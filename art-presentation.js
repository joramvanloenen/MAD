// Artwork materials, adjustable canvas/frame formats and procedural geometry.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {constrainReliefGeometry,sanitizeWallVoxels} from './wall-art.js';
import {clayObject} from './clay-sculpt.js';
import {mixedArtwork} from './mixed-media.js?v=20261010-mixed5';

const box=(w,h,d,mat,x=0,y=0,z=0)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
};
export function paintingDimensions(format){
  if(format==='portrait')return [1.75,2.8];
  if(format==='landscape')return [2.9,1.8];
  if(format==='wide')return [2.95,1.15];
  return [2.62,2.62];
}
export function sculptureMaterial(a){
  const preset=a.materialPreset||'ceramic';
  const settings={
    ceramic:{roughness:.18,metalness:0,clearcoat:.43},
    clay:{roughness:.96,metalness:0},
    stone:{roughness:.82,metalness:0},
    bronze:{roughness:.38,metalness:.77},
    metal:{roughness:.30,metalness:.88},
    glass:{roughness:.1,metalness:0,transparent:true,opacity:.78,depthWrite:false}
  }[preset]||{roughness:.43,metalness:.1};
  return new THREE.MeshPhysicalMaterial({
    color:a.color||'#c5eb68',...settings,
    clearcoatRoughness:.14,side:THREE.DoubleSide
  });
}
export function geometryFor(a){
  let geo;const n=Math.min(9,Math.max(1,Number(a.complexity??5)));
  if(a.shape==='sphere')geo=new THREE.IcosahedronGeometry(1,Math.min(4,Math.floor(n/2)+1));
  else if(a.shape==='knot')geo=new THREE.TorusKnotGeometry(.78,.27,60+n*13,8+n*2,2,3);
  else if(a.shape==='column')geo=new THREE.CylinderGeometry(.37,.78,2.2,8+n*2,12+n*2);
  else if(a.shape==='crystal')geo=new THREE.IcosahedronGeometry(1.1,n<5?1:2);
  else if(a.shape==='petals')geo=new THREE.TorusKnotGeometry(.7,.26,60+n*10,8+n,3,5);
  else if(a.shape==='ribbon')geo=new THREE.TorusKnotGeometry(.73,.15,70+n*12,6+n,1,5);
  else geo=new THREE.TorusGeometry(.9,.38,10+n*2,30+n*6);
  const p=geo.attributes.position,d=(Number(a.distortion??30))/100;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const variation=Math.sin(x*3.8+y*4.3+z*2.9)*.14*d
      +Math.cos(x*6-z*4)*.15*d;
    const wave=a.shape==='petals'?.21*Math.sin(Math.atan2(z,x)*8):0;
    const scale=1+variation+wave;
    p.setXYZ(i,x*scale,y*scale,z*scale);
  }
  p.needsUpdate=true;geo.computeVertexNormals();
  geo.computeBoundingSphere();return geo;
}
function framedPainting(a){
  const group=new THREE.Group();
  const [width,height]=paintingDimensions(a.format);
  const texture=new THREE.TextureLoader().load(a.image);
  texture.colorSpace=THREE.SRGBColorSpace;
  group.add(box(width,height,.065,new THREE.MeshStandardMaterial({
    color:0xf4f0e9,roughness:.93
  })));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width-.065,height-.065),
    new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  face.position.z=.042;group.add(face);
  const style=a.frame||'thin';
  if(style!=='none'){
    const f=style==='thin'?.055:style==='gold'?.14:.10;
    const tone=style==='oak'?0xa7794c:style==='gold'?0xb69a51:
      style==='black'?0x242a28:0x474d4b;
    const mat=new THREE.MeshStandardMaterial({
      color:tone,metalness:style==='gold'?.66:style==='thin'?.45:0,
      roughness:style==='oak'?.72:.36
    });
    group.add(box(width+2*f,f,.105,mat,0,height/2+f/2,.045));
    group.add(box(width+2*f,f,.105,mat,0,-height/2-f/2,.045));
    group.add(box(f,height,.105,mat,-width/2-f/2,0,.045));
    group.add(box(f,height,.105,mat,width/2+f/2,0,.045));
  }
  return group;
}
export function artMesh(a,isWall=false){
  if(a.mode==='mixed')return mixedArtwork(a);
  if(a.mode==='painting')return framedPainting(a);
  if(a.mode==='clay')return clayObject(a,sculptureMaterial);
  const group=new THREE.Group();
  if(a.mode==='voxel'){
    const cells=isWall?sanitizeWallVoxels(a.voxels):a.voxels||[];
    const material=sculptureMaterial(a);
    const count=Math.min(3000,cells.length);
    if(count){
      const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.22,.22),material,count);
      const tmp=new THREE.Object3D();
      for(let i=0;i<count;i++){
        const v=cells[i];tmp.position.set(v[0]*.22,v[1]*.22,v[2]*.22);
        tmp.updateMatrix();instanced.setMatrixAt(i,tmp.matrix);
      }
      instanced.instanceMatrix.needsUpdate=true;
      instanced.castShadow=true;
      group.add(instanced);
    }
  }else{
    const geo=geometryFor(a);
    if(isWall)constrainReliefGeometry(geo,a.reliefDepth??.6);
    const mesh=new THREE.Mesh(geo,sculptureMaterial(a));
    mesh.castShadow=true;group.add(mesh);
  }
  return group;
}
