import {CLOUD} from './mad-config.js';

export class MuseumStore {
  constructor(){
    this.url=CLOUD.url.replace(/\/+$/,'');
    this.anonKey=CLOUD.anonKey;
    this.enabled=Boolean(this.url&&this.anonKey);
  }
  headers(extra={}){
    return {apikey:this.anonKey,Authorization:'Bearer '+this.anonKey,
      ...extra};
  }
  async load(){
    if(!this.enabled)return [];
    const path='/rest/v1/mad_artworks?select=id,spot_id,payload,created_at,status&status=eq.approved&order=created_at.desc&limit=500';
    const response=await fetch(this.url+path,{headers:this.headers(),cache:'no-store'});
    if(!response.ok)throw Error('Gallery sync failed: HTTP '+response.status);
    const rows=await response.json();
    return rows.map(row=>({
      ...row.payload,id:row.id,spotId:row.spot_id,
      createdAt:new Date(row.created_at).getTime(),
      status:row.status
    })).filter(a=>a&&a.spotId&&Number.isFinite(a.createdAt));
  }
  async submit(art){
    if(!this.enabled)return {local:true};
    const data={
      id:art.id,spot_id:art.spotId,status:'pending',
      payload:art
    };
    const response=await fetch(this.url+'/rest/v1/mad_artworks',{
      method:'POST',
      headers:this.headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify(data)
    });
    if(!response.ok){
      let detail='';
      try{detail=await response.text()}catch(e){}
      throw Error('Artwork submission failed ('+response.status+'): '+detail.slice(0,160));
    }
    return {local:false,pending:true};
  }
}
