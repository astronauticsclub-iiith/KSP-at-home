import * as THREE from 'three';
import * as PLANETS from './planets.js'
import './styles.css';
// import { updateTelemetry } from './ui.js';
import * as UI from './ui.js'
import { initLaunchEffects, updateLaunchEffects, disposeLaunchEffects } from './launch-effects.js';
import { triggerCrashEffect, updateCrashEffect, disposeCrashEffect } from './crash.js';
import * as Autopilot from './autopilot.js';

const scene = new THREE.Scene()

document.body.dataset.mode = 'landing';

const landingScreen = document.getElementById('landing-screen');
const landingStatus = document.getElementById('landing-status');
const launchButton = document.getElementById('launch-button');
const missionInputs = {
    G: document.getElementById('mission-g'),
    dt: document.getElementById('mission-dt'),
    moonMass: document.getElementById('mission-moon-mass'),
    Isp: document.getElementById('mission-isp'),
    thrust: document.getElementById('mission-thrust'),
    dryMass: document.getElementById('mission-dry-mass'),
    fuelMass: document.getElementById('mission-fuel-mass'),
    pathSteps: document.getElementById('mission-path-steps'),
    orbitRadius: document.getElementById('mission-orbit-radius'),
};

const launchSequence = {
    active: false,
    finishing: false,
    startTime: 0,
    duration: 3200,
    start: new THREE.Vector3(),
    control: new THREE.Vector3(),
    end: new THREE.Vector3(),
    orbitRadius: 2,
};

let crashTriggered = false;
const crashOverlay = document.getElementById('crash-overlay');
const crashMessageEl = document.getElementById('crash-message');
const crashTargetEl = document.getElementById('crash-target');
const restartBtn = document.getElementById('restart-btn');

const launchCamera = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
};



function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
}

function quadraticBezier(p0, p1, p2, t) {
    const inv = 1 - t;
    const a = inv * inv;
    const b = 2 * inv * t;
    const c = t * t;
    return new THREE.Vector3(
        a * p0.x + b * p1.x + c * p2.x,
        a * p0.y + b * p1.y + c * p2.y,
        0,
    );
}

function quadraticBezierTangent(p0, p1, p2, t) {
    return new THREE.Vector3(
        2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
        2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
        0,
    );
}

function setMode(mode) {
    document.body.dataset.mode = mode;
}

function setCameraFollow(position, intensity = 0.08, t = 0) {
    // Task 4.5: Low upward angle at launch start, lerp to chase cam at end
    // Close low-angle camera: offset (+0.3, -2.5, 4.5) from rocket, looking up
    const lowCamPos = new THREE.Vector3(position.x + 0.3, position.y - 2.5, 4.5);
    const lowCamTarget = new THREE.Vector3(position.x, position.y + 1.0, 0);

    // Normal chase camera position
    const chaseCamPos = new THREE.Vector3(position.x - 5.4, position.y + 2.8, 13.5);
    const chaseCamTarget = new THREE.Vector3(position.x + 0.55, position.y + 0.15, 0);

    // Smoothly transition from low camera to chase camera over final 20% (t: 0.8 → 1.0)
    let blend = 0; // 0 = low cam, 1 = chase cam
    if (t > 0.8) {
        blend = clamp((t - 0.8) / 0.2, 0, 1);
    }

    launchCamera.position.lerpVectors(lowCamPos, chaseCamPos, blend);
    launchCamera.target.lerpVectors(lowCamTarget, chaseCamTarget, blend);

    camera.position.lerp(launchCamera.position, intensity);
    controls.target.lerp(launchCamera.target, intensity);
    camera.lookAt(launchCamera.target);
}





function updateMoonPosition() {
    PLANETS.moon.position.x = STEP.bodies.earth.pos.x + 15 * Math.cos(STEP.moonState.omega + Math.PI / 3);
    PLANETS.moon.position.y = STEP.bodies.earth.pos.y + 15 * Math.sin(STEP.moonState.omega + Math.PI / 3);
}

function syncMissionParameters() {
    const gravity = Number.parseFloat(missionInputs.G.value);
    const step = Number.parseFloat(missionInputs.dt.value);
    const moonMass = Number.parseFloat(missionInputs.moonMass.value);
    const isp = Number.parseFloat(missionInputs.Isp.value);
    const thrust = Number.parseFloat(missionInputs.thrust.value);
    const dryMass = Number.parseFloat(missionInputs.dryMass.value);
    const fuelMass = Number.parseFloat(missionInputs.fuelMass.value);
    const pathSteps = Number.parseInt(missionInputs.pathSteps.value, 10);
    const orbitRadius = Number.parseFloat(missionInputs.orbitRadius.value);

    STEP.params.G = Number.isFinite(gravity) ? gravity : STEP.params.G;
    STEP.params.dt = Number.isFinite(step) ? step : STEP.params.dt;
    STEP.params.moonMass = Number.isFinite(moonMass) ? moonMass : STEP.params.moonMass;
    STEP.params.pathSteps = Number.isFinite(pathSteps) ? pathSteps : STEP.params.pathSteps;
    STEP.bodies.moon.m = STEP.params.moonMass;

    STEP.rocketParams.Isp = Number.isFinite(isp) ? isp : STEP.rocketParams.Isp;
    STEP.rocketParams.thrust = Number.isFinite(thrust) ? thrust : STEP.rocketParams.thrust;
    STEP.rocketParams.dryMass = Number.isFinite(dryMass) ? dryMass : STEP.rocketParams.dryMass;
    STEP.rocketParams.fuelMass = Number.isFinite(fuelMass) ? fuelMass : STEP.rocketParams.fuelMass;

    UI.setMaxFuel(STEP.rocketParams.fuelMass);

    return {
        orbitRadius: Number.isFinite(orbitRadius) ? Math.max(1.1, orbitRadius) : 2,
    };
}

function setLandingMessage(message, className) {
    if (!landingStatus) return;
    landingStatus.innerText = message;
    landingStatus.className = className;
}

function startLaunchSequence() {
    const launchConfig = syncMissionParameters();

    UI.resetMissionTimer();
    setMode('launching');
    setLandingMessage('Ignition sequence engaged', 'status-pill status-pill-ready');
    controls.enabled = false;

    launchSequence.active = true;
    launchSequence.finishing = false;
    launchSequence.startTime = performance.now();
    launchSequence.duration = 3200;
    launchSequence.orbitRadius = launchConfig.orbitRadius;

    launchSequence.start.copy(POD.pod.position);
    launchSequence.end.set(
        STEP.bodies.earth.pos.x + launchSequence.orbitRadius,
        STEP.bodies.earth.pos.y,
        0,
    );
    launchSequence.control.set(
        STEP.bodies.earth.pos.x + launchSequence.orbitRadius * 0.12,
        STEP.bodies.earth.pos.y + Math.max(launchSequence.orbitRadius * 2.6, 4.2),
        0,
    );

    launchFlame.visible = true;
    initLaunchEffects(scene);
    PATH.predict_trajectory_init();
}

function finishLaunchSequence() {
    STEP.setInitialOrbit(launchSequence.orbitRadius);
    POD.pod.position.set(STEP.r.x, STEP.r.y, 0);
    POD.pod.rotation.z = 0;
    launchFlame.visible = false;
    disposeLaunchEffects();
    launchSequence.active = false;
    launchSequence.finishing = false;
    controls.enabled = true;
    setMode('flight');
    setLandingMessage('Flight systems nominal', 'status-pill status-pill-ready');
    UI.resetMissionTimer();
    PATH.predict_trajectory_init();

    // Task 5.5: Transition to orbit stage (hides boosters, shows capsule)
    POD.setStage('orbit');
    POD.playSeparation(scene, quadraticBezierTangent(
        launchSequence.start, launchSequence.control, launchSequence.end, 1
    ).normalize());
}

if (launchButton) {
    launchButton.addEventListener('click', startLaunchSequence);
}

// Task 5.6: Reset staging when restarting to landing mode.
// Full restart logic is implemented in Task 6.7; this function provides
// the staging reset hook for it.
export function resetToLanding() {
    POD.setStage('launch');
}

// Task 6.7: Restart logic — reset everything to pre-flight state
function restartMission() {
    disposeCrashEffect();
    crashTriggered = false;
    window._crashMsg = '';

    // Reset maneuver state
    STEP.crashState.crashed = false;
    STEP.crashState.message = '';
    STEP.setInitialOrbit(launchSequence.orbitRadius || 2);

    // Reset trajectory prediction
    if (UI.autoPredict) {
        PATH.predict_trajectory_init();
    }
    const attr = POD.trajectory_Geometry.attributes.position;
    POD.trajectory_Geometry.setDrawRange(0, 0);
    attr.needsUpdate = true;

    // Reset staging
    resetToLanding();

    // Hide crash overlay, switch to landing mode
    if (crashOverlay) crashOverlay.hidden = true;
    setMode('landing');
    setLandingMessage('Ready on the pad', 'status-pill status-pill-ready');
}

// Wire restart button
if (restartBtn) {
    restartBtn.addEventListener('click', restartMission);
}

// Wire R key for restart (only active during crash state)
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (crashTriggered) {
            restartMission();
        }
    }
});

// Wire up range slider readouts AND live parameter sync
document.querySelectorAll('.slider-field input[type="range"]').forEach((slider) => {
    const readout = slider.parentElement.querySelector('.slider-readout');
    if (readout) {
        slider.addEventListener('input', () => {
            readout.textContent = slider.value;
            // Sync parameter to sim in real time (works during flight too)
            syncLiveParameter(slider.id, slider.value);
        });
    }
});

/**
 * Update a single sim parameter from a slider change.
 * Works during flight — allows real-time tuning of physics/rocket params.
 */
function syncLiveParameter(id, rawValue) {
    const val = Number.parseFloat(rawValue);
    if (!Number.isFinite(val)) return;

    switch (id) {
        case 'mission-g': case 'fp-g':
            STEP.params.G = val;
            break;
        case 'mission-dt': case 'fp-dt':
            STEP.params.dt = val;
            break;
        case 'mission-moon-mass': case 'fp-moon-mass':
            STEP.params.moonMass = val;
            STEP.bodies.moon.m = val;
            break;
        case 'mission-isp': case 'fp-isp':
            STEP.rocketParams.Isp = val;
            break;
        case 'mission-thrust': case 'fp-thrust':
            STEP.rocketParams.thrust = val;
            break;
        case 'mission-dry-mass':
            STEP.rocketParams.dryMass = val;
            break;
        case 'mission-fuel-mass':
            STEP.rocketParams.fuelMass = val;
            UI.setMaxFuel(val);
            break;
        case 'mission-path-steps': case 'fp-path-steps':
            STEP.params.pathSteps = Number.parseInt(rawValue, 10);
            break;
        case 'mission-orbit-radius':
            break;
    }
}

// Toggle in-flight params panel
const toggleParamsBtn = document.getElementById('toggle-params');
const flightParamsPanel = document.getElementById('flight-params');
if (toggleParamsBtn && flightParamsPanel) {
    toggleParamsBtn.addEventListener('click', () => {
        flightParamsPanel.hidden = !flightParamsPanel.hidden;
    });
}

// Wire flight-params sliders for live sync
document.querySelectorAll('#flight-params .slider-field input[type="range"]').forEach((slider) => {
    const readout = slider.parentElement.querySelector('.slider-readout');
    slider.addEventListener('input', () => {
        if (readout) readout.textContent = slider.value;
        syncLiveParameter(slider.id, slider.value);
    });
});


// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 15;
// camera.position.set(-5, 0, 0);
camera.lookAt(0, 0, 0);

// render
const rendererCanvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: rendererCanvas, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;


//scene
// import { pod } from './pod.js';
// import { trajectory } from './trajectory.js';
import * as POD from './pod.js'
scene.add(POD.pod)
POD.pod.position.set(STEP.r.x, STEP.r.y, STEP.r.z);
POD.pod.rotation.z = 0;
scene.add(PLANETS.earth);
scene.add(PLANETS.moon);
scene.add(PLANETS.sun);
scene.add(POD.trajectory);

const launchFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.9, 14),
    new THREE.MeshStandardMaterial({
        color: 0xffc26b,
        emissive: 0xff7a00,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
    }),
);
launchFlame.position.copy(POD.exhaustAnchor.position);
launchFlame.rotation.z = Math.PI;
launchFlame.visible = false;
POD.pod.add(launchFlame);

// lights

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

//sunlight
const sunlight = new THREE.PointLight(0xffffff, 20);
sunlight.decay = 0; // dosent look lit enough otherwise
sunlight.position.copy(PLANETS.sun.position);

sunlight.castShadow = true;

scene.add(sunlight);

//background
const loader = new THREE.TextureLoader();

loader.load("assets/bg.webp", (texture) => {
    scene.background = texture;
});

// Orbit Equations and Animation loop
import * as STEP from './maneuver.js';

// trajectory prediction
import * as PATH from './trajectory.js'

// velocity vectors

const dir = new THREE.Vector3();
const origin = new THREE.Vector3();
const length = 1;
const color = 0xff0000;
const velArrow = new THREE.ArrowHelper(dir, origin, length, color);
scene.add(velArrow);

//add zoom features
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;  //2D only
controls.enableDamping = true;
controls.zoomToCursor = true;
controls.target.copy(POD.pod.position);

// ── Autopilot UI wiring ───────────────────────────────────────────────────────
const autopilotBtn = document.getElementById('autopilot-btn');
const autopilotCancelBtn = document.getElementById('autopilot-cancel');
const autopilotOrbitSelect = document.getElementById('autopilot-orbit-type');
const autopilotStatusRow = document.getElementById('autopilot-status-row');
const autopilotPhaseEl = document.getElementById('autopilot-phase');

if (autopilotBtn) {
    autopilotBtn.addEventListener('click', () => {
        const orbitType = autopilotOrbitSelect ? autopilotOrbitSelect.value : 'circular';
        const result = Autopilot.engage(orbitType, { x: STEP.r.x, y: STEP.r.y }, { x: STEP.v.x, y: STEP.v.y });
        if (!result.success) {
            // Flash the button to indicate failure
            autopilotBtn.style.borderColor = 'rgba(255, 82, 82, 0.6)';
            autopilotBtn.textContent = result.reason || 'FAILED';
            setTimeout(() => {
                autopilotBtn.style.borderColor = '';
                autopilotBtn.textContent = 'AUTOPILOT';
            }, 2500);
        } else {
            autopilotBtn.hidden = true;
            if (autopilotOrbitSelect) autopilotOrbitSelect.hidden = true;
            if (autopilotCancelBtn) autopilotCancelBtn.hidden = false;
        }
    });
}

if (autopilotCancelBtn) {
    autopilotCancelBtn.addEventListener('click', () => {
        Autopilot.cancel();
        resetAutopilotUI();
    });
}

// Escape key cancels autopilot
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && Autopilot.isActive()) {
        Autopilot.cancel();
        resetAutopilotUI();
    }
});

function resetAutopilotUI() {
    if (autopilotBtn) { autopilotBtn.hidden = false; autopilotBtn.textContent = 'AUTOPILOT'; }
    if (autopilotOrbitSelect) autopilotOrbitSelect.hidden = false;
    if (autopilotCancelBtn) autopilotCancelBtn.hidden = true;
    if (autopilotStatusRow) autopilotStatusRow.hidden = true;
}

function updateAutopilotUI() {
    const telemetry = Autopilot.getTelemetry();
    if (Autopilot.isActive() || telemetry.phaseText !== '—') {
        if (autopilotStatusRow) autopilotStatusRow.hidden = false;
        if (autopilotPhaseEl) {
            const dvText = telemetry.remainingDv > 0 ? ` (Δv: ${telemetry.remainingDv.toFixed(2)})` : '';
            autopilotPhaseEl.textContent = telemetry.phaseText + dvText;
        }
    } else {
        if (autopilotStatusRow) autopilotStatusRow.hidden = true;
    }

    // Reset UI when autopilot completes
    if (!Autopilot.isActive() && autopilotBtn && autopilotBtn.hidden) {
        resetAutopilotUI();
    }
}

//animation loop
function animate(now = performance.now()) {
    if (launchSequence.active) {
        const t = clamp((now - launchSequence.startTime) / launchSequence.duration, 0, 1);
        const eased = easeOutCubic(t);
        const pos = quadraticBezier(launchSequence.start, launchSequence.control, launchSequence.end, eased);
        const tangent = quadraticBezierTangent(launchSequence.start, launchSequence.control, launchSequence.end, eased).normalize();

        POD.pod.position.copy(pos);
        POD.pod.rotation.z = Math.atan2(tangent.y, tangent.x) - Math.PI / 2;

        launchFlame.visible = true;
        launchFlame.material.opacity = 0.5 + 0.35 * Math.sin(now * 0.02);
        launchFlame.scale.setScalar(0.75 + 0.22 * Math.sin(now * 0.03));

        const rocketVel = quadraticBezierTangent(launchSequence.start, launchSequence.control, launchSequence.end, eased);
        updateLaunchEffects(Math.min(0.05, STEP.params.dt), pos, rocketVel);

        setCameraFollow(pos, 0.085, t);

        // Task 4.4: Camera shake — random displacement with amplitude 0.15,
        // exponential decay over first 60% of launch duration
        if (t < 0.6) {
            const shakeIntensity = 0.15 * Math.exp(-t * 5);
            camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            camera.position.y += (Math.random() - 0.5) * shakeIntensity;
        }

        PLANETS.earth.rotation.y += 0.0015;
        updateMoonPosition();
        STEP.moonState.omega -= 0.0001;

        if (t >= 1 && !launchSequence.finishing) {
            launchSequence.finishing = true;
            finishLaunchSequence();
        }
    } else {
        controls.enabled = true;
        const { x, y, theta, vx, vy, ax, ay, moonx, moony, dt, fuelMass, crashed } = STEP.step();
        POD.pod.position.x = x;
        POD.pod.position.y = y;
        POD.pod.rotation.z = -Math.PI / 2 + theta;
        PLANETS.earth.rotation.y += 0.002;

        PLANETS.moon.position.x = moonx;
        PLANETS.moon.position.y = moony;

        // Crash detection and effect trigger
        if (crashed && !crashTriggered) {
            crashTriggered = true;
            triggerCrashEffect(scene, { x, y }, STEP.crashState.message);
            window._crashMsg = STEP.crashState.message;
            setTimeout(() => {
                if (crashOverlay) crashOverlay.hidden = false;
                if (crashMessageEl) crashMessageEl.textContent = 'MISSION FAILED';
                if (crashTargetEl) crashTargetEl.textContent = STEP.crashState.message;
            }, 500);
        }

        // Update crash animation every frame
        updateCrashEffect();

        // Autopilot update (Task 8.11)
        Autopilot.update(
            STEP.params.dt,
            { x, y },
            { x: vx, y: vy },
            { x: moonx, y: moony }
        );

        // Update autopilot telemetry display
        updateAutopilotUI();

        // Update HUD
        UI.updateTelemetry({ vx, vy, ax, ay, dt, fuelMass, crashed });

        // Update circularization burn each frame
        if (!crashed) {
            UI.updateCircularization(dt);
        }

        // velocity vector
        const vVec = new THREE.Vector3(vx, vy, 0);

        // set arrow direction (must be normalized)
        const dir = vVec.clone().normalize();

        velArrow.position.set(x, y, 0);
        velArrow.setDirection(dir);

        // scale arrow length = 2*speed // just a scale
        velArrow.setLength(2 * vVec.length());

        if (UI.autoPredict) {
            PATH.trajectory_UI_update();
        }

        camera.position.lerp(new THREE.Vector3(x - 6, y + 3, 15), 0.04);
        controls.target.lerp(new THREE.Vector3(x, y, 0), 0.06);
    }

    controls.update();  //zoom update
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();


