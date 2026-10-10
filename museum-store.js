import {CLOUD} from './mad-config.js';

// Public, account-free museum storage. A secret code is verified ONLY by
// Supabase: neither the code nor its hash appears in this application.
export class MuseumStore {
  constructor(){
    this.url=(CLOUD.url||'').trim().replace(/\/+$/,'');
    this.anonKey=(CLOUD.anonKey||'').trim();
    this.enabled=Boolean(this.url&&this.anonKey);
    this.client=null;this.ready=false;this.isAdmin=false;
    this.listeners=new Set();this.sessionKey='mad-admin-session-v1';
    try{this.adminToken=sessionStorage.getItem(this.sessionKey)||null}
    catch{this.adminToken=null}
  }
  onChange(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(){for(const fn of this.listeners)try{fn(this)}catch(e){console.error(e)}}
  async init(){
    if(!this.enabled){this.ready=true;this.emit();return}
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm');
      this.client=createClient(this.url,this.anonKey,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      if(this.adminToken)await this.validateAdmin();
    }finally{this.ready=true;this.emit()}
  }
  async load(){
    if(!this.client)return [];
    const {data,error}=await this.client.from('mad_artworks')
      .select('id,spot_id,payload,created_at,status')
      .eq('status','approved').order('created_at',{ascending:false}).limit(500);
    if(error)throw error;
    return(data||[]).map(row=>({
      ...row.payload,id:row.id,spotId:row.spot_id,
      createdAt:Date.parse(row.created_at),status:row.status
    })).filter(a=>a&&a.spotId&&Number.isFinite(a.createdAt));
  }
  async submit(art){
    if(!this.client)throw Error('Gallery server is not ready yet.');
    const {data,error}=await this.client.from('mad_artworks')
      .insert({id:art.id,spot_id:art.spotId,status:'approved',payload:art})
      .select('id,status,created_at').single();
    if(error)throw error;
    return {id:data.id,status:data.status,createdAt:Date.parse(data.created_at)};
  }
  async _rpc(name,args){
    if(!this.client)throw Error('Gallery server is unavailable.');
    const {data,error}=await this.client.rpc(name,args);
    if(error)throw error;
    return data;
  }
  async login(code){
    if(typeof code!=='string'||code.length<8||code.length>128)
      throw Error('Invalid admin code.');
    const token=await this._rpc('mad_admin_login',{p_code:code.trim()});
    if(typeof token!=='string'||token.length!==64)
      throw Error('Invalid admin code or too many attempts. Try again later.');
    this.adminToken=token;
    try{sessionStorage.setItem(this.sessionKey,token)}catch{}
    this.isAdmin=true;this.emit();
    return true;
  }
  async validateAdmin(){
    if(!this.adminToken){this.isAdmin=false;this.emit();return false}
    try{this.isAdmin=await this._rpc('mad_admin_active',{p_token:this.adminToken})===true}
    catch{this.isAdmin=false}
    if(!this.isAdmin){this.adminToken=null;
      try{sessionStorage.removeItem(this.sessionKey)}catch{}}
    this.emit();return this.isAdmin;
  }
  async logout(){
    const token=this.adminToken;
    this.adminToken=null;this.isAdmin=false;
    try{sessionStorage.removeItem(this.sessionKey)}catch{}
    this.emit();
    if(token&&this.client)await this._rpc('mad_admin_logout',{p_token:token});
  }
  _requireAdmin(){
    if(!this.isAdmin||!this.adminToken)
      throw Error('Maintenance login required.');
    return this.adminToken;
  }
  async listStatus(status){
    const token=this._requireAdmin();
    if(!['pending','approved','rejected'].includes(status))throw Error('Invalid status');
    return await this._rpc('mad_admin_list',{p_token:token,p_status:status})||[];
  }
  pending(){return this.listStatus('pending')}
  published(){return this.listStatus('approved')}
  async moderate(id,status){
    const token=this._requireAdmin();
    if(!['approved','rejected','pending'].includes(status))throw Error('Invalid decision');
    return this._rpc('mad_admin_set_status',{p_token:token,p_id:id,p_status:status});
  }
  async remove(id){
    return this._rpc('mad_admin_delete',{p_token:this._requireAdmin(),p_id:id});
  }
  destroy(){this.listeners.clear()}
}
