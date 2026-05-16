import { bodies } from "./maneuver.js";
import { v } from "./maneuver.js";
import { r } from "./maneuver.js";
import { params } from "./maneuver.js";

const pathLen = 2000;

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

function acc(pos) {

    let ax = 0;
    let ay = 0;

    for (const body of Object.values(bodies)) {

        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;

        const dist = distance(body.pos.x, body.pos.y, pos.x, pos.y);

        const factor = params.G * body.m / (dist ** 3);

        ax += factor * dx;
        ay += factor * dy;
    }

    return { ax, ay };
}

// Implementing velocity verlet algorithm which is a symplectic integrator
export function pathStep() {
    const simR = { x: r.x, y: r.y };
    const simV = { x: v.x, y: v.y };

    let path = [];
    for (let i = 0; i < pathLen; i++) {
        // accn
        const { ax: ax_old, ay: ay_old } = acc(simR);

        const dt = 0.1;
        // position update
        simR.x += simV.x * dt + 0.5 * ax_old * dt * dt;
        simR.y += simV.y * dt + 0.5 * ay_old * dt * dt;
        path.push({rx: simR.x, ry: simR.y});
        // new accn
        const { ax: ax_new, ay: ay_new } = acc(simR);

        // velocity update
        simV.x += 0.5 * (ax_old + ax_new) * dt;
        simV.y += 0.5 * (ay_old + ay_new) * dt;
    }
    return path;
}