// Offline-first artwork persistence for MAD. No service, account or API token required.
// Local work and a read-only cache of public works use separate object stores.
// Browser data is DEVICE-LOCAL: a backup export is the portable archive.
export class LocalMuseumStore {
  constructor() {
    this.legacyKey='mad-artworks-v1';
    this.fallbackKeys={local:'mad-local-works-v2',remote:'mad-public-cache-v2'};
    this.dbPromise=null;
  }
  async db() {
    if(typeof indexedDB==='undefined')return null;
    if(!this.dbPromise)this.dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open('mad-museum-offline',1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const name of ['local','remote'])
          if(!db.objectStoreNames.contains(name))
            db.createObjectStore(name,{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error('IndexedDB could not open'));
      req.onblocked=()=>reject(Error('Close other MAD tabs and reload to upgrade storage'));
    });
    try{return await this.dbPromise}
    catch(error){console.warn('IndexedDB unavailable, using browser storage',error);this.dbPromise=null;return null}
  }
  readFallback(name){
    try{
      const rows=JSON.parse(localStorage.getItem(this.fallbackKeys[name])||'[]');
      return Array.isArray(rows)?rows.filter(a=>a&&typeof a.id==='string'):[];
    }catch{return []}
  }
  writeFallback(name,rows){
    localStorage.setItem(this.fallbackKeys[name],JSON.stringify(rows));
  }
  async getAll(name){
    const db=await this.db();
    let rows=[];
    if(db)try{
      rows=await new Promise((resolve,reject)=>{
        const req=db.transaction(name,'readonly').objectStore(name).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error||Error('Could not read saved artworks'));
      });
    }catch(error){console.warn('Artwork database read failed',error)}
    const map=new Map();
    for(const item of [...rows,...this.readFallback(name)])
      if(item&&typeof item.id==='string')map.set(item.id,item);
    return [...map.values()];
  }
  async put(name,art){
    if(!art||typeof art.id!=='string'||!art.id||!art.spotId)
      throw Error('Artwork has no valid ID or exhibition space.');
    const db=await this.db();
    if(db)try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(name,'readwrite');
        tx.objectStore(name).put(art);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||Error('Browser database write failed'));
        tx.onabort=()=>reject(tx.error||Error('Browser database transaction aborted'));
      });
      // Retain any older fallback entries unrelated to this ID.
      const fallback=this.readFallback(name).filter(a=>a.id!==art.id);
      try{this.writeFallback(name,fallback)}catch{}
      return;
    }catch(error){console.warn('IndexedDB write failed; trying localStorage',error)}
    const map=new Map(this.readFallback(name).map(a=>[a.id,a]));
    map.set(art.id,art);
    this.writeFallback(name,[...map.values()]); // throws when browser storage is full
  }
  async replaceRemote(artworks){
    const rows=artworks.filter(a=>a?.id&&a.spotId);
    const db=await this.db();
    if(db)try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('remote','readwrite');
        const data=tx.objectStore('remote');
        data.clear();
        for(const art of rows)data.put({...art,localOnly:false});
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||Error('Public collection cache failed'));
        tx.onabort=()=>reject(tx.error||Error('Public collection cache aborted'));
      });
      try{localStorage.removeItem(this.fallbackKeys.remote)}catch{}
      return;
    }catch(error){console.warn('IndexedDB public cache failed',error)}
    this.writeFallback('remote',rows.map(a=>({...a,localOnly:false})));
  }
  async rememberRemote(art){await this.put('remote',{...art,localOnly:false})}
  async saveLocal(art){await this.put('local',{...art,localOnly:true})}
  legacyWorks(){
    try{
      const works=JSON.parse(localStorage.getItem(this.legacyKey)||'[]');
      return Array.isArray(works)?works.filter(a=>a?.id&&a.spotId):[];
    }catch{return []}
  }
  async listLocal(){
    const map=new Map();
    for(const art of this.legacyWorks())map.set(art.id,{...art,localOnly:true});
    for(const art of await this.getAll('local'))
      map.set(art.id,{...art,localOnly:true});
    return [...map.values()];
  }
  async all(){
    const [local,remote]=await Promise.all([this.listLocal(),this.getAll('remote')]);
    // A public artwork with the same ID supersedes its older local draft.
    const map=new Map(local.map(a=>[a.id,a]));
    for(const a of remote)map.set(a.id,{...a,localOnly:false});
    return [...map.values()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  }
  async removeLocal(id){
    const db=await this.db();
    if(db)await new Promise((resolve,reject)=>{
      const tx=db.transaction('local','readwrite');
      tx.objectStore('local').delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||Error('Could not remove local draft'));
      tx.onabort=()=>reject(tx.error||Error('Could not remove local draft'));
    });
    const other=this.readFallback('local').filter(a=>a.id!==id);
    try{this.writeFallback('local',other)}catch{}
    const legacy=this.legacyWorks().filter(a=>a.id!==id);
    try{localStorage.setItem(this.legacyKey,JSON.stringify(legacy))}catch{}
  }
  async exportBackup(){
    return JSON.stringify({format:'mad-artwork-backup',version:1,
      exportedAt:new Date().toISOString(),artworks:await this.all()});
  }
  async importBackup(data){
    if(data?.format!=='mad-artwork-backup'||data?.version!==1||
       !Array.isArray(data.artworks)||data.artworks.length>1000)
      throw Error('Not a valid MAD artwork backup (version 1).');
    let count=0;
    for(const item of data.artworks){
      if(!item||typeof item.id!=='string'||item.id.length>128||
         typeof item.spotId!=='string'||item.spotId.length>64||
         typeof item.title!=='string'||typeof item.desc!=='string'||
         !Number.isFinite(item.createdAt))
        throw Error('Backup contains an invalid artwork.');
      await this.saveLocal({...item,localOnly:true});
      count++;
    }
    return count;
  }
}
