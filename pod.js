import * as THREE from 'https://unpkg.com/three?module';

import * as BufferGeometryUtils from
'https://unpkg.com/three/examples/jsm/utils/BufferGeometryUtils.js?module';


const loader = new THREE.TextureLoader();

const geometry_pod = new THREE.CylinderGeometry(
    0.2,
    0.6,
    0.7,
    64
)
const hullTexture = loader.load('assets/hull.jpg');

const material_pod = new THREE.MeshStandardMaterial( { map:hullTexture} );
const pod = new THREE.Mesh(geometry_pod, material_pod );


const mergedGeometry = BufferGeometryUtils.mergeVertices(geometry_pod);
mergedGeometry.computeVertexNormals();
pod.geometry = mergedGeometry;
pod.scale.set(0.5, 0.5, 0.5);

export {pod};

