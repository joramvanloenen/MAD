// MAD's spot identity is immutable during artwork creation. Every form,
// save and post-publish camera move refers to the same canonical slot ID.
export const EXHIBITION_MS=14*24*60*60*1000;
export function findVacantSlot(slotId,slots,artworks,now=Date.now()){
  const slot=slots.find(s=>s.id===slotId);
  if(!slot)return {ok:false,reason:'This exhibition spot no longer exists.'};
  const occupied=artworks.some(a=>
    a.spotId===slotId &&
    Number.isFinite(a.createdAt) &&
    now-a.createdAt < EXHIBITION_MS
  );
  if(occupied)return {ok:false,reason:'This exhibition spot has already been filled. Please select another.'};
  return {ok:true,slot};
}
export function viewFromSlot(slot){
  // s.rot=0 on north walls, PI on south walls; positive Z points into
  // the room at the north wall, negative Z at the south wall.
  const isWall=slot.type==='wall';
  const yaw=isWall&&slot.z>0?Math.PI:0;
  const inVitrine=slot.type==='vitrine';
  const z=slot.z+(isWall?Math.cos(yaw)*4.2:inVitrine?2.65:4.3);
  return {
    x:Math.max(-17.5,Math.min(17.5,slot.x)),
    y:1.7,
    z:Math.max(-10.6,Math.min(10.6,z)),
    yaw,
    pitch:isWall?.285:inVitrine?-.17:.065
  };
}
