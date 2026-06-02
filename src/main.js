import * as THREE from 'three';
import * as PLANETS from './planets.js'
import './styles.css';
// import { updateTelemetry } from './ui.js';
import * as UI from './ui.js'
import { initLaunchEffects, updateLaunchEffects, disposeLaunchEffects } from './launch-effects.js';
import { triggerCrashEffect, updateCrashEffect, disposeCrashEffect } from './crash.js';
import * as Autopilot from './autopilot.js';
import * as HOHMANN from './hohmann.js';

const scene = new THREE.Scene()

document.body.dataset.mode = 'landing';

// Launch geometry
const EARTH_SURFACE = 1;         // Earth visual radius (units)
const ROCKET_HALF_LENGTH = 0.9;  // rough half-height of the rocket stack

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
    phase: 'idle',          // 'countdown' | 'flight'
    finishing: false,
    countdownStart: 0,
    countdownDuration: 3200, // 3 .. 2 .. 1 .. liftoff
    flightStart: 0,
    duration: 4500,
    start: new THREE.Vector3(),
    control1: new THREE.Vector3(),
    control2: new THREE.Vector3(),
    end: new THREE.Vector3(),
    pad: new THREE.Vector3(),
    orbitRadius: 2,
};

const countdownEl = document.getElementById('launch-countdown');
let countdownHideTimer = null;

function showCountdown(text) {
    if (!countdownEl) return;
    if (countdownHideTimer) { clearTimeout(countdownHideTimer); countdownHideTimer = null; }
    countdownEl.textContent = text;
    countdownEl.classList.add('is-visible');
    countdownEl.classList.toggle('is-liftoff', text === 'LIFTOFF');
}

function hideCountdown(delay = 0) {
    if (!countdownEl) return;
    countdownHideTimer = setTimeout(() => {
        countdownEl.classList.remove('is-visible', 'is-liftoff');
    }, delay);
}

let crashTriggered = false;
const crashOverlay = document.getElementById('crash-overlay');
const crashMessageEl = document.getElementById('crash-message');
const crashTargetEl = document.getElementById('crash-target');
const restartBtn = document.getElementById('restart-btn');




function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Slow majestic liftoff, accelerate through the gravity turn, settle into orbit.
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// Cubic Bezier with two control points — gives the classic gravity-turn S-curve:
// near-vertical climb off the pad, pitch-over downrange, tangential orbit insertion.
function cubicBezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return new THREE.Vector3(
        a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        a * p0.y + b * p1.y + c * p2.y + d * p3.y,
        0,
    );
}

function cubicBezierTangent(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return new THREE.Vector3(
        3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
        3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
        0,
    );
}

function setMode(mode) {
    document.body.dataset.mode = mode;
}

// Cinematic launch camera: a low, broadcast-style ground cam beside the pad
// during countdown and the early climb (panning up to track the rocket), then
// eases back into the orbital chase cam as it pitches over.
// progress: 0 on the pad → 1 at orbit insertion.
function setLaunchCamera(rocketPos, progress, intensity = 0.1) {
    const pad = launchSequence.pad;

    const groundPos = new THREE.Vector3(pad.x + 5.0, pad.y + 0.8, 7.5);
    const groundTarget = new THREE.Vector3(pad.x * 0.6 + rocketPos.x * 0.4, rocketPos.y, 0);

    const chasePos = new THREE.Vector3(rocketPos.x - 5.5, rocketPos.y + 3.0, 14.0);
    const chaseTarget = new THREE.Vector3(rocketPos.x, rocketPos.y, 0);

    // Hold the ground cam through the early climb, then ease to the chase cam.
    const blend = clamp((progress - 0.4) / 0.5, 0, 1);
    const camPos = new THREE.Vector3().lerpVectors(groundPos, chasePos, blend);
    const camTarget = new THREE.Vector3().lerpVectors(groundTarget, chaseTarget, blend);

    camera.position.lerp(camPos, intensity);
    controls.target.lerp(camTarget, intensity);
    camera.lookAt(camTarget);
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
    setLandingMessage('Countdown', 'status-pill status-pill-ready');
    controls.enabled = false;

    launchSequence.active = true;
    launchSequence.phase = 'countdown';
    launchSequence.finishing = false;
    launchSequence.countdownStart = performance.now();
    launchSequence.duration = 4500;
    launchSequence.orbitRadius = launchConfig.orbitRadius;

    const earth = STEP.bodies.earth.pos;

    // Launch pad: sit the rocket ON Earth's north surface, pointing radially out.
    launchSequence.pad.set(earth.x, earth.y + EARTH_SURFACE + ROCKET_HALF_LENGTH, 0);
    launchSequence.start.copy(launchSequence.pad);

    launchSequence.end.set(earth.x + launchSequence.orbitRadius, earth.y, 0);

    // Gravity-turn arc. control1 sits straight above the pad so the rocket lifts
    // off vertically; control2 sits straight above the insertion point so the
    // final tangent is purely vertical (-y) — matching the circular orbit
    // velocity set in finishLaunchSequence for a seamless hand-off.
    const climb = Math.max(launchSequence.orbitRadius * 2.6, 4.5);
    launchSequence.control1.set(launchSequence.start.x, launchSequence.start.y + climb, 0);
    launchSequence.control2.set(launchSequence.end.x, launchSequence.end.y + climb * 0.9, 0);

    // Stand the rocket on the pad, nose pointing straight up (radially outward).
    POD.setStage('launch');
    POD.pod.position.copy(launchSequence.pad);
    POD.pod.rotation.z = Math.PI / 2;

    launchFlame.visible = false;
    launchFlame.material.opacity = 0;
    initLaunchEffects(scene);
    showCountdown('3');
    PATH.predict_trajectory_init();
}

function finishLaunchSequence() {
    STEP.setInitialOrbit(launchSequence.orbitRadius);
    POD.pod.position.set(STEP.r.x, STEP.r.y, 0);
    POD.pod.rotation.z = Math.atan2(STEP.v.y, STEP.v.x); // nose along velocity (prograde)
    launchFlame.visible = false;
    launchFlame.material.opacity = 0;
    disposeLaunchEffects();
    launchSequence.active = false;
    launchSequence.phase = 'idle';
    launchSequence.finishing = false;
    controls.enabled = true;
    setMode('flight');
    setLandingMessage('Flight systems nominal', 'status-pill status-pill-ready');
    UI.resetMissionTimer();
    PATH.predict_trajectory_init();

    // Transition to orbit stage (hides boosters, shows capsule)
    POD.setStage('orbit');
    POD.playSeparation(scene, cubicBezierTangent(
        launchSequence.start, launchSequence.control1, launchSequence.control2, launchSequence.end, 1
    ).normalize());
}

if (launchButton) {
    launchButton.addEventListener('click', startLaunchSequence);
}

// Reset staging when restarting to landing mode.
// Full restart logic is implemented; this function provides
// the staging reset hook for it.
export function resetToLanding() {
    POD.setStage('launch');
}

// Restart logic — reset everything to pre-flight state
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

// Wire ALL range sliders: update readout, sync to sim, and mirror any other
// sliders bound to the same parameter. The same parameter can appear on the
// landing screen, the control panel, and the params panel (matched by
// data-param, falling back to id) — keeping them in lockstep avoids stale
// duplicates.
const allRangeSliders = Array.from(document.querySelectorAll('input[type="range"]'));

function sliderReadout(slider) {
    return slider.parentElement.querySelector('.slider-readout');
}

function sliderParam(slider) {
    return slider.dataset.param || slider.id;
}

function setSliderDisplay(slider, value) {
    slider.value = value;
    const readout = sliderReadout(slider);
    if (readout) readout.textContent = value;
}

function onSliderInput(slider) {
    const param = sliderParam(slider);
    const value = slider.value;
    const readout = sliderReadout(slider);
    if (readout) readout.textContent = value;
    // Sync parameter to sim in real time (works during flight too)
    syncLiveParameter(param, value);
    // Mirror to every other slider bound to the same parameter
    for (const other of allRangeSliders) {
        if (other !== slider && sliderParam(other) === param) {
            setSliderDisplay(other, value);
        }
    }
}

allRangeSliders.forEach((slider) => {
    slider.addEventListener('input', () => onSliderInput(slider));
});

/**
 * Update a single sim parameter from a slider change. Keyed by the canonical
 * parameter name (data-param / id). Works during flight too.
 */
function syncLiveParameter(param, rawValue) {
    const val = Number.parseFloat(rawValue);
    if (!Number.isFinite(val)) return;

    switch (param) {
        case 'mission-g':
            STEP.params.G = val;
            break;
        case 'mission-dt':
            STEP.params.dt = val;
            break;
        case 'mission-moon-mass':
            STEP.params.moonMass = val;
            STEP.bodies.moon.m = val;
            break;
        case 'mission-isp':
            STEP.rocketParams.Isp = val;
            break;
        case 'mission-thrust':
            STEP.rocketParams.thrust = val;
            break;
        case 'mission-dry-mass':
            STEP.rocketParams.dryMass = val;
            break;
        case 'mission-fuel-mass':
            STEP.rocketParams.fuelMass = val;
            UI.setMaxFuel(val);
            break;
        case 'mission-path-steps':
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
launchFlame.rotation.z = -Math.PI / 2; // plume trails out the engine (-x, opposite the nose)
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

// Autopilot UI wiring
const autopilotBtn = document.getElementById('autopilot-btn');
const autopilotCancelBtn = document.getElementById('autopilot-cancel');
const autopilotOrbitSelect = document.getElementById('autopilot-orbit-type');
const moonAltitudeSelect = document.getElementById('moon-altitude');
const autopilotStatusRow = document.getElementById('autopilot-status-row');
const autopilotPhaseEl = document.getElementById('autopilot-phase');
const altholdBtn = document.getElementById('althold-btn');

if (autopilotBtn) {
    autopilotBtn.addEventListener('click', () => {
        const mode = autopilotOrbitSelect ? autopilotOrbitSelect.value : 'circularize';
        const lunarR = moonAltitudeSelect ? Number.parseFloat(moonAltitudeSelect.value) : 1.2;
        const result = Autopilot.engage(mode, { x: STEP.r.x, y: STEP.r.y }, { x: STEP.v.x, y: STEP.v.y }, { lunarR });
        if (!result.success) {
            // Flash the button to indicate failure (UI re-syncs in updateAutopilotUI).
            autopilotBtn.style.borderColor = 'rgba(255, 82, 82, 0.6)';
            autopilotBtn.textContent = result.reason || 'FAILED';
            setTimeout(() => {
                autopilotBtn.style.borderColor = '';
                autopilotBtn.textContent = 'AUTOPILOT';
            }, 2500);
        } else if (mode === 'moon') {
            HOHMANN.show();
            setHohmannLabel(true);
        }
    });
}

if (autopilotCancelBtn) {
    autopilotCancelBtn.addEventListener('click', () => Autopilot.cancel());
}

// Alt-hold: continuously hold the current circular altitude (toggle).
function toggleAltHold() {
    if (Autopilot.isHolding()) Autopilot.cancel();
    else Autopilot.engageHold();
}

if (altholdBtn) altholdBtn.addEventListener('click', toggleAltHold);

document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && Autopilot.isActive()) Autopilot.cancel();
    else if (e.key === 't' || e.key === 'T') toggleAltHold();
});

// Hohmann transfer visualization wiring
HOHMANN.initHohmann(scene);
const hohmannBtn = document.getElementById('hohmann-btn');

function setHohmannLabel(shown) {
    if (!hohmannBtn) return;
    const label = hohmannBtn.querySelector('.cb-label');
    if (label) label.textContent = shown ? 'Hide Hohmann' : 'Show Hohmann';
}

function toggleHohmann() {
    setHohmannLabel(HOHMANN.toggle());
}

if (hohmannBtn) hohmannBtn.addEventListener('click', toggleHohmann);

document.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
        if (!e.repeat) toggleHohmann();
    }
});

// Camera focus + time warp
let cameraFocus = 'ship';   // 'ship' | 'earth' | 'moon'
let timeWarp = 1;
const WARP_STEPS = [1, 2, 5, 10, 50];

const focusButtons = {
    ship: document.getElementById('focus-ship'),
    earth: document.getElementById('focus-earth'),
    moon: document.getElementById('focus-moon'),
};

function setFocus(target) {
    if (!focusButtons[target]) return;
    cameraFocus = target;
    for (const [name, btn] of Object.entries(focusButtons)) {
        if (btn) btn.classList.toggle('is-active', name === target);
    }
}

for (const [name, btn] of Object.entries(focusButtons)) {
    if (btn) btn.addEventListener('click', () => setFocus(name));
}

const warpButtons = Array.from(document.querySelectorAll('.warp-btn'));

function setWarp(value) {
    timeWarp = value;
    for (const btn of warpButtons) {
        btn.classList.toggle('is-active', Number(btn.dataset.warp) === value);
    }
}

for (const btn of warpButtons) {
    btn.addEventListener('click', () => setWarp(Number(btn.dataset.warp)));
}

function stepWarp(dir) {
    const i = WARP_STEPS.indexOf(timeWarp);
    const next = clamp(i + dir, 0, WARP_STEPS.length - 1);
    setWarp(WARP_STEPS[next]);
}

// Keys: 1/2/3 focus Earth/Moon/Ship, ',' / '.' step time warp down/up.
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.key) {
        case '1': setFocus('earth'); break;
        case '2': setFocus('moon'); break;
        case '3': setFocus('ship'); break;
        case ',': case '<': stepWarp(-1); break;
        case '.': case '>': stepWarp(1); break;
    }
});

// Click a body (Earth / Moon / ship) to lock the camera onto it.
const focusRaycaster = new THREE.Raycaster();
const focusPointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
    if (document.body.dataset.mode !== 'flight') return;
    const rect = renderer.domElement.getBoundingClientRect();
    focusPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    focusPointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    focusRaycaster.setFromCamera(focusPointer, camera);
    const targets = [
        [PLANETS.moon, 'moon'],
        [POD.pod, 'ship'],
        [PLANETS.earth, 'earth'],
    ];
    for (const [obj, name] of targets) {
        if (focusRaycaster.intersectObject(obj, true).length > 0) {
            setFocus(name);
            break;
        }
    }
});

function getFocusPoint(shipX, shipY, moonX, moonY) {
    if (cameraFocus === 'earth') return { x: STEP.bodies.earth.pos.x, y: STEP.bodies.earth.pos.y };
    if (cameraFocus === 'moon') return { x: moonX, y: moonY };
    return { x: shipX, y: shipY };
}

function fmtEta(seconds) {
    const t = Math.max(0, Math.round(seconds));
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function updateAutopilotUI() {
    const active = Autopilot.isActive();

    // Sync control visibility/state straight from the autopilot.
    if (autopilotBtn) autopilotBtn.hidden = active;
    if (autopilotOrbitSelect) autopilotOrbitSelect.hidden = active;
    if (moonAltitudeSelect) moonAltitudeSelect.hidden = active;
    if (autopilotCancelBtn) autopilotCancelBtn.hidden = !active;
    if (altholdBtn) altholdBtn.classList.toggle('is-active', Autopilot.isHolding());

    const telemetry = Autopilot.getTelemetry();
    if (active || telemetry.phaseText !== '-') {
        if (autopilotStatusRow) autopilotStatusRow.hidden = false;
        if (autopilotPhaseEl) {
            const burnType = Autopilot.getBurnType();
            const dvText = telemetry.remainingDv > 0 ? ` dV:${telemetry.remainingDv.toFixed(2)}` : '';
            const etaText = telemetry.etaSeconds > 0 ? ` ETA ${fmtEta(telemetry.etaSeconds)}` : '';
            const burnText = burnType ? ` ${burnType.toUpperCase()}` : '';
            autopilotPhaseEl.textContent = telemetry.phaseText + dvText + etaText + burnText;
        }
    } else if (autopilotStatusRow) {
        autopilotStatusRow.hidden = true;
    }

    // Reflect autopilot burns in the burn indicator.
    if (active) UI.updateBurnIndicator();
}

//animation loop
function animate(now = performance.now()) {
    if (launchSequence.active) {
        const { start, control1, control2, end } = launchSequence;

        if (launchSequence.phase === 'countdown') {
            // Hold on the pad, run the clock, spool the engines up at the end.
            const remaining = launchSequence.countdownDuration - (now - launchSequence.countdownStart);
            const secs = Math.ceil(remaining / 1000);
            showCountdown(secs > 0 ? String(secs) : 'LIFTOFF');

            // Engine ignition over the final 0.8s: flame + smoke build before release.
            const ignite = clamp(1 - remaining / 800, 0, 1);
            launchFlame.visible = ignite > 0;
            launchFlame.material.opacity = ignite * (0.5 + 0.4 * Math.sin(now * 0.04));
            launchFlame.scale.setScalar(0.4 + ignite * 0.5);
            if (ignite > 0) {
                updateLaunchEffects(Math.min(0.05, STEP.params.dt), start.clone(), new THREE.Vector3(0, 1, 0));
            }

            // Low ground cam with rumble growing as the engines light.
            setLaunchCamera(start, 0, 0.12);
            const rumble = 0.06 * ignite;
            camera.position.x += (Math.random() - 0.5) * rumble;
            camera.position.y += (Math.random() - 0.5) * rumble;

            if (remaining <= 0) {
                launchSequence.phase = 'flight';
                launchSequence.flightStart = now;
                hideCountdown(700);
            }
        } else {
            const t = clamp((now - launchSequence.flightStart) / launchSequence.duration, 0, 1);
            const eased = easeInOutCubic(t);
            const pos = cubicBezier(start, control1, control2, end, eased);
            const tangent = cubicBezierTangent(start, control1, control2, end, eased).normalize();

            POD.pod.position.copy(pos);
            POD.pod.rotation.z = Math.atan2(tangent.y, tangent.x); // nose along the flight path

            // Flame ramps to full over the first 8% of the climb, then flickers.
            const throttle = clamp(0.4 + t / 0.08, 0.4, 1);
            launchFlame.visible = true;
            launchFlame.material.opacity = throttle * (0.6 + 0.35 * Math.sin(now * 0.02));
            launchFlame.scale.setScalar(throttle * (0.9 + 0.22 * Math.sin(now * 0.03)));

            const rocketVel = cubicBezierTangent(start, control1, control2, end, eased);
            updateLaunchEffects(Math.min(0.05, STEP.params.dt), pos, rocketVel);

            setLaunchCamera(pos, t, 0.09);

            // Liftoff shake, decaying over the first 60% of the climb.
            if (t < 0.6) {
                const shakeIntensity = 0.15 * Math.exp(-t * 5);
                camera.position.x += (Math.random() - 0.5) * shakeIntensity;
                camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            }

            if (t >= 1 && !launchSequence.finishing) {
                launchSequence.finishing = true;
                finishLaunchSequence();
            }
        }

        PLANETS.earth.rotation.y += 0.0015;
        updateMoonPosition();
        STEP.moonState.omega -= 0.0001;
    } else {
        controls.enabled = true;

        // Time warp: run multiple physics sub-steps per frame (keeps dt small so
        // accuracy holds). Warp is suppressed while thrusting and during the
        // autopilot phases that need per-step fidelity (window timing, burns,
        // periapsis detection) — but allowed during COAST and HOLD so warp keeps
        // working after a transfer / while alt-holding. Any frame that actually
        // fires a burn (incl. an alt-hold correction) drops to 1x via `thrusting`.
        const thrusting = STEP.controls.prograding || STEP.controls.retrograding
            || STEP.controls.normalPos || STEP.controls.normalNeg;
        const apPhase = Autopilot.getPhase();
        const apPrecise = Autopilot.isActive() && (
            apPhase === 'PHASING' || apPhase === 'TLI_BURN'
            || apPhase === 'APPROACH' || apPhase === 'CIRCULARIZE');
        const subSteps = (thrusting || apPrecise) ? 1 : Math.max(1, Math.round(timeWarp));
        let stepResult = STEP.step();
        for (let i = 1; i < subSteps && !stepResult.crashed; i++) {
            stepResult = STEP.step();
        }
        const { x, y, theta, vx, vy, ax, ay, moonx, moony, dt, fuelMass, crashed } = stepResult;
        POD.pod.position.x = x;
        POD.pod.position.y = y;
        POD.pod.rotation.z = theta; // nose along velocity (prograde)
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

        // Autopilot update
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
            UI.updateCircularization();
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

        // Keep the Hohmann transfer ellipse anchored to the current orbit.
        if (HOHMANN.isVisible()) {
            HOHMANN.updateHohmann({ x, y }, STEP.bodies.earth.pos);
        }

        const fp = getFocusPoint(x, y, moonx, moony);
        camera.position.lerp(new THREE.Vector3(fp.x - 6, fp.y + 3, 15), 0.06);
        controls.target.lerp(new THREE.Vector3(fp.x, fp.y, 0), 0.08);
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


