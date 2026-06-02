// Orbit Circularization Module

/**
 * Determine which massive body the spacecraft is physically closest to.
 * Circularization targets this body, so flying near the Moon circularizes
 * around the Moon rather than always defaulting to Earth.
 * Returns the body object { m, pos } or null if none found.
 */
export function getNearestBody(pos, bodies) {
    let minDist = Infinity;
    let nearest = null;
    for (const body of Object.values(bodies)) {
        if (body.m === 0) continue;
        const d = Math.hypot(body.pos.x - pos.x, body.pos.y - pos.y);
        if (d < minDist) {
            minDist = d;
            nearest = body;
        }
    }
    return nearest;
}

/**
 * Compute orbital eccentricity for the current orbit around a body.
 */
export function computeEccentricity(pos, vel, bodyPos, bodyMass, G) {
    const r_vec = { x: pos.x - bodyPos.x, y: pos.y - bodyPos.y };
    const r = Math.hypot(r_vec.x, r_vec.y);
    const v = Math.hypot(vel.x, vel.y);
    const mu = G * bodyMass;
    const energy = (v * v) / 2 - mu / r;
    const h = r_vec.x * vel.y - r_vec.y * vel.x; // angular momentum (scalar, 2D)
    const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
    return Math.abs(e);
}

/**
 * Compute the velocity correction needed to circularize the orbit at the
 * current point, RELATIVE to the dominant body.
 *
 * The target is the circular-orbit velocity vector: magnitude sqrt(mu/r), in
 * the current tangential direction, with ZERO radial component. Returning the
 * error decomposed onto the craft's own thrust axes (along velocity and
 * perpendicular to it) lets a controller null both the radial velocity and the
 * tangential speed deficit — i.e. true circularization, not just a speed match.
 *
 * Pass bodyVel to circularize around a MOVING body (the Moon): the target is
 * then bodyVel + circular velocity, so the orbit is circular relative to that
 * body. Defaults to a stationary body (Earth).
 *
 * @returns {{ errAlong:number, errPerp:number, errMag:number }}
 *   errAlong > 0 → burn prograde, < 0 → retrograde.
 *   errPerp  > 0 → burn normal+,  < 0 → normal-.
 */
export function circularizationError(pos, vel, body, G, bodyVel = { x: 0, y: 0 }) {
    const dx = pos.x - body.pos.x;
    const dy = pos.y - body.pos.y;
    const r = Math.hypot(dx, dy);
    const rHat = { x: dx / r, y: dy / r };           // radial unit (outward)
    const vCircular = Math.sqrt(G * body.m / r);

    // Work in the body-relative frame for the tangential direction.
    const rvx = vel.x - bodyVel.x;
    const rvy = vel.y - bodyVel.y;
    const vDotR = rvx * rHat.x + rvy * rHat.y;
    let tx = rvx - vDotR * rHat.x;
    let ty = rvy - vDotR * rHat.y;
    const tMag = Math.hypot(tx, ty);
    if (tMag > 1e-6) {
        tx /= tMag; ty /= tMag;
    } else {
        // No tangential motion (purely radial): pick the counter-clockwise tangent.
        tx = -rHat.y; ty = rHat.x;
    }

    // Target absolute velocity = body velocity + circular velocity. Error to it.
    const ex = (bodyVel.x + vCircular * tx) - vel.x;
    const ey = (bodyVel.y + vCircular * ty) - vel.y;
    const errMag = Math.hypot(ex, ey);

    // Decompose the error onto the craft's control axes (absolute velocity).
    const speed = Math.hypot(vel.x, vel.y);
    let vhx, vhy;
    if (speed > 1e-6) { vhx = vel.x / speed; vhy = vel.y / speed; }
    else { vhx = tx; vhy = ty; }
    const nhx = -vhy, nhy = vhx; // normal+ direction (perpendicular-left to velocity)

    return {
        errAlong: ex * vhx + ey * vhy,
        errPerp: ex * nhx + ey * nhy,
        errMag,
    };
}

/**
 * CircularizationController
 * Closed-loop burn controller for orbit circularization. Each frame it measures
 * the remaining velocity error and thrusts along/perpendicular to velocity to
 * cancel it, so it converges to a circular orbit from any starting point —
 * including ones with significant radial velocity.
 */
export class CircularizationController {
    constructor() {
        this.active = false;
        this.completed = false;
        this.fuelExhausted = false;
        this.targetDv = 0;     // initial error magnitude, for display
        this.remainingDv = 0;  // live error magnitude, for display
    }

    /**
     * Begin circularizing the current orbit.
     * @param {object} pos - spacecraft position {x, y}
     * @param {object} vel - spacecraft velocity {x, y}
     * @param {object} bodies - celestial bodies map
     * @param {object} params - simulation params (G, dt, ...)
     */
    start(pos, vel, bodies, params) {
        const dominant = getNearestBody(pos, bodies);
        if (!dominant) return;

        this.active = true;
        this.completed = false;
        this.fuelExhausted = false;
        this.targetDv = circularizationError(pos, vel, dominant, params.G).errMag;
        this.remainingDv = this.targetDv;
    }

    /**
     * Closed-loop step. Call once per frame while active.
     * @returns {object} status
     */
    update(pos, vel, bodies, params, rocketParams, controls) {
        if (!this.active) return this._status();

        if (rocketParams.fuelMass <= 0) {
            this.fuelExhausted = true;
            this.active = false;
            this._allOff(controls);
            return this._status();
        }

        const dominant = getNearestBody(pos, bodies);
        if (!dominant) {
            this.active = false;
            this._allOff(controls);
            return this._status();
        }

        const { errAlong, errPerp, errMag } = circularizationError(pos, vel, dominant, params.G);
        this.remainingDv = errMag;

        // Size the deadband to the delta-v one frame of full thrust delivers, so
        // we stop instead of chattering once we can no longer improve.
        const mass = rocketParams.dryMass + rocketParams.fuelMass;
        const dvPerFrame = mass > 0 ? (rocketParams.thrust / mass) * params.dt : 0;
        const deadband = Math.max(dvPerFrame * 1.5, 1e-4);

        if (errMag <= deadband) {
            this.active = false;
            this.completed = true;
            this._allOff(controls);
            return this._status();
        }

        // Thrust toward the target velocity. Axes are independent, so prograde/
        // retrograde and a normal burn can run together to correct both at once.
        const gate = deadband * 0.3;
        controls.prograding = errAlong > gate;
        controls.retrograding = errAlong < -gate;
        controls.normalPos = errPerp > gate;
        controls.normalNeg = errPerp < -gate;

        return this._status();
    }

    /**
     * Cancel the burn immediately.
     */
    cancel(controls) {
        this.active = false;
        this.completed = false;
        this._allOff(controls);
    }

    _allOff(controls) {
        controls.prograding = false;
        controls.retrograding = false;
        controls.normalPos = false;
        controls.normalNeg = false;
    }

    _status() {
        return {
            active: this.active,
            completed: this.completed,
            fuelExhausted: this.fuelExhausted,
            targetDv: this.targetDv,
            remainingDv: this.remainingDv,
        };
    }
}
