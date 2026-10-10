// MAD Mixed Media Atelier: cut wood, assemble found forms, cloth dynamics,
// glue, paint across materials, and bake to indexed, vertex-colored geometry.
// No third-party physics engine or extra WebGL renderer is required.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TYPES=['wood','beam','laminate','metal','ceramic','found','coil','fabric'];
const DEFAULTS={wood:'#ba8051',beam:'#946640',laminate:'#a87343',metal:'#8795a0',
  ceramic:'#d58e76',found:'#b0c7c2',coil:'#b49b78',fabric:'#6c5977',paint:'#ff6655'};
const COLOR=(s)=>new THREE.Color(s||'#ffffff');
const MAX_PARTS=25,MAX_STAMPS=220,MAX_VERTS=45000,ROWS=13,COLS=15;
const mediaMaterial=(kind)=>{
  const prop={
    wood:{roughness:.86,metalness:0},beam:{roughness:.84,metalness:0},
    laminate:{roughness:.89,metalness:0},
    metal:{roughness:.36,metalness:.77},ceramic:{roughness:.34,metalness:.02},
    found:{roughness:.67,metalness:.12},coil:{roughness:.55,metalness:.27},
    fabric:{roughness:.96,metalness:0,side:THREE.DoubleSide},
    paint:{roughness:.48,metalness:0,side:THREE.DoubleSide}
  }[kind]||{roughness:.8,metalness:0};
  return new THREE.MeshStandardMaterial({...prop,vertexColors:true});
};
const previewMaterial=(kind,color)=>new THREE.MeshStandardMaterial({
  color,roughness:kind==='metal'?.32:kind==='fabric'?.94:.76,
  metalness:kind==='metal'?.72:.02,side:THREE.DoubleSide
});
const b64=(arr)=>{
  const bytes=new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength);
  let out='';
  for(let i=0;i<bytes.length;i+=8192)
    out+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(out);
};
const fromB64=(value,Type)=>{
  const raw=atob(value||'');
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  if(bytes.length%Type.BYTES_PER_ELEMENT)throw Error('Invalid mesh payload');
  return new Type(bytes.buffer);
};
const round=(n)=>Math.round(n*4096)/4096;
function woodShape(cut){
  const s=new THREE.Shape();
  const w=1.14,h=1.26,notch=.33;
  if(cut==='bevel'){
    s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h-.44);
    s.lineTo(w-.48,h);s.lineTo(-w,h);s.lineTo(-w,-h);
  }else if(cut==='notch'){
    s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);
    s.lineTo(.22,h);s.lineTo(.22,h-.56);
    s.lineTo(-.38,h-.56);s.lineTo(-.38,h);s.lineTo(-w,h);
    s.lineTo(-w,-h);
  }else if(cut==='angle'){
    s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);
    s.lineTo(-w,h-.58);s.lineTo(-w,-h);
  }else{
    s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);s.lineTo(-w,h);s.closePath();
  }
  const geo=new THREE.ExtrudeGeometry(s,{depth:.21,bevelEnabled:false,
    steps:1,curveSegments:1});
  geo.translate(0,0,-.105);
  geo.computeVertexNormals();return geo;
}
function primitive(kind,cut='straight'){
  switch(kind){
    case 'wood':return woodShape(cut);
    case 'beam':return new THREE.BoxGeometry(.40,2.4,.44,4,18,4);
    case 'laminate':{
      // 48 visible organic stacked contours, inspired by carved / printed
      // laminated wooden sculptures. The geometry itself has undulating layers.
      const points=[];
      for(let i=0;i<=48;i++){
        const t=i/48,y=(t-.5)*2.35;
        const envelope=Math.pow(Math.sin(Math.PI*t),.47);
        const rings=.06*Math.sin(t*48*Math.PI);
        const swell=.25*Math.sin(t*5*Math.PI+.7);
        const radius=Math.max(0,.04+envelope*(.53+swell+rings));
        points.push(new THREE.Vector2(radius,y));
      }
      const geo=new THREE.LatheGeometry(points,28);
      const attr=geo.attributes.position;
      for(let i=0;i<attr.count;i++){
        const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);
        const angle=Math.atan2(z,x);
        const wave=.10*Math.sin(y*5+angle*3);
        attr.setXYZ(i,x*(1+wave)+.12*Math.sin(y*2.9),
          y,z*(1+wave)+.12*Math.cos(y*3.2));
      }
      geo.computeVertexNormals();return geo;
    }
    case 'metal':return new THREE.CylinderGeometry(.25,.36,2.0,16,8);
    case 'ceramic':return new THREE.IcosahedronGeometry(.79,3);
    case 'found':return new THREE.DodecahedronGeometry(.79,1);
    case 'coil':return new THREE.TorusKnotGeometry(.53,.115,92,9,2,3);
    default:return new THREE.BoxGeometry(1,1,.22,8,8,1);
  }
}
function clothGeometry(){
  const pos=[],uv=[],inds=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    pos.push((c/(COLS-1)-.5)*2.05,1.15,(r/(ROWS-1)-.5)*1.70);
    uv.push(c/(COLS-1),r/(ROWS-1));
    if(r&&c){
      const i=r*COLS+c;
      inds.push(i-1,i-COLS,i, i-1,i-COLS-1,i-COLS);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(inds);geo.computeVertexNormals();
  return geo;
}
function partBase(part){
  const geometry=part.kind==='fabric'?clothGeometry():primitive(part.kind,part.cut);
  const mesh=new THREE.Mesh(geometry,previewMaterial(part.kind,part.color));
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.partId=part.id;mesh.userData.medium=part.kind;
  return mesh;
}
function addStamp(root,stroke){
  const [x,y,z,nx,ny,nz,size,hex]=stroke;
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(size,12),
    new THREE.MeshBasicMaterial({color:hex,side:THREE.DoubleSide,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  const normal=new THREE.Vector3(nx,ny,nz).normalize();
  mesh.position.set(x+normal.x*.011,y+normal.y*.011,z+normal.z*.011);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  mesh.userData.medium='paint';mesh.userData.partId=root.userData.partId;
  root.add(mesh);
  return mesh;
}

export class MixedMediaStudio {
  constructor(scene,camera,canvas,{wall=false,vitrine=false,draft=null,onChange=()=>{}}={}){
    this.scene=scene;this.camera=camera;this.canvas=canvas;
    this.wall=wall;this.vitrine=vitrine;this.onChange=onChange;
    this.group=new THREE.Group();scene.add(this.group);
    this.parts=[];this.sequence=0;this.selected=null;
    this.tool='move';this.paintColor='#ff6655';this.brush=.15;
    this.simulations=new Map();this.lastTick=0;
    this.ray=new THREE.Raycaster();this.pointer=null;
    this.selectionOutline=null;
    this._bind();
    if(draft?.parts?.length)this.restoreDraft(draft);
    else {this.add('wood');this.add('ceramic');}
  }
  _bind(){
    const start=e=>{if(!this.group.visible)return;
      if(e.button>1)return;
      e.preventDefault();e.stopImmediatePropagation();
      const hit=this._hit(e);
      if(hit){
        this.select(hit.part.id);
        if(this.tool==='paint'){this._stamp(hit);this.pointer={x:e.clientX,y:e.clientY,type:'paint'};}
        else this.pointer={x:e.clientX,y:e.clientY,type:'move',id:hit.part.id};
      }else this.pointer={x:e.clientX,y:e.clientY,type:'orbit'};
      this.canvas.setPointerCapture(e.pointerId);
    };
    const drag=e=>{if(!this.group.visible||!this.pointer)return;
      e.preventDefault();e.stopImmediatePropagation();
      const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;
      if(this.pointer.type==='paint'){const hit=this._hit(e);if(hit)this._stamp(hit);}
      else if(this.pointer.type==='move'&&this.tool==='move'){
        const p=this.current();
        if(p){
          const a=-this.camera.position.x*0; // view-plane movement remains camera-relative
          p.pos[0]+=dx*.009;
          p.pos[1]-=dy*.009;
          p.pos[0]=clamp(p.pos[0],-2.3,2.3);p.pos[1]=clamp(p.pos[1],-1.0,2.1);
          this._transform(p);this.onChange(this);
        }
      }else if(this.pointer.type==='move'&&this.tool==='rotate'){
        const p=this.current();if(p){
          p.rot[1]+=dx*.013;p.rot[0]+=dy*.008;
          this._transform(p);this.onChange(this);
        }
      }else if(this.pointer.type==='orbit'){
        this.camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),-dx*.007);
        const radius=this.camera.position.length();
        this.camera.position.y=clamp(this.camera.position.y+dy*.008,-2.1,4);
        this.camera.position.setLength(radius);
        this.camera.lookAt(0,0,0);
      }
      this.pointer.x=e.clientX;this.pointer.y=e.clientY;
    };
    const stop=e=>{if(!this.group.visible)return;
      this.pointer=null;
    };
    this.canvas.addEventListener('pointerdown',start,{capture:true});
    this.canvas.addEventListener('pointermove',drag,{capture:true});
    this.canvas.addEventListener('pointerup',stop,{capture:true});
    this.canvas.addEventListener('pointercancel',stop,{capture:true});
    this._events=[[ 'pointerdown',start ],['pointermove',drag],
      ['pointerup',stop],['pointercancel',stop]];
  }
  _hit(e){
    const rect=this.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const xy=new THREE.Vector2(
      (e.clientX-rect.left)/rect.width*2-1,
      -(e.clientY-rect.top)/rect.height*2+1);
    this.ray.setFromCamera(xy,this.camera);
    const meshes=this.parts.filter(p=>p.mesh).map(p=>p.mesh);
    const hits=this.ray.intersectObjects(meshes,false);
    if(!hits.length)return null;
    const hit=hits[0];
    const part=this.parts.find(p=>p.mesh===hit.object);
    return part?{part,hit}:null;
  }
  _stamp({part,hit}){
    if(part.strokes.length>=MAX_STAMPS)return;
    const point=part.root.worldToLocal(hit.point.clone());
    const normal=hit.face?.normal?.clone()||new THREE.Vector3(0,0,1);
    normal.transformDirection(hit.object.matrixWorld);
    normal.transformDirection(part.root.matrixWorld.clone().invert());
    const stroke=[point.x,point.y,point.z,normal.x,normal.y,normal.z,
      this.brush,this.paintColor];
    part.strokes.push(stroke);addStamp(part.root,stroke);
    this.onChange(this);
  }
  add(kind='wood'){
    if(this.parts.length>=MAX_PARTS)return false;
    if(!TYPES.includes(kind))kind='wood';
    const i=this.sequence++;
    const part={
      id:i,kind,color:DEFAULTS[kind],cut:'straight',
      pos:[(i%4-1.5)*.35,.15+Math.floor(i/4)*.18,
        this.wall?.60:(i%3-1)*.23],
      rot:[0,i*.35,0],scale:[.55,.55,.55],
      gluedTo:null,strokes:[],baked:false,
      root:new THREE.Group(),mesh:null,sim:null
    };
    part.root.userData.partId=i;
    part.mesh=partBase(part);part.root.add(part.mesh);
    this.group.add(part.root);this.parts.push(part);
    if(kind==='fabric')this._startCloth(part);
    this.select(i);return true;
  }
  select(id){
    const part=this.parts.find(p=>p.id===id);
    if(!part)return;
    this.selected=id;
    if(this.selectionOutline){
      this.group.remove(this.selectionOutline);
      this.selectionOutline.geometry.dispose();
      this.selectionOutline.material.dispose();
    }
    this.selectionOutline=new THREE.BoxHelper(part.mesh,0xc9f16d);
    this.selectionOutline.visible=true;
    this.group.add(this.selectionOutline);
    this.onChange(this);
  }
  current(){return this.parts.find(p=>p.id===this.selected)||null}
  _transform(part){
    part.root.position.set(...part.pos);
    part.root.rotation.set(...part.rot);
    part.root.scale.set(...part.scale);
    if(this.wall){
      part.root.updateMatrixWorld(true);
      const bbox=new THREE.Box3().setFromObject(part.root);
      if(!bbox.isEmpty()&&bbox.min.z<.10){
        part.pos[2]+=.10-bbox.min.z;
        part.root.position.z=part.pos[2];
      }
    }
    this.selectionOutline?.update();
  }
  setTransform(axis,value){
    const p=this.current();if(!p)return;
    const [name,index]=axis.split('.');
    if(!['pos','rot','scale'].includes(name))return;
    if(![0,1,2].includes(Number(index)))return;
    p[name][Number(index)]=name==='rot'?value*Math.PI/180:value;
    if(name==='scale')p[name][Number(index)]=clamp(value,.15,2.1);
    this._transform(p);this.onChange(this);
  }
  setCut(shape){
    const p=this.current();if(!p||p.kind!=='wood')return;
    p.cut=shape;
    p.root.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();
    p.mesh=partBase(p);p.root.add(p.mesh);
    if(this.selectionOutline)this.select(p.id);
    this._transform(p);this.onChange(this);
  }
  glue(){
    const p=this.current();if(!p||this.parts.length<2)return false;
    // Glue to the previous piece in the component list, preserving its world
    // pose. Descendants now follow their bonded parent when it is transformed.
    const index=this.parts.indexOf(p);
    const target=this.parts[index>0?index-1:index+1];
    if(!target)return false;
    // Avoid cycles (which would otherwise break Three.js parenting).
    let cursor=target;
    while(cursor){
      if(cursor===p)return false;
      cursor=this.parts.find(q=>q.id===cursor.gluedTo);
    }
    this.group.updateMatrixWorld(true);
    target.root.attach(p.root);
    p.gluedTo=target.id;
    p.pos=p.root.position.toArray();
    p.rot=[p.root.rotation.x,p.root.rotation.y,p.root.rotation.z];
    p.scale=p.root.scale.toArray();
    this.select(p.id);
    return true;
  }
  remove(){
    const p=this.current();if(!p)return;
    this.group.updateMatrixWorld(true);
    for(const child of this.parts.filter(q=>q.gluedTo===p.id)){
      this.group.attach(child.root);
      child.gluedTo=null;
      child.pos=child.root.position.toArray();
      child.rot=[child.root.rotation.x,child.root.rotation.y,child.root.rotation.z];
      child.scale=child.root.scale.toArray();
    }
    p.root.removeFromParent();
    p.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()});
    this.parts=this.parts.filter(q=>q!==p);
    this.simulations.delete(p.id);
    this.selected=null;
    if(this.parts.length)this.select(this.parts[this.parts.length-1].id);
    else this.onChange(this);
  }
  setPaintColor(value){this.paintColor=value}
  setBrushSize(value){this.brush=clamp(Number(value),.025,.42)}
  setTool(value){this.tool=value}
  _startCloth(p){
    const geometry=p.mesh.geometry;
    const verts=Float32Array.from(geometry.attributes.position.array);
    p.sim={current:verts,previous:Float32Array.from(verts),rest:Float32Array.from(verts)};
    this.simulations.set(p.id,p.sim);
  }
  drape(){
    const p=this.current();
    if(!p||p.kind!=='fabric')return false;
    p.baked=false;
    const attr=p.mesh.geometry.attributes.position;
    for(let i=0;i<attr.count;i++){
      const c=i%COLS,r=Math.floor(i/COLS);
      attr.setXYZ(i,(c/(COLS-1)-.5)*2.05,1.15,
        (r/(ROWS-1)-.5)*1.7);
    }
    attr.needsUpdate=true;
    this._startCloth(p);
    return true;
  }
  _simulate(p,dt){
    if(p.baked||!p.sim)return;
    const {current,previous,rest}=p.sim;
    const supports=[];
    for(const solid of this.parts){
      if(solid===p||solid.kind==='fabric')continue;
      solid.root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(solid.mesh);
      if(bounds.isEmpty())continue;
      const centre=bounds.getCenter(new THREE.Vector3());
      supports.push({centre,radius:Math.min(1.1,
        bounds.getSize(new THREE.Vector3()).length()*.31)});
    }
    const pinned=i=>i===0||i===COLS-1;
    for(let i=0;i<current.length/3;i++){
      if(pinned(i))continue;
      const j=i*3,x=current[j],y=current[j+1],z=current[j+2];
      const vx=(x-previous[j])*.988,vy=(y-previous[j+1])*.988;
      const vz=(z-previous[j+2])*.988;
      previous[j]=x;previous[j+1]=y;previous[j+2]=z;
      current[j]=x+vx;current[j+1]=y+vy-.00125;
      current[j+2]=z+vz;
      for(const {centre,radius} of supports){
        // Cloth local->model position approximation for unrotated drape.
        const dx=current[j]+p.pos[0]-centre.x;
        const dy=current[j+1]+p.pos[1]-centre.y;
        const dz=current[j+2]+p.pos[2]-centre.z;
        const length=Math.hypot(dx,dy,dz);
        if(length<radius&&length>.00001){
          const k=(radius-length)/length;
          current[j]+=dx*k;current[j+1]+=dy*k;current[j+2]+=dz*k;
        }
      }
      current[j+1]=Math.max(current[j+1],-1.16-p.pos[1]);
      if(this.wall)current[j+2]=Math.max(current[j+2],.08-p.pos[2]);
    }
    // Constraint relaxation for stable inextensible woven fabric.
    const satisfy=(ia,ib)=>{
      const a=ia*3,b=ib*3;
      const restLen=Math.hypot(rest[a]-rest[b],
        rest[a+1]-rest[b+1],rest[a+2]-rest[b+2]);
      let dx=current[b]-current[a],dy=current[b+1]-current[a+1],
        dz=current[b+2]-current[a+2];
      const distance=Math.hypot(dx,dy,dz);
      if(distance<1e-8)return;
      const delta=(distance-restLen)/distance*.48;
      if(!pinned(ia)){
        current[a]+=dx*delta;current[a+1]+=dy*delta;current[a+2]+=dz*delta;
      }
      if(!pinned(ib)){
        current[b]-=dx*delta;current[b+1]-=dy*delta;current[b+2]-=dz*delta;
      }
    };
    for(let pass=0;pass<3;pass++)
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        const i=r*COLS+c;
        if(c<COLS-1)satisfy(i,i+1);
        if(r<ROWS-1)satisfy(i,i+COLS);
      }
    p.mesh.geometry.attributes.position.array.set(current);
    p.mesh.geometry.attributes.position.needsUpdate=true;
    p.mesh.geometry.computeVertexNormals();
    p.mesh.geometry.computeBoundingSphere();
  }
  update(dt=.016){
    if(this.parts.length===0)return;
    this.group.visible=true;
    for(const p of this.parts){
      this._transform(p);
      if(p.kind==='fabric'&&!p.baked)this._simulate(p,Math.min(dt,.05));
    }
    this.selectionOutline?.update();
  }
  freezeCloth(){
    for(const p of this.parts)if(p.kind==='fabric'){
      // Settle cloth before final baking. About 0.8 s of extra physics.
      if(!p.baked)for(let i=0;i<50;i++)this._simulate(p,1/60);
      p.baked=true;p.sim=null;this.simulations.delete(p.id);
    }
    this.onChange(this);
  }
  getSummary(){
    const t=this.parts.reduce((map,p)=>(map[p.kind]=(map[p.kind]||0)+1,map),{});
    return this.parts.length+' pieces · '+Object.entries(t).map(([k,n])=>n+' '+k).join(', ')+
      ' · '+this.parts.reduce((n,p)=>n+p.strokes.length,0)+' paint dabs';
  }
  bake(){
    this.freezeCloth();
    const buckets=new Map();
    this.group.updateMatrixWorld(true);
    const normalMatrix=new THREE.Matrix3(),pos=new THREE.Vector3(),normal=new THREE.Vector3();
    const stageInverse=this.group.matrixWorld.clone().invert();
    const localMatrix=new THREE.Matrix4();
    for(const part of this.parts){
      part.root.updateMatrixWorld(true);
      const meshes=[];
      part.root.traverse(o=>{
        // Bonded child pieces have their own source-bake pass.
        if(o.isMesh&&o.geometry&&o.userData.partId===part.id)meshes.push(o);
      });
      for(const mesh of meshes){
        const geometry=mesh.geometry;
        if(!geometry.attributes.position)continue;
        if(!geometry.attributes.normal)geometry.computeVertexNormals();
        const kind=mesh.userData.medium||part.kind;
        if(!buckets.has(kind))buckets.set(kind,[]);
        const dest=buckets.get(kind);
        // Bake in artwork-local coordinates, not scaled preview coordinates.
        localMatrix.multiplyMatrices(stageInverse,mesh.matrixWorld);
        normalMatrix.getNormalMatrix(localMatrix);
        const attr=geometry.attributes.position,nAttr=geometry.attributes.normal;
        const idx=geometry.index;
        const rgb=COLOR(mesh.userData.medium==='paint'?
          '#ffffff':part.color);
        // Paint decals keep their own chosen colors from BasicMaterial.
        if(kind==='paint')rgb.copy(mesh.material.color);
        const count=idx?idx.count:attr.count;
        for(let i=0;i<count;i++){
          const v=idx?idx.getX(i):i;
          pos.fromBufferAttribute(attr,v).applyMatrix4(localMatrix);
          normal.fromBufferAttribute(nAttr,v).applyMatrix3(normalMatrix).normalize();
          const grain=(kind==='wood'||kind==='beam'||kind==='laminate')?
            .78+.16*Math.sin(pos.y*21+Math.sin(pos.x*8)*.8):1;
          dest.push([pos.x,pos.y,pos.z,normal.x,normal.y,normal.z,
            clamp(rgb.r*grain,0,1),clamp(rgb.g*grain,0,1),
            clamp(rgb.b*grain,0,1)]);
        }
      }
    }
    const P=[],N=[],C=[],I=[],groups=[],materialNames=[];
    const vertexMap=new Map();
    for(const [kind,verts] of buckets){
      const before=I.length;
      materialNames.push(kind);
      for(let j=0;j<verts.length;j+=3){
        const triangle=verts.slice(j,j+3);
        if(triangle.length!==3)continue;
        const keys=triangle.map(v=>v.slice(0,6).map(t=>Math.round(t*2048))
          .concat(v.slice(6).map(t=>Math.round(t*255))).join(',')+':'+kind);
        const added=keys.filter(key=>!vertexMap.has(key)).length;
        if(P.length/3+added>MAX_VERTS)break;
        for(let k=0;k<3;k++){
          const key=keys[k],v=triangle[k];
          if(!vertexMap.has(key)){
            vertexMap.set(key,P.length/3);
            P.push(round(v[0]),round(v[1]),round(v[2]));
            N.push(clamp(Math.round(v[3]*127),-127,127),
              clamp(Math.round(v[4]*127),-127,127),
              clamp(Math.round(v[5]*127),-127,127));
            C.push(clamp(Math.round(v[6]*255),0,255),
              clamp(Math.round(v[7]*255),0,255),
              clamp(Math.round(v[8]*255),0,255));
          }
          I.push(vertexMap.get(key));
        }
      }
      if(I.length>before)groups.push([before,I.length-before,kind]);
    }
    if(!I.length)throw Error('Add at least one sculptural element first.');
    return {v:1,p:b64(Float32Array.from(P)),n:b64(Int8Array.from(N)),
      c:b64(Uint8Array.from(C)),i:b64(Uint16Array.from(I)),
      groups,materials:materialNames,vertices:P.length/3,faces:I.length/3};
  }
  saveDraft(){
    return {selected:this.selected,tool:this.tool,
      parts:this.parts.map(p=>({
        kind:p.kind,color:p.color,cut:p.cut,
        pos:[...p.pos],rot:[...p.rot],scale:[...p.scale],
        gluedTo:p.gluedTo,strokes:p.strokes.map(v=>[...v]),
        baked:p.baked,
        vertices:p.kind==='fabric'?Array.from(p.mesh.geometry.attributes.position.array):null
      }))
    };
  }
  restoreDraft(data){
    for(const old of [...this.parts])this.group.remove(old.root);
    this.parts=[];this.simulations.clear();this.selected=null;this.sequence=0;
    for(const source of data.parts.slice(0,MAX_PARTS)){
      if(!this.add(source.kind))break;
      const p=this.current();
      p.color=source.color||p.color;
      p.cut=source.cut||'straight';
      p.pos=[...source.pos];p.rot=[...source.rot];p.scale=[...source.scale];
      p.gluedTo=source.gluedTo??null;
      p.baked=!!source.baked;
      if(p.cut!=='straight')this.setCut(p.cut);
      if(p.mesh.material.color)p.mesh.material.color.set(p.color);
      if(p.kind==='fabric'&&source.vertices?.length===
          p.mesh.geometry.attributes.position.count*3){
        p.mesh.geometry.attributes.position.array.set(source.vertices);
        p.mesh.geometry.attributes.position.needsUpdate=true;
        p.mesh.geometry.computeVertexNormals();
        if(p.sim){
          p.sim.current.set(source.vertices);
          p.sim.previous.set(source.vertices);
        }
      }
      for(const stroke of (source.strokes||[]).slice(0,MAX_STAMPS)){
        p.strokes.push(stroke);addStamp(p.root,stroke);
      }
      this._transform(p);
    }
    // Restore actual parent-child bonds after all the pieces exist.
    for(const p of this.parts){
      const parent=this.parts.find(q=>q.id===p.gluedTo);
      if(parent)parent.root.add(p.root);
    }
    this.group.updateMatrixWorld(true);
    if(data.parts.length)this.select(clamp(data.selected??0,0,this.parts.length-1));
    this.tool=data.tool||'move';
  }
  dispose(){
    for(const [event,fn] of this._events)
      this.canvas.removeEventListener(event,fn,true);
    this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()});
    this.scene.remove(this.group);
    this.parts.length=0;this.simulations.clear();
  }
}
export function mixedArtwork(art){
  const data=art.mixed;
  if(!data||data.v!==1)throw Error('Unsupported mixed-media file');
  const p=fromB64(data.p,Float32Array),n=fromB64(data.n,Int8Array),
    c=fromB64(data.c,Uint8Array),i=fromB64(data.i,Uint16Array);
  if(!p.length||p.length%3||n.length!==p.length||c.length!==p.length||
     i.length%3||p.length/3>MAX_VERTS||i.length>MAX_VERTS*10)
    throw Error('Invalid sculpture geometry');
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  const normals=Float32Array.from(n,v=>v/127);
  const colors=Float32Array.from(c,v=>v/255);
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(Array.from(i));
  const matIds=data.materials||[];
  const mats=matIds.map(mediaMaterial);
  for(const [start,count,kind] of data.groups||[]){
    const index=matIds.indexOf(kind);
    if(index>=0&&start>=0&&count>0&&start+count<=i.length)
      g.addGroup(start,count,index);
  }
  g.computeBoundingBox();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mats.length?mats:[mediaMaterial('wood')]);
  m.castShadow=true;m.receiveShadow=true;
  const group=new THREE.Group();group.add(m);
  return group;
}
