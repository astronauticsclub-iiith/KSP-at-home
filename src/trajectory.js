import * as MAN from './maneuver.js'
import * as POD from './pod.js'

export const pathLen = 2000; // predict trajectory 2000 steps ahead

export let sim_pos = [];

/**
 * Predicts future spacecraft positions and stores them in sim_pos.
 *
 * @returns {void}
 */
export function predict_trajectory_init() {

    sim_pos = [];

    let pseudo_r = { x: MAN.r.x, y: MAN.r.y, z: MAN.r.z };
    let pseudo_v = { x: MAN.v.x, y: MAN.v.y, z: MAN.v.z };

    for (let i = 0; i < pathLen; i++) {

        const { ax: ax_old, ay: ay_old } = MAN.acc(pseudo_r);

        pseudo_r.x += pseudo_v.x * MAN.params.dt + 0.5 * ax_old * (MAN.params.dt**2);
        pseudo_r.y += pseudo_v.y * MAN.params.dt + 0.5 * ay_old * (MAN.params.dt **2);

        const { ax: ax_new, ay: ay_new } = MAN.acc(pseudo_r);

        pseudo_v.x += 0.5 * (ax_old + ax_new) * MAN.params.dt;
        pseudo_v.y += 0.5 * (ay_old + ay_new) * MAN.params.dt;

        sim_pos.push({
            x: pseudo_r.x,
            y: pseudo_r.y
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
    const attr = POD.trajectory_Geometry.attributes.position;

    if (!sim_pos || sim_pos.length === 0) {
        POD.trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
        return;
    }

    predict_trajectory_init();

    const count = Math.min(sim_pos.length, pathLen);

    for (let i = 0; i < count; i++) {
        attr.array[i * 3] = sim_pos[i].x;
        attr.array[i * 3 + 1] = sim_pos[i].y;
        attr.array[i * 3 + 2] = 0;
    }

    POD.trajectory_Geometry.setDrawRange(0, count);

    attr.needsUpdate = true;
}
