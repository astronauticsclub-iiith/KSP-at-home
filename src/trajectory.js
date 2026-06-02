import * as MAN from './maneuver.js'
import * as POD from './pod.js'

export let sim_pos = [];

const R = 15;            // Earth-Moon orbital radius (must match maneuver.js)
const EARTH_RADIUS = 1.05;
const MOON_RADIUS  = 0.42;
/**
 * Predicts future spacecraft positions — the current ballistic (coast) orbit.
 *
 * The moon's orbit is simulated forward (pseudo_omega advances by -0.0001 each
 * step) so the gravity used at each step matches where the moon will actually
 * be — otherwise the predicted path diverges from reality whenever the moon's
 * gravity matters.
 *
 * It deliberately does NOT extrapolate held burns. Doing so made the path jump
 * wildly frame-to-frame while the autopilot/circularizer toggled thrust. Every
 * burn already changes the live velocity, so recomputing the coast each frame
 * from that velocity shows the orbit updating smoothly as you burn.
 */
export function predict_trajectory_init() {
    sim_pos = [];

    if (MAN.crashState.crashed) return;

    let pseudo_r = { x: MAN.r.x, y: MAN.r.y, z: MAN.r.z };
    let pseudo_v = { x: MAN.v.x, y: MAN.v.y, z: MAN.v.z };
    let pseudo_omega = MAN.moonState.omega; // start from current moon angle

    const steps = Math.min(MAN.params.pathSteps, POD.pathLen);
    const dt = MAN.params.dt;

    for (let i = 0; i < steps; i++) {

        // Moon position at this prediction step
        const moonPos = {
            x: MAN.bodies.earth.pos.x + R * Math.cos(pseudo_omega + Math.PI / 3),
            y: MAN.bodies.earth.pos.y + R * Math.sin(pseudo_omega + Math.PI / 3),
        };

        const { ax: ax_old, ay: ay_old } = MAN.accWithMoonPos(pseudo_r, moonPos);

        // Position update (Velocity Verlet step 1)
        pseudo_r.x += pseudo_v.x * dt + 0.5 * ax_old * dt ** 2;
        pseudo_r.y += pseudo_v.y * dt + 0.5 * ay_old * dt ** 2;

        const { ax: ax_new, ay: ay_new } = MAN.accWithMoonPos(pseudo_r, moonPos);

        // Velocity update (Velocity Verlet step 2)
        pseudo_v.x += 0.5 * (ax_old + ax_new) * dt;
        pseudo_v.y += 0.5 * (ay_old + ay_new) * dt;

        // Advance the moon once per predicted step, matching the live integrator.
        pseudo_omega -= 0.0001;

        sim_pos.push({ x: pseudo_r.x, y: pseudo_r.y });

        // Stop prediction if the spacecraft would crash
        const moonX = MAN.bodies.earth.pos.x + R * Math.cos(pseudo_omega + Math.PI / 3);
        const moonY = MAN.bodies.earth.pos.y + R * Math.sin(pseudo_omega + Math.PI / 3);
        const earthDist = Math.hypot(pseudo_r.x - MAN.bodies.earth.pos.x, pseudo_r.y - MAN.bodies.earth.pos.y);
        const moonDist  = Math.hypot(pseudo_r.x - moonX,                  pseudo_r.y - moonY);
        if (earthDist < EARTH_RADIUS || moonDist < MOON_RADIUS) break;
    }
}

/**
 * Recomputes the prediction and pushes it into the GPU buffer.
 */
export function trajectory_UI_update() {
    const attr = POD.trajectory_Geometry.attributes.position;

    predict_trajectory_init();

    if (!sim_pos || sim_pos.length === 0) {
        POD.trajectory_Geometry.setDrawRange(0, 0);
        attr.needsUpdate = true;
        return;
    }

    const count = Math.min(sim_pos.length, POD.pathLen);
    for (let i = 0; i < count; i++) {
        attr.array[i * 3]     = sim_pos[i].x;
        attr.array[i * 3 + 1] = sim_pos[i].y;
        attr.array[i * 3 + 2] = 0;
    }

    POD.trajectory_Geometry.setDrawRange(0, count);
    attr.needsUpdate = true;
}
