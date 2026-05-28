// ── Orbit Circularization Module ──────────────────────────────────────────────

/**
 * Task 9.1: Compute the delta-v needed to circularize the current orbit.
 * Positive = prograde burn needed, negative = retrograde.
 */
export function computeCircularizationDeltaV(pos, vel, bodyPos, bodyMass, G) {
    const dx = pos.x - bodyPos.x;
    const dy = pos.y - bodyPos.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    const vCircular = Math.sqrt(G * bodyMass / r);
    const vCurrent = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    return vCircular - vCurrent; // positive = need to speed up (prograde)
}

/**
 * Task 9.2: Determine which body has the strongest gravitational pull at the current position.
 * Returns the body object { m, pos } that dominates, or null if none found.
 */
export function getDominantBody(pos, bodies, G) {
    let maxAcc = 0;
    let dominant = null;
    for (const body of Object.values(bodies)) {
        if (body.m === 0) continue;
        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 0.01) continue;
        const acc = G * body.m / (r * r);
        if (acc > maxAcc) {
            maxAcc = acc;
            dominant = body;
        }
    }
    return dominant;
}

/**
 * Task 9.5: Compute orbital eccentricity for the current orbit around a body.
 */
export function computeEccentricity(pos, vel, bodyPos, bodyMass, G) {
    const r_vec = { x: pos.x - bodyPos.x, y: pos.y - bodyPos.y };
    const r = Math.sqrt(r_vec.x ** 2 + r_vec.y ** 2);
    const v = Math.sqrt(vel.x ** 2 + vel.y ** 2);
    const mu = G * bodyMass;
    const energy = (v * v) / 2 - mu / r;
    const h = r_vec.x * vel.y - r_vec.y * vel.x; // angular momentum (scalar, 2D)
    const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
    return Math.abs(e);
}

/**
 * Task 9.3 & 9.4: CircularizationController
 * Manages the burn execution for orbit circularization.
 */
export class CircularizationController {
    constructor() {
        this.active = false;
        this.completed = false;
        this.targetDv = 0;
        this.accumulatedDv = 0;
        this.burnDirection = null; // 'prograde' or 'retrograde'
        this.fuelExhausted = false;
    }

    /**
     * Start a circularization burn.
     * @param {object} pos - spacecraft position {x, y}
     * @param {object} vel - spacecraft velocity {x, y}
     * @param {object} bodies - celestial bodies map
     * @param {object} params - simulation params (G, dt, etc.)
     * @param {object} rocketParams - rocket config (thrust, Isp, fuelMass, dryMass)
     * @param {object} controls - burn control flags (prograding, retrograding)
     */
    start(pos, vel, bodies, params, rocketParams, controls) {
        const dominant = getDominantBody(pos, bodies, params.G);
        if (!dominant) return;

        const dv = computeCircularizationDeltaV(pos, vel, dominant.pos, dominant.m, params.G);

        this.targetDv = Math.abs(dv);
        this.accumulatedDv = 0;
        this.burnDirection = dv >= 0 ? 'prograde' : 'retrograde';
        this.active = true;
        this.completed = false;
        this.fuelExhausted = false;

        // Set initial burn direction
        if (this.burnDirection === 'prograde') {
            controls.prograding = true;
            controls.retrograding = false;
        } else {
            controls.prograding = false;
            controls.retrograding = true;
        }
    }

    /**
     * Called each frame while the burn is active.
     * Accumulates applied delta-v and checks completion.
     * @param {number} dt - time step
     * @param {object} rocketParams - rocket config (thrust, Isp, fuelMass, dryMass)
     * @param {object} controls - burn control flags
     * @returns {object} status { active, completed, accumulatedDv, targetDv, fuelExhausted }
     */
    update(dt, rocketParams, controls) {
        if (!this.active) {
            return this._status();
        }

        // Check if fuel is exhausted (Task 9.4)
        if (rocketParams.fuelMass <= 0) {
            this.fuelExhausted = true;
            this.active = false;
            controls.prograding = false;
            controls.retrograding = false;
            return this._status();
        }

        // Compute dv applied this frame: dv = (thrust / mass) * dt
        const mass = rocketParams.dryMass + rocketParams.fuelMass;
        if (mass <= 0) {
            this.fuelExhausted = true;
            this.active = false;
            controls.prograding = false;
            controls.retrograding = false;
            return this._status();
        }

        const dvThisFrame = (rocketParams.thrust / mass) * dt;
        this.accumulatedDv += dvThisFrame;

        // Check if burn is complete
        if (this.accumulatedDv >= this.targetDv) {
            this.active = false;
            this.completed = true;
            controls.prograding = false;
            controls.retrograding = false;
            return this._status();
        }

        // Keep burning in the correct direction
        if (this.burnDirection === 'prograde') {
            controls.prograding = true;
            controls.retrograding = false;
        } else {
            controls.prograding = false;
            controls.retrograding = true;
        }

        return this._status();
    }

    /**
     * Cancel the burn immediately.
     * @param {object} controls - burn control flags
     */
    cancel(controls) {
        this.active = false;
        this.completed = false;
        controls.prograding = false;
        controls.retrograding = false;
    }

    _status() {
        return {
            active: this.active,
            completed: this.completed,
            accumulatedDv: this.accumulatedDv,
            targetDv: this.targetDv,
            fuelExhausted: this.fuelExhausted,
            remainingDv: this.targetDv - this.accumulatedDv,
        };
    }
}
