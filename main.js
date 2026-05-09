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

camera.position.z = 10;
// camera.position.set(-5, 0, 0);
camera.lookAt(0, 0, 0);

// render
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);



//scene
import { earth } from './planets.js';
import {pod} from './pod.js';
scene.add(pod)
scene.add(earth);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 2, 4);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

let theta=0
let a=8.5; // major axis
let b=4.5; // minor axis
let Eccentricity =Math.sqrt(1-(b*b)/(a*a));
function animate() {
    theta+=0.05
    Eccentricity=Math.sqrt(1-(b*b)/(a*a))
    pod.position.y = -b*Math.cos(theta);
    pod.position.x=Eccentricity*a-a*Math.sin(theta);
    pod.rotation.z=Math.PI/2-theta
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}

animate();

// renderer.render(scene, camera);

