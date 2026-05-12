let r = { x:-3, y: -2, z: 0 } // postion and velocities
let v = { x: 2, y: 0, z: 0 }
let theta = 0;
let G = 7; // gravitational constant times mass ARBITRARY UNITS
let dt = 0.01 // time step

let bodies = {
    earth: { m: 1, pos: { x: -3, y: -4, z: 0 } },
    moon: { m: 20 / 81, pos: { x: 6, y: 8, z: 0 } }
} //artifically increase moons pull for now
export {bodies}

function distance(x1, y1, z1, x2, y2, z2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2)
}

function acc(pos) {

    let ax = 0;
    let ay = 0;

    for (const body of Object.values(bodies)) {

        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;

        const dist = Math.sqrt(dx * dx + dy * dy);

        const factor = G * body.m / (dist ** 3);

        ax += factor * dx;
        ay += factor * dy;
    }

    return { ax, ay };
}
// Implementing velocity verlet algorithm which is a symplectic integrator
export function step() {

    // accn
    const { ax: ax_old, ay: ay_old } = acc(r);

    // position update
    r.x += v.x * dt + 0.5 * ax_old * dt * dt;
    r.y += v.y * dt + 0.5 * ay_old * dt * dt;

    // new accn
    const { ax: ax_new, ay: ay_new } = acc(r);

    // velocity update
    v.x += 0.5 * (ax_old + ax_new) * dt;
    v.y += 0.5 * (ay_old + ay_new) * dt;

    // orientation
    const theta = Math.atan2(v.y, v.x);

    return {
        x: r.x,
        y: r.y,
        theta: theta,
        vx: v.x,
        vy: v.y
    };
}

// Prograde and Retrograde 

let dv = 0.2;
function prograde() {

    const speed =
        Math.sqrt(v.x ** 2 + v.y ** 2);
    v.x += dv * (v.x / speed);
    v.y += dv * (v.y / speed);
}
function retrograde() {

    const speed =
        Math.sqrt(v.x ** 2 + v.y ** 2);

    v.x -= dv * (v.x / speed);
    v.y -= dv * (v.y / speed);
}


const probtn = document.getElementById('prograde');
probtn.addEventListener('click', (event) => {
    prograde();
})

const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('click', (event) => {
    retrograde();
})