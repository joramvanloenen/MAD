// MAD static global-illumination baker (pure JS, no Three.js/WebGL).
// Offline diffuse path gathering against an architectural proxy: static
// walls, floors, ceiling and permanent partition segments. Visitor art and
// moving props are intentionally omitted. Output: 6-chart RGB565 lightmap.
export const TILE=64, W=TILE*2, H=TILE*3;
export const ROOMS=['gallery','wing','upper','depot','cellar'];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=a=>{const k=Math.hypot(...a)||1;return a.map(v=>v/k)};
const mul=(a,b)=>a.map((v,i)=>v*b[i]);
const PAL={
 gallery:[.90,.87,.78],wing:[.87,.91,.91],upper:[.88,.91,.96],
 depot:[.84,.88,.88],cellar:[.44,.41,.37]
};
function architecture(room){
 const box=[];
 const push=(x,z,hx,hz)=>box.push([x,3.84,z,hx,3.84,hz]);
 if(room==='gallery'){
  for(const x of [-6.5,7.5])
   for(const z of [-8.675,8.675])push(x,z,.15,3.125);
 }
 if(room==='wing'){
  for(const x of [-7.2,6.8])
   for(const z of [-7.36,7.36])push(x,z,.12,4.26);
 }
 return box;
}
function hitBoxes(o,d,boxes,far=1e8){
 let best=null,nearest=far;
 for(const b of boxes){
  let tmin=-1e8,tmax=1e8,side=-1,sign=1;
  for(let k=0;k<3;k++){
   const a=b[k]-b[3+k],c=b[k]+b[3+k];
   if(Math.abs(d[k])<1e-8){if(o[k]<a||o[k]>c){tmax=-1e8;break}continue}
   let t1=(a-o[k])/d[k],t2=(c-o[k])/d[k],sg=-1;
   if(t1>t2){const temp=t1;t1=t2;t2=temp;sg=1}
   if(t1>tmin){tmin=t1;side=k;sign=sg}
   tmax=Math.min(tmax,t2);
   if(tmin>tmax)break;
  }
  if(tmin>tmax||tmax<.005)continue;
  const t=tmin>.005?tmin:tmax;
  if(t>=nearest)continue;
  const p=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t];
  let n=[0,0,0];if(side>=0)n[side]=t===tmin?sign:-sign;
  nearest=t;best={t,p,n,albedo:[.84,.84,.80]};
 }
 return best;
}
function trace(o,d,boxes){
 let dist=1e8,best=null;
 const faces=[
  [0,-19.5,[1,0,0]],[0,19.5,[-1,0,0]],
  [1,0,[0,1,0]],[1,8,[0,-1,0]],
  [2,-12,[0,0,1]],[2,12,[0,0,-1]]
 ];
 for(const [axis,coord,n] of faces){
  if(Math.abs(d[axis])<1e-9)continue;
  const t=(coord-o[axis])/d[axis];
  if(t<.006||t>=dist)continue;
  const p=o.map((v,k)=>v+d[k]*t);
  if(p[0]<-19.501||p[0]>19.501||p[1]<-.001||
     p[1]>8.001||p[2]<-12.001||p[2]>12.001)continue;
  dist=t;
  best={t,p,n,albedo:axis===1&&coord===0?
    [.66,.56,.45]:[.90,.88,.82]};
 }
 return hitBoxes(o,d,boxes,dist)||best;
}
function pointSources(room){
 const ls=[];
 if(room==='cellar'){
  for(const x of [-13,-3.5,7.8])
   for(const z of [-7.7,7.7])ls.push([x,3.4,z,5.5,[1,.61,.31]]);
 }else{
  for(const x of [-15,-10,-4,0,4,10,15])
   for(const z of [-8,8])ls.push([x,7.45,z,8.0,[1,.88,.74]]);
  for(const x of [-12,0,12])ls.push([x,7.45,0,4.0,[1,.96,.87]]);
 }
 return ls;
}
function direct(p,n,lights,boxes){
 const e=[.09,.10,.11];
 for(const [x,y,z,power,c] of lights){
  const dx=x-p[0],dy=y-p[1],dz=z-p[2];
  const r2=dx*dx+dy*dy+dz*dz;
  if(r2>240)continue;
  const dir=unit([dx,dy,dz]),nd=Math.max(0,dot(n,dir));
  if(nd<.004)continue;
  const blockers=hitBoxes(p.map((v,i)=>v+n[i]*.035),dir,boxes,
    Math.sqrt(r2)-.07);
  if(blockers)continue;
  const bright=(power*nd)/(2.8+r2)*.44;
  e[0]+=bright*c[0];e[1]+=bright*c[1];e[2]+=bright*c[2];
 }
 return e;
}
// Cosine-weighted hemisphere in a stable tangent frame, deterministic
// low-discrepancy samples to keep fixed rebakes reproducible.
function direction(n,index,count,seed){
 const u=(index+.5)/count,phi=(index*.618033988749895+seed)*Math.PI*2;
 const radial=Math.sqrt(u),vertical=Math.sqrt(1-u);
 const helper=Math.abs(n[1])>.89?[1,0,0]:[0,1,0];
 const t=unit([n[1]*helper[2]-n[2]*helper[1],
  n[2]*helper[0]-n[0]*helper[2],n[0]*helper[1]-n[1]*helper[0]]);
 const b=[n[1]*t[2]-n[2]*t[1],
 n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]];
 return n.map((v,k)=>v*vertical+radial*(Math.cos(phi)*t[k]+Math.sin(phi)*b[k]));
}
function chart(chartId,u,v){
 const x=-19.5+39*u,y=8*v,z=-12+24*u;
 const depth=-12+24*v;
 switch(chartId){
 case 0:return [[x,.035,depth],[0,1,0]];  // floor
 case 1:return [[x,7.965,depth],[0,-1,0]]; // ceiling
 case 2:return [[x,y,-11.965],[0,0,1]];    // north
 case 3:return [[x,y,11.965],[0,0,-1]];    // south
 case 4:return [[-19.465,y,z],[1,0,0]];    // west
 default:return [[19.465,y,z],[-1,0,0]];   // east
 }
}
function sample(p,n,room,lights,boxes,seed,rays){
 const ambient=PAL[room],directL=direct(p,n,lights,boxes);
 const bounce=[0,0,0];
 for(let k=0;k<rays;k++){
  const d=direction(n,k,rays,seed);
  const o=p.map((v,i)=>v+n[i]*.045);
  const hit=trace(o,d,boxes);
  if(!hit)continue;
  const reflect=direct(hit.p,hit.n,lights,boxes);
  for(let i=0;i<3;i++)bounce[i]+=reflect[i]*hit.albedo[i];
 }
 // One explicit diffuse bounce plus a very subdued constant higher-order
 // term. This lightmap contains INDIRECT irradiance only; direct lights
 // stay managed by the normal Three.js scene.
 return ambient.map((c,i)=>{
  const indirect=.13*c+bounce[i]/Math.max(1,rays)*.67;
  const AO=Math.min(1,Math.max(.60,
   .92-.12/(.8+Math.abs(p[0]+19.5))-.12/(.8+Math.abs(p[0]-19.5))
     -.1/(.8+Math.abs(p[2]+12))-.1/(.8+Math.abs(p[2]-12))));
  return clamp(indirect*AO*(room==='cellar'?.66:.95),.018,.95);
 });
}
function pack565(r,g,b){
 const red=Math.round(clamp(r,0,1)*31);
 const green=Math.round(clamp(g,0,1)*63);
 const blue=Math.round(clamp(b,0,1)*31);
 return (red<<11)|(green<<5)|blue;
}
// Top row: floor, ceiling. Middle: north, south. Bottom: west, east.
// Each tile reserves one texel of padding to prevent cross-chart filtering.
export function bakeRoom(room,{tile=TILE,rays=6}={}){
 if(!ROOMS.includes(room))throw Error('Unsupported bake room: '+room);
 const width=tile*2,height=tile*3;
 const bytes=new Uint8Array(width*height*2);
 const lights=pointSources(room),boxes=architecture(room);
 for(let ch=0;ch<6;ch++){
  const tx=ch%2,ty=Math.floor(ch/2);
  for(let py=0;py<tile;py++)for(let px=0;px<tile;px++){
   const u=clamp((px-1)/Math.max(1,tile-3),0,1);
   const v=clamp((py-1)/Math.max(1,tile-3),0,1);
   const [p,n]=chart(ch,u,v);
   const result=sample(p,n,room,lights,boxes,
      (px*37+py*101+ch*17+ROOMS.indexOf(room)*331)*.003,rays);
   const packed=pack565(...result);
   const at=((ty*tile+py)*width+(tx*tile+px))*2;
   bytes[at]=packed&255;bytes[at+1]=packed>>8;
  }
 }
 return {room,tile,width,height,format:'RGB565',data:bytes};
}
export function unpack565(input){
 if(!input||input.length%2)throw Error('Invalid lightmap');
 const out=new Uint8Array(input.length*2);
 for(let i=0;i<input.length;i+=2){
  const p=input[i]|(input[i+1]<<8),j=i*2;
  out[j]=Math.round(((p>>11)&31)*255/31);
  out[j+1]=Math.round(((p>>5)&63)*255/63);
  out[j+2]=Math.round((p&31)*255/31);
  out[j+3]=255;
 }
 return out;
}
