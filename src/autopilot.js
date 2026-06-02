// Autopilot System
//
// Two modes, both finishing in a clean circular orbit:
//
//  - 'circularize': burn now to circularize the orbit around the nearest body
//    (closed-loop, reliable). Good for tidying up an Earth orbit.
//
//  - 'moon': a Hohmann transfer to the Moon — prograde TLI burn to raise
//    apoapsis to the Moon's orbit, coast, brake into capture at closest
//    approach (LOI), then auto-circularize around the Moon.

import { controls, params, rocketParams, bodies } from './maneuver.js';
import { circularizationError, getNearestBody } from './circularize.js';

const MOON_RADIUS = 0.4;
const EARTH_MOON_R = 15;

export const PHASES = {
    IDLE: 'IDLE',
    TLI_BURN: 'TLI_BURN',
    COAST: 'COAST',
    APPROACH: 'APPROACH',
    LOI_BURN: 'LOI_BURN',
    CIRCULARIZE: 'CIRCULARIZE',
    ORBIT_ACHIEVED: 'ORBIT_ACHIEVED',
};

// Human-readable descriptions of what each phase is doing.
const PHASE_TEXT = {
    IDLE: '-',
    TLI_BURN: 'TLI burn: raising orbit toward Moon',
    COAST: 'Coasting toward Moon',
    APPROACH: 'Approach: entering Moon influence',
    LOI_BURN: 'Capture burn: braking into Moon orbit',
    CIRCULARIZE: 'Circularizing orbit',
    ORBIT_ACHIEVED: 'Orbit achieved',
};

const state = {
    active: false,
    phase: PHASES.IDLE,
    mode: 'circularize',        // 'circularize' | 'moon'
    burnType: '',               // 'prograde' | 'retrograde' | 'normal+' | 'normal-'
    plannedDeltaV: 0,
    accumulatedDeltaV: 0,
    remainingDv: 0,
    orbitAchievedTime: 0,
    abortReason: '',
    coastFrames: 0,
    closestApproach: Infinity,
    periapsisReached: false,
};

// Getters
export function getPhase() { return state.phase; }
export function isActive() { return state.active; }
export function getAbortReason() { return state.abortReason; }
export function getBurnType() { return state.burnType; }

export function getTelemetry() {
    if (!state.active && state.phase === PHASES.IDLE) {
        return { phaseText: '-', remainingDv: 0 };
    }
    let phaseText = PHASE_TEXT[state.phase] || state.phase;
    if (state.phase === PHASES.COAST) phaseText = `Coasting toward Moon (${state.coastFrames})`;
    return { phaseText, remainingDv: Math.max(0, state.remainingDv) };
}

// Helpers
function mag(x, y) { return Math.hypot(x, y); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function normalize(x, y) { const m = mag(x, y); return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 1 }; }

function getMoonVelocity(moonPos) {
    const moonSpeed = Math.sqrt(params.G * bodies.earth.m / EARTH_MOON_R);
    const angle = Math.atan2(moonPos.y - bodies.earth.pos.y, moonPos.x - bodies.earth.pos.x);
    return { x: -moonSpeed * Math.sin(angle), y: moonSpeed * Math.cos(angle) };
}

function getRelativeVelocity(vel, moonPos) {
    const moonVel = getMoonVelocity(moonPos);
    return { x: vel.x - moonVel.x, y: vel.y - moonVel.y };
}

function computeAvailableDv() {
    const mWet = rocketParams.dryMass + rocketParams.fuelMass;
    const mDry = rocketParams.dryMass;
    if (mDry <= 0 || mWet <= mDry) return 0;
    return rocketParams.Isp * Math.log(mWet / mDry);
}

// Public API

export function engage(mode, pos, vel) {
    if (state.active) return { success: false, reason: 'Already active' };

    state.mode = mode === 'moon' ? 'moon' : 'circularize';
    state.abortReason = '';
    state.accumulatedDeltaV = 0;
    state.remainingDv = 0;
    state.burnType = '';
    state.coastFrames = 0;
    state.closestApproach = Infinity;
    state.periapsisReached = false;

    if (state.mode === 'circularize') {
        // No transfer — just feedback-circularize wherever we are.
        state.active = true;
        state.phase = PHASES.CIRCULARIZE;
        state.plannedDeltaV = 0;
        return { success: true };
    }

    // Moon transfer: size and fuel-check the TLI burn.
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
    state.phase = PHASES.TLI_BURN;
    state.plannedDeltaV = tliDv;
    state.burnType = 'prograde';
    return { success: true };
}

export function cancel() {
    stopAllBurns();
    state.active = false;
    state.phase = PHASES.IDLE;
    state.plannedDeltaV = 0;
    state.accumulatedDeltaV = 0;
    state.remainingDv = 0;
    state.burnType = '';
}

export function update(dt, pos, vel, moonPos) {
    if (!state.active) return;

    const distToMoon = dist(pos.x, pos.y, moonPos.x, moonPos.y);

    switch (state.phase) {
        case PHASES.TLI_BURN:
            setBurn('prograde');
            accumulateDv(dt);
            state.remainingDv = Math.max(0, state.plannedDeltaV - state.accumulatedDeltaV);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                stopAllBurns();
                state.phase = PHASES.COAST;
                state.coastFrames = 0;
            }
            break;

        case PHASES.COAST:
            stopAllBurns();
            state.coastFrames++;
            if (distToMoon < 4.0) {
                state.phase = PHASES.APPROACH;
                state.closestApproach = distToMoon;
                state.periapsisReached = false;
            }
            if (state.coastFrames > 80000) {
                state.abortReason = 'TRAJECTORY MISS';
                cancel();
            }
            break;

        case PHASES.APPROACH: {
            if (distToMoon < state.closestApproach) {
                state.closestApproach = distToMoon;
            } else if (!state.periapsisReached && state.closestApproach < 3.0) {
                state.periapsisReached = true;
                if (state.closestApproach < MOON_RADIUS + 0.1) {
                    state.abortReason = 'PERIAPSIS TOO LOW';
                    cancel();
                    break;
                }
                // Brake toward a bound orbit; CIRCULARIZE then cleans it up.
                const relVel = getRelativeVelocity(vel, moonPos);
                const relSpeed = mag(relVel.x, relVel.y);
                const targetSpeed = Math.sqrt(params.G * bodies.moon.m / distToMoon);
                state.plannedDeltaV = Math.max(0, relSpeed - targetSpeed);
                state.accumulatedDeltaV = 0;
                state.phase = PHASES.LOI_BURN;
            }
            if (distToMoon > 6.0 && state.closestApproach < distToMoon) {
                state.abortReason = 'FLYBY - no capture';
                cancel();
            }
            break;
        }

        case PHASES.LOI_BURN: {
            const relVel = getRelativeVelocity(vel, moonPos);
            const relSpeed = mag(relVel.x, relVel.y);

            if (relSpeed > 0.001) {
                // Thrust to oppose relative motion using whichever control axis
                // best aligns with -relVel.
                const velDir = normalize(vel.x, vel.y);
                const relDir = normalize(relVel.x, relVel.y);
                const negRelDir = { x: -relDir.x, y: -relDir.y };

                const dotRetro = (-velDir.x) * negRelDir.x + (-velDir.y) * negRelDir.y;
                const dotNormPos = (-velDir.y) * negRelDir.x + (velDir.x) * negRelDir.y;
                const dotNormNeg = (velDir.y) * negRelDir.x + (-velDir.x) * negRelDir.y;
                const dotPro = velDir.x * negRelDir.x + velDir.y * negRelDir.y;

                const maxDot = Math.max(dotRetro, dotNormPos, dotNormNeg, dotPro);
                if (maxDot === dotRetro) setBurn('retrograde');
                else if (maxDot === dotNormPos) setBurn('normal+');
                else if (maxDot === dotNormNeg) setBurn('normal-');
                else setBurn('prograde');
            } else {
                stopAllBurns();
            }

            accumulateDv(dt);
            state.remainingDv = Math.max(0, state.plannedDeltaV - state.accumulatedDeltaV);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                stopAllBurns();
                state.phase = PHASES.CIRCULARIZE;
            }
            break;
        }

        case PHASES.CIRCULARIZE: {
            const body = getNearestBody(pos, bodies);
            if (!body) { finishOrbit(); break; }

            const { errAlong, errPerp, errMag } = circularizationError(pos, vel, body, params.G);
            state.remainingDv = errMag;

            const mass = rocketParams.dryMass + rocketParams.fuelMass;
            const dvPerFrame = mass > 0 ? (rocketParams.thrust / mass) * dt : 0;
            const deadband = Math.max(dvPerFrame * 1.5, 1e-4);

            if (errMag <= deadband) { finishOrbit(); break; }

            const gate = deadband * 0.3;
            controls.prograding = errAlong > gate;
            controls.retrograding = errAlong < -gate;
            controls.normalPos = errPerp > gate;
            controls.normalNeg = errPerp < -gate;
            state.burnType = controls.prograding ? 'prograde'
                : controls.retrograding ? 'retrograde'
                    : controls.normalPos ? 'normal+'
                        : controls.normalNeg ? 'normal-' : '';
            break;
        }

        case PHASES.ORBIT_ACHIEVED:
            stopAllBurns();
            if (Date.now() - state.orbitAchievedTime > 3000) {
                state.active = false;
                state.phase = PHASES.IDLE;
                state.burnType = '';
            }
            break;
    }

    // Fuel exhaustion safety during powered phases.
    if (rocketParams.fuelMass <= 0 &&
        (state.phase === PHASES.TLI_BURN || state.phase === PHASES.LOI_BURN || state.phase === PHASES.CIRCULARIZE)) {
        state.abortReason = 'FUEL EXHAUSTED';
        cancel();
    }
}

function finishOrbit() {
    stopAllBurns();
    state.phase = PHASES.ORBIT_ACHIEVED;
    state.orbitAchievedTime = Date.now();
    state.remainingDv = 0;
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
