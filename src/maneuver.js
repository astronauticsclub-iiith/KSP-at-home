// ── Simulation parameters ─────────────────────────────────────────────────────
export const params = {
    G: 1,
    dt: 0.03,
    moonMass: 20 / 81,
    pathSteps: 2000,   // How many steps ahead to predict (each step = dt seconds of sim time)
};

// ── Rocket parameters ─────────────────────────────────────────────────────────
export const rocketParams = {
    Isp: 300,      // Specific impulse — exhaust velocity in game units (higher = more efficient)
    dryMass: 2,    // Dry mass (structure + engine, no fuel)
    fuelMass: 8,   // Current fuel mass on board
    thrust: 2,     // Engine thrust force
};

// ── Moon orbital state (exported so trajectory prediction can simulate it) ────
export const moonState = { omega: 0 };
const R = 15; // Earth–Moon orbital radius

// ── Spacecraft state ──────────────────────────────────────────────────────────
export let r = { x: -3, y: -2, z: 0 };
export let v = { x: 1 / Math.sqrt(2), y: 0, z: 0 };

// ── Celestial bodies ──────────────────────────────────────────────────────────
export let bodies = {
    earth: { m: 1, pos: { x: -3, y: -4, z: 0 } },
    moon: { m: params.moonMass, pos: { x: 6, y: 8, z: 0 } },
    sun: { m: 0, pos: { x: -20, y: 0, z: 1 } },
};

// ── Crash state ───────────────────────────────────────────────────────────────
export const crashState = { crashed: false, message: '' };

// ── Undo history ──────────────────────────────────────────────────────────────
const stateHistory = [];
const MAX_HISTORY = 100;
let frameCount = 0;

function saveSnapshot() {
    stateHistory.push({
        r: { x: r.x, y: r.y, z: r.z },
        v: { x: v.x, y: v.y, z: v.z },
        fuelMass: rocketParams.fuelMass,
        omega: moonState.omega,
    });
    if (stateHistory.length > MAX_HISTORY) stateHistory.shift();
}

export function undo() {
    if (stateHistory.length === 0) return false;
    const snap = stateHistory.pop();
    r.x = snap.r.x; r.y = snap.r.y; r.z = snap.r.z;
    v.x = snap.v.x; v.y = snap.v.y; v.z = snap.v.z;
    rocketParams.fuelMass = snap.fuelMass;
    moonState.omega = snap.omega;
    crashState.crashed = false;
    crashState.message = '';
    return true;
}

// ── Initial orbit setup ───────────────────────────────────────────────────────
export function setInitialOrbit(orbitRadius) {
    const ex = bodies.earth.pos.x;
    const ey = bodies.earth.pos.y;
    r.x = ex + orbitRadius;
    r.y = ey;
    r.z = 0;
    // Circular orbital velocity: v = sqrt(G * M / r)
    const vCirc = Math.sqrt(params.G * bodies.earth.m / orbitRadius);
    v.x = 0;
    v.y = vCirc;
    v.z = 0;
    stateHistory.length = 0;
    crashState.crashed = false;
    crashState.message = '';
    frameCount = 0;
}

// ── Physics helpers ───────────────────────────────────────────────────────────
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Standard gravitational acceleration (uses current bodies positions)
export function acc(pos) {
    let ax = 0, ay = 0;
    for (const body of Object.values(bodies)) {
        if (body.m === 0) continue;
        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) continue;
        const f = params.G * body.m / (d ** 3);
        ax += f * dx;
        ay += f * dy;
    }
    return { ax, ay };
}

/**
 * Acceleration with an EXPLICIT moon position.
 * Used by trajectory prediction to simulate the moon moving during prediction,
 * making the predicted path match reality instead of assuming a frozen moon.
 */
export function accWithMoonPos(pos, moonPos) {
    let ax = 0, ay = 0;

    // Earth gravity
    const dex = bodies.earth.pos.x - pos.x;
    const dey = bodies.earth.pos.y - pos.y;
    const de = Math.sqrt(dex * dex + dey * dey);
    if (de > 0.01 && bodies.earth.m > 0) {
        const fe = params.G * bodies.earth.m / (de ** 3);
        ax += fe * dex; ay += fe * dey;
    }

    // Moon gravity (custom position — updated per prediction step)
    if (bodies.moon.m > 0 && moonPos) {
        const dmx = moonPos.x - pos.x;
        const dmy = moonPos.y - pos.y;
        const dm = Math.sqrt(dmx * dmx + dmy * dmy);
        if (dm > 0.01) {
            const fm = params.G * bodies.moon.m / (dm ** 3);
            ax += fm * dmx; ay += fm * dmy;
        }
    }

    return { ax, ay };
}

// ── Burn controls ─────────────────────────────────────────────────────────────
export const controls = {
    retrograding: false,
    prograding: false,
    normalPos: false,    // RCS: thrust perpendicular to velocity (left / orbit-raise)
    normalNeg: false,    // RCS: thrust perpendicular to velocity (right / orbit-lower)
};

function consumeFuel() {
    if (rocketParams.fuelMass <= 0) return 0;
    const used = (rocketParams.thrust / Math.max(rocketParams.Isp, 1)) * params.dt;
    rocketParams.fuelMass = Math.max(0, rocketParams.fuelMass - used);
    return rocketParams.thrust;
}

// RCS uses 30% of main engine thrust and fuel rate
function consumeRCSFuel() {
    if (rocketParams.fuelMass <= 0) return 0;
    const rcsThrust = rocketParams.thrust * 0.3;
    const used = (rcsThrust / Math.max(rocketParams.Isp, 1)) * params.dt;
    rocketParams.fuelMass = Math.max(0, rocketParams.fuelMass - used);
    return rcsThrust;
}

export function prograde() {
    const thrust = consumeFuel();
    if (thrust === 0) return;
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);
    if (speed === 0 || mass <= 0) return;
    const dv = (thrust / mass) * params.dt;
    v.x += dv * (v.x / speed);
    v.y += dv * (v.y / speed);
}

export function retrograde() {
    const thrust = consumeFuel();
    if (thrust === 0) return;
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);
    if (speed === 0 || mass <= 0) return;
    const dv = (thrust / mass) * params.dt;
    v.x -= dv * (v.x / speed);
    v.y -= dv * (v.y / speed);
}

/**
 * Normal+ burn: thrust perpendicular to velocity (left in 2D — raises orbit).
 * In 2D, normal to velocity (vx, vy) is (-vy, vx) normalized.
 */
export function normalPositive() {
    const thrust = consumeRCSFuel();
    if (thrust === 0) return;
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);
    if (speed === 0 || mass <= 0) return;
    const dv = (thrust / mass) * params.dt;
    // Perpendicular left: (-vy, vx) / speed
    v.x += dv * (-v.y / speed);
    v.y += dv * (v.x / speed);
}

/**
 * Normal- burn: thrust perpendicular to velocity (right in 2D — lowers orbit).
 */
export function normalNegative() {
    const thrust = consumeRCSFuel();
    if (thrust === 0) return;
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);
    if (speed === 0 || mass <= 0) return;
    const dv = (thrust / mass) * params.dt;
    // Perpendicular right: (vy, -vx) / speed
    v.x += dv * (v.y / speed);
    v.y += dv * (-v.x / speed);
}

// ── Main step ─────────────────────────────────────────────────────────────────
export function step() {
    if (crashState.crashed) {
        return {
            x: r.x, y: r.y, theta: Math.atan2(v.y, v.x),
            vx: 0, vy: 0, ax: 0, ay: 0,
            moonx: bodies.moon.pos.x, moony: bodies.moon.pos.y,
            dt: params.dt, fuelMass: rocketParams.fuelMass, crashed: true,
        };
    }

    // Save undo snapshot every 60 frames (~2 s of wall time)
    frameCount++;
    if (frameCount % 60 === 0) saveSnapshot();

    // Velocity Verlet integration
    const { ax: ax_old, ay: ay_old } = acc(r);
    r.x += v.x * params.dt + 0.5 * ax_old * params.dt ** 2;
    r.y += v.y * params.dt + 0.5 * ay_old * params.dt ** 2;
    const { ax: ax_new, ay: ay_new } = acc(r);
    v.x += 0.5 * (ax_old + ax_new) * params.dt;
    v.y += 0.5 * (ay_old + ay_new) * params.dt;

    const theta = Math.atan2(v.y, v.x);

    // Engine burns
    if (controls.prograding) prograde();
    if (controls.retrograding) retrograde();
    if (controls.normalPos) normalPositive();
    if (controls.normalNeg) normalNegative();

    // Advance moon orbit
    bodies.moon.pos.x = bodies.earth.pos.x + R * Math.cos(moonState.omega + Math.PI / 3);
    bodies.moon.pos.y = bodies.earth.pos.y + R * Math.sin(moonState.omega + Math.PI / 3);
    moonState.omega -= 0.0001;

    // ── Collision detection ──────────────────────────────────────────────────
    const earthDist = dist(r.x, r.y, bodies.earth.pos.x, bodies.earth.pos.y);
    const moonDist = dist(r.x, r.y, bodies.moon.pos.x, bodies.moon.pos.y);

    if (earthDist < 1.05) {          // Earth visual radius ≈ 1
        crashState.crashed = true;
        crashState.message = 'CRASHED INTO EARTH';
        v.x = 0; v.y = 0;
    } else if (moonDist < 0.42) {   // Moon visual radius ≈ 0.4
        crashState.crashed = true;
        crashState.message = 'CRASHED INTO MOON';
        v.x = 0; v.y = 0;
    }

    return {
        x: r.x, y: r.y, theta,
        vx: v.x, vy: v.y,
        ax: ax_new, ay: ay_new,
        moonx: bodies.moon.pos.x, moony: bodies.moon.pos.y,
        dt: params.dt,
        fuelMass: rocketParams.fuelMass,
        crashed: crashState.crashed,
    };
}
