import * as MAN from './maneuver.js'
import * as POD from './pod.js'

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

    let pseudo_r = { x: MAN.r.x, y: MAN.r.y, z: MAN.r.z };
    let pseudo_v = { x: MAN.v.x, y: MAN.v.y, z: MAN.v.z };

    let pseudo_bodies = {
        earth: { m: 1, pos: { x: -3, y: -4, z: 0 } },
        moon: { m: MAN.params.moonMass, pos: { x: MAN.bodies.moon.pos.x, y: MAN.bodies.moon.pos.y, z: MAN.bodies.moon.pos.z } },
        sun: { m: 0, pos: { x: -20, y: 0, z: 1 } }

    }
    let omega = MAN.omega;
    let R = MAN.R;

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
            moonx: pseudo_bodies.moon.pos.x,
            moony: pseudo_bodies.moon.pos.y
        };

        //if reaching a state match, no need to calculate further 
        //(orbits, non degrading trajectories)
        // const stateExists = previousStates.some(state =>
        //     Math.abs(state.rx - currentState.rx) < stateThreshold &&
        //     Math.abs(state.ry - currentState.ry) < stateThreshold &&
        //     Math.abs(state.rz - currentState.rz) < stateThreshold &&
        //     Math.abs(state.vx - currentState.vx) < stateThreshold &&
        //     Math.abs(state.vy - currentState.vy) < stateThreshold &&
        //     Math.abs(state.vz - currentState.vz) < stateThreshold
        // );

        // if (stateExists) {
        //     // State has been seen before, stop to prevent cycle
        //     break;
        // }
        // This is slowing down the simulation alot will look for alternatives

        //Store current state
        previousStates.push(currentState);

        const { ax: ax_old, ay: ay_old } = MAN.acc(pseudo_r, pseudo_bodies);

        pseudo_r.x += pseudo_v.x * MAN.params.dt + 0.5 * ax_old * (MAN.params.dt ** 2);
        pseudo_r.y += pseudo_v.y * MAN.params.dt + 0.5 * ay_old * (MAN.params.dt ** 2);

        const { ax: ax_new, ay: ay_new } = MAN.acc(pseudo_r, pseudo_bodies);

        pseudo_v.x += 0.5 * (ax_old + ax_new) * MAN.params.dt;
        pseudo_v.y += 0.5 * (ay_old + ay_new) * MAN.params.dt;

        sim_pos.push({
            x: pseudo_r.x,
            y: pseudo_r.y
        });

        pseudo_bodies.moon.pos.x = pseudo_bodies.earth.pos.x + R * Math.cos(omega + Math.PI / 3);
        pseudo_bodies.moon.pos.y = pseudo_bodies.earth.pos.y + R * Math.sin(omega + Math.PI / 3);
        omega -= 0.0001

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
