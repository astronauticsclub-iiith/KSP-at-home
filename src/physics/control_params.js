
export const params = {
    G: 1, // Graviational constant in ARBITRARY UNITS
    dt: 0.03, // TIME SCALE
    moonMass: 20 / 81,
};

let r = { x: 2, y: -2, z: 0 }; // postion and velocities
let v = { x: 0.707, y: 0, z: 0 }; //start with a stable orbital velocity

export let R = 15; //distance between earth and moon

let bodies = {
    earth: {
        name: 'EARTH',
        m: 1,
        r: 1.05,
        theta: 0,
        pos: { x: 2, y: 0, z: 0 },
    },
    moon: {
        name: 'MOON',
        m: params.moonMass,
        r: 0.42,
        theta: 0,
        pos: { x: 6, y: 8, z: 0 },
    },
    sun: {
        name: 'SUN',
        m: 1,
        r: 2,
        theta: 0,
        pos: { x: -22, y: 0, z: 1 },
    },
    jupiter: {
        name: 'JUPITER',
        m: 0.8,
        r: 1.8,
        theta: 0,
        pos: { x: -26, y: 8, z: 0 },
    },
    mars: {
        name: 'MARS',
        m: 0.3,
        r: 1.2,
        theta: 0,
        pos: { x: -5, y: -3, z: 0 },
    },
    neptune: {
        name: 'NEPTUNE',
        m: 0.2,
        r: 0.8,
        theta: 0,
        pos: { x: -45, y: -10, z: 0 },
    },
    pluto: {
        name: 'PLUTO',
        m: 0.05,
        r: 0.35,
        theta: 0,
        pos: { x: -70, y: 14, z: 0 },
    },
}; //artifically increase moons pull for now

// Snapshot of original masses from the bodies object above.
// Taken at module-init time, before initLevel can zero them out.
const ORIGINAL_MASSES = Object.fromEntries(
    Object.entries(bodies).map(([name, body]) => [name, body.m])
);

// Controls whether body_update orbital functions run each frame
export let dynamicBodies = true;

/**
 * Initialises physics state from a level config object.
 * Mutates r, v, and bodies IN-PLACE to preserve module references
 * held by maneuver.js and collision.js.
 *
 * @param {{ startPos, startVel, activeBodies, dynamicBodies }} cfg
 */
export function initLevel(cfg) {
    // Pod start state
    r.x = cfg.startPos.x;
    r.y = cfg.startPos.y;
    r.z = 0;
    v.x = cfg.startVel.x;
    v.y = cfg.startVel.y;
    v.z = 0;

    // Disable all bodies first, then re-enable active ones
    for (const name of Object.keys(bodies)) {
        bodies[name].m = 0;
    }
    for (const name of cfg.activeBodies) {
        if (bodies[name] !== undefined) {
            bodies[name].m = ORIGINAL_MASSES[name];
        }
    }

    // Orbital motion flag — read by body_update.js each frame
    dynamicBodies = cfg.dynamicBodies ?? true;
}

export { bodies };
export { r, v };
