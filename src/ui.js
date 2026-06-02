// HUD elements
const velEl = document.getElementById('velocity');
const accnEl = document.getElementById('acceleration');
const timeEl = document.getElementById('timestep');
const fuelEl = document.getElementById('fuel');
const timerEl = document.getElementById('mission-timer');
const statusEl = document.getElementById('mission-status');
const fuelFill = document.getElementById('fuel-bar-fill');
const burnIndicator = document.getElementById('burn-indicator');

let missionStartTime = Date.now();
let maxFuel = 8; // updated from intro params

export function setMaxFuel(v) { maxFuel = v; }
export function resetMissionTimer() { missionStartTime = Date.now(); }

export function updateTelemetry({ vx, vy, ax, ay, dt, fuelMass, crashed }) {
    const speed = Math.sqrt(vx ** 2 + vy ** 2);
    const accel = Math.sqrt(ax ** 2 + ay ** 2);

    if (velEl) velEl.innerText = speed.toFixed(4) + ' u/s';
    if (accnEl) accnEl.innerText = accel.toFixed(4) + ' u/s²';
    if (timeEl) timeEl.innerText = `${dt} s/frame  ×  ${Math.round(1 / dt)} frames/s-sim`;

    // Fuel
    if (fuelEl) fuelEl.innerText = fuelMass !== undefined ? fuelMass.toFixed(2) + ' kg' : '-';
    if (fuelFill && maxFuel > 0) {
        const pct = Math.max(0, (fuelMass / maxFuel) * 100);
        fuelFill.style.width = pct + '%';
        fuelFill.style.background = pct > 25 ? '#00ff88' : pct > 10 ? '#ffaa00' : '#ff3333';
    }

    // Mission elapsed time
    const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    if (timerEl) timerEl.innerText = `T+ ${h}:${m}:${s}`;

    // Status
    if (statusEl) {
        if (crashed) {
            statusEl.innerText = window._crashMsg || 'CRASHED';
            statusEl.className = 'status-crashed';
        } else if (fuelMass !== undefined && fuelMass <= 0) {
            statusEl.innerText = 'NO FUEL';
            statusEl.className = 'status-warn';
        } else {
            statusEl.innerText = '● NOMINAL';
            statusEl.className = 'status-ok';
        }
    }
}

// Imports
import { controls, undo, r, v, bodies, params, rocketParams } from './maneuver.js';
import { trajectory_Geometry } from './pod.js';
import { CircularizationController, computeEccentricity, getNearestBody } from './circularize.js';

// Prograde / Retrograde buttons
const probtn = document.getElementById('prograde');
const retrobtn = document.getElementById('retrograde');
const normalPosbtn = document.getElementById('normal-pos');
const normalNegbtn = document.getElementById('normal-neg');

function setPrograde(val) { controls.prograding = val; updateBurnIndicator(); }
function setRetrograde(val) { controls.retrograding = val; updateBurnIndicator(); }
function setNormalPos(val) { controls.normalPos = val; updateBurnIndicator(); }
function setNormalNeg(val) { controls.normalNeg = val; updateBurnIndicator(); }

function updateBurnIndicator() {
    if (!burnIndicator) return;
    if (controls.prograding) { burnIndicator.innerText = 'PROGRADE BURN'; burnIndicator.style.opacity = '1'; }
    else if (controls.retrograding) { burnIndicator.innerText = 'RETROGRADE BURN'; burnIndicator.style.opacity = '1'; }
    else if (controls.normalPos) { burnIndicator.innerText = 'RCS NORMAL+'; burnIndicator.style.opacity = '1'; }
    else if (controls.normalNeg) { burnIndicator.innerText = 'RCS NORMAL-'; burnIndicator.style.opacity = '1'; }
    else { burnIndicator.style.opacity = '0'; }
}

// Export for autopilot to use
export { updateBurnIndicator };

probtn.addEventListener('pointerdown', () => setPrograde(true));
probtn.addEventListener('pointerup', () => setPrograde(false));
probtn.addEventListener('pointerleave', () => setPrograde(false));

retrobtn.addEventListener('pointerdown', () => setRetrograde(true));
retrobtn.addEventListener('pointerup', () => setRetrograde(false));
retrobtn.addEventListener('pointerleave', () => setRetrograde(false));

if (normalPosbtn) {
    normalPosbtn.addEventListener('pointerdown', () => setNormalPos(true));
    normalPosbtn.addEventListener('pointerup', () => setNormalPos(false));
    normalPosbtn.addEventListener('pointerleave', () => setNormalPos(false));
}
if (normalNegbtn) {
    normalNegbtn.addEventListener('pointerdown', () => setNormalNeg(true));
    normalNegbtn.addEventListener('pointerup', () => setNormalNeg(false));
    normalNegbtn.addEventListener('pointerleave', () => setNormalNeg(false));
}

// Keyboard controls
// W / ↑  = prograde burn (hold)
// S / ↓  = retrograde burn (hold)
// A / ←  = normal+ / RCS left (hold)
// D / →  = normal- / RCS right (hold)
// C      = circularize (toggle)
// P      = predict trajectory (toggle)
// Ctrl/⌘+Z = undo

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
    if (e.repeat) return;
    switch (e.key) {
        case 'w': case 'W': case 'ArrowUp': setPrograde(true); break;
        case 's': case 'S': case 'ArrowDown': setRetrograde(true); break;
        case 'a': case 'A': case 'ArrowLeft': setNormalPos(true); break;
        case 'd': case 'D': case 'ArrowRight': setNormalNeg(true); break;
        case 'c': case 'C': toggleCircularize(); break;
        case 'p': case 'P': togglePrediction(); break;
    }
});

document.addEventListener('keyup', e => {
    switch (e.key) {
        case 'w': case 'W': case 'ArrowUp': setPrograde(false); break;
        case 's': case 'S': case 'ArrowDown': setRetrograde(false); break;
        case 'a': case 'A': case 'ArrowLeft': setNormalPos(false); break;
        case 'd': case 'D': case 'ArrowRight': setNormalNeg(false); break;
    }
});

// Undo button
const undoBtn = document.getElementById('undo-btn');
if (undoBtn) undoBtn.addEventListener('click', () => undo());

// Set a control button's label without clobbering its <kbd> shortcut badge.
function setBtnLabel(btn, text) {
    if (!btn) return;
    const label = btn.querySelector('.cb-label');
    if (label) label.textContent = text;
    else btn.textContent = text;
}

// Trajectory prediction toggle
export let autoPredict = false;
const tra_btn = document.getElementById('predict');

function togglePrediction() {
    autoPredict = !autoPredict;
    setBtnLabel(tra_btn, autoPredict ? 'Stop Prediction' : 'Predict Trajectory');
    if (!autoPredict) {
        const attr = trajectory_Geometry.attributes.position;
        trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
    }
}

if (tra_btn) tra_btn.addEventListener('click', togglePrediction);

// Circularization
const circController = new CircularizationController();
const circBtn = document.getElementById('circularize-btn');
let eccentricityTimeout = null;

export function getCircController() { return circController; }

function toggleCircularize() {
    if (!circBtn) return;
    if (circController.active) {
        // Cancel if already running
        circController.cancel(controls);
        setBtnLabel(circBtn, 'CIRCULARIZE');
        updateBurnIndicator();
        return;
    }
    // Start circularization burn
    circController.start(r, v, bodies, params);
    if (circController.active) {
        setBtnLabel(circBtn, 'CANCEL CIRC');
        updateBurnIndicator();
    }
}

if (circBtn) circBtn.addEventListener('click', toggleCircularize);

/**
 * Called each frame from the animation loop to update circularization state.
 * Returns the status object for UI notifications.
 */
export function updateCircularization() {
    if (!circController.active) return null;

    const status = circController.update(r, v, bodies, params, rocketParams, controls);
    updateBurnIndicator();

    if (status.completed) {
        setBtnLabel(circBtn, 'CIRCULARIZE');
        // Show eccentricity for 3 seconds after completion
        const dominant = getNearestBody(r, bodies);
        if (dominant) {
            const ecc = computeEccentricity(r, v, dominant.pos, dominant.m, params.G);
            showEccentricity(ecc);
        }
    } else if (status.fuelExhausted) {
        // Notify user of insufficient fuel
        setBtnLabel(circBtn, 'CIRCULARIZE');
        showFuelExhaustedNotification(status.remainingDv);
    }

    return status;
}

function showEccentricity(ecc) {
    if (!burnIndicator) return;
    burnIndicator.innerText = `CIRC COMPLETE • e = ${ecc.toFixed(4)}`;
    burnIndicator.style.opacity = '1';
    burnIndicator.style.color = '#00e676';
    if (eccentricityTimeout) clearTimeout(eccentricityTimeout);
    eccentricityTimeout = setTimeout(() => {
        burnIndicator.style.opacity = '0';
        burnIndicator.style.color = '';
    }, 3000);
}

function showFuelExhaustedNotification(remainingDv) {
    if (!burnIndicator) return;
    burnIndicator.innerText = `FUEL OUT - dV deficit: ${remainingDv.toFixed(2)} u/s`;
    burnIndicator.style.opacity = '1';
    burnIndicator.style.color = '#ff5252';
    if (eccentricityTimeout) clearTimeout(eccentricityTimeout);
    eccentricityTimeout = setTimeout(() => {
        burnIndicator.style.opacity = '0';
        burnIndicator.style.color = '';
    }, 4000);
}