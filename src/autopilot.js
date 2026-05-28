// ── Autopilot System ──────────────────────────────────────────────────────────
// Guides the spacecraft from Earth orbit to lunar orbit.
// Key improvement: burns toward the Moon's predicted intercept position,
// not just blindly prograde.

import { controls, params, rocketParams, bodies } from './maneuver.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const MOON_VISUAL_RADIUS = 0.4;
const MOON_SOI_RADIUS = 2.5; // Larger SOI for reliable capture detection
const EARTH_MOON_DISTANCE = 15;

// ── State Machine Phases ──────────────────────────────────────────────────────
export const PHASES = {
    IDLE: 'IDLE',
    TLI_BURN: 'TLI_BURN',
    COAST_TO_MOON: 'COAST_TO_MOON',
    LOI_BURN: 'LOI_BURN',
    ORBIT_ACHIEVED: 'ORBIT_ACHIEVED',
};

// ── Autopilot State ───────────────────────────────────────────────────────────
const state = {
    active: false,
    phase: PHASES.IDLE,
    targetOrbitType: 'circular',
    plannedDeltaV: 0,
    accumulatedDeltaV: 0,
    burnDirection: { x: 0, y: 0 }, // unit vector for burn direction
    orbitAchievedTime: 0,
    abortReason: '',
    coastFrames: 0, // frames spent coasting (timeout safety)
};

// ── Getters ───────────────────────────────────────────────────────────────────
export function getPhase() { return state.phase; }
export function isActive() { return state.active; }
export function getAbortReason() { return state.abortReason; }

export function getTelemetry() {
    if (!state.active && state.phase === PHASES.IDLE) {
        return { phaseText: '—', remainingDv: 0 };
    }
    const remaining = Math.max(0, state.plannedDeltaV - state.accumulatedDeltaV);
    let phaseText = state.phase;
    if (state.phase === PHASES.ORBIT_ACHIEVED) phaseText = 'ORBIT ACHIEVED ✓';
    return { phaseText, remainingDv: remaining };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mag(x, y) { return Math.sqrt(x * x + y * y); }
function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2); }
function normalize(x, y) { const m = mag(x, y); return m > 0 ? { x: x / m, y: y / m } : { x: 0, y: 1 }; }

function computeAvailableDeltaV() {
    const mWet = rocketParams.dryMass + rocketParams.fuelMass;
    const mDry = rocketParams.dryMass;
    if (mDry <= 0 || mWet <= mDry) return 0;
    return rocketParams.Isp * Math.log(mWet / mDry);
}

/**
 * Predict where the Moon will be after a given time.
 * Moon orbits at omega rate of -0.0001 per sim frame.
 * Each frame = dt seconds of sim time.
 */
function predictMoonPosition(framesAhead) {
    const futureOmega = -0.0001 * framesAhead; // relative change
    const currentAngle = Math.atan2(
        bodies.moon.pos.y - bodies.earth.pos.y,
        bodies.moon.pos.x - bodies.earth.pos.x
    );
    const futureAngle = currentAngle + futureOmega;
    return {
        x: bodies.earth.pos.x + EARTH_MOON_DISTANCE * Math.cos(futureAngle),
        y: bodies.earth.pos.y + EARTH_MOON_DISTANCE * Math.sin(futureAngle),
    };
}

/**
 * Compute TLI burn. Instead of a simple Hohmann, aim toward where the Moon
 * will be when we arrive. The burn direction points from the spacecraft
 * toward the predicted intercept point, tangent to the orbit for efficiency.
 */
function computeTLI(pos, vel) {
    const earthPos = bodies.earth.pos;
    const r = dist(pos.x, pos.y, earthPos.x, earthPos.y);
    const vCurrent = mag(vel.x, vel.y);

    // Estimate transfer time: half-period of transfer orbit
    // T/2 = pi * sqrt(a^3 / (G*M))
    const a = (r + EARTH_MOON_DISTANCE) / 2;
    const transferTime = Math.PI * Math.sqrt(a * a * a / (params.G * bodies.earth.m));
    const framesAhead = Math.round(transferTime / params.dt);

    // Predict Moon position at arrival
    const moonFuture = predictMoonPosition(framesAhead);

    // Direction from spacecraft to predicted Moon position
    const toMoon = normalize(moonFuture.x - pos.x, moonFuture.y - pos.y);

    // Blend between prograde (efficient) and toward-Moon (accurate)
    // Use mostly prograde for the burn but bias toward Moon direction
    const prograde = normalize(vel.x, vel.y);
    const blendFactor = 0.35; // 35% toward Moon, 65% prograde
    const burnDir = normalize(
        prograde.x * (1 - blendFactor) + toMoon.x * blendFactor,
        prograde.y * (1 - blendFactor) + toMoon.y * blendFactor
    );

    // Delta-v via vis-viva
    const vTransfer = Math.sqrt(params.G * bodies.earth.m * (2 / r - 1 / a));
    const dv = Math.max(0, vTransfer - vCurrent);

    return { dv, burnDir, framesAhead };
}

/**
 * Compute LOI burn to capture into lunar orbit.
 * Burns retrograde relative to Moon to reduce relative velocity.
 */
function computeLOI(pos, vel, moonPos) {
    const rFromMoon = dist(pos.x, pos.y, moonPos.x, moonPos.y);

    // Moon velocity (tangent to its orbit around Earth)
    const moonOrbitalSpeed = Math.sqrt(params.G * bodies.earth.m / EARTH_MOON_DISTANCE);
    const moonAngle = Math.atan2(moonPos.y - bodies.earth.pos.y, moonPos.x - bodies.earth.pos.x);
    const moonVx = -moonOrbitalSpeed * Math.sin(moonAngle);
    const moonVy = moonOrbitalSpeed * Math.cos(moonAngle);

    // Relative velocity to Moon
    const relVx = vel.x - moonVx;
    const relVy = vel.y - moonVy;
    const relSpeed = mag(relVx, relVy);

    // Target speed depends on orbit type
    let targetSpeed;
    if (state.targetOrbitType === 'nrho') {
        // NRHO: highly elliptical, keep more speed
        const targetPerilune = 1.5 * MOON_VISUAL_RADIUS;
        const e = 0.9;
        const sma = targetPerilune / (1 - e);
        targetSpeed = Math.sqrt(params.G * bodies.moon.m * (2 / rFromMoon - 1 / sma));
    } else {
        // Circular orbit at current distance from Moon
        targetSpeed = Math.sqrt(params.G * bodies.moon.m / rFromMoon);
    }

    const dv = Math.max(0, relSpeed - targetSpeed);

    // Burn direction: opposite to relative velocity (retrograde relative to Moon)
    const burnDir = normalize(-relVx, -relVy);

    return { dv, burnDir };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function engage(orbitType, pos, vel) {
    if (state.active) return { success: false, reason: 'Already active' };

    state.targetOrbitType = orbitType || 'circular';
    state.abortReason = '';

    const { dv: tliDv, burnDir } = computeTLI(pos, vel);
    const available = computeAvailableDeltaV();

    // Need at least enough for TLI + estimated LOI
    const totalEstimate = tliDv * 1.8;
    if (available < totalEstimate * 0.5) {
        state.abortReason = `LOW ΔV: ~${totalEstimate.toFixed(1)} needed, ${available.toFixed(1)} available`;
        return { success: false, reason: state.abortReason };
    }

    state.active = true;
    state.phase = PHASES.TLI_BURN;
    state.plannedDeltaV = tliDv;
    state.accumulatedDeltaV = 0;
    state.burnDirection = burnDir;
    state.coastFrames = 0;

    return { success: true };
}

export function cancel() {
    controls.prograding = false;
    controls.retrograding = false;
    state.active = false;
    state.phase = PHASES.IDLE;
    state.plannedDeltaV = 0;
    state.accumulatedDeltaV = 0;
    state.abortReason = '';
}

export function update(dt, pos, vel, moonPos) {
    if (!state.active) return;

    switch (state.phase) {
        case PHASES.TLI_BURN:
            applyDirectionalBurn(dt, vel);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                controls.prograding = false;
                controls.retrograding = false;
                state.phase = PHASES.COAST_TO_MOON;
                state.accumulatedDeltaV = 0;
                state.coastFrames = 0;
            }
            break;

        case PHASES.COAST_TO_MOON: {
            controls.prograding = false;
            controls.retrograding = false;
            state.coastFrames++;

            const distToMoon = dist(pos.x, pos.y, moonPos.x, moonPos.y);

            // Check Moon SOI entry
            if (distToMoon < MOON_SOI_RADIUS) {
                const { dv, burnDir } = computeLOI(pos, vel, moonPos);
                state.plannedDeltaV = dv;
                state.accumulatedDeltaV = 0;
                state.burnDirection = burnDir;
                state.phase = PHASES.LOI_BURN;
                break;
            }

            // Safety timeout: if we've been coasting too long without reaching Moon,
            // the trajectory missed. Abort.
            if (state.coastFrames > 50000) {
                state.abortReason = 'TRAJECTORY MISS — Moon not reached';
                state.active = false;
                state.phase = PHASES.IDLE;
            }
            break;
        }

        case PHASES.LOI_BURN:
            applyDirectionalBurn(dt, vel);
            if (state.accumulatedDeltaV >= state.plannedDeltaV) {
                controls.prograding = false;
                controls.retrograding = false;
                state.phase = PHASES.ORBIT_ACHIEVED;
                state.orbitAchievedTime = Date.now();
            }
            break;

        case PHASES.ORBIT_ACHIEVED:
            if (Date.now() - state.orbitAchievedTime > 3000) {
                state.active = false;
                state.phase = PHASES.IDLE;
                state.plannedDeltaV = 0;
                state.accumulatedDeltaV = 0;
            }
            break;
    }

    // Safety: fuel exhaustion
    if (rocketParams.fuelMass <= 0 &&
        (state.phase === PHASES.TLI_BURN || state.phase === PHASES.LOI_BURN)) {
        controls.prograding = false;
        controls.retrograding = false;
        state.abortReason = 'FUEL EXHAUSTED';
        state.active = false;
        state.phase = PHASES.IDLE;
    }
}

/**
 * Apply thrust in the computed burn direction.
 * Uses prograde/retrograde flags based on alignment with velocity.
 */
function applyDirectionalBurn(dt, vel) {
    const vDir = normalize(vel.x, vel.y);
    // Dot product to determine if burn is mostly prograde or retrograde
    const dot = state.burnDirection.x * vDir.x + state.burnDirection.y * vDir.y;

    if (dot >= 0) {
        controls.prograding = true;
        controls.retrograding = false;
    } else {
        controls.retrograding = true;
        controls.prograding = false;
    }

    // Accumulate delta-v
    const mass = rocketParams.dryMass + rocketParams.fuelMass;
    if (mass > 0 && rocketParams.fuelMass > 0) {
        state.accumulatedDeltaV += (rocketParams.thrust / mass) * dt;
    }
}
