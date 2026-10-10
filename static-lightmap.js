// MAD / static baked indirect illumination.
// Loads the committed RGB565 lightmap atlas and assigns UV2 to architectural
// meshes. Absolutely no lighting traces or texture writes in the render loop.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {STATIC_LIGHTMAPS,STATIC_LIGHTMAP_TILE} from './static-lightmaps-data.js';
import {unpack565} from './static-lightmap-baker.js';

const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
// 2 columns, 3 rows:
// floor / ceiling, north / south, west / east.
function mapUV(world,normal,tile){
  const nx=normal.x,ny=normal.y,nz=normal.z;
  let chart,u,v;
  const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);
  if(ay>=ax&&ay>=az){
    chart=ny>0?0:1;
    u=(world.x+19.5)/39;v=(world.z+12)/24;
  }else if(az>=ax){
    chart=nz>0?2:3;
    u=(world.x+19.5)/39;v=world.y/8;
  }else{
    chart=nx>0?4:5;
    u=(world.z+12)/24;v=world.y/8;
  }
  // One texel of gutter on every side of each chart. Without it,
  // bilinear texture sampling bleeds unrelated floor/wall irradiance.
  const tileU=(1+clamp(u,0,1)*(tile-3)+.5)/(tile*2);
  const tileV=(1+clamp(v,0,1)*(tile-3)+.5)/(tile*3);
  return [(chart%2)*.5+tileU,Math.floor(chart/2)/3+tileV];
}
export function applyLightmapUV2(mesh,tile=STATIC_LIGHTMAP_TILE){
  if(!mesh?.isMesh||!mesh.geometry?.attributes?.position)return false;
  const geo=mesh.geometry,position=geo.attributes.position;
  if(!geo.attributes.normal)geo.computeVertexNormals();
  const normal=geo.attributes.normal;
  const uv2=new Float32Array(position.count*2);
  const point=new THREE.Vector3(),direction=new THREE.Vector3();
  mesh.updateWorldMatrix(true,false);
  const transform=mesh.matrixWorld;
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(transform);
    direction.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
    const [u,v]=mapUV(point,direction,tile);
    uv2[i*2]=u;uv2[i*2+1]=v;
  }
  geo.setAttribute('uv2',new THREE.BufferAttribute(uv2,2));
  return true;
}
function decodeData(text){
  if(!text||text.length>70000)throw Error('Invalid baked lightmap asset');
  const raw=atob(text),data=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
  return unpack565(data);
}
export class StaticMuseumLighting {
  constructor({room}){
    this.room=room;
    const encoded=STATIC_LIGHTMAPS[room];
    this.enabled=!!encoded;
    this.mode=this.enabled?'BAKED':'OFF';
    this.textures=[];
    this.materials=new Set();
    this.originalHemisphere=null;
    if(!this.enabled)return;
    const px=decodeData(encoded),tile=STATIC_LIGHTMAP_TILE;
    this.texture=new THREE.DataTexture(px,tile*2,tile*3,
      THREE.RGBAFormat,THREE.UnsignedByteType);
    this.texture.channel=1; // r165: use second UV set (uv2).
    this.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.texture.minFilter=THREE.LinearFilter;
    this.texture.magFilter=THREE.LinearFilter;
    this.texture.wrapS=THREE.ClampToEdgeWrapping;
    this.texture.wrapT=THREE.ClampToEdgeWrapping;
    this.texture.generateMipmaps=false;
    this.texture.flipY=false;
    this.texture.unpackAlignment=1;
    this.texture.needsUpdate=true;
  }
  decorateScene(scene){
    if(!this.enabled)return;
    scene.updateMatrixWorld(true);
    const hemi=scene.children.find(o=>o.isHemisphereLight);
    if(hemi){
      this.originalHemisphere={light:hemi,intensity:hemi.intensity};
      hemi.intensity*=.74;
    }
    scene.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.userData.madStatic)return;
      const m=mesh.material;
      if(!m||(!m.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial))return;
      if(!applyLightmapUV2(mesh))return;
      // Shared architectural materials are okay: every matching surface
      // has its own atlas UV2, so they all sample the same baked asset.
      if(!this.materials.has(m)){
        m.lightMap=this.texture;
        m.lightMapIntensity=this.room==='cellar'?.9:1.4;
        m.needsUpdate=true;
        this.materials.add(m);
      }
    });
  }
  cycleQuality(){
    if(!this.enabled)return 'OFF';
    this.mode=this.mode==='BAKED'?'OFF':'BAKED';
    for(const m of this.materials)m.lightMapIntensity=this.mode==='OFF'?0:
      this.room==='cellar'?.9:1.4;
    if(this.originalHemisphere){
      const {light,intensity}=this.originalHemisphere;
      light.intensity=this.mode==='OFF'?intensity:intensity*.74;
    }
    return this.mode;
  }
  dispose(){
    if(this.originalHemisphere){
      const {light,intensity}=this.originalHemisphere;
      light.intensity=intensity;
    }
    for(const mat of this.materials){
      mat.lightMap=null;
      mat.needsUpdate=true;
    }
    this.materials.clear();
    this.texture?.dispose();
    this.texture=null;
  }
}
