import * as PARAMS from './control_params';

export const controls = {
    retrograding: false,
    prograding: false,
};

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function acc(pos, objects_pos) {
    let ax = 0;
    let ay = 0;
    for (const body of Object.values(objects_pos)) {
        if (body.m == 0) {
            continue;
        }
        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;

        const dist = distance(body.pos.x, body.pos.y, pos.x, pos.y);

        const factor = (PARAMS.params.G * body.m) / dist ** 3;

        ax += factor * dx;
        ay += factor * dy;
    }
    return { ax, ay };
}

export let omega = 0; // moons rotation around the sun

let r = PARAMS.r;
let v = PARAMS.v;
let bodies = PARAMS.bodies;
let dt = PARAMS.params.dt;
let R = PARAMS.R;

/**
 * Advances the spacecraft simulation by one timestep
 * using Velocity Verlet integration.
 *
 * @returns {{
 *  x:number,
 *  y:number,
 *  theta:number,
 *  vx:number,
 *  vy:number,
 *  moonx:number,
 *  moony:number
 * }}
 */
export function step() {
    // accn
    const { ax: ax_old, ay: ay_old } = acc(r, bodies);

    // position update
    r.x += v.x * dt + 0.5 * ax_old * dt ** 2;
    r.y += v.y * dt + 0.5 * ay_old * dt ** 2;

    // new accn
    const { ax: ax_new, ay: ay_new } = acc(r, bodies);

    // velocity update
    v.x += 0.5 * (ax_old + ax_new) * dt;
    v.y += 0.5 * (ay_old + ay_new) * dt;

    // orientation
    const theta = Math.atan2(v.y, v.x);

    // prograde retrograde upgrade
    if (controls.prograding == true) {
        prograde();
    }
    if (controls.retrograding == true) {
        retrograde();
    }

    // moon rotation
    bodies.moon.pos.x = bodies.earth.pos.x + R * Math.cos(omega + Math.PI / 3);
    bodies.moon.pos.y = bodies.earth.pos.y + R * Math.sin(omega + Math.PI / 3);
    omega -= 0.0001;

    return {
        x: r.x,
        y: r.y,
        theta: theta,
        vx: v.x,
        vy: v.y,
        ax: ax_new,
        ay: ay_new,
        moonx: bodies.moon.pos.x,
        moony: bodies.moon.pos.y,
        dt: dt,
    };
}

// Prograde and Retrograde

let dv = 0.01;
export function prograde() {
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);
    v.x += dv * (v.x / speed);
    v.y += dv * (v.y / speed);
}
export function retrograde() {
    const speed = Math.sqrt(v.x ** 2 + v.y ** 2);

    v.x -= dv * (v.x / speed);
    v.y -= dv * (v.y / speed);
}
