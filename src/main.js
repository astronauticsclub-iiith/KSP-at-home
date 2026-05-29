import * as THREE from 'three'; // 3D objects API
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // add zoom features

import * as PLANETS from './entities/planets.js';
import * as POD from './entities/pod.js';
import * as PATH from './entities/trajectory.js'; // trajectory prediction
import * as VEC from './entities/velocity_vector.js';

import './styles.css';
import * as UI from './frontend/ui.js';

import * as STEP from './physics/maneuver.js'; // Orbit Equations and Animation loop
import * as COLLISION from './physics/collision.js';

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

//--------------SCENE----------------------

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
scene.add(VEC.velArrow);

//add zoom features
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; //2D only
controls.enableDamping = true;
controls.zoomToCursor = true;

PATH.predict_trajectory_init(); //start trajectory

//animation loop
function animate() {
    const { x, y, theta, vx, vy, ax, ay, moonx, moony, dt } = STEP.step();

    //Update planet Positions
    UI.update_position(x, y, theta, moonx, moony);
    // Update HUD
    UI.updateTelemetry({ vx, vy, ax, ay, dt });

    // velocity vector
    VEC.update_vector(x, y, vx, vy);

    if (UI.autoPredict) {
        PATH.trajectory_UI_update();
    }

    // check for collisions
    COLLISION.collision_status();
    if (COLLISION.crashState.crashed == true) {
        COLLISION.update_UI();
        console.log(COLLISION.crashState.message);
        return;
    }

    controls.update(); //zoom update
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
