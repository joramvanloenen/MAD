// MAD / Directional Dynamic Diffuse GI (DDGI-lite)
// CPU ray-sampled multi-bounce irradiance probes -> six GPU 3D textures.
// Works in Three.js r165/WebGL2 without external dependencies or offline lightmaps.
// Room intersection is exact for architectural planes; art uses light-transport proxies.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const AXES = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
];
const SIZE = [13,4,9], COUNT = SIZE[0]*SIZE[1]*SIZE[2];
const MIN = [-18.8,0.45,-11.15], MAX = [18.8,7.55,11.15];
const RADIANCE_RANGE = 3.2;
const PI = Math.PI;
const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm = v => {
  const l = Math.hypot(v[0],v[1],v[2]) || 1;
  return [v[0]/l,v[1]/l,v[2]/l];
};
const toLin = hex => {
  const c = new THREE.Color(hex ?? '#e8e6df');
  return [c.r,c.g,c.b];
};
const gridIndex = (x,y,z) => x+SIZE[0]*(y+SIZE[1]*z);

export class MuseumGI {
  constructor({renderer,room,slots,artworks}) {
    this.enabled = !!renderer.capabilities.isWebGL2;
    this.mode = this.enabled ? (matchMedia('(pointer:coarse)').matches ? 'ECO' : 'HIGH') : 'OFF';
    this.lights = [];
    for(let x=-15;x<=15;x+=6) for(let z=-7;z<=7;z+=7)
      this.lights.push([x,7.4,z]);
    this.proxies = [];
    this.setupProxies(room,slots,artworks);
    this.probes = Array.from({length:6},()=>new Float32Array(COUNT*3));
    this.bytes = Array.from({length:6},()=>new Uint8Array(COUNT*4));
    this.textures = [];
    this.uniforms = {};
    this.cursor = 0;
    this.updates = 0;
    this.disposed = false;
    this.frame = 0;
    this.quality = this.mode==='ECO' ? 22 : 96;
    if (!this.enabled) return;
    for(let k=0;k<6;k++) {
      const bytes=this.bytes[k], field=this.probes[k];
      for(let i=0;i<COUNT;i++) {
        const o=i*4,q=i*3;
        field[q]=0.12;field[q+1]=0.11;field[q+2]=0.095;
        bytes[o]=11;bytes[o+1]=10;bytes[o+2]=9;bytes[o+3]=255;
      }
      const texture=new THREE.Data3DTexture(bytes,SIZE[0],SIZE[1],SIZE[2]);
      texture.format=THREE.RGBAFormat;
      texture.type=THREE.UnsignedByteType;
      texture.minFilter=THREE.LinearFilter;
      texture.magFilter=THREE.LinearFilter;
      texture.wrapS=texture.wrapT=texture.wrapR=THREE.ClampToEdgeWrapping;
      texture.unpackAlignment=1;
      texture.generateMipmaps=false;
      texture.needsUpdate=true;
      this.textures.push(texture);
      this.uniforms['madGi'+k]={value:texture};
    }
    this.uniforms.madGiMin={value:new THREE.Vector3(...MIN)};
    this.uniforms.madGiInvSpan={value:new THREE.Vector3(
      1/(MAX[0]-MIN[0]),1/(MAX[1]-MIN[1]),1/(MAX[2]-MIN[2])
    )};
    this.uniforms.madGiScale={value:new THREE.Vector3(...SIZE.map(n=>(n-1)/n))};
    this.uniforms.madGiOffset={value:new THREE.Vector3(...SIZE.map(n=>0.5/n))};
    this.uniforms.madGiStrength={value:1.1};
  }

  // Respect the mounting surface so wall reliefs never send bounced light
  // from the wall's interior. 2D paintings stay very thin.
  addWallArtProxy(x,y,z,forward,a) {
    const depth=a.mode==='painting'?.055:
      a.mode==='voxel'?.19*(1+Math.max(0,...(a.voxels||[]).map(v=>Number(v[2])||0))):
      .18+Math.min(.76,Math.max(.08,a.reliefDepth??.6))*.8;
    const half=Math.max(.03,depth*.5);
    this.addBox(x,y,z+forward*(.22+half),1.35,1.35,half,a.color);
  }

  setupProxies(room,slots,artworks) {
    if(room==='gallery'){
      // Interior partitions must take part in ray visibility and bounced light.
      for(const x of [-6.5,7.5]){
        for(const z of [-8.675,8.675])
          this.addBox(x,3.85,z,.18,3.85,3.125,'#f0eee8');
      }
      for(const s of slots) {
        const a=artworks.find(t=>t.spotId===s.id && Date.now()-t.createdAt < 14*86400000);
        if(s.type==='plinth')this.addBox(s.x,.45,s.z,1.17,.46,1.17,'#e3e0d9');
        if(s.type==='vitrine')this.addBox(s.x,.36,s.z,.64,.36,.64,'#e1e1db');
        if(s.type==='floor')this.addBox(s.x,.035,s.z,1.6,.055,1.6,'#d7d4cf');
        if(!a)continue;
        if(s.type==='wall')this.addWallArtProxy(s.x,3,s.z,Math.cos(s.rot),a);
        else this.addSphere(s.x,s.type==='vitrine'?1.22:s.type==='plinth'?2.12:1.5,
          s.z,s.type==='vitrine'?.45:1.02,a.color);
      }
    } else {
      artworks.filter(a=>Date.now()-a.createdAt>=14*86400000).forEach((a,i)=>{
        const x=-14+(i%6)*5.5,z=-6+Math.floor(i/6)*5;
        const original=slots.find(s=>s.id===a.spotId);
        if(original?.type==='wall'){
          this.addBox(x,3,z-.12,1.78,2.13,.11,'#aaaead');
          this.addWallArtProxy(x,3,z,1,a);
        }else{
          if(original?.type==='vitrine')this.addBox(x,.36,z,.64,.36,.64,'#b9bcb4');
          else if(original?.type!=='floor')this.addBox(x,.45,z,1.17,.46,1.17,'#b9bcb4');
          this.addSphere(x,original?.type==='floor'?1.5:original?.type==='vitrine'?1.22:2.12,
            z,original?.type==='vitrine'?.45:1.06,a.color);
        }
      });
    }
  }
  addSphere(x,y,z,r,color) {
    this.proxies.push({type:'sphere',p:[x,y,z],r,color:toLin(color)});
  }
  addBox(x,y,z,hx,hy,hz,color) {
    this.proxies.push({type:'box',p:[x,y,z],h:[hx,hy,hz],color:toLin(color)});
  }

  // Ray exits from the gallery's six architectural surfaces.
  traceRoom(o,d) {
    let dist=1e7, normal=null, color=null;
    const candidates=[
      [0,-19.5,[1,0,0]],[0,19.5,[-1,0,0]],
      [1,0,[0,1,0]],[1,8,[0,-1,0]],
      [2,-12,[0,0,1]],[2,12,[0,0,-1]]
    ];
    for(const [axis,plane,n] of candidates) {
      const v=d[axis];
      if(Math.abs(v)<1e-6)continue;
      const t=(plane-o[axis])/v;
      if(t<.005||t>=dist)continue;
      const p=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t];
      if(p[0]<-19.501||p[0]>19.501||p[1]<-.001||p[1]>8.001||p[2]<-12.001||p[2]>12.001)continue;
      dist=t;normal=n;
      color=axis===1?(plane===0?[.76,.74,.69]:[.84,.84,.79]):[.85,.84,.79];
    }
    if(!normal)return null;
    return {t:dist,p:[o[0]+d[0]*dist,o[1]+d[1]*dist,o[2]+d[2]*dist],n:normal,color};
  }

  traceProxies(o,d,maxT=1e7) {
    let best=null,dist=maxT;
    for(const proxy of this.proxies) {
      if(proxy.type==='sphere'){
        const v=[o[0]-proxy.p[0],o[1]-proxy.p[1],o[2]-proxy.p[2]];
        const b=dot(v,d),c=dot(v,v)-proxy.r*proxy.r,disc=b*b-c;
        if(disc<0)continue;
        const root=Math.sqrt(disc);
        let t=-b-root;
        if(t<.01)t=-b+root;
        if(t<.01||t>=dist)continue;
        const p=[o[0]+t*d[0],o[1]+t*d[1],o[2]+t*d[2]];
        best={t,p,n:norm([p[0]-proxy.p[0],p[1]-proxy.p[1],p[2]-proxy.p[2]]),color:proxy.color};
        dist=t;
      }else {
        let near=-Infinity,far=Infinity,axis=-1,sign=0;
        for(let k=0;k<3;k++){
          const mn=proxy.p[k]-proxy.h[k],mx=proxy.p[k]+proxy.h[k];
          if(Math.abs(d[k])<1e-8){if(o[k]<mn||o[k]>mx){far=-Infinity;break;}continue;}
          let t1=(mn-o[k])/d[k],t2=(mx-o[k])/d[k];
          let face=-1;
          if(t1>t2){const tmp=t1;t1=t2;t2=tmp;face=1;}
          if(t1>near){near=t1;axis=k;sign=face;}
          far=Math.min(far,t2);
          if(near>far)break;
        }
        if(near>=far||far<.01)continue;
        const t=near>.01?near:far;
        if(t>=dist||t<.01)continue;
        const p=[o[0]+t*d[0],o[1]+t*d[1],o[2]+t*d[2]];
        const n=[0,0,0];
        if(near>.01)n[axis]=sign;
        else {
          let face=0,delta=Infinity;
          for(let k=0;k<3;k++) {
            const q=Math.abs(Math.abs(p[k]-proxy.p[k])-proxy.h[k]);
            if(q<delta){delta=q;face=k;}
          }
          n[face]=Math.sign(p[face]-proxy.p[face])||1;
        }
        best={t,p,n,color:proxy.color};dist=t;
      }
    }
    return best;
  }
  trace(o,d) {
    const roomHit=this.traceRoom(o,d);
    const artHit=this.traceProxies(o,d,roomHit?.t??1e7);
    return artHit||roomHit;
  }
  // Probe sampling of the last frame's light field for an approximate second bounce.
  sampleBounce(p,n) {
    const v=[0,0,0],c=[
      clamp((p[0]-MIN[0])/(MAX[0]-MIN[0])*(SIZE[0]-1),0,SIZE[0]-1),
      clamp((p[1]-MIN[1])/(MAX[1]-MIN[1])*(SIZE[1]-1),0,SIZE[1]-1),
      clamp((p[2]-MIN[2])/(MAX[2]-MIN[2])*(SIZE[2]-1),0,SIZE[2]-1)
    ];
    const x0=Math.floor(c[0]),y0=Math.floor(c[1]),z0=Math.floor(c[2]);
    const x1=Math.min(x0+1,SIZE[0]-1),y1=Math.min(y0+1,SIZE[1]-1),z1=Math.min(z0+1,SIZE[2]-1);
    const fx=c[0]-x0,fy=c[1]-y0,fz=c[2]-z0;
    for(let a=0;a<6;a++) {
      const w=Math.max(0,dot(n,AXES[a]));
      if(w<.001)continue;
      const f=this.probes[a];
      for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++) {
        const mix=w*(x?fx:1-fx)*(y?fy:1-fy)*(z?fz:1-fz);
        const q=gridIndex(x?x1:x0,y?y1:y0,z?z1:z0)*3;
        v[0]+=f[q]*mix;v[1]+=f[q+1]*mix;v[2]+=f[q+2]*mix;
      }
    }
    return v;
  }
  direct(hit) {
    const p=hit.p,n=hit.n,e=[.025,.028,.032];
    for(const l of this.lights) {
      const dx=l[0]-p[0],dy=l[1]-p[1],dz=l[2]-p[2],r2=dx*dx+dy*dy+dz*dz;
      if(r2>110)continue;
      const inv=1/Math.sqrt(Math.max(r2,.05));
      const nd=Math.max(0,(dx*n[0]+dy*n[1]+dz*n[2])*inv);
      if(nd<=.001)continue;
      // Only geometry/art shadows are traced, avoiding a shadow map per ceiling lamp.
      const start=[p[0]+n[0]*.025,p[1]+n[1]*.025,p[2]+n[2]*.025];
      const occluder=this.traceProxies(start,[dx*inv,dy*inv,dz*inv],1/inv-.06);
      if(occluder)continue;
      const power=(18/(3.0+r2))*nd;
      e[0]+=power*1.00;e[1]+=power*.89;e[2]+=power*.76;
    }
    return e;
  }
  sampleRay(p,dir) {
    const hit=this.trace(p,dir);
    if(!hit)return [.12,.13,.14];
    const direct=this.direct(hit);
    const bounce=this.sampleBounce(hit.p,hit.n);
    const albedo=hit.color;
    return [
      clamp(albedo[0]*(direct[0]/PI*.82+bounce[0]*.52),0,RADIANCE_RANGE),
      clamp(albedo[1]*(direct[1]/PI*.82+bounce[1]*.52),0,RADIANCE_RANGE),
      clamp(albedo[2]*(direct[2]/PI*.82+bounce[2]*.52),0,RADIANCE_RANGE)
    ];
  }
  // Cosine-oriented hemisphere direction, randomized over time (no full-screen tracing).
  randomHemisphere(axis) {
    const u=Math.random(),ang=Math.random()*PI*2,r=Math.sqrt(u),z=Math.sqrt(1-u);
    const a=AXES[axis];
    const helper=Math.abs(a[1])<.9?[0,1,0]:[1,0,0];
    const t=norm([a[1]*helper[2]-a[2]*helper[1],a[2]*helper[0]-a[0]*helper[2],a[0]*helper[1]-a[1]*helper[0]]);
    const b=[a[1]*t[2]-a[2]*t[1],a[2]*t[0]-a[0]*t[2],a[0]*t[1]-a[1]*t[0]];
    return [a[0]*z+r*(Math.cos(ang)*t[0]+Math.sin(ang)*b[0]),
      a[1]*z+r*(Math.cos(ang)*t[1]+Math.sin(ang)*b[1]),
      a[2]*z+r*(Math.cos(ang)*t[2]+Math.sin(ang)*b[2])];
  }
  decorateScene(scene) {
    if(!this.enabled)return;
    scene.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      materials.forEach(m=>this.decorateMaterial(m));
    });
  }
  decorateMaterial(m) {
    if(!m || (!m.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial) || m.userData.madGi)return;
    m.userData.madGi=true;
    const uniforms=this.uniforms;
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 madWorldPos;\nvarying vec3 madWorldNormal;'
      ).replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nmadWorldPos=(modelMatrix*vec4(transformed,1.0)).xyz;\nmadWorldNormal=normalize(mat3(modelMatrix)*objectNormal);'
      );
      shader.fragmentShader=shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 madWorldPos;\nvarying vec3 madWorldNormal;\nuniform sampler3D madGi0;\nuniform sampler3D madGi1;\nuniform sampler3D madGi2;\nuniform sampler3D madGi3;\nuniform sampler3D madGi4;\nuniform sampler3D madGi5;\nuniform vec3 madGiMin;\nuniform vec3 madGiInvSpan;\nuniform vec3 madGiScale;\nuniform vec3 madGiOffset;\nuniform float madGiStrength;'
      ).replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nvec3 madUV=clamp((madWorldPos-madGiMin)*madGiInvSpan,vec3(0.0),vec3(1.0))*madGiScale+madGiOffset;\nvec3 madN=normalize(madWorldNormal);\nvec3 madW=max(madN,vec3(0.0)),madV=max(-madN,vec3(0.0));\nvec3 madI=(texture(madGi0,madUV).rgb*madW.x+texture(madGi1,madUV).rgb*madV.x+texture(madGi2,madUV).rgb*madW.y+texture(madGi3,madUV).rgb*madV.y+texture(madGi4,madUV).rgb*madW.z+texture(madGi5,madUV).rgb*madV.z)*3.2;\nreflectedLight.indirectDiffuse+=madI*material.diffuseColor.rgb*madGiStrength;'
      );
    };
    m.customProgramCacheKey=()=>'mad-ddgi-v1';
    m.needsUpdate=true;
  }
  setQuality(mode){
    if(!this.enabled)return 'UNAVAILABLE';
    this.mode=mode;
    this.quality=mode==='HIGH'?96:mode==='ECO'?22:0;
    this.uniforms.madGiStrength.value=mode==='OFF'?0:1.1;
    return mode;
  }
  cycleQuality(){
    return this.setQuality(this.mode==='HIGH'?'ECO':this.mode==='ECO'?'OFF':'HIGH');
  }
  update() {
    if(!this.enabled||this.disposed||this.quality===0)return;
    // Distributed, amortized work budget: ~96 samples/frame on desktop; 22 on mobile.
    // Each sample actually traces a hemisphere ray + estimates direct and bounced radiance.
    const dirty=new Set();
    for(let t=0;t<this.quality;t++){
      const rayId=(this.cursor++)%(COUNT*6);
      const index=Math.floor(rayId/6),axis=rayId%6;
      const x=index%SIZE[0],y=Math.floor(index/SIZE[0])%SIZE[1],z=Math.floor(index/(SIZE[0]*SIZE[1]));
      const p=[MIN[0]+x/(SIZE[0]-1)*(MAX[0]-MIN[0]),
        MIN[1]+y/(SIZE[1]-1)*(MAX[1]-MIN[1]),
        MIN[2]+z/(SIZE[2]-1)*(MAX[2]-MIN[2])];
      const dir=this.randomHemisphere(axis);
      const sample=this.sampleRay(p,dir);
      const dst=this.probes[axis],bytes=this.bytes[axis],i3=index*3,i4=index*4;
      const alpha=.14;
      for(let c=0;c<3;c++){
        dst[i3+c]+=alpha*(sample[c]-dst[i3+c]);
        bytes[i4+c]=Math.round(clamp(dst[i3+c]/RADIANCE_RANGE*255,0,255));
      }
      dirty.add(axis);
    }
    for(const axis of dirty)this.textures[axis].needsUpdate=true;
    this.updates+=this.quality;
    this.frame++;
  }
  dispose(){
    this.disposed=true;
    for(const texture of this.textures)texture.dispose();
    this.textures.length=0;
  }
}
