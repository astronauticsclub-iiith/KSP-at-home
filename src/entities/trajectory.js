import * as MAN from '../physics/maneuver.js';
import * as POD from './pod.js';
import * as PARAMS from '../physics/control_params.js';
import * as UPDATE from '../physics/body_update.js';
export const pathLen = 2000; // predict trajectory 2000 steps ahead
export const stateThreshold = 1e-5; // threshold for state comparison

export let sim_pos = [];

/**
 * Predicts future spacecraft positions and stores them in sim_pos.
 *
 * @returns {void}
 */
export function predict_trajectory_init() {
    sim_pos = [];

    let pseudo_r = { x: PARAMS.r.x, y: PARAMS.r.y, z: PARAMS.r.z };
    let pseudo_v = { x: PARAMS.v.x, y: PARAMS.v.y, z: PARAMS.v.z };

    // Build pseudo_bodies dynamically from whatever bodies are active this level.
    // Bodies with m=0 are already ignored by acc(), so no special filtering needed.
    let pseudo_bodies = {};
    for (const [name, body] of Object.entries(PARAMS.bodies)) {
        pseudo_bodies[name] = {
            m: body.m,
            theta: body.theta,
            pos: { x: body.pos.x, y: body.pos.y, z: body.pos.z },
        };
    }
    let omega = MAN.omega;
    let R = PARAMS.R;
    let dt = PARAMS.params.dt;

    // Store previous states to detect cycles
    const previousStates = [];

    for (let i = 0; i < pathLen; i++) {
        // store all current stats
        const currentState = {
            rx: pseudo_r.x,
            ry: pseudo_r.y,
            rz: pseudo_r.z,
            vx: pseudo_v.x,
            vy: pseudo_v.y,
            vz: pseudo_v.z,
            moonx: pseudo_bodies.moon?.pos.x,
            moony: pseudo_bodies.moon?.pos.y,
        };

        //Store current state
        previousStates.push(currentState);

        const { ax: ax_old, ay: ay_old } = MAN.acc(pseudo_r, pseudo_bodies);

        pseudo_r.x += pseudo_v.x * dt + 0.5 * ax_old * dt ** 2;
        pseudo_r.y += pseudo_v.y * dt + 0.5 * ay_old * dt ** 2;

        const { ax: ax_new, ay: ay_new } = MAN.acc(pseudo_r, pseudo_bodies);

        pseudo_v.x += 0.5 * (ax_old + ax_new) * dt;
        pseudo_v.y += 0.5 * (ay_old + ay_new) * dt;

        UPDATE.moon_update(pseudo_bodies);
        UPDATE.earth_update(pseudo_bodies);

        sim_pos.push({
            x: pseudo_r.x,
            y: pseudo_r.y,
        });
    }
}

//Updating the GUI
/**
 * Updates the trajectory render buffer using
 * the current predicted trajectory positions.
 *
 * @returns {void}
 */
export function trajectory_UI_update() {
    predict_trajectory_init();

    const attr = POD.trajectory_Geometry.attributes.position;

    if (!sim_pos || sim_pos.length === 0) {
        POD.trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
        return;
    }

    const count = Math.min(sim_pos.length, pathLen);

    for (let i = 0; i < count; i++) {
        attr.array[i * 3] = sim_pos[i].x;
        attr.array[i * 3 + 1] = sim_pos[i].y;
        attr.array[i * 3 + 2] = 0;
    }

    POD.trajectory_Geometry.setDrawRange(0, count);

    attr.needsUpdate = true;
}
