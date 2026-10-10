import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

// Real split-flap board inspired by the supplied black/white/green reference.
export const FLAP_COLUMNS=16;
export const FLAP_STORAGE='mad-split-flap-messages-v1';
export const DEFAULT_FLAP_MESSAGES=[
  'WELCOME TO\nTHE MAD MUSEUM\nMAKE SOMETHING',
  'THE WALLS ARE\nLISTENING\nPLEASE CONTINUE',
  'SOMETHING IS\nLOOKING AT YOU\nFROM THE FRAME',
  'EVERY ARTWORK\nIS A QUESTION\nWITHOUT A DOOR',
  'PLEASE DO NOT\nFEED THE SHADOWS\nAFTER CLOSING',
  'THE COLLECTION\nHAS A MEMORY\nOF ITS OWN',
  'YOU WERE HERE\nBEFORE YOU\nARRIVED'
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function flapLine(text){
  return String(text??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/\s+/g,' ').replace(/[^A-Z0-9 .,!?':&+\-\/]/g,'').trim();
}
export function splitFlapLines(message){
  const lines=[];
  for(const raw of String(message||'').split(/\r?\n/)){
    let line=flapLine(raw);
    while(line.length>FLAP_COLUMNS&&lines.length<3){
      let n=line.lastIndexOf(' ',FLAP_COLUMNS);
      if(n<8)n=FLAP_COLUMNS;
      lines.push(line.slice(0,n).trim());
      line=line.slice(n).trim();
    }
    if(line&&lines.length<3)lines.push(line);
    if(lines.length>=3)break;
  }
  while(lines.length<3)lines.push('');
  return lines.map(s=>s.slice(0,FLAP_COLUMNS).padStart(
    Math.floor((FLAP_COLUMNS+s.length)/2),' '
  ).padEnd(FLAP_COLUMNS,' '));
}
export function parseFlapMessages(text){
  return String(text||'').replace(/\r/g,'').split(/\n\s*\n/)
    .map(s=>s.trim()).filter(Boolean).slice(0,24)
    .map(s=>s.split('\n').slice(0,3).map(line=>line.slice(0,80)).join('\n'));
}
export function loadFlapMessages(){
  try{
    const messages=JSON.parse(localStorage.getItem(FLAP_STORAGE)||'null');
    if(Array.isArray(messages)&&messages.length)
      return messages.filter(v=>typeof v==='string').slice(0,24);
  }catch(e){console.warn('MAD display settings could not load',e)}
  return DEFAULT_FLAP_MESSAGES.slice();
}
export function saveFlapMessages(messages){
  const values=messages.filter(v=>typeof v==='string'&&v.trim()).slice(0,24);
  localStorage.setItem(FLAP_STORAGE,JSON.stringify(values));
  return values;
}
export function buildFlapSequence(artworks,messages,now=Date.now()){
  const recent=(Array.isArray(artworks)?artworks:[]).filter(a=>
    Number.isFinite(a.createdAt)&&a.createdAt<=now&&now-a.createdAt<14*86400000
  ).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  const announcements=recent.map(a=>
    'NEW ART IN MAD\n'+flapLine(a.title||'UNTITLED').slice(0,16)+
    '\nBY '+flapLine(a.artist||'ANONYMOUS').slice(0,13)
  );
  const notes=messages.length?messages:DEFAULT_FLAP_MESSAGES;
  const output=[];
  for(let i=0;i<Math.max(announcements.length,notes.length);i++){
    if(notes[i])output.push(notes[i]);
    if(announcements[i])output.push(announcements[i]);
  }
  return output.length?output:DEFAULT_FLAP_MESSAGES.slice();
}
function block(w,h,d,material,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}
export class SplitFlapBoard{
  constructor(scene,artworks){
    this.scene=scene;this.artworks=artworks;
    this.messages=loadFlapMessages();
    this.sequence=buildFlapSequence(artworks,this.messages);
    this.sequenceIndex=0;this.lastSwitch=performance.now();this.holdMs=8500;
    this.flipping=false;this.transitionAt=0;this.targetLines=null;this.lastDraw=-Infinity;
    this.tiles=Array.from({length:48},()=>({from:' ',to:' ',delay:0}));
    this.canvas=document.createElement('canvas');
    this.canvas.width=1344;this.canvas.height=545;
    this.ctx=this.canvas.getContext('2d',{alpha:false});
    this.texture=new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
    this.texture.anisotropy=4;

    // Inward-facing east wall: beside, not in front of, the Depot doorway.
    this.group=new THREE.Group();
    this.group.position.set(19.19,1.84,-4.38);
    this.group.rotation.y=-Math.PI/2;
    scene.add(this.group);
    const body=new THREE.MeshStandardMaterial({color:0x161a1b,metalness:.24,roughness:.68});
    const trim=new THREE.MeshStandardMaterial({color:0x333938,metalness:.5,roughness:.4});
    this.hitMesh=block(3.25,1.33,.15,body);
    this.group.add(this.hitMesh);
    for(const y of [-.66,.66])this.group.add(block(3.29,.025,.11,trim,0,y,.05));
    for(const x of [-1.63,1.63])this.group.add(block(.026,1.32,.11,trim,x,0,.05));
    const face=new THREE.Mesh(
      new THREE.PlaneGeometry(3.14,1.22),
      new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false})
    );
    face.position.z=.09;this.group.add(face);
    this._fillImmediately(splitFlapLines(this.sequence[0]));
    this._draw(0);
  }
  _fillImmediately(lines){
    for(let row=0;row<3;row++)for(let col=0;col<16;col++){
      const tile=this.tiles[row*16+col];
      tile.from=lines[row][col];tile.to=lines[row][col];tile.delay=0;
    }
  }
  refreshFeed(){
    this.sequence=buildFlapSequence(this.artworks,this.messages);
    this.sequenceIndex=Math.min(this.sequenceIndex,this.sequence.length-1);
  }
  setMessages(messages){
    this.messages=messages.length?messages.slice():DEFAULT_FLAP_MESSAGES.slice();
    this.refreshFeed();this.next(true);
  }
  showNewest(art){
    this.refreshFeed();
    if(!art)return;
    const words='NEW ART IN MAD\n'+flapLine(art.title).slice(0,16)+
      '\nBY '+flapLine(art.artist).slice(0,13);
    this._transition(splitFlapLines(words),performance.now());
  }
  next(immediate=false){
    this.sequenceIndex=(this.sequenceIndex+1)%this.sequence.length;
    this._transition(splitFlapLines(this.sequence[this.sequenceIndex]),performance.now(),immediate);
  }
  _transition(lines,now,immediate=false){
    this.lastSwitch=now;this.transitionAt=now;this.flipping=!immediate;
    this.targetLines=lines.slice();
    for(let row=0;row<3;row++)for(let col=0;col<16;col++){
      const i=row*16+col,tile=this.tiles[i];
      tile.from=tile.to;tile.to=lines[row][col];
      tile.delay=(row*79+col*26+((i*7)%5)*11);
      if(immediate)tile.from=tile.to;
    }
    this._draw(now);
  }
  update(now){
    if(!Number.isFinite(now))return;
    if(!this.flipping&&now-this.lastSwitch>=this.holdMs){
      this.refreshFeed();this.next();
    }
    if(!this.flipping)return;
    this._draw(now);
    if(now-this.transitionAt>=1170){
      this.flipping=false;
      this._fillImmediately(this.targetLines);
      this._draw(now,true);
    }
  }
  _draw(now,force=false){
    // Cap 2D texture redraws at 25fps to protect mobile GPU bandwidth.
    if(!force&&now-this.lastDraw<40)return;
    this.lastDraw=now;
    const ctx=this.ctx,W=this.canvas.width,H=this.canvas.height;
    ctx.fillStyle='#101213';ctx.fillRect(0,0,W,H);
    const width=65,height=91,gap=6,rowGap=31;
    const x0=(W-(16*width+15*gap))/2,y0=68;
    const glyph=(char,x,y,half,fold=1)=>{
      ctx.save();
      ctx.beginPath();
      ctx.rect(x+2,half?y+height/2:y+2,width-4,height/2-2);
      ctx.clip();
      if(fold<1){
        const seam=y+height/2;
        ctx.translate(0,seam);ctx.scale(1,fold);ctx.translate(0,-seam);
      }
      ctx.fillStyle='#f2f4f1';
      ctx.font='400 61px "Arial Narrow",Arial,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(char,x+width/2,y+height/2+3,width-8);
      ctx.restore();
    };
    for(let row=0;row<3;row++)for(let col=0;col<16;col++){
      const tile=this.tiles[row*16+col];
      const x=x0+col*(width+gap),y=y0+row*(height+rowGap);
      const green=row===0&&(col===0||col===15);
      const progress=tile.from===tile.to?1:
        clamp((now-this.transitionAt-tile.delay)/370,0,1);
      ctx.fillStyle='#07090a';ctx.fillRect(x-2,y-2,width+4,height+4);
      ctx.fillStyle=green?'#137743':'#25282a';ctx.fillRect(x,y,width,height);
      ctx.fillStyle=green?'#1f9e54':'#303234';
      ctx.fillRect(x+3,y+3,width-6,height/2-5);
      ctx.fillStyle=green?'#116638':'#222526';
      ctx.fillRect(x+3,y+height/2+1,width-6,height/2-5);
      ctx.fillStyle='rgba(255,255,255,.06)';
      ctx.fillRect(x+3,y+3,width-6,2);
      if(!green){
        if(progress<.5){
          glyph(tile.from,x,y,true);
          glyph(tile.from,x,y,false,Math.max(.05,1-1.9*progress));
        }else{
          glyph(tile.to,x,y,false);
          glyph(tile.to,x,y,true,Math.max(.05,1.9*(progress-.5)));
        }
      }
      // The mechanical split/axle detail matches the supplied image.
      ctx.fillStyle='#090a0b';ctx.fillRect(x,y+height/2-2,width,4);
      ctx.fillStyle='#555a58';ctx.fillRect(x+1,y+height/2-1,4,2);
      ctx.fillRect(x+width-5,y+height/2-1,4,2);
    }
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='500 18px Arial,sans-serif';
    ctx.fillStyle='#555d5b';
    ctx.fillText('M A D   /   DISPLAY  001',W/2,H-41);
    for(const x of [36,W-36])for(const y of [29,H-27]){
      ctx.fillStyle='#454c4b';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#080b0a';ctx.fillRect(x-3,y,6,1);
    }
    this.texture.needsUpdate=true;
  }
  dispose(){
    this.scene?.remove(this.group);
    this.group?.traverse(o=>{
      o.geometry?.dispose();
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{if(m){if(m.map&&m.map!==this.texture)m.map.dispose();m.dispose()}});
    });
    this.texture?.dispose();
    this.group=null;
  }
}
