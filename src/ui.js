// This file is responsible for updating the HUD and UI

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
import {controls } from "./maneuver";

// Prograde and Retrograde buttons

const probtn = document.getElementById('prograde');
probtn.addEventListener('pointerdown', (event) => {
    controls.prograding = true;
})

probtn.addEventListener('pointerup', (event) => {
    controls.prograding = false;
})


const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('pointerdown', (event) => {
    controls.retrograding = true;
})

retrobtn.addEventListener('pointerup', (event) => {
    controls.retrograding = false;
})

// Trajectory btn
import {trajectory_Geometry} from './pod.js'

export let autoPredict = false;
const tra_btn = document.getElementById('predict');

tra_btn.addEventListener('click', () => {

    autoPredict = !autoPredict;

    if (autoPredict) {
        tra_btn.innerText = 'Stop Prediction';
    }
    else {
        tra_btn.innerText = 'Predict Trajectory';
        const attr = trajectory_Geometry.attributes.position;
        trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate=true;

    }
});