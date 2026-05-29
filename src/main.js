import * as THREE from 'three'; // 3D objects API
import * as PLANETS from './planets.js';
import './styles.css';
import * as UI from './ui.js';

import * as STEP from './maneuver.js'; // Orbit Equations and Animation loop
import * as PATH from './trajectory.js'; // trajectory prediction
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // add zoom features

import * as COLLISION from './collision.js'

const scene = new THREE.Scene();

// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 15; // starting position
camera.lookAt(0, 0, 0);

// render
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

//scene
import * as POD from './pod.js';

//planets
scene.add(PLANETS.earth);
scene.add(PLANETS.moon);
scene.add(PLANETS.sun);

// pod
scene.add(POD.pod);
scene.add(POD.trajectory);

//sunlight
scene.add(PLANETS.sunlight);

// lights
const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

//background
const loader = new THREE.TextureLoader();

loader.load('assets/bg.webp', (texture) => {
    scene.background = texture;
});

// velocity vectors

const dir = new THREE.Vector3();
const origin = new THREE.Vector3();
const length = 1;
const color = 0xff0000;
const velArrow = new THREE.ArrowHelper(dir, origin, length, color);
scene.add(velArrow);

//add zoom features
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; //2D only
controls.enableDamping = true;
controls.zoomToCursor = true;

PATH.predict_trajectory_init(); //start trajectory
//animation loop
function animate() {
    const { x, y, theta, vx, vy, ax, ay, moonx, moony, dt } = STEP.step();

    POD.pod.position.x = x;
    POD.pod.position.y = y;
    POD.pod.rotation.z = -Math.PI / 2 + theta;
    PLANETS.earth.rotation.y += 0.002;

    PLANETS.moon.position.x = moonx;
    PLANETS.moon.position.y = moony;

    // Update HUD
    UI.updateTelemetry({ vx, vy, ax, ay, dt });

    // velocity vector
    const vVec = new THREE.Vector3(vx, vy, 0);
    const dir = vVec.clone().normalize();
    velArrow.position.set(x, y, 0);
    velArrow.setDirection(dir);
    velArrow.setLength(2 * vVec.length()); // scale arrow length = 2*speed (just a scale)

    if (UI.autoPredict) {
        PATH.trajectory_UI_update();
    }

    // check for collisions
    COLLISION.collision_status();
    if(COLLISION.crashState.crashed==true){
        COLLISION.update_UI();
        console.log(COLLISION.crashState.message);
        return;
    }

    controls.update(); //zoom update
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
