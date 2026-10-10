// MAD wall sculpture constraints.
// The gallery face is z = 0 in an artwork's local coordinate system.
// Sculpted material can only occupy positive z: it can never cut through the wall.
export const WALL_RELIEF_DEPTH = 0.72;
export const WALL_VOXEL_LIMIT = 4;

export function constrainReliefGeometry(geometry, depth=WALL_RELIEF_DEPTH) {
  const positions=geometry.attributes.position;
  geometry.computeBoundingBox();
  const box=geometry.boundingBox;
  const minZ=box.min.z, span=Math.max(1e-6,box.max.z-minZ);
  for(let i=0;i<positions.count;i++) {
    const t=(positions.getZ(i)-minZ)/span;
    positions.setZ(i,0.015+Math.max(0,Math.min(1,t))*depth);
  }
  positions.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Grid 1 is the legacy 9x9 relief. Grid 2 is the new 21x21 relief.
export function wallVoxelAllowed(x,y,z,resolution=1){
  const max=resolution>=2?10:WALL_VOXEL_LIMIT;
  const depth=resolution>=2?8:WALL_VOXEL_LIMIT;
  return [x,y,z].every(Number.isInteger)&&Math.abs(x)<=max&&
    Math.abs(y)<=max&&z>=0&&z<=depth;
}
const validHex=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);
// Preserve optional per-voxel hexadecimal colour. Older three-number
// entries still load correctly, with their original artwork-wide colour.
export function sanitizeWallVoxels(voxels,resolution=1){
  if(!Array.isArray(voxels))return [];
  const result=[],seen=new Set();
  const max=resolution>=2?10:WALL_VOXEL_LIMIT;
  const depth=resolution>=2?8:WALL_VOXEL_LIMIT;
  for(const entry of voxels){
    if(!Array.isArray(entry)||entry.length<3||
      !entry.slice(0,3).every(Number.isFinite))continue;
    const [x,y,z]=entry.slice(0,3).map(Math.round);
    const p=[Math.max(-max,Math.min(max,x)),
      Math.max(-max,Math.min(max,y)),Math.max(0,Math.min(depth,z))];
    const key=p.join(',');
    if(seen.has(key))continue;
    seen.add(key);
    if(validHex(entry[3]))p.push(entry[3]);
    result.push(p);
  }
  return result;
}
