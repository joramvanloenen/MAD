import {CLOUD} from './mad-config.js';

// Verified permissions are always enforced by database RLS, not browser email.
export class MuseumStore {
 constructor(){
  this.url=(CLOUD.url||'').trim().replace(/\/+$/,'');
  this.anonKey=(CLOUD.anonKey||'').trim();
  this.enabled=Boolean(this.url&&this.anonKey);
  this.client=null;this.user=null;this.isAdmin=false;this.ready=false;
  this.listeners=new Set();this.subscription=null;this.version=0;
 }
 get signedIn(){return Boolean(this.user?.id)}
 onChange(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn)}
 emit(){for(const fn of this.listeners)try{fn(this)}catch(e){console.error(e)}}
 async init(){
  if(!this.enabled){this.ready=true;this.emit();return}
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm');
  this.client=createClient(this.url,this.anonKey,{
    auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const {data:{session},error}=await this.client.auth.getSession();
  if(error)throw error;
  this.user=session?.user||null;
  const response=this.client.auth.onAuthStateChange((event,session)=>{
    this.user=session?.user||null;this.isAdmin=false;this.emit();
    // Supabase calls inside auth callbacks can deadlock the auth lock.
    queueMicrotask(()=>this.refreshPermission());
  });
  this.subscription=response.data.subscription;
  await this.refreshPermission();this.ready=true;this.emit();
 }
 async refreshPermission(){
  const version=++this.version;
  if(!this.client||!this.user){this.isAdmin=false;this.emit();return}
  try{
    const {data:{user},error}=await this.client.auth.getUser();
    if(error)throw error;
    if(version!==this.version)return;
    this.user=user;
    const result=await this.client.rpc('mad_is_admin');
    if(result.error)throw result.error;
    if(version!==this.version)return;
    this.isAdmin=result.data===true;
  }catch(e){this.isAdmin=false;console.warn('MAD admin verification:',e.message)}
  this.emit();
 }
 async signIn(){
  if(!this.enabled)throw Error('Cloud backend is not configured.');
  if(!this.client)throw Error('Google sign-in is loading. Retry in a moment.');
  const {error}=await this.client.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:location.origin+location.pathname,
      queryParams:{prompt:'select_account'}}
  });
  if(error)throw error;
 }
 async signOut(){
  if(!this.client)return;
  const {error}=await this.client.auth.signOut();
  if(error)throw error;
  this.user=null;this.isAdmin=false;this.emit();
 }
 async load(){
  if(!this.client)return [];
  let q=this.client.from('mad_artworks')
   .select('id,spot_id,payload,created_at,status,owner_id')
   .order('created_at',{ascending:false}).limit(500);
  q=this.user?.id
    ?q.or('status.eq.approved,owner_id.eq.'+this.user.id)
    :q.eq('status','approved');
  const {data,error}=await q;if(error)throw error;
  return (data||[]).map(row=>({
    ...row.payload,id:row.id,spotId:row.spot_id,
    createdAt:Date.parse(row.created_at),status:row.status,ownerId:row.owner_id
  })).filter(a=>a&&a.spotId&&Number.isFinite(a.createdAt));
 }
 async submit(art){
  if(!this.client)throw Error('Cloud connection unavailable.');
  if(!this.user?.id)throw Error('Sign in with Google to save your artwork.');
  const {data,error}=await this.client.from('mad_artworks')
    .insert({id:art.id,spot_id:art.spotId,owner_id:this.user.id,
      status:'pending',payload:art})
    .select('id,status,created_at,owner_id').single();
  if(error)throw error;
  return {pending:true,id:data.id,status:data.status,
    createdAt:Date.parse(data.created_at),ownerId:data.owner_id};
 }
 async pending(){
  if(!this.isAdmin)throw Error('Verified MAD administrator required.');
  const {data,error}=await this.client.from('mad_artworks')
   .select('id,spot_id,payload,created_at,owner_id,status')
   .eq('status','pending').order('created_at',{ascending:true}).limit(200);
  if(error)throw error;
  return data||[];
 }
 async moderate(id,status){
  if(!this.isAdmin)throw Error('Administrator access required.');
  if(!['approved','rejected'].includes(status))throw Error('Invalid review decision.');
  const {data,error}=await this.client.from('mad_artworks')
    .update({status}).eq('id',id).eq('status','pending')
    .select('id,status').single();
  if(error)throw error;return data;
 }
 async remove(id){
  if(!this.client||!this.user)throw Error('Sign in first.');
  const {error}=await this.client.from('mad_artworks').delete().eq('id',id);
  if(error)throw error;
 }
 destroy(){this.subscription?.unsubscribe();this.listeners.clear()}
}
