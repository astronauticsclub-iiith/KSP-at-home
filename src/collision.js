import * as PARAMS from './control_params.js'
import * as MAN from './maneuver.js'
export let crashState = { crashed: false, message: '' };


export function collision_status() {
    for (const body of Object.values(PARAMS.bodies)) {
        if (body.m == 0) {
            continue;
        }
        const object_Dist = MAN.distance(PARAMS.r.x, PARAMS.r.y, body.pos.x, body.pos.y);
        if (object_Dist < body.r) {
            crashState.crashed = true;
            crashState.message = `CRASHED INTO ${body.name}`;
            PARAMS.v.x = 0; PARAMS.v.y = 0;
        }
    }
}

export function update_UI() {
    const crashOverlay = document.getElementById('crash-overlay');
    const crashMessageEl = document.getElementById('crash-message');
    const crashTargetEl = document.getElementById('crash-target');
    const restartBtn = document.getElementById('restart-btn');
    if (crashOverlay) crashOverlay.hidden = false;
    if (crashMessageEl) crashMessageEl.textContent = 'MISSION FAILED';
    if (crashTargetEl) crashTargetEl.textContent = crashState.message;
}