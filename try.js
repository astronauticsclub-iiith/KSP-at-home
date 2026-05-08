import * as THREE from
'https://unpkg.com/three?module';

import * as BufferGeometryUtils from
'https://unpkg.com/three/examples/jsm/utils/BufferGeometryUtils.js?module';

const scene = new THREE.Scene()
console.log("here")

// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

// render
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

// sphere
const loader = new THREE.TextureLoader();

const earthTexture = loader.load('earth.jpg');

const geometry = new THREE.SphereGeometry(1, 64, 64)

const material = new THREE.MeshStandardMaterial({
    map: earthTexture
});

//pod

const geometry_cone = new THREE.CylinderGeometry(
    0.2,
    0.6,
    0.7,
    64
)
const hullTexture = loader.load('hull.jpg');

const material_cone = new THREE.MeshStandardMaterial( { map:hullTexture} );
const cone = new THREE.Mesh(geometry_cone, material_cone );


const mergedGeometry = BufferGeometryUtils.mergeVertices(geometry_cone);
mergedGeometry.computeVertexNormals();
cone.geometry = mergedGeometry;
cone.scale.set(0.5, 0.5, 0.5);
scene.add(cone)


const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 2, 4);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

let theta=0

function animate() {
    theta+=0.05
    cone.position.y = -1.5*Math.cos(theta);
    cone.position.x=-2.5*Math.sin(theta);
    cone.rotation.z=Math.PI/2-theta
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

animate();

// renderer.render(scene, camera);

