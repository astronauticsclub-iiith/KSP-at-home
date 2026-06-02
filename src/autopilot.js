// Autopilot System
//
// Modes (all converge on, and then HOLD, a circular orbit):
//
//  - 'circularize': burn now to circularize around the nearest body, then stop.
//  - 'moon': phase for the transfer window, prograde TLI to raise apoapsis to
//    the Moon, coast, raise the lunar periapsis to a safe altitude on approach,
//    circularize at the chosen altitude, then ALT-HOLD it.
//  - 'hold' (alt-hold): continuously trim the orbit to hold the current
//    altitude. Needed because the Moon here moves kinematically, so Earth's pull
//    isn't tidally cancelled and free lunar orbits slowly decay.

import { controls, params, rocketParams, bodies } from './maneuver.js';
import { circularizationError, getNearestBody } from './circularize.js';

const MOON_RADIUS = 0.4;
const EARTH_MOON_R = 15;
const MOON_SOI = 6;          // distance at which we start managing the approach
const CAPTURE_EST = 20;      // rough seconds for approach + capture, for the ETA

export const PHASES = {
    IDLE: 'IDLE',
    PHASING: 'PHASING',
    TLI_BURN: 'TLI_BURN',
    COAST: 'COAST',
    APPROACH: 'APPROACH',
    CIRCULARIZE: 'CIRCULARIZE',
    HOLD: 'HOLD',
    ORBIT_ACHIEVED: 'ORBIT_ACHIEVED',
    RTE_ESCAPE: 'RTE_ESCAPE',
    RTE_BURN: 'RTE_BURN',
    RTE_COAST: 'RTE_COAST',
};

const PHASE_TEXT = {
    IDLE: '-',
    PHASING: 'Phasing: waiting for transfer window',
    TLI_BURN: 'TLI burn: raising orbit toward Moon',
    COAST: 'Coasting toward Moon',
    APPROACH: 'Approach: trimming lunar periapsis',
    CIRCULARIZE: 'Circularizing orbit',
    HOLD: 'Alt-hold: maintaining orbit',
    ORBIT_ACHIEVED: 'Orbit achieved',
    RTE_ESCAPE: 'Return: leaving lunar orbit',
    RTE_BURN: 'Return burn: lowering Earth periapsis',
    RTE_COAST: 'Coasting back to Earth',
};

function normalizeAngle(x) {
    x %= 2 * Math.PI;
    if (x < -Math.PI) x += 2 * Math.PI;
    if (x >= Math.PI) x -= 2 * Math.PI;
    return x;
}

const state = {
    active: false,
    phase: PHASES.IDLE,
    mode: 'circularize',        // 'circularize' | 'moon' | 'hold'
    burnType: '',
    plannedDeltaV: 0,
    accumulatedDeltaV: 0,
    remainingDv: 0,
    orbitAchievedTime: 0,
    abortReason: '',
    coastFrames: 0,
    closestApproach: Infinity,
    periapsisReached: false,
    targetLunarR: 1.2,          // desired circular lunar-orbit radius
    targetEarthR: 2,            // desired circular Earth-orbit radius (return)
    simTime: 0,                 // sim-seconds since engage
    tliTime: 0,                 // simTime at which the TLI burn started
    transferTime: 0,            // half-period of the transfer ellipse
    phaseWait: 0,               // estimated sim-seconds left in PHASING
    etaSeconds: 0,              // estimated time to a stable orbit
};

// Getters
export function getPhase() { return state.phase; }
export function isActive() { return state.active; }
export function isHolding() { return state.active && state.phase === PHASES.HOLD; }
export function getAbortReason() { return state.abortReason; }
export function getBurnType() { return state.burnType; }

export function getTelemetry() {
    if (!state.active && state.phase === PHASES.IDLE) {
        return { phaseText: '-', remainingDv: 0, etaSeconds: 0 };
    }
    let phaseText = PHASE_TEXT[state.phase] || state.phase;
    if (state.phase === PHASES.COAST) phaseText = `Coasting toward Moon (${state.coastFrames})`;
    return { phaseText, remainingDv: Math.max(0, state.remainingDv), etaSeconds: state.etaSeconds };
}

// Helpers
function mag(x, y) { return Math.hypot(x, y); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function getMoonVelocity(moonPos) {
    const omegaDot = -0.0001 / Math.max(params.dt, 1e-6); // rad per sim-second (signed)
    const angle = Math.atan2(moonPos.y - bodies.earth.pos.y, moonPos.x - bodies.earth.pos.x);
    const f = EARTH_MOON_R * omegaDot;
    return { x: -Math.sin(angle) * f, y: Math.cos(angle) * f };
}

function moonRelPeriapsis(pos, vel, moonPos) {
    const mv = getMoonVelocity(moonPos);
    const rx = pos.x - moonPos.x;
    const ry = pos.y - moonPos.y;
    const vx = vel.x - mv.x;
    const vy = vel.y - mv.y;
    const r = Math.hypot(rx, ry);
    const mu = params.G * bodies.moon.m;
    if (mu <= 0) return { rp: r, h: rx * vy - ry * vx };
    const h = rx * vy - ry * vx;
    const v2 = vx * vx + vy * vy;
    const energy = v2 / 2 - mu / r;
    const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
    return { rp: (h * h / mu) / (1 + e), h };
}

function raisePeriapsis(pos, vel, moonPos) {
    const { h } = moonRelPeriapsis(pos, vel, moonPos);
    const rx = pos.x - moonPos.x;
    const ry = pos.y - moonPos.y;
    const sign = h >= 0 ? 1 : -1;
    const desX = sign * -ry;   // gradient of |h| wrt added velocity
    const desY = sign * rx;
    const s = Math.hypot(vel.x, vel.y) || 1;
    const nPlusX = -vel.y / s;  // normal+ thrust direction
    const nPlusY = vel.x / s;
    if (desX * nPlusX + desY * nPlusY >= 0) setBurn('normal+');
    else setBurn('normal-');
}

// Thrust to push the velocity toward direction (dx, dy), using whichever
// prograde/retrograde + normal combination is available.
function burnToward(dx, dy, vel) {
    const s = Math.hypot(vel.x, vel.y) || 1;
    const vhx = vel.x / s, vhy = vel.y / s;
    const nhx = -vhy, nhy = vhx;
    const along = dx * vhx + dy * vhy;
    const perp = dx * nhx + dy * nhy;
    const mag2 = Math.hypot(dx, dy) || 1;
    const gate = 0.04 * mag2;
    controls.prograding = along > gate;
    controls.retrograding = along < -gate;
    controls.normalPos = perp > gate;
    controls.normalNeg = perp < -gate;
    state.burnType = controls.prograding ? 'prograde'
        : controls.retrograding ? 'retrograde'
            : controls.normalPos ? 'normal+'
                : controls.normalNeg ? 'normal-' : '';
}

// Apoapsis distance about the Moon (Infinity if unbound).
function moonRelApoapsis(pos, vel, moonPos) {
    const mv = getMoonVelocity(moonPos);
    const rx = pos.x - moonPos.x, ry = pos.y - moonPos.y;
    const vx = vel.x - mv.x, vy = vel.y - mv.y;
    const r = Math.hypot(rx, ry);
    const mu = params.G * bodies.moon.m;
    if (mu <= 0) return Infinity;
    const h = rx * vy - ry * vx;
    const energy = (vx * vx + vy * vy) / 2 - mu / r;
    if (energy >= 0) return Infinity;
    const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
    return (h * h / mu) / (1 - e);
}

// Periapsis distance about Earth (Earth is stationary, so absolute velocity).
function earthPeriapsis(pos, vel) {
    const dx = pos.x - bodies.earth.pos.x;
    const dy = pos.y - bodies.earth.pos.y;
    const r = Math.hypot(dx, dy);
    const mu = params.G * bodies.earth.m;
    const h = dx * vel.y - dy * vel.x;
    const v2 = vel.x * vel.x + vel.y * vel.y;
    const energy = v2 / 2 - mu / r;
    const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
    return { rp: (h * h / mu) / (1 + e), r };
}

function computeAvailableDv() {
    const mWet = rocketParams.dryMass + rocketParams.fuelMass;
    const mDry = rocketParams.dryMass;
    if (mDry <= 0 || mWet <= mDry) return 0;
    return rocketParams.Isp * Math.log(mWet / mDry);
}

// Closed-loop circularize step around `body`. Returns the velocity error.
function circStep(pos, vel, body, moonPos, dt, holdTolerance = false) {
    const bodyVel = body === bodies.moon ? getMoonVelocity(moonPos) : { x: 0, y: 0 };
    const { errAlong, errPerp, errMag } = circularizationError(pos, vel, body, params.G, bodyVel);
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    const dvPerFrame = mass > 0 ? (rocketParams.thrust / mass) * dt : 0;
    const deadband = Math.max(dvPerFrame * (holdTolerance ? 4 : 1.5), 1e-4);
    const gate = deadband * 0.3;

    if (errMag <= (holdTolerance ? deadband : gate)) {
        stopAllBurns();
    } else {
        controls.prograding = errAlong > gate;
        controls.retrograding = errAlong < -gate;
        controls.normalPos = errPerp > gate;
        controls.normalNeg = errPerp < -gate;
        state.burnType = controls.prograding ? 'prograde'
            : controls.retrograding ? 'retrograde'
                : controls.normalPos ? 'normal+'
                    : controls.normalNeg ? 'normal-' : '';
    }
    return { errMag, deadband };
}

// Public API

export function engage(mode, pos, vel, opts = {}) {
    if (state.active && state.mode !== 'hold') return { success: false, reason: 'Already active' };

    resetTransient();
    if (mode === 'moon') state.mode = 'moon';
    else if (mode === 'earth') state.mode = 'earth';
    else state.mode = 'circularize';

    if (state.mode === 'circularize') {
        state.active = true;
        state.phase = PHASES.CIRCULARIZE;
        return { success: true };
    }

    if (state.mode === 'earth') {
        // Return to Earth: drop the Earth periapsis to a low orbit, coast in,
        // circularize. Works from a lunar orbit or anywhere out near the Moon.
        state.targetEarthR = Number.isFinite(opts.earthR) ? opts.earthR : 2;
        state.active = true;
        state.phase = PHASES.RTE_ESCAPE;
        return { success: true };
    }

    // Moon transfer.
    state.targetLunarR = Number.isFinite(opts.lunarR) ? opts.lunarR : 1.2;
    const earthPos = bodies.earth.pos;
    const r = dist(pos.x, pos.y, earthPos.x, earthPos.y);
    const vCurrent = mag(vel.x, vel.y);
    const a = (r + EARTH_MOON_R) / 2;
    const vTransfer = Math.sqrt(params.G * bodies.earth.m * (2 / r - 1 / a));
    const tliDv = Math.max(0, vTransfer - vCurrent);

    const available = computeAvailableDv();
    if (available < tliDv * 1.5) {
        state.abortReason = `LOW dV: need ~${(tliDv * 1.8).toFixed(1)}, have ${available.toFixed(1)}`;
        return { success: false, reason: state.abortReason };
    }

    state.active = true;
    state.phase = PHASES.PHASING;
    state.plannedDeltaV = tliDv;
    return { success: true };
}

// Alt-hold: maintain the current circular altitude. Overrides any other mode.
export function engageHold() {
    resetTransient();
    state.mode = 'hold';
    state.active = true;
    state.phase = PHASES.HOLD;
    return { success: true };
}

function resetTransient() {
    state.abortReason = '';
    state.accumulatedDeltaV = 0;
    state.remainingDv = 0;
    state.burnType = '';
    state.coastFrames = 0;
    state.closestApproach = Infinity;
    state.periapsisReached = false;
    state.simTime = 0;
    state.tliTime = 0;
    state.transferTime = 0;
    state.phaseWait = 0;
    state.etaSeconds = 0;
}

export function cancel() {
    stopAllBurns();
    state.active = false;
    state.phase = PHASES.IDLE;
    state.plannedDeltaV = 0;
    state.accumulatedDeltaV = 0;
    state.remainingDv = 0;
    state.etaSeconds = 0;
    state.burnType = '';
    state.mode = 'circularize';
}

export function update(dt, pos, vel, moonPos) {
    if (!state.active) return;
    state.simTime += dt;

    const distToMoon = dist(pos.x, pos.y, moonPos.x, moonPos.y);

    switch (state.phase) {
        case PHASES.PHASING: {
            stopAllBurns();
            const earth = bodies.earth.pos;
            const thetaC = Math.atan2(pos.y - earth.y, pos.x - earth.x);
            const thetaM = Math.atan2(moonPos.y - earth.y, moonPos.x - earth.x);
            const r = dist(pos.x, pos.y, earth.x, earth.y);
            const a = (r + EARTH_MOON_R) / 2;
            state.transferTime = Math.PI * Math.sqrt((a * a * a) / (params.G * bodies.earth.m));
            const omegaM = -0.0001 / Math.max(params.dt, 1e-6);
            const required = normalizeAngle(-Math.PI - omegaM * state.transferTime);
            const diff = normalizeAngle((thetaM - thetaC) - required);

            // Estimate the wait from the closing rate of the phase angle.
            const rxE = pos.x - earth.x, ryE = pos.y - earth.y;
            const omegaC = (rxE * vel.y - ryE * vel.x) / (r * r);
            const relRate = Math.abs(omegaM - omegaC);
            state.phaseWait = relRate > 1e-6 ? Math.abs(diff) / relRate : 0;

            if (Math.abs(diff) < 0.03) {
                const vTransfer = Math.sqrt(params.G * bodies.earth.m * (2 / r - 1 / a));
                state.plannedDeltaV = Math.max(0, vTransfer - mag(vel.x, vel.y));
                state.accumulatedDeltaV = 0;
                state.tliTime = state.simTime;
                state.phase = PHASES.TLI_BURN;
            }
            break;
        }

        case PHASES.TLI_BURN:
            setBurn('prograde');
            accumulateDv(dt);
            state.remainingDv = Math.max(0, state.plannedDeltaV - state.accumulatedDeltaV);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                stopAllBurns();
                state.phase = PHASES.COAST;
                state.coastFrames = 0;
                state.tliTime = state.simTime;
            }
            break;

        case PHASES.COAST:
            stopAllBurns();
            state.coastFrames++;
            if (distToMoon < MOON_SOI) {
                state.phase = PHASES.APPROACH;
                state.closestApproach = distToMoon;
                state.periapsisReached = false;
            }
            if (state.coastFrames > 200000) {
                state.abortReason = 'TRAJECTORY MISS';
                cancel();
            }
            break;

        case PHASES.APPROACH: {
            if (distToMoon < state.closestApproach) state.closestApproach = distToMoon;
            const { rp } = moonRelPeriapsis(pos, vel, moonPos);
            const target = state.targetLunarR;
            state.remainingDv = Math.max(0, target - rp);

            if (rp < target && !state.periapsisReached) {
                raisePeriapsis(pos, vel, moonPos);
            } else {
                stopAllBurns();
                if (distToMoon > state.closestApproach + 0.03) {
                    state.periapsisReached = true;
                    state.phase = PHASES.CIRCULARIZE;
                }
            }

            if (distToMoon < MOON_RADIUS + 0.05) {
                state.abortReason = 'IMPACT - correction too late';
                cancel();
            } else if (distToMoon > 8 && state.closestApproach < distToMoon - 1.5) {
                state.abortReason = 'FLYBY - no capture';
                cancel();
            }
            break;
        }

        case PHASES.CIRCULARIZE: {
            const body = getNearestBody(pos, bodies);
            if (!body) { finishCircularize(); break; }
            const { errMag, deadband } = circStep(pos, vel, body, moonPos, dt, false);
            state.remainingDv = errMag;
            if (errMag <= deadband * 0.3) finishCircularize();
            break;
        }

        case PHASES.HOLD: {
            const body = getNearestBody(pos, bodies);
            if (body) {
                const { errMag } = circStep(pos, vel, body, moonPos, dt, true);
                state.remainingDv = errMag;
            } else {
                stopAllBurns();
            }
            break; // never deactivates — alt-hold is sticky
        }

        case PHASES.ORBIT_ACHIEVED:
            stopAllBurns();
            if (Date.now() - state.orbitAchievedTime > 3000) {
                state.active = false;
                state.phase = PHASES.IDLE;
                state.burnType = '';
            }
            break;

        case PHASES.RTE_ESCAPE: {
            // Leave lunar orbit with the MINIMUM burn: raise lunar apoapsis just
            // past the SOI, then coast out. A minimal escape keeps Earth-relative
            // velocity low, and since the Moon moves below Earth-circular speed,
            // the craft then falls toward Earth on its own.
            if (distToMoon > MOON_SOI) {
                stopAllBurns();
                state.phase = PHASES.RTE_BURN;
            } else if (moonRelApoapsis(pos, vel, moonPos) < MOON_SOI * 1.15) {
                setBurn('prograde');
            } else {
                stopAllBurns(); // coasting outward to leave the SOI
            }
            break;
        }

        case PHASES.RTE_BURN: {
            // Outside the Moon now: trim the Earth periapsis to the target by
            // adding/removing Earth-tangential velocity.
            const earth = bodies.earth.pos;
            const dx = pos.x - earth.x, dy = pos.y - earth.y;
            const r = Math.hypot(dx, dy);
            const { rp } = earthPeriapsis(pos, vel);
            const target = state.targetEarthR;
            state.remainingDv = Math.abs(rp - target);
            const rHatx = dx / r, rHaty = dy / r;
            const vDotR = vel.x * rHatx + vel.y * rHaty;
            const tanx = vel.x - vDotR * rHatx; // Earth-tangential velocity
            const tany = vel.y - vDotR * rHaty;
            if (rp > target * 1.05) {
                burnToward(-tanx, -tany, vel);   // lower periapsis
            } else if (rp < target * 0.95) {
                burnToward(tanx, tany, vel);      // raise periapsis (avoid impact)
            } else {
                stopAllBurns();
                state.phase = PHASES.RTE_COAST;
                state.closestApproach = r;
                state.periapsisReached = false;
            }
            break;
        }

        case PHASES.RTE_COAST: {
            stopAllBurns();
            const earth = bodies.earth.pos;
            const distEarth = dist(pos.x, pos.y, earth.x, earth.y);
            if (distEarth < state.closestApproach) state.closestApproach = distEarth;
            // Once near the target altitude and past periapsis, circularize.
            if (distEarth < state.targetEarthR + 0.5 && distEarth > state.closestApproach + 0.02) {
                state.phase = PHASES.CIRCULARIZE;
            }
            break;
        }
    }

    updateEta(pos, vel, moonPos, distToMoon);

    // Fuel exhaustion safety during the powered transfer phases (not HOLD —
    // alt-hold simply coasts once it's out of fuel).
    if (rocketParams.fuelMass <= 0 &&
        (state.phase === PHASES.TLI_BURN || state.phase === PHASES.APPROACH
            || state.phase === PHASES.CIRCULARIZE || state.phase === PHASES.RTE_ESCAPE
            || state.phase === PHASES.RTE_BURN)) {
        state.abortReason = 'FUEL EXHAUSTED';
        cancel();
    }
}

function finishCircularize() {
    if (state.mode === 'moon') {
        // Hand off to alt-hold so the (otherwise decaying) lunar orbit is kept.
        state.phase = PHASES.HOLD;
        state.mode = 'hold';
        stopAllBurns();
        state.remainingDv = 0;
    } else {
        stopAllBurns();
        state.phase = PHASES.ORBIT_ACHIEVED;
        state.orbitAchievedTime = Date.now();
        state.remainingDv = 0;
    }
}

function updateEta(pos, vel, moonPos, distToMoon) {
    let eta;
    switch (state.phase) {
        case PHASES.PHASING:
            eta = state.phaseWait + state.transferTime + CAPTURE_EST;
            break;
        case PHASES.TLI_BURN:
        case PHASES.COAST:
            eta = Math.max(0, state.transferTime - (state.simTime - state.tliTime)) + CAPTURE_EST;
            break;
        case PHASES.APPROACH:
            eta = 8 + Math.max(0, distToMoon) * 2;
            break;
        case PHASES.CIRCULARIZE:
            eta = 5;
            break;
        case PHASES.RTE_ESCAPE:
            eta = 40;
            break;
        case PHASES.RTE_BURN:
            eta = 20 + state.remainingDv * 30;
            break;
        case PHASES.RTE_COAST: {
            const dE = Math.hypot(pos.x - bodies.earth.pos.x, pos.y - bodies.earth.pos.y);
            eta = 5 + Math.max(0, dE) * 2;
            break;
        }
        default:
            eta = 0; // HOLD / ORBIT_ACHIEVED / IDLE: already stable
    }
    state.etaSeconds = eta;
}

// Burn Helpers

function setBurn(type) {
    state.burnType = type;
    controls.prograding = type === 'prograde';
    controls.retrograding = type === 'retrograde';
    controls.normalPos = type === 'normal+';
    controls.normalNeg = type === 'normal-';
}

function stopAllBurns() {
    controls.prograding = false;
    controls.retrograding = false;
    controls.normalPos = false;
    controls.normalNeg = false;
    state.burnType = '';
}

function accumulateDv(dt) {
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    if (mass > 0 && rocketParams.fuelMass > 0) {
        state.accumulatedDeltaV += (rocketParams.thrust / mass) * dt;
    }
}
