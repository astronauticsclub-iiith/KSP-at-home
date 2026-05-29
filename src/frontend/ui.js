import { controls } from '../physics/maneuver.js';
import { trajectory_Geometry } from '../entities/pod.js';
import * as POD from '../entities/pod.js';
import * as PLANETS from '../entities/planets.js';

// This file is responsible for updating the HUD and UI and Entites

//--------Object Positions---------
export function update_position(x, y, theta, moonx, moony) {
    POD.pod.position.x = x;
    POD.pod.position.y = y;
    POD.pod.rotation.z = -Math.PI / 2 + theta;

    PLANETS.earth.rotation.y += 0.002;

    PLANETS.moon.position.x = moonx;
    PLANETS.moon.position.y = moony;
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
    controls.prograding = true;
});

probtn.addEventListener('pointerup', () => {
    controls.prograding = false;
});

const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('pointerdown', () => {
    controls.retrograding = true;
});

retrobtn.addEventListener('pointerup', () => {
    controls.retrograding = false;
});

// Trajectory btn

export let autoPredict = false;
const tra_btn = document.getElementById('predict');

tra_btn.addEventListener('click', () => {
    autoPredict = !autoPredict;

    if (autoPredict) {
        tra_btn.innerText = 'Stop Prediction';
    } else {
        tra_btn.innerText = 'Predict Trajectory';
        const attr = trajectory_Geometry.attributes.position;
        trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
    }
});
