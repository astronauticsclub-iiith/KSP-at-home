export const WIN_DURATION_SECONDS = 8; // real wall-clock seconds required in orbit zone

/**
 * Mutable win state — exported so main.js can read orbitTimer for the HUD countdown.
 * Automatically resets on page reload (location.reload() on restart).
 */
export let winState = {
    won:         false,
    inOrbitZone: false,
    orbitTimer:  0,      // real seconds accumulated inside the orbit zone
    _startMs:    null,   // internal: wall-clock timestamp of zone entry
};

/**
 * Call every animation frame.
 *
 * Win condition:
 *   pod is within (body.r, orbitRadius) of the destination body,
 *   AND not thrusting,
 *   for WIN_DURATION_SECONDS consecutive real seconds.
 *
 * Any thruster use OR leaving the zone resets the countdown to zero.
 *
 * @param {{ x:number, y:number }} r  - current pod position
 * @param {object}  bodies            - all physics bodies (from control_params)
 * @param {string}  destination       - key name of target body (e.g. 'moon')
 * @param {number}  orbitRadius       - capture radius from level.json
 * @param {boolean} burning           - true if prograde or retrograde is active this frame
 * @returns {boolean} true the moment the win condition is satisfied
 */
export function checkWin(r, bodies, destination, orbitRadius, burning) {
    if (winState.won) return true;

    const dest = bodies[destination];
    if (!dest || dest.m === 0) return false;

    const dx   = r.x - dest.pos.x;
    const dy   = r.y - dest.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Inside orbit radius, above the surface, not thrusting
    const inZone = dist < orbitRadius && dist > dest.r;

    if (!inZone || burning) {
        winState.inOrbitZone = false;
        winState.orbitTimer  = 0;
        winState._startMs    = null;
        return false;
    }

    // Coasting inside the zone tick the countdown
    winState.inOrbitZone = true;
    const now = Date.now();
    if (!winState._startMs) winState._startMs = now;
    winState.orbitTimer = (now - winState._startMs) / 1000;

    if (winState.orbitTimer >= WIN_DURATION_SECONDS) {
        winState.won = true;
        return true;
    }

    return false;
}
