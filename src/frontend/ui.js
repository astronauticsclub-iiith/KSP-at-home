import { controls } from '../physics/maneuver.js';
import { trajectory_Geometry } from '../entities/pod.js';
import * as POD from '../entities/pod.js';
import * as PLANETS from '../entities/planets.js';
import { addBuyIn } from './score.js';
import { crashState } from '../physics/collision.js';

// This file is responsible for updating the HUD and UI and Entites

//--------Object Positions---------
export function update_position(x, y, theta, moonx, moony, earthx, earthy) {
    POD.pod.position.x = x;
    POD.pod.position.y = y;
    POD.pod.rotation.z = -Math.PI / 2 + theta;

    PLANETS.earth.rotation.y += 0.002;

    PLANETS.moon.position.x = moonx;
    PLANETS.moon.position.y = moony;
    PLANETS.earth.position.x = earthx;
    PLANETS.earth.position.y = earthy;
}

//-----HUD----------
const vel = document.getElementById('velocity');
const accn = document.getElementById('acceleration');
const time = document.getElementById('timestep');

export function updateTelemetry({ vx, vy, ax, ay, dt }) {
    vel.innerText = Math.sqrt(vx ** 2 + vy ** 2).toFixed(2);
    accn.innerText = Math.sqrt(ax ** 2 + ay ** 2).toFixed(2);
    time.innerText = dt;
}

//--------Buttons----------

// Prograde and Retrograde buttons

const probtn = document.getElementById('prograde');
probtn.addEventListener('pointerdown', () => {
    addBuyIn(); // one-time activation cost per press
    controls.prograding = true;
});

probtn.addEventListener('pointerup', () => {
    controls.prograding = false;
});
probtn.addEventListener('pointerleave', () => {
    controls.prograding = false;
});
probtn.addEventListener('pointercancel', () => {
    controls.prograding = false;
});

const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('pointerdown', () => {
    addBuyIn(); // one-time activation cost per press
    controls.retrograding = true;
});

retrobtn.addEventListener('pointerup', () => {
    controls.retrograding = false;
});
retrobtn.addEventListener('pointerleave', () => {
    controls.retrograding = false;
});
retrobtn.addEventListener('pointercancel', () => {
    controls.retrograding = false;
});

// Trajectory btn

export let autoPredict = false;
const tra_btn = document.getElementById('predict');

export function togglePredict() {
    autoPredict = !autoPredict;

    if (autoPredict) {
        if (tra_btn) tra_btn.innerText = 'Stop Prediction (T)';
    } else {
        if (tra_btn) tra_btn.innerText = 'Predict Trajectory (T)';
        const attr = trajectory_Geometry.attributes.position;
        trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
    }
}

if (tra_btn) {
    tra_btn.addEventListener('click', togglePredict);
}

// Timer

const timer = document.getElementById('timer');

export let start_time = Date.now() / 1000;

export function reset_timer() {
    start_time = Date.now() / 1000;
}

function update_timer() {
    const t = Date.now() / 1000 - start_time;
    timer.innerText = `Timer: ${t.toPrecision(3)}`;
}
setInterval(update_timer, 250);

//---------- Keybindings ----------
window.addEventListener('keydown', function (event) {
    const key = event.key.toLowerCase();

    if (key === 'backspace') {
        event.preventDefault();
        window.location.href = 'index.html';
        return;
    }

    if (key === 'r') {
        if (crashState.crashed) {
            location.reload();
            return;
        }
        if (!event.repeat && !controls.retrograding) {
            addBuyIn();
            controls.retrograding = true;
        }
    } else if (key === 'p') {
        if (!event.repeat && !controls.prograding) {
            addBuyIn();
            controls.prograding = true;
        }
    } else if (key === 't') {
        if (!event.repeat) {
            togglePredict();
        }
    }
});

window.addEventListener('keyup', function (event) {
    const key = event.key.toLowerCase();

    if (key === 'r') {
        controls.retrograding = false;
    } else if (key === 'p') {
        controls.prograding = false;
    }
});

window.addEventListener('blur', function () {
    controls.prograding = false;
    controls.retrograding = false;
});

const restart = document.getElementById('restart-btn');
restart.addEventListener('click', function (e) {
    location.reload();
});

// Which level is this ?
const params = new URLSearchParams(window.location.search);
export let level = params.get('level');

//--------Mission Briefing----------

/**
 * Populates the mission briefing popup from level.json data.
 * Called by main.js after the level config is fetched.
 *
 * @param {string[]} lines - Array of paragraph strings
 * @param {string} destination - Destination body name (shown in the header)
 */
export function setBriefing(lines, destination) {
    const container = document.getElementById('briefing-body');
    if (!container) return;

    container.innerHTML = '';
    for (const line of lines) {
        const p = document.createElement('p');
        p.className = 'mb-3';
        p.textContent = line;
        container.appendChild(p);
    }

    const dest = document.getElementById('briefing-destination');
    if (dest) dest.textContent = destination?.toUpperCase() ?? '';
}

//--------Win Screen----------

/** Returns true if any thruster is currently active (used by win_condition and main.js) */
export function isBurning() {
    return controls.prograding || controls.retrograding;
}

/**
 * Renders the win overlay, POSTs the score to MongoDB, and shows the result.
 * Async — fires after the animation loop has already stopped.
 *
 * @param {{ username, level, timeSeconds, fuelUsed, predictedScore }} payload
 */
export async function showWinScreen(payload) {
    const overlay = document.getElementById('win-overlay');
    const stats   = document.getElementById('win-stats');
    if (!overlay || !stats) return;

    // Show panel immediately with a loading state
    stats.innerHTML = `<div style="text-align:center;padding:1rem;opacity:0.55;letter-spacing:0.1em">
        TRANSMITTING...
    </div>`;
    overlay.hidden = false;

    let displayScore = payload.predictedScore;
    let verified     = false;
    let submitted    = false;

    try {
        const res = await fetch('/api/scores', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        if (res.ok) {
            const data   = await res.json();
            displayScore = data.actualScore;
            verified     = data.verified;
            submitted    = true;
        }
    } catch (err) {
        console.warn('[score submit] server unreachable:', err.message);
    }

    const statusLine = submitted
        ? verified
            ? ''
            : ''
        : '○ Server unreachable — score not recorded';

    stats.innerHTML = `
        <div class="win-stat-row">
            <span>PILOT</span>
            <span class="win-stat-value">${payload.username}</span>
        </div>
        <div class="win-stat-row">
            <span>TIME</span>
            <span class="win-stat-value">${payload.timeSeconds}s</span>
        </div>
        <div class="win-stat-row">
            <span>FUEL</span>
            <span class="win-stat-value">${payload.fuelUsed}</span>
        </div>
        <div class="win-stat-row">
            <span>SCORE</span>
            <span class="win-stat-value">${displayScore.toLocaleString()}</span>
        </div>
        <div style="font-size:0.7rem;margin-top:0.75rem;opacity:0.5">${statusLine}</div>
    `;
}