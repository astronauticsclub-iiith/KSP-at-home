/**
 * Score and fuel tracking.
 *
 * Score formula:  score = floor(500_000 / (timeSeconds + fuelUsed * 0.3))
 *
 * Anti-cheat verification (server-side, future):
 *   const expected = Math.floor(500_000 / (doc.timeSeconds + doc.fuelUsed * 0.3));
 *   if (expected !== doc.score) reject();
 *   else db.scores.updateOne({ _id }, { $set: { verified: true } });
 */

const FUEL_WEIGHT = 0.3;
const BASE_SCORE  = 500_000;

// Two-tier fuel cost:
//   BUY_IN_COST       → charged once on pointerdown (in ui.js)
//   HOLD_COST_PER_FRAME → charged each frame while held (in main.js animate loop)
//
// Effect: 10 quick taps (1s) = 10 × 5 = 50 units
//         1s hold           = 5 + (60 × 0.1) = 11 units
// Rewards smooth sustained burns over button mashing.
export const BUY_IN_COST        = 5;
export const HOLD_COST_PER_FRAME = 0.1; // ~6 units / real second at 60 fps

let _fuelUsed = 0;

/** Called on pointerdown — flat activation cost per press */
export function addBuyIn()    { _fuelUsed += BUY_IN_COST; }

/** Called each animation frame while a thruster is held */
export function addHoldCost() { _fuelUsed += HOLD_COST_PER_FRAME; }

export function getFuelUsed() { return _fuelUsed; }

/** Deterministic score — safe to recompute server-side */
export function computeScore(timeSeconds) {
    return Math.floor(BASE_SCORE / (timeSeconds + _fuelUsed * FUEL_WEIGHT));
}

/**
 * Builds the payload sent to POST /api/scores.
 *
 * username     — read from localStorage (set on the landing page login).
 * predictedScore — what the client computed; server recomputes independently
 *                  as actualScore and sets verified = (predicted === actual).
 */
export function buildScorePayload(level, timeSeconds) {
    // Round FIRST, then compute the score from those exact values.
    // The server receives these rounded numbers and recomputes actualScore from them.
    // Using raw floats here would produce a different result → false mismatch.
    const roundedTime = Math.round(timeSeconds * 10) / 10; // 1 decimal place
    const roundedFuel = Math.round(_fuelUsed);

    return {
        username:       localStorage.getItem('ksp_username') || 'anonymous',
        level:          Number(level),
        timeSeconds:    roundedTime,
        fuelUsed:       roundedFuel,
        predictedScore: Math.floor(BASE_SCORE / (roundedTime + roundedFuel * FUEL_WEIGHT)),
    };
}

/** Updates the live score element in the telemetry HUD each frame */
export function updateScoreHUD(timeSeconds) {
    const el = document.getElementById('score');
    if (el) el.innerText = computeScore(timeSeconds).toLocaleString();
}
