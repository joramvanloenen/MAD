// Google account and secure review UI; admin rights come only from Supabase RLS.
export function installAccountUI({store,show,hide,toast,sync,storageKey}){
 const $=id=>document.getElementById(id);
 const local=()=>{
  try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}catch(e){return []}
 };
 const escapeTag=(s,max=200)=>String(s||'').slice(0,max);
 let currentSessionKey='uninitialized';
 const status=()=>{
  const ready=store.ready,online=store.enabled,logged=store.signedIn;
  $('cloudStatus').textContent=!online?'LOCAL ONLY':!ready?'CONNECTING…':
    !logged?'CLOUD · SIGN IN':store.isAdmin?'CLOUD · ADMIN':'CLOUD · SAVED';
  $('accountBtn').textContent=logged?'ACCOUNT':'SIGN IN';
  $('accountBtn').title=logged?store.user.email:'Google account sign-in';
  $('adminBtn').classList.toggle('hidden',!store.isAdmin);
  $('syncBtn').classList.toggle('hidden',!online);
  $('startGoogleBtn').classList.toggle('hidden',!online);
  $('googleSignIn').classList.toggle('hidden',!online||logged);
  $('googleSignOut').classList.toggle('hidden',!logged);
  $('migrateArtworks').classList.toggle('hidden',!logged||!local().length);
  $('accountEmail').textContent=logged?(store.user.email||'Signed in'):'';
  $('accountStatus').textContent=!online?'Cloud sign-in is not yet configured.':
    !ready?'Connecting securely to MAD…':
    logged?store.isAdmin?'Signed in · verified MAD administrator':'Signed in · artwork creator':
    'Sign in with Google to save and retrieve your artworks.';
  $('accountHelp').textContent=!online
   ?'The museum owner must connect a Supabase project and enable Google OAuth before cross-device saving works. This site is still in local demonstration mode.'
   :logged?'Your new artwork is stored under your account. It will appear in the public museum after administrator approval.'
   :'Your artworks are saved on the server, associated with your Google account, and reviewed before appearing in the public museum.';
  if(online&&ready){
    const key=store.user?.id||'guest';
    if(key!==currentSessionKey){
      currentSessionKey=key;
      sync().catch(e=>console.warn('MAD gallery sync:',e));
    }
  }
 };
 store.onChange(status);
 status();
 $('accountBtn').onclick=()=>{status();show('account')};
 $('startGoogleBtn').onclick=()=>{status();hide('start');show('account')};
 $('adminBtn').onclick=()=>{show('admin');refreshReviews()};
 const login=async()=>{
  try{$('googleSignIn').disabled=true;await store.signIn()}
  catch(e){toast('Google sign-in: '+e.message)}
  finally{$('googleSignIn').disabled=false}
 };
 $('googleSignIn').onclick=login;
 $('googleSignOut').onclick=async()=>{
  try{await store.signOut();toast('Signed out of MAD')}
  catch(e){toast(e.message)}
 };
 $('migrateArtworks').onclick=async()=>{
  if(!store.signedIn)return;
  const artwork=local().filter(a=>a&&a.id&&a.spotId&&a.title&&a.desc);
  if(!artwork.length){toast('No older local works to upload.');return}
  if(!confirm('Submit '+artwork.length+' local artwork(s) for review? Existing browser copies will be preserved.'))return;
  $('migrateArtworks').disabled=true;
  let uploaded=0,skipped=0,failed=0;
  try{
    const existing=new Set((await store.load()).map(a=>a.id));
    for(const item of artwork){
      if(existing.has(item.id)){skipped++;continue}
      try{await store.submit(item);uploaded++}
      catch(e){console.warn('MAD local artwork upload:',item.id,e);failed++}
    }
    $('importReport').textContent='Sent for review: '+uploaded+
      ' · Already uploaded: '+skipped+' · Could not upload: '+failed+
      '. Original local artworks are unchanged.';
    await sync();
  }catch(e){toast('Import failed: '+e.message)}
  finally{$('migrateArtworks').disabled=false}
 };
 async function refreshReviews(){
  if(!store.isAdmin)return;
  const list=$('adminList');list.replaceChildren();
  $('adminStatus').textContent='Loading review queue…';
  try{
    const rows=await store.pending();
    $('adminStatus').textContent=rows.length+' artwork(s) awaiting review.';
    for(const row of rows){
      const art=row.payload||{},card=document.createElement('article');
      card.className='card';
      const title=document.createElement('strong');
      title.textContent=escapeTag(art.title||'Untitled',100);
      const desc=document.createElement('p');
      desc.textContent=escapeTag(art.desc||'',500);
      const meta=document.createElement('p');meta.className='stat';
      meta.textContent='BY '+escapeTag(art.artist,60)+' · '+
        escapeTag(art.mode,24).toUpperCase()+' · SLOT '+
        escapeTag(row.spot_id,8).toUpperCase()+
        ' · '+new Date(row.created_at).toLocaleDateString();
      card.append(title,meta,desc);
      if(art.mode==='painting'&&/^data:image\/png;base64,/.test(art.image||'')){
        const thumb=document.createElement('img');thumb.src=art.image;
        thumb.alt='Submitted painting preview';thumb.loading='lazy';
        thumb.style.cssText='max-width:180px;max-height:135px;object-fit:contain;display:block;margin-bottom:12px';
        card.append(thumb);
      }
      const rowButtons=document.createElement('div');rowButtons.className='toolrow';
      for(const [label,next,cls] of [
        ['APPROVE','approved','btn'],['REJECT','rejected','btn secondary']
      ]){
        const btn=document.createElement('button');btn.className=cls;
        btn.textContent=label;
        btn.onclick=async()=>{
          for(const other of rowButtons.querySelectorAll('button'))other.disabled=true;
          try{
            await store.moderate(row.id,next);
            toast(label==='APPROVE'?'Artwork approved and published':'Artwork rejected');
            await sync();await refreshReviews();
          }catch(e){
            toast('Review failed: '+e.message);
            for(const other of rowButtons.querySelectorAll('button'))other.disabled=false;
          }
        };
        rowButtons.append(btn);
      }
      card.append(rowButtons);list.append(card);
    }
    if(!rows.length)list.textContent='No submissions to review right now.';
  }catch(e){$('adminStatus').textContent='Could not load reviews: '+e.message}
 }
 $('refreshPending').onclick=refreshReviews;
 return {status,refreshReviews};
}
