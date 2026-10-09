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

export function wallVoxelAllowed(x,y,z) {
  return Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)
    &&Math.abs(x)<=WALL_VOXEL_LIMIT&&Math.abs(y)<=WALL_VOXEL_LIMIT
    &&z>=0&&z<=WALL_VOXEL_LIMIT;
}

// Historic artworks may predate the wall-aware editor. Sanitize on display as
// well as on creation so existing gallery data cannot embed art into the wall.
export function sanitizeWallVoxels(voxels) {
  if(!Array.isArray(voxels))return [];
  const seen=new Set(),result=[];
  for(const entry of voxels) {
    if(!Array.isArray(entry)||entry.length!==3||!entry.every(Number.isFinite))continue;
    const [x,y,z]=entry.map(Math.round);
    const corrected=[Math.max(-4,Math.min(4,x)),Math.max(-4,Math.min(4,y)),Math.max(0,Math.min(4,z))];
    const key=corrected.join(',');
    if(!seen.has(key)){seen.add(key);result.push(corrected)}
  }
  return result;
}
