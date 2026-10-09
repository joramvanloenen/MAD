// MAD smooth volumetric clay: sculptable signed-distance field + adaptive meshes.
// CPU mesh extraction uses marching tetrahedra; runtime THREE.LOD reduces distant detail.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
export const CLAY_N=25,CLAY_MIN=-1.5,CLAY_SIZE=3.0;
const SPACING=CLAY_SIZE/(CLAY_N-1),COUNT=CLAY_N**3;
const EDGES=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal=a=>{const r=Math.hypot(...a)||1;return a.map(t=>t/r)};
const xyz=i=>CLAY_MIN+i*SPACING;
const encode=(array)=>{let str='';for(let i=0;i<array.length;i+=2048)str+=String.fromCharCode(...array.subarray(i,i+2048));return btoa(str)};
const decode=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));

export class ClayField {
  constructor(wall=false,serialized=null){
    this.wall=!!(serialized?.wall??wall);
    this.field=new Float32Array(COUNT);
    this.pigment=new Uint8Array(COUNT);
    this.palette=serialized?.palette||['#c5eb68'];
    if(serialized?.density){
      const density=decode(serialized.density);
      const pigment=serialized.colors?decode(serialized.colors):new Uint8Array(COUNT);
      if(density.length!==COUNT)throw Error('Unsupported clay sculpt resolution');
      for(let i=0;i<COUNT;i++)this.field[i]=density[i]/255*4-2;
      this.pigment.set(pigment.subarray(0,COUNT));
    }else{
      for(let z=0;z<CLAY_N;z++)for(let y=0;y<CLAY_N;y++)for(let x=0;x<CLAY_N;x++){
        const wx=xyz(x),wy=xyz(y),wz=xyz(z);
        let v=Math.hypot(wx,wy,wz-(this.wall?.55:0))-.89;
        if(this.wall)v=Math.max(v,.018-wz);
        this.field[this.index(x,y,z)]=v;
      }
    }
  }
  index(x,y,z){return x+CLAY_N*(y+CLAY_N*z)}
  at(x,y,z){return this.field[this.index(clamp(x,0,CLAY_N-1),clamp(y,0,CLAY_N-1),clamp(z,0,CLAY_N-1))]}
  sample(pos){
    const q=pos.map(v=>clamp((v-CLAY_MIN)/SPACING,0,CLAY_N-1));
    const i=q.map(Math.floor),f=q.map((v,k)=>v-i[k]);
    const x=i[0],y=i[1],z=i[2];
    let result=0;
    for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const weight=(dx?f[0]:1-f[0])*(dy?f[1]:1-f[1])*(dz?f[2]:1-f[2]);
      result+=weight*this.at(x+dx,y+dy,z+dz);
    }
    return result;
  }
  gradient(p){
    const h=SPACING*.55;
    return normal([
      this.sample([p[0]+h,p[1],p[2]])-this.sample([p[0]-h,p[1],p[2]]),
      this.sample([p[0],p[1]+h,p[2]])-this.sample([p[0],p[1]-h,p[2]]),
      this.sample([p[0],p[1],p[2]+h])-this.sample([p[0],p[1],p[2]-h])
    ]);
  }
  colorIndex(hex){
    let i=this.palette.indexOf(hex);
    if(i<0){
      if(this.palette.length>=32)i=0;
      else {this.palette.push(hex);i=this.palette.length-1;}
    }
    return i;
  }
  brush(position,radius=.30,strength=.12,tool='add',hex='#c5eb68'){
    const [px,py,pz]=position;
    const min=[px-radius,py-radius,pz-radius].map(v=>clamp(Math.floor((v-CLAY_MIN)/SPACING),0,CLAY_N-1));
    const max=[px+radius,py+radius,pz+radius].map(v=>clamp(Math.ceil((v-CLAY_MIN)/SPACING),0,CLAY_N-1));
    const pigment=this.colorIndex(hex);
    const changes=[];
    for(let z=min[2];z<=max[2];z++)for(let y=min[1];y<=max[1];y++)for(let x=min[0];x<=max[0];x++){
      const p=[xyz(x),xyz(y),xyz(z)],d=Math.hypot(p[0]-px,p[1]-py,p[2]-pz);
      if(d>radius||this.wall&&p[2]<-.001)continue;
      const falloff=(1-d/radius)**2,idx=this.index(x,y,z);
      if(tool==='paint'){if(falloff>.11)this.pigment[idx]=pigment;continue;}
      const old=this.field[idx];let next=old;
      if(tool==='add')next=old-strength*falloff;
      else if(tool==='subtract')next=old+strength*falloff;
      else if(tool==='smooth'){
        const ave=(this.at(x-1,y,z)+this.at(x+1,y,z)+this.at(x,y-1,z)+this.at(x,y+1,z)+this.at(x,y,z-1)+this.at(x,y,z+1))/6;
        next=old+(ave-old)*clamp(strength*5*falloff,0,1);
      }else if(tool==='flatten'){
        const target=(p[2]-pz)*.85;
        next=old+(target-old)*clamp(strength*1.6*falloff,0,1);
      }
      if(this.wall)next=Math.max(next,.018-p[2]);
      changes.push([idx,clamp(next,-2,2)]);
    }
    for(const [index,value] of changes)this.field[index]=value;
  }
  serialize(){
    const density=new Uint8Array(COUNT);
    for(let i=0;i<COUNT;i++)density[i]=Math.round(clamp((this.field[i]+2)/4*255,0,255));
    return {density:encode(density),colors:encode(this.pigment),palette:this.palette,wall:this.wall,version:1};
  }
  geometry(step=1){
    step=clamp(Math.round(step),1,4);
    const vertices=[],normals=[],colors=[];
    const palette=this.palette.map(c=>new THREE.Color(c));
    const white=new THREE.Color('#ffffff');
    const getColor=p=>{
      const ix=p.map(v=>clamp(Math.round((v-CLAY_MIN)/SPACING),0,CLAY_N-1));
      return palette[this.pigment[this.index(...ix)]]||white;
    };
    for(let z=0;z<CLAY_N-1;z+=step)
      for(let y=0;y<CLAY_N-1;y+=step)
        for(let x=0;x<CLAY_N-1;x+=step){
          const sx=Math.min(step,CLAY_N-1-x),sy=Math.min(step,CLAY_N-1-y),sz=Math.min(step,CLAY_N-1-z);
          const p=[],values=[];
          for(const [cx,cy,cz] of CORNERS){
            const ix=x+cx*sx,iy=y+cy*sy,iz=z+cz*sz;
            p.push([xyz(ix),xyz(iy),xyz(iz)]);
            values.push(this.at(ix,iy,iz));
          }
          if(values.every(v=>v>=0)||values.every(v=>v<0))continue;
          for(const tetra of TETS){
            const vs=tetra.map(k=>values[k]),points=[];
            if(vs.every(v=>v>=0)||vs.every(v=>v<0))continue;
            for(const [ai,bi] of EDGES){
              const va=vs[ai],vb=vs[bi];
              if((va<0)===(vb<0))continue;
              const t=clamp(va/(va-vb),0,1),a=p[tetra[ai]],b=p[tetra[bi]];
              points.push(a.map((v,k)=>v+(b[k]-v)*t));
            }
            if(points.length<3)continue;
            const center=[0,0,0];
            for(const v of points)for(let i=0;i<3;i++)center[i]+=v[i]/points.length;
            const outward=this.gradient(center);
            const axis=Math.abs(outward[1])>.87?[1,0,0]:[0,1,0];
            const tangent=normal(cross(axis,outward)),bitangent=cross(outward,tangent);
            points.sort((a,b)=>{
              const da=a.map((v,k)=>v-center[k]),db=b.map((v,k)=>v-center[k]);
              return Math.atan2(dot(da,bitangent),dot(da,tangent))
                -Math.atan2(dot(db,bitangent),dot(db,tangent));
            });
            for(let i=1;i<points.length-1;i++){
              for(const v of [points[0],points[i],points[i+1]]){
                vertices.push(...v);normals.push(...this.gradient(v));
                const c=getColor(v);colors.push(c.r,c.g,c.b);
              }
            }
          }
        }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
export function clayObject(a,sculptureMaterial){
  const field=new ClayField(!!a.wallRelief,a.clay);
  const lod=new THREE.LOD();
  for(const [step,distance] of [[1,0],[2,9],[3,23]]){
    const material=sculptureMaterial({...a,color:'#ffffff'});
    material.vertexColors=true;
    material.needsUpdate=true;
    const mesh=new THREE.Mesh(field.geometry(step),material);
    mesh.castShadow=true;mesh.receiveShadow=true;
    lod.addLevel(mesh,distance);
  }
  return lod;
}
