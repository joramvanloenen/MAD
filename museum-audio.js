// Procedural museum acoustics — synthesized footsteps, soft indoor air and reverb.
// AudioContext is only started after a user interaction (browser autoplay policy).
export class MuseumAudio {
  constructor(){
    this.context=null;this.muted=false;this.distance=0;this.left=false;
    this.noise=null;this.destination=null;this.ambience=null;this.ambGain=null;
    this.lastRoom=null;
  }
  start(){
    if(this.context){this.context.resume();return;}
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    const ctx=new Audio();
    this.context=ctx;
    this.destination=ctx.createGain();
    this.destination.gain.value=.45;
    const convolver=ctx.createConvolver();
    const seconds=.48,length=Math.floor(ctx.sampleRate*seconds);
    const impulse=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){
      const data=impulse.getChannelData(ch);
      for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3)*.28;
    }
    convolver.buffer=impulse;
    const dry=ctx.createGain();dry.gain.value=.88;
    const wet=ctx.createGain();wet.gain.value=.21;
    dry.connect(this.destination);convolver.connect(wet);wet.connect(this.destination);
    this.destination.connect(ctx.destination);
    this.dry=dry;this.convolver=convolver;
    const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.noise=buffer;
    this.ambience=ctx.createBufferSource();this.ambience.buffer=buffer;this.ambience.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=95;
    this.ambGain=ctx.createGain();this.ambGain.gain.value=.008;
    this.ambience.connect(filter);filter.connect(this.ambGain);
    this.ambGain.connect(this.dry);
    this.ambience.start();
  }
  setMuted(value){
    this.muted=value;
    if(this.destination)this.destination.gain.setTargetAtTime(value?0:.45,this.context.currentTime,.03);
    return this.muted;
  }
  step(dt,motion,room='gallery'){
    if(!this.context||this.muted)return;
    if(!motion){this.distance=0;return;}
    this.distance+=motion;
    if(this.distance<1.38)return;
    this.distance%=1.38;
    const ctx=this.context,now=ctx.currentTime;
    // Two transient layers: wooden floor body and filtered shoe friction.
    const src=ctx.createBufferSource();src.buffer=this.noise;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';
    filter.frequency.value=room==='depot'?650:430+(this.left?120:0);
    filter.Q.value=.45;
    const gain=ctx.createGain();
    const amp=room==='depot'?.09:.13;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(amp,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.14);
    src.connect(filter);filter.connect(gain);
    gain.connect(this.dry);gain.connect(this.convolver);
    src.start(now);src.stop(now+.15);
    const osc=ctx.createOscillator();
    osc.type='triangle';osc.frequency.setValueAtTime(115,now);
    osc.frequency.exponentialRampToValueAtTime(55,now+.09);
    const low=ctx.createGain();low.gain.setValueAtTime(.04,now);
    low.gain.exponentialRampToValueAtTime(.0001,now+.11);
    osc.connect(low);low.connect(this.dry);osc.start(now);osc.stop(now+.12);
    this.left=!this.left;
  }
  dispose(){
    try{this.ambience?.stop()}catch(e){}
    this.context?.close();this.context=null;
  }
}
