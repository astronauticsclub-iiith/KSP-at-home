import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new THREE.TextureLoader();

const geometry_pod = new THREE.CylinderGeometry(
    0.2,
    0.6,
    0.7,
    64
)
const hullTexture = loader.load('assets/hull.webp');

const material_pod = new THREE.MeshStandardMaterial( { map:hullTexture} );
const pod = new THREE.Mesh(geometry_pod, material_pod );


const mergedGeometry = BufferGeometryUtils.mergeVertices(geometry_pod);
mergedGeometry.computeVertexNormals();
pod.geometry = mergedGeometry;
pod.scale.set(0.5, 0.5, 0.5);

export {pod};

// Pod Trajectory Prediction
import {pathLen} from './trajectory.js'

export const trajectory_Geometry = new THREE.BufferGeometry();
const trajectory_Material = new THREE.PointsMaterial({
    color: 0x00ff00,
    size: 0.5,
    sizeAttenuation: false
});

// intialize attibutes to pick up from
const positions = new Float32Array(pathLen * 3);

trajectory_Geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
);

const trajectory = new THREE.Points(trajectory_Geometry, trajectory_Material);
export { trajectory }

