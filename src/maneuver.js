import GUI from 'lil-gui'

const params = {
    G: 1, // Graviational constant in ARBITRARY UNITS
    dt: 0.03, // TIME SCALE
    moonMass: 20 / 81,
};

const gui = new GUI();

gui.add(params, 'G', 0, 20, 0.1);

gui.add(params, 'dt', 0.001, 0.05, 0.001);

gui.add(params, 'moonMass', 0.01, 1, 0.01); // mass of earth is 1


let r = { x: -3, y: -2, z: 0 } // postion and velocities
let v = { x: 1 / Math.sqrt(2), y: 0, z: 0 }
let R=15 //distance between earth and moon
let bodies = {
    earth: { m: 1, pos: { x: -3, y: -4, z: 0 } },
    moon: { m: params.moonMass, pos: { x: 6, y: 8, z: 0 } }
} //artifically increase moons pull for now
export { bodies }
export { v }
export { r }
export { params }

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

let prograding = false;
let retrograding = false;

let omega=0;

//UI little bit
let vel=document.getElementById('velocity');
let accn=document.getElementById('acceleration');

// Implementing velocity verlet algorithm which is a symplectic integrator
export function step() {

    // accn
    const { ax: ax_old, ay: ay_old } = acc(r);

    // position update
    r.x += v.x * params.dt + 0.5 * ax_old * params.dt * params.dt;
    r.y += v.y * params.dt + 0.5 * ay_old * params.dt * params.dt;

    // new accn
    const { ax: ax_new, ay: ay_new } = acc(r);
    accn.innerText=Math.sqrt(ax_new**2+ay_new**2).toFixed(2);

    // velocity update
    v.x += 0.5 * (ax_old + ax_new) * params.dt;
    v.y += 0.5 * (ay_old + ay_new) * params.dt;
    vel.innerText=Math.sqrt(v.x**2+v.y**2).toFixed(2)

    // orientation
    const theta = Math.atan2(v.y, v.x);

    // prograde retrograde upgrade
    if (prograding == true) {
        prograde();

    }
    if (retrograding == true) {
        retrograde();
    }

    // moon rotation
    bodies.moon.pos.x = bodies.earth.pos.x + R * Math.cos(omega+Math.PI/3);
    bodies.moon.pos.y = bodies.earth.pos.y + R * Math.sin(omega+Math.PI/3);
    omega-=0.0001

    return {
        x: r.x,
        y: r.y,
        theta: theta,
        vx: v.x,
        vy: v.y,
        moonx:bodies.moon.pos.x,
        moony:bodies.moon.pos.y
    };
}

// Prograde and Retrograde 

let dv = 0.002;
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

// UI
const probtn = document.getElementById('prograde');
probtn.addEventListener('pointerdown', (event) => {
    prograding = true;
})

probtn.addEventListener('pointerup', (event) => {
    prograding = false;
})

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        // Prevent the default behavior (like scrolling down)
        event.preventDefault();
        prograding = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        prograding = false;
    }
});

window.addEventListener('keydown', (event) => {
    if (event.code === 'ShiftLeft') {
        event.preventDefault();
        retrograding = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.code === 'ShiftLeft') {
        event.preventDefault();
        retrograding = false;
    }
});

const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('pointerdown', (event) => {
    retrograding = true;
})

retrobtn.addEventListener('pointerup', (event) => {
    retrograding = false;
})

