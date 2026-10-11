// MAD's sleeping gallery guard.
// This is the user-uploaded Meshy GLB optimized from 19 MB to 472 KB:
// original mesh triangles and UVs remain, with a smaller color texture.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';

const modelUrl='./assets/models/sleeping-guard.glb?v=guard1';
const loader=new GLTFLoader();

function disposeModel(group){
  group.traverse(o=>{
    if(!o.isMesh)return;
    o.geometry?.dispose();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){
      if(!m)continue;
      for(const prop of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])
        m[prop]?.dispose();
      m.dispose();
    }
  });
}

/**
 * Only place the sleeping guard in the main gallery. A pending load
 * is discarded rather than attaching to a destroyed room.
 */
export async function addSleepingGuard(scene,{eco=false}={}){
  try{
    const gltf=await loader.loadAsync(modelUrl);
    const model=gltf.scene;
    if(scene.userData.madDisposed){disposeModel(model);return null;}
    const bounds=new THREE.Box3().setFromObject(model);
    const size=bounds.getSize(new THREE.Vector3());
    if(!Number.isFinite(size.y)||size.y<.2){
      disposeModel(model);throw Error('Unexpected guard GLB dimensions');
    }
    // A seated person and chair reach roughly 1.55 meters.
    model.scale.setScalar(1.55/size.y);
    model.updateMatrixWorld(true);
    const settled=new THREE.Box3().setFromObject(model);
    model.position.set(
      -(settled.min.x+settled.max.x)*.5,
      -settled.min.y+.008,
      -(settled.min.z+settled.max.z)*.5
    );
    model.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=!eco;
      o.receiveShadow=true;
      o.frustumCulled=true;
    });
    const root=new THREE.Group();
    root.name='Sleeping Museum Guard';
    root.position.set(-16.70,0,-9.35);
    root.rotation.y=-Math.PI*.75;
    root.add(model);
    // The fixed building lightmap excludes this decorative character.
    root.userData.madStatic=false;
    scene.add(root);
    return root;
  }catch(error){
    console.warn('Sleeping guard model could not load',error);
    return null;
  }
}
