// ── Autopilot System ──────────────────────────────────────────────────────────
// Lunar orbit insertion via powered flyby capture.
//
// Strategy (how NASA actually does it):
// 1. TLI: Prograde burn to raise apoapsis toward Moon's orbit
// 2. Coast: Free-fall toward Moon, gravity does the work
// 3. Course correction: Small normal burns to ensure periapsis altitude is safe
// 4. LOI: At closest approach (periapsis), burn retrograde RELATIVE TO MOON
//    to capture into orbit. At periapsis velocity is tangential, so retrograde
//    slows into a bound orbit without crashing.
//
// Key insight: We aim for a periapsis ALTITUDE (not the Moon center).
// The LOI burn happens at periapsis where velocity is tangential.

import { controls, params, rocketParams, bodies } from './maneuver.js';

const MOON_RADIUS = 0.4;
const EARTH_MOON_R = 15;
const TARGET_PERIAPSIS = MOON_RADIUS + 0.5; // Fly past at 0.5 units above surface

export const PHASES = {
    IDLE: 'IDLE',
    TLI_BURN: 'TLI_BURN',
    COAST: 'COAST',
    APPROACH: 'APPROACH',       // Inside Moon SOI, monitoring periapsis
    LOI_BURN: 'LOI_BURN',       // Retrograde burn at periapsis
    ORBIT_ACHIEVED: 'ORBIT_ACHIEVED',
};

const state = {
    active: false,
    phase: PHASES.IDLE,
    targetOrbitType: 'circular',
    burnType: '',               // 'prograde' | 'retrograde' | 'normal+' | 'normal-'
    plannedDeltaV: 0,
    accumulatedDeltaV: 0,
    orbitAchievedTime: 0,
    abortReason: '',
    coastFrames: 0,
    closestApproach: Infinity,  // Track closest distance to Moon during approach
    approachPhaseStarted: false,
    periapsisReached: false,
};

// ── Getters ───────────────────────────────────────────────────────────────────
export function getPhase() { return state.phase; }
export function isActive() { return state.active; }
export function getAbortReason() { return state.abortReason; }
export function getBurnType() { return state.burnType; }

export function getTelemetry() {
    if (!state.active && state.phase === PHASES.IDLE) {
        return { phaseText: '—', remainingDv: 0 };
    }
    const remaining = Math.max(0, state.plannedDeltaV - state.accumulatedDeltaV);
    let phaseText = state.phase;
    if (state.phase === PHASES.ORBIT_ACHIEVED) phaseText = 'ORBIT ACHIEVED ✓';
    if (state.phase === PHASES.COAST) phaseText = `COAST (${state.coastFrames})`;
    return { phaseText, remainingDv: remaining };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function mag(x, y) { return Math.sqrt(x * x + y * y); }
function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2); }
function normalize(x, y) { const m = mag(x, y); return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 1 }; }

function getMoonVelocity(moonPos) {
    // Moon orbital velocity (tangent to circular orbit around Earth)
    const moonSpeed = Math.sqrt(params.G * bodies.earth.m / EARTH_MOON_R);
    const angle = Math.atan2(moonPos.y - bodies.earth.pos.y, moonPos.x - bodies.earth.pos.x);
    return {
        x: -moonSpeed * Math.sin(angle),
        y: moonSpeed * Math.cos(angle),
    };
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

// ── Public API ────────────────────────────────────────────────────────────────

export function engage(orbitType, pos, vel) {
    if (state.active) return { success: false, reason: 'Already active' };

    state.targetOrbitType = orbitType || 'circular';
    state.abortReason = '';

    // Compute TLI delta-v
    const earthPos = bodies.earth.pos;
    const r = dist(pos.x, pos.y, earthPos.x, earthPos.y);
    const vCurrent = mag(vel.x, vel.y);

    // Hohmann transfer semi-major axis
    const a = (r + EARTH_MOON_R) / 2;
    const vTransfer = Math.sqrt(params.G * bodies.earth.m * (2 / r - 1 / a));
    const tliDv = Math.max(0, vTransfer - vCurrent);

    // Fuel check
    const available = computeAvailableDv();
    if (available < tliDv * 1.5) {
        state.abortReason = `LOW ΔV: need ~${(tliDv * 1.8).toFixed(1)}, have ${available.toFixed(1)}`;
        return { success: false, reason: state.abortReason };
    }

    state.active = true;
    state.phase = PHASES.TLI_BURN;
    state.plannedDeltaV = tliDv;
    state.accumulatedDeltaV = 0;
    state.burnType = 'prograde';
    state.coastFrames = 0;
    state.closestApproach = Infinity;
    state.periapsisReached = false;

    return { success: true };
}

export function cancel() {
    stopAllBurns();
    state.active = false;
    state.phase = PHASES.IDLE;
    state.plannedDeltaV = 0;
    state.accumulatedDeltaV = 0;
    state.burnType = '';
    state.abortReason = '';
}

export function update(dt, pos, vel, moonPos) {
    if (!state.active) return;

    const distToMoon = dist(pos.x, pos.y, moonPos.x, moonPos.y);

    switch (state.phase) {
        case PHASES.TLI_BURN:
            setBurn('prograde');
            accumulateDv(dt);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                stopAllBurns();
                state.phase = PHASES.COAST;
                state.coastFrames = 0;
            }
            break;

        case PHASES.COAST:
            stopAllBurns();
            state.coastFrames++;

            // Transition to approach when entering Moon's gravitational influence
            if (distToMoon < 4.0) {
                state.phase = PHASES.APPROACH;
                state.closestApproach = distToMoon;
                state.periapsisReached = false;
            }

            // Timeout safety
            if (state.coastFrames > 80000) {
                state.abortReason = 'TRAJECTORY MISS';
                cancel();
            }
            break;

        case PHASES.APPROACH: {
            // Monitor distance to Moon. We're looking for periapsis passage.
            // At periapsis, distance to Moon reaches a local minimum.
            if (distToMoon < state.closestApproach) {
                state.closestApproach = distToMoon;
            } else if (!state.periapsisReached && state.closestApproach < 3.0) {
                // Distance just started increasing — we passed periapsis!
                state.periapsisReached = true;

                // Check if periapsis was too close (would crash)
                if (state.closestApproach < MOON_RADIUS + 0.1) {
                    // Too close, we'll crash. Abort.
                    state.abortReason = 'PERIAPSIS TOO LOW';
                    cancel();
                    break;
                }

                // Compute LOI burn: retrograde relative to Moon to capture
                const relVel = getRelativeVelocity(vel, moonPos);
                const relSpeed = mag(relVel.x, relVel.y);

                // Target orbital speed around Moon at current distance
                let targetSpeed;
                if (state.targetOrbitType === 'nrho') {
                    // NRHO: keep more speed (highly elliptical)
                    const perilune = 1.5 * MOON_RADIUS;
                    const e = 0.85;
                    const sma = perilune / (1 - e);
                    targetSpeed = Math.sqrt(Math.max(0, params.G * bodies.moon.m * (2 / distToMoon - 1 / sma)));
                } else {
                    // Circular orbit at current distance
                    targetSpeed = Math.sqrt(params.G * bodies.moon.m / distToMoon);
                }

                const loiDv = Math.max(0, relSpeed - targetSpeed);
                state.plannedDeltaV = loiDv;
                state.accumulatedDeltaV = 0;
                state.phase = PHASES.LOI_BURN;
            }

            // Safety: if we're too far away now and still haven't found periapsis, we missed
            if (distToMoon > 6.0 && state.closestApproach < distToMoon) {
                state.abortReason = 'FLYBY — no capture';
                cancel();
            }
            break;
        }

        case PHASES.LOI_BURN: {
            // Burn retrograde RELATIVE TO MOON (not spacecraft-relative retrograde)
            const relVel = getRelativeVelocity(vel, moonPos);
            const relSpeed = mag(relVel.x, relVel.y);

            if (relSpeed > 0.001) {
                // Determine if spacecraft-retrograde aligns with Moon-retrograde
                const velDir = normalize(vel.x, vel.y);
                const relDir = normalize(relVel.x, relVel.y);

                // We need to slow our motion relative to Moon.
                // Check which control (retrograde or normal) is most aligned
                // with reducing relative velocity.
                //
                // The ideal thrust direction is -relDir (oppose relative motion).
                // Spacecraft can only thrust along or perpendicular to its velocity.
                //
                // Prograde direction: velDir
                // Retrograde direction: -velDir
                // Normal+ direction: (-velDir.y, velDir.x)
                //
                // Pick whichever has the best dot product with -relDir

                const negRelDir = { x: -relDir.x, y: -relDir.y };

                const dotRetro = (-velDir.x) * negRelDir.x + (-velDir.y) * negRelDir.y;
                const dotNormPos = (-velDir.y) * negRelDir.x + (velDir.x) * negRelDir.y;
                const dotNormNeg = (velDir.y) * negRelDir.x + (-velDir.x) * negRelDir.y;
                const dotPro = velDir.x * negRelDir.x + velDir.y * negRelDir.y;

                const maxDot = Math.max(dotRetro, dotNormPos, dotNormNeg, dotPro);
                if (maxDot === dotRetro) {
                    setBurn('retrograde');
                } else if (maxDot === dotNormPos) {
                    setBurn('normal+');
                } else if (maxDot === dotNormNeg) {
                    setBurn('normal-');
                } else {
                    setBurn('prograde');
                }
            } else {
                stopAllBurns();
            }

            accumulateDv(dt);

            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                stopAllBurns();
                state.phase = PHASES.ORBIT_ACHIEVED;
                state.orbitAchievedTime = Date.now();
            }
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

    // Fuel exhaustion safety
    if (rocketParams.fuelMass <= 0 &&
        (state.phase === PHASES.TLI_BURN || state.phase === PHASES.LOI_BURN)) {
        state.abortReason = 'FUEL EXHAUSTED';
        cancel();
    }
}

// ── Burn Helpers ──────────────────────────────────────────────────────────────

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
