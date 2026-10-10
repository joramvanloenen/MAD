// MAD maintenance dashboard. No visitor sign-in is required or offered.
// All permissions are checked by Supabase RPCs using a short-lived admin token.
export function installAccountUI({store,show,hide,toast,sync,storageKey}){
  const $=id=>document.getElementById(id);
  let importedLocal=false;
  const localArt=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}
    catch{return []}};
  const label=(value,max=160)=>String(value??'').slice(0,max);
  function refreshUI(){
    $('cloudStatus').textContent=!store.enabled?'LOCAL ONLY':
      !store.ready?'CONNECTING…':'PUBLIC GALLERY · ONLINE';
    $('syncBtn').classList.toggle('hidden',!store.enabled);
    $('accountBtn').textContent=store.isAdmin?'MAINTENANCE ✓':'MAINTENANCE';
    $('adminBtn').classList.toggle('hidden',!store.isAdmin);
    $('maintenanceLogin').classList.toggle('hidden',store.isAdmin);
    $('maintenanceLogout').classList.toggle('hidden',!store.isAdmin);
    $('maintenanceCode').value='';
    $('accountStatus').textContent=!store.enabled?'Server is not configured.':
      store.isAdmin?'Maintenance access active · expires after 12 hours':
      'Visitors can publish without an account. Only the administrator needs a code.';
    $('migrateArtworks').classList.toggle('hidden',
      !store.enabled||!store.ready||!localArt().length);
  }
  store.onChange(refreshUI);refreshUI();
  $('accountBtn').onclick=()=>{refreshUI();show(store.isAdmin?'admin':'account')};
  $('adminBtn').onclick=()=>{show('admin');renderList('approved')};
  $('maintenanceLogin').onclick=async()=>{
    const code=$('maintenanceCode').value;
    $('maintenanceLogin').disabled=true;
    $('accountError').textContent='';
    try{
      await store.login(code);
      $('maintenanceCode').value='';
      hide('account');show('admin');
      await renderList('approved');
      toast('Maintenance access enabled');
    }catch(e){$('accountError').textContent=e.message}
    finally{$('maintenanceLogin').disabled=false}
  };
  $('maintenanceCode').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();$('maintenanceLogin').click()}
  });
  $('maintenanceLogout').onclick=async()=>{
    try{await store.logout();hide('admin');toast('Maintenance session ended')}
    catch(e){toast(e.message)}
  };
  $('migrateArtworks').onclick=async()=>{
    const works=localArt().filter(a=>a?.id&&a.spotId&&a.title&&a.desc);
    if(!works.length)return;
    if(!confirm('Upload '+works.length+' older browser artworks to the public MAD museum? These will be immediately visible to everyone. Original local copies stay saved.'))return;
    $('migrateArtworks').disabled=true;
    let done=0,skipped=0,failed=0;
    try{
      const existing=new Set((await store.load()).map(a=>a.id));
      for(const art of works){
        if(existing.has(art.id)){skipped++;continue}
        try{await store.submit(art);done++}
        catch(e){failed++;console.warn('Upload error',art.id,e)}
      }
      $('importReport').textContent='Published: '+done+' · Already online: '+
        skipped+' · Failed: '+failed+'. Originals were kept in this browser.';
      await sync();
    }catch(e){$('importReport').textContent='Import failed: '+e.message}
    finally{$('migrateArtworks').disabled=false}
  };
  async function renderList(status){
    if(!await store.validateAdmin()){
      hide('admin');show('account');return;
    }
    const list=$('adminList');list.replaceChildren();
    $('adminStatus').textContent='Loading '+status+' artworks…';
    try{
      const records=await store.listStatus(status);
      $('adminStatus').textContent=records.length+' '+status+' artworks (up to 250).';
      for(const row of records){
        const art=row.payload||{};
        const card=document.createElement('article');card.className='card';
        const title=document.createElement('strong');title.textContent=label(art.title||'Untitled',100);
        const meta=document.createElement('p');meta.className='stat';
        meta.textContent=label(art.artist||'Anonymous',70)+' · '+
          label(row.spot_id,8).toUpperCase()+' · '+
          new Date(row.created_at).toLocaleDateString()+
          ' · '+label(art.mode,22);
        const desc=document.createElement('p');desc.textContent=label(art.desc,500);
        card.append(title,meta,desc);
        if(art.mode==='painting'&&/^data:image\/png;base64,/.test(art.image||'')){
          const preview=document.createElement('img');preview.src=art.image;
          preview.loading='lazy';preview.alt='Artwork preview';
          preview.style.cssText='display:block;max-width:180px;max-height:140px;object-fit:contain;margin-bottom:12px';
          card.append(preview);
        }
        const actions=document.createElement('div');actions.className='toolrow';
        for(const [word,next] of status==='approved'
          ?[['HIDE','rejected']]:[['PUBLISH','approved'],['KEEP HIDDEN','rejected']]){
          const button=document.createElement('button');button.className='btn secondary';button.textContent=word;
          button.onclick=async()=>{
            button.disabled=true;
            try{await store.moderate(row.id,next);await sync();
              card.remove();toast(next==='approved'?'Artwork made public':'Artwork hidden');}
            catch(e){toast(e.message);button.disabled=false}
          };
          actions.append(button);
        }
        const remove=document.createElement('button');remove.className='btn secondary';
        remove.textContent='DELETE';
        remove.onclick=async()=>{
          if(!confirm('Permanently delete this artwork?'))return;
          remove.disabled=true;
          try{await store.remove(row.id);await sync();card.remove();toast('Artwork deleted')}
          catch(e){toast(e.message);remove.disabled=false}
        };
        actions.append(remove);card.append(actions);list.append(card);
      }
      if(!records.length)list.textContent='No artworks in this section.';
    }catch(e){$('adminStatus').textContent='Could not load artworks: '+e.message}
  }
  $('showApproved').onclick=()=>renderList('approved');
  $('refreshPending').onclick=()=>renderList('rejected');
  return {status:refreshUI,refreshReviews:()=>renderList('approved')};
}
