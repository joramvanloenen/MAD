// MAD — recorded-footstep playback. Audio is CC0 Kenney Impact Sounds foley,
// locally hosted in assets/audio/. No synthesized/oscillator footstep sounds.
const WOOD_FILES=Array.from({length:5},(_,i)=>
  new URL('./assets/audio/footstep_wood_00'+i+'.ogg',import.meta.url).href
);
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));

export class MuseumAudio {
  constructor(){
    this.context=null;
    this.muted=false;
    this.master=null;
    this.dry=null;
    this.wet=null;
    this.buffers=[];
    this.loading=null;
    this.lastIndex=-1;
    this.lastPlayed=-Infinity;
    this.strideDistance=0;
    this.isMoving=false;
    this.left=false;
    this.lastRoom=null;
  }
  start(){
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor)return;
    if(!this.context){
      const ctx=new Ctor();
      this.context=ctx;
      this.master=ctx.createGain();
      this.master.gain.value=this.muted?0:.26;
      this.master.connect(ctx.destination);
      this.dry=ctx.createGain();
      this.dry.gain.value=.96;
      this.dry.connect(this.master);
      // Short, quiet room reflection. Uses a small synthesized reverb impulse,
      // but the FOOTSTEP itself is always one of the real recorded clips.
      const convolver=ctx.createConvolver();
      const duration=.27,len=Math.floor(ctx.sampleRate*duration);
      const impulse=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){
        const out=impulse.getChannelData(ch);
        for(let i=0;i<len;i++)out[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)*.1;
      }
      convolver.buffer=impulse;
      this.wet=ctx.createGain();
      this.wet.gain.value=.095;
      convolver.connect(this.wet);
      this.wet.connect(this.master);
      this.reverbInput=convolver;
    }
    if(this.context.state==='suspended'){
      this.context.resume().catch(()=>{});
    }
    if(!this.loading){
      this.loading=Promise.allSettled(WOOD_FILES.map(async url=>{
        const response=await fetch(url,{cache:'force-cache'});
        if(!response.ok)throw new Error('Footstep sample HTTP '+response.status);
        const bytes=await response.arrayBuffer();
        return this.context.decodeAudioData(bytes);
      })).then(results=>{
        this.buffers=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
        if(!this.buffers.length)console.warn('MAD: Recorded footstep samples could not load');
      });
    }
    return this.loading;
  }
  setMuted(value){
    this.muted=Boolean(value);
    if(this.master&&this.context){
      this.master.gain.setTargetAtTime(this.muted?0:.26,this.context.currentTime,.04);
    }
    return this.muted;
  }
  // frame dt + ACTUAL distance moved, not keyboard presses.
  // Ordinary walk: ~0.58–0.7 s per audible contact at 4.3 m/s.
  // Sprint remains faster, but never becomes an artificial machine-gun beat.
  step(dt,motion,room='gallery'){
    if(!this.context||this.muted||!this.buffers.length)return;
    if(!Number.isFinite(motion)||!Number.isFinite(dt)||dt<=0)return;
    const ctx=this.context;
    if(motion<.004||dt>.16){
      this.isMoving=false;
      this.strideDistance=0;
      return;
    }
    const speed=clamp(motion/dt,0,12);
    const sprint=speed>6.1;
    const spacing=sprint?3.05:2.55;
    const minGap=sprint?.40:.55;
    if(!this.isMoving){
      // Delay the first contact to avoid sounding when barely tapping movement.
      this.strideDistance=0;
      this.isMoving=true;
    }
    this.strideDistance+=motion;
    if(this.strideDistance<spacing*.75 || ctx.currentTime-this.lastPlayed<minGap)return;
    this.strideDistance=Math.max(0,this.strideDistance-spacing);
    this.playStep(room,sprint);
  }
  playStep(room='gallery',sprint=false){
    if(!this.buffers.length||!this.context||this.muted)return;
    let index=Math.floor(Math.random()*this.buffers.length);
    if(index===this.lastIndex && this.buffers.length>1){
      index=(index+1+Math.floor(Math.random()*(this.buffers.length-1)))%this.buffers.length;
    }
    this.lastIndex=index;
    const ctx=this.context;
    const source=ctx.createBufferSource();
    source.buffer=this.buffers[index];
    source.playbackRate.value=clamp(.94+Math.random()*.105,.9,1.08);
    const envelope=ctx.createGain();
    const now=ctx.currentTime;
    const amplitude=(sprint?.92:.72)*(.90+Math.random()*.14);
    envelope.gain.setValueAtTime(0,now);
    envelope.gain.linearRampToValueAtTime(amplitude,now+.008);
    envelope.gain.setValueAtTime(amplitude,now+.10);
    const end=now+Math.min(source.buffer.duration/source.playbackRate.value,.62);
    envelope.gain.linearRampToValueAtTime(.00001,Math.max(now+.11,end));
    source.connect(envelope);
    if(ctx.createStereoPanner){
      const pan=ctx.createStereoPanner();
      pan.pan.value=this.left?-.09:.09;
      envelope.connect(pan);
      pan.connect(this.dry);
      pan.connect(this.reverbInput);
    }else{
      envelope.connect(this.dry);
      envelope.connect(this.reverbInput);
    }
    this.left=!this.left;
    this.lastPlayed=now;
    source.start(now);
    source.stop(end+.02);
  }
  dispose(){
    this.buffers=[];
    this.context?.close();
    this.context=null;
    this.loading=null;
  }
}
