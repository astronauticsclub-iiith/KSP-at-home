import GUI from 'lil-gui'

const params = {
    G: 7, // Graviational constant in ARBITRARY UNITS
    dt: 0.01, // TIME SCALE
    moonMass: 20/81,
    thrust: 0.2
};

const gui = new GUI();

gui.add(params, 'G', 0, 20, 0.1);

gui.add(params, 'params.dt', 0.001, 0.05, 0.001);

gui.add(params, 'moonMass', 0.01, 1, 0.01); // mass of earth is 1


let r = { x:-3, y: -2, z: 0 } // postion and velocities
let v = { x: -2, y: 0, z: 0 }

let bodies = {
    earth: { m: 1, pos: { x: -3, y: -4, z: 0 } },
    moon: { m: params.moonMass, pos: { x: 6, y: 8, z: 0 } }
} //artifically increase moons pull for now
export {bodies}

function distance(x1, y1,x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

function acc(pos) {

    let ax = 0;
    let ay = 0;

    for (const body of Object.values(bodies)) {

        const dx = body.pos.x - pos.x;
        const dy = body.pos.y - pos.y;

        const dist=distance(body.pos.x,body.pos.y,pos.x,pos.y);

        const factor = params.G * body.m / (dist ** 3);

        ax += factor * dx;
        ay += factor * dy;
    }

    return { ax, ay };
}

let prograding=false;
let retrograding=false;

// Implementing velocity verlet algorithm which is a symplectic integrator
export function step() {

    // accn
    const { ax: ax_old, ay: ay_old } = acc(r);

    // position update
    r.x += v.x * params.dt + 0.5 * ax_old * params.dt * params.dt;
    r.y += v.y * params.dt + 0.5 * ay_old * params.dt * params.dt;

    // new accn
    const { ax: ax_new, ay: ay_new } = acc(r);

    // velocity update
    v.x += 0.5 * (ax_old + ax_new) * params.dt;
    v.y += 0.5 * (ay_old + ay_new) * params.dt;

    // orientation
    const theta = Math.atan2(v.y, v.x);
    
    // prograde retrograde upgrade
    if(prograding==true){
        prograde();
    }
    if(retrograding==true){
        retrograde();
    }
    return {
        x: r.x,
        y: r.y,
        theta: theta,
        vx: v.x,
        vy: v.y
    };
}

// Prograde and Retrograde 

let dv = 0.02;
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
probtn.addEventListener('pointerdown', (event) => {
    prograding=true;
})

probtn.addEventListener('pointerup', (event) => {
    prograding=false;
})


const retrobtn = document.getElementById('retrograde');
retrobtn.addEventListener('pointerdown', (event) => {
    retrograding=true;
})

retrobtn.addEventListener('pointerup', (event) => {
    retrograding=false;
})
