import * as THREE from 'three';

// Hohmann Transfer Visualization
//
// Draws the transfer ellipse the autopilot uses to reach the Moon: an ellipse
// with its focus at Earth, periapsis grazing the spacecraft's current orbit and
// apoapsis touching the Moon's orbit. Also drawn: a faint circle for the Moon's
// orbit (the target) and a marker at apoapsis (the lunar intercept point) — so
// it's visible how the burn raises apoapsis from one circle out to the other.

const SEGMENTS = 160;
const EARTH_MOON_R = 15; // must match maneuver.js / autopilot.js

let group = null;
let transferGeom = null;
let transferLine = null;
let targetGeom = null;
let targetCircle = null;
let apoMarker = null;
let visible = false;

function makeDashedLine(color, opacity, dashSize, gapSize) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3));
    const line = new THREE.Line(
        geom,
        new THREE.LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity }),
    );
    return { geom, line };
}

export function initHohmann(scene) {
    group = new THREE.Group();

    ({ geom: transferGeom, line: transferLine } = makeDashedLine(0xffaa33, 0.95, 0.4, 0.25));
    group.add(transferLine);

    ({ geom: targetGeom, line: targetCircle } = makeDashedLine(0x4488ff, 0.4, 0.3, 0.4));
    group.add(targetCircle);

    apoMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 }),
    );
    group.add(apoMarker);

    group.visible = false;
    scene.add(group);
}

/**
 * Recompute the ellipse from the spacecraft's current position. Periapsis sits
 * at the current orbit radius (in the current direction); apoapsis sits at the
 * Moon's orbital radius on the opposite side.
 */
export function updateHohmann(craftPos, earthPos) {
    if (!group || !visible) return;

    const r1 = Math.hypot(craftPos.x - earthPos.x, craftPos.y - earthPos.y);
    const r2 = EARTH_MOON_R;
    const a = (r1 + r2) / 2;
    const e = Math.abs(r2 - r1) / (r2 + r1);
    const theta0 = Math.atan2(craftPos.y - earthPos.y, craftPos.x - earthPos.x); // periapsis direction

    // Transfer ellipse (focus at Earth, periapsis at the craft).
    const tp = transferGeom.attributes.position.array;
    for (let i = 0; i <= SEGMENTS; i++) {
        const nu = (i / SEGMENTS) * Math.PI * 2; // true anomaly from periapsis
        const rOrbit = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
        const ang = theta0 + nu;
        tp[i * 3] = earthPos.x + rOrbit * Math.cos(ang);
        tp[i * 3 + 1] = earthPos.y + rOrbit * Math.sin(ang);
        tp[i * 3 + 2] = 0;
    }
    transferGeom.attributes.position.needsUpdate = true;
    transferGeom.setDrawRange(0, SEGMENTS + 1);
    transferLine.computeLineDistances();

    // Target circle = Moon's orbit.
    const cp = targetGeom.attributes.position.array;
    for (let i = 0; i <= SEGMENTS; i++) {
        const ang = (i / SEGMENTS) * Math.PI * 2;
        cp[i * 3] = earthPos.x + r2 * Math.cos(ang);
        cp[i * 3 + 1] = earthPos.y + r2 * Math.sin(ang);
        cp[i * 3 + 2] = 0;
    }
    targetGeom.attributes.position.needsUpdate = true;
    targetGeom.setDrawRange(0, SEGMENTS + 1);
    targetCircle.computeLineDistances();

    // Apoapsis (lunar intercept), opposite the periapsis.
    apoMarker.position.set(
        earthPos.x + r2 * Math.cos(theta0 + Math.PI),
        earthPos.y + r2 * Math.sin(theta0 + Math.PI),
        0,
    );
}

export function show() {
    visible = true;
    if (group) group.visible = true;
}

export function hide() {
    visible = false;
    if (group) group.visible = false;
}

export function toggle() {
    if (visible) hide();
    else show();
    return visible;
}

export function isVisible() {
    return visible;
}
