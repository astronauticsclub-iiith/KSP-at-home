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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;


//scene
import { earth } from './planets.js';
import { pod } from './pod.js';
import {moon} from './planets.js'
scene.add(pod)
scene.add(earth);
scene.add(moon);

// lights

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 2, 4);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

// Orbit Equations and Animation loop
import * as STEP from './maneuver.js';

// velocity vectors

const dir = new THREE.Vector3();
const origin = new THREE.Vector3();
const length = 1;
const color = 0xff0000;

const velArrow = new THREE.ArrowHelper(dir, origin, length, color);
scene.add(velArrow);

function animate() {

    const { x, y, theta,vx,vy } = STEP.step();
    pod.position.x = x;
    pod.position.y = y;
    pod.rotation.z = Math.PI / 2 - theta

    // velocity vector
    const vVec = new THREE.Vector3(vx, vy, 0);

    // set arrow direction (must be normalized)
    const dir = vVec.clone().normalize();

    velArrow.position.set(x, y, 0);
    velArrow.setDirection(dir);

    // scale arrow length = speed
    velArrow.setLength(vVec.length());

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();


