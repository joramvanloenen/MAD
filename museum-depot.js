// MAD Depot: white powder-coated, ceiling/floor guided sliding picture racks.
// Archived 2D art and wall reliefs are physically mounted to mesh panels.
// Includes movement, collision footprints, and interactive artwork targets.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const PANEL_DEPTH=4.45;
const PANEL_HEIGHT=3.65;
const RACKS_PER_BANK=10;
const RACK_X0=-16.2;
const RACK_XSTEP=3.55;
const MAX_PICTURES_PER_RACK=4;
const METAL=new THREE.MeshStandardMaterial({color:0xd8dfdc,metalness:.56,roughness:.43});
const FRAME=new THREE.MeshStandardMaterial({color:0xf0f1eb,metalness:.45,roughness:.48});
const RAIL=new THREE.MeshStandardMaterial({color:0x87918c,metalness:.7,roughness:.32});
const DARK=new THREE.MeshStandardMaterial({color:0x414a48,metalness:.55,roughness:.38});
const WIRE=new THREE.LineBasicMaterial({color:0xb5c0bb,transparent:true,opacity:.73});
const HIT=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,colorWrite:false,depthWrite:false});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function part(parent,w,h,d,material,x,y,z){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  o.position.set(x,y,z);
  o.castShadow=material!==HIT;
  o.receiveShadow=material!==HIT;
  parent.add(o);
  return o;
}

function meshPanel(){
  const coords=[];
  const line=(x,y1,z1,y2,z2)=>coords.push(x,y1,z1,x,y2,z2);
  for(const x of [-.022,.022]){
    for(let z=-2.14;z<=2.15;z+=.175)
      line(x,.22,z,3.78,z);
    for(let y=.22;y<=3.79;y+=.17)
      line(x,y,-2.17,y,2.17);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  const lines=new THREE.LineSegments(geo,WIRE);
  return lines;
}
function numberPlate(text){
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=172;
  const c=canvas.getContext('2d');
  c.fillStyle='#dee6e1';c.fillRect(0,0,480,172);
  c.fillStyle='#26342f';c.font='bold 65px Arial';
  c.textAlign='center';c.fillText(text,240,101);
  // Single rack identifier, no giant floating instruction billboard.
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.35,.125),
    new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
  return sign;
}
function addRack(scene,index,bank){
  const dir=bank===0?1:-1;
  const x=RACK_X0+(index%RACKS_PER_BANK)*RACK_XSTEP;
  const baseZ=bank===0?-7.9:7.9;
  const group=new THREE.Group();
  group.position.set(x,0,baseZ);scene.add(group);
  const id=(bank===0?'A':'B')+'-'+String(index%RACKS_PER_BANK+1).padStart(2,'0');
  // Each rack has TWO independent Z-running floor rails and overhead guides.
  // Tracks remain fixed in space when the mesh wall slides forward.
  const fixed=new THREE.Group();scene.add(fixed);
  for(const offset of [-.092,.092]){
    part(fixed,.043,.028,7.45,RAIL,x+offset,.033,dir<0?7.05:-7.05);
    part(fixed,.055,.055,7.45,METAL,x+offset,4.18,dir<0?7.05:-7.05);
  }
  for(const z of [-10.82,-3.28,3.28,10.82]){
    if((z>0)!==(bank===1))continue;
    part(fixed,.37,.04,.23,DARK,x,.025,z);
  }
  // Fine welded wire between strong white corner posts.
  group.add(meshPanel());
  for(const z of [-PANEL_DEPTH/2,PANEL_DEPTH/2]){
    part(group,.11,PANEL_HEIGHT,.085,FRAME,0,2.02,z);
  }
  for(const y of [.205,3.845]){
    part(group,.105,.085,PANEL_DEPTH,FRAME,0,y,0);
  }
  // A second thin seam accent and an upper guide bridge show that this is
  // a sliding frame, not a freestanding shelving cabinet.
  part(group,.10,.07,PANEL_DEPTH,METAL,0,3.91,0);
  part(group,.18,.16,.29,RAIL,0,4.08,dir*(PANEL_DEPTH/2-.2));
  for(const z of [-1.82,1.82]){
    part(group,.19,.115,.27,DARK,0,.105,z);
    part(group,.145,.075,.17,RAIL,0,3.98,z);
  }
  const tip=dir*(PANEL_DEPTH/2+.025);
  // Label is now fixed ABOVE the grip on the rack's front upright. In the
  // older version white sign planes floated over the wire mesh mid-panel.
  const plateBack=part(group,.40,.165,.024,DARK,0,3.51,tip);
  plateBack.castShadow=false;
  const plate=numberPlate(id);
  plate.position.set(0,3.51,tip+dir*.019);
  plate.rotation.y=dir<0?Math.PI:0;
  group.add(plate);
  const handle=part(group,.11,.35,.028,RAIL,0,1.13,tip);
  handle.castShadow=false;
  // Invisible wide hit target at eye height. Touch users can aim at the tip.
  const hit=part(group,.5,2.25,.42,HIT,0,1.80,tip);
  const collider={x,z:baseZ,hx:.20,hz:PANEL_DEPTH/2+.16};
  return {
    id,group,hit,dir,x,baseZ,open:0,target:0,collider,
    toggle(){this.target=this.target>.5?0:1;return this.target>0},
    openRack(){this.target=1},
    move(now,dt){
      if(Math.abs(this.open-this.target)<.001)return;
      this.open+=(this.target-this.open)*Math.min(1,dt*4);
      if(Math.abs(this.open-this.target)<.002)this.open=this.target;
      this.group.position.z=this.baseZ+this.dir*1.65*this.open;
      this.collider.z=this.group.position.z;
    }
  };
}
function attachPicture(rack,art,artMesh,slotType,mountIndex){
  const side=mountIndex<2?1:-1;
  const alongZ=mountIndex%2===0?-1.10:1.10;
  const mount=new THREE.Group();
  mount.position.set(side*.09,2.0,alongZ);
  mount.rotation.y=side*Math.PI/2;
  rack.group.add(mount);
  // Wall reliefs need their wall-facing, nonpenetrating geometry. All
  // paintings (even those originally on a pedestal) fit these mesh racks.
  const artwork=artMesh(art,slotType==='wall');
  artwork.updateMatrixWorld(true);
  const bbox=new THREE.Box3().setFromObject(artwork);
  if(!bbox.isEmpty()){
    const size=bbox.getSize(new THREE.Vector3());
    const center=bbox.getCenter(new THREE.Vector3());
    const fit=Math.min(1.9/Math.max(size.x,.001),2.85/Math.max(size.y,.001),
      1.00/Math.max(size.z,.001),1.0);
    artwork.scale.setScalar(fit);
    artwork.position.set(-center.x*fit,-center.y*fit,.045-bbox.min.z*fit);
  }
  mount.add(artwork);
  // Real clamp clips grip the top of the frame.
  for(const x of [-.70,.70])
    part(mount,.095,.085,.09,RAIL,x,1.45,.04);
  const hit=part(mount,1.98,3.15,.055,HIT,0,0,.34);
  return {
    hit,
    locate(){
      rack.openRack();
      const z=rack.baseZ+rack.dir*1.65+alongZ;
      return {
        x:clamp(rack.x+side*1.36,-17.9,17.9),
        y:1.7,z:clamp(z,-10.8,10.8),
        yaw:side>0?Math.PI/2:-Math.PI/2,
        pitch:0
      };
    }
  };
}
export function buildDepotArchive(scene,archivedArtworks,artMesh,slots){
  const racks=[],interactables=[],colliders=[],locations=new Map(),mountedIds=new Set();
  for(let bank=0;bank<2;bank++){
    for(let i=0;i<RACKS_PER_BANK;i++){
      const rack=addRack(scene,bank*RACKS_PER_BANK+i,bank);
      racks.push(rack);colliders.push(rack.collider);
      interactables.push({mesh:rack.hit,kind:'rack',rack});
    }
  }
  const originals=new Map(slots.map(s=>[s.id,s]));
  const onRacks=archivedArtworks.filter(a=>
    a.mode==='painting'||originals.get(a.spotId)?.type==='wall'
  );
  for(let i=0;i<Math.min(onRacks.length,racks.length*MAX_PICTURES_PER_RACK);i++){
    const rack=racks[Math.floor(i/MAX_PICTURES_PER_RACK)];
    const art=onRacks[i];
    const mounted=attachPicture(rack,art,artMesh,originals.get(art.spotId)?.type,i%MAX_PICTURES_PER_RACK);
    mountedIds.add(art.id);
    locations.set(art.id,{rack,locate:mounted.locate});
    interactables.push({mesh:mounted.hit,kind:'art',art});
  }
  let previous=performance.now();
  return {
    racks,interactables,colliders,mountedIds,
    locate(id){return locations.get(id)?.locate()||null},
    update(now){
      const dt=clamp((now-previous)/1000,0,.06);previous=now;
      for(const r of racks)r.move(now,dt);
    },
    dispose(){
      // The gallery's existing scene traversal disposes all geometries and
      // textures on room changes. Clear only references here.
      racks.length=0;interactables.length=0;colliders.length=0;
      locations.clear();mountedIds.clear();
    }
  };
}
