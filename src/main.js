
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
import * as PARAMS from './physics/control_params.js';
import * as WIN from './physics/win_condition.js';
import * as SCORE from './frontend/score.js';

const scene = new THREE.Scene();

// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// camera position is set per-level after the config loads (below)
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// Keep canvas and camera in sync when window/device orientation changes
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//--------------LEVEL SETUP----------------------

const levelRes = await fetch(`${import.meta.env.BASE_URL}level.json`);
const allLevels = await levelRes.json();
const levelCfg = allLevels[UI.level] ?? allLevels['1'];

// Init physics state: mutates r, v, bodies and sets dynamicBodies flag
PARAMS.initLevel(levelCfg);

// Populate the mission briefing popup from level config
UI.setBriefing(levelCfg.briefing, levelCfg.destination);

//--------------SCENE----------------------

// Add only the planet meshes listed in this level's activeBodies
for (const name of levelCfg.activeBodies) {
    if (PLANETS.planetMeshes[name]) {
        scene.add(PLANETS.planetMeshes[name]);
    }
}

// pod
scene.add(POD.pod);
scene.add(POD.trajectory);

// sunlight (always present — illuminates from sun's world position)
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

// Camera: position x/y matches the target so we look straight-on (true 2D)
const camTarget = levelCfg.cameraTarget ?? { x: 0, y: 4 };
const camZ = levelCfg.cameraZ ?? 15;
camera.position.set(camTarget.x, camTarget.y, camZ);

//add zoom features
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; //2D only
controls.enableDamping = true;
controls.zoomToCursor = true;
controls.target.set(camTarget.x, camTarget.y, 0);
controls.update();
PATH.predict_trajectory_init(); //start trajectory

// FPS cap: ensures consistent speed across 60Hz, 120Hz, and 144Hz displays
let lastTime = 0;
const FRAME_INTERVAL = 1000 / 60; // 16.67ms (60 FPS cap)

//animation loop
function animate(currentTime = 0) {
    // Skip extra frames on high refresh-rate monitors (e.g. 120Hz/144Hz)
    const elapsed_frame = currentTime - lastTime;
    if (elapsed_frame < FRAME_INTERVAL) {
        requestAnimationFrame(animate);
        return;
    }
    lastTime = currentTime - (elapsed_frame % FRAME_INTERVAL);

    const { x, y, theta, vx, vy, ax, ay, moonx, moony, earthx, earthy, dt } =
        STEP.step();

    //Update planet Positions
    UI.update_position(x, y, theta, moonx, moony, earthx, earthy);
    // Update HUD
    UI.updateTelemetry({ vx, vy, ax, ay, dt });

    // velocity vector
    VEC.update_vector(x, y, vx, vy);

    if (UI.autoPredict) {
        PATH.trajectory_UI_update();
    }

    // Elapsed real time since mission start
    const elapsed = Date.now() / 1000 - UI.start_time;

    // Continuous fuel drain while any thruster is held
    if (STEP.controls.prograding || STEP.controls.retrograding) {
        SCORE.addHoldCost();
    }

    // Live score in telemetry
    SCORE.updateScoreHUD(elapsed);

    // Orbit countdown HUD
    const orbitEl = document.getElementById('orbit-timer');
    if (orbitEl) {
        if (WIN.winState.inOrbitZone) {
            const remaining = Math.max(
                0,
                WIN.WIN_DURATION_SECONDS - WIN.winState.orbitTimer
            ).toFixed(1);
            orbitEl.innerText = `${remaining}s`;
            orbitEl.classList.add('in-zone');
        } else {
            orbitEl.innerText = '-';
            orbitEl.classList.remove('in-zone');
        }
    }

    // Win check
    const won = WIN.checkWin(
        PARAMS.r,
        PARAMS.bodies,
        levelCfg.destination,
        levelCfg.orbitRadius,
        STEP.controls.prograding || STEP.controls.retrograding
    );

    if (won) {
        const payload = SCORE.buildScorePayload(UI.level, elapsed);
        UI.showWinScreen(payload);
        renderer.render(scene, camera); // final frame
        return; // stop loop
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


// Wait for the player to dismiss the mission briefing before starting the sim.
// The 'missionStart' event is dispatched by the BEGIN MISSION button in gameui.html.
window.addEventListener('missionStart', () => { animate(); }, { once: true });

