let r = { x: 0, y: 2, z: 0 } // postion and velocities
let v = { x: 2, y: 0, z: 0 }
let theta = 0;
let G = 7; // gravitational constant times mass ARBITRARY UNITS
let dt = 0.01 // time step

function distance(x1, y1, z1, x2, y2, z2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2)
}

function acc(r, coord) {
    // d²r/dt²=(−G/r³)r(vec) orbit equation
    return (-G * coord) / r ** 3;
}


export function step() {
    const dist = distance(r.x, r.y, r.z, 0, 0, 0);
    const ax = acc(dist, r.x);
    const ay = acc(dist, r.y);

    v.x += ax * dt;
    v.y += ay * dt;

    r.x += v.x * dt;
    r.y += v.y * dt;

    const theta = Math.atan2(v.y, v.x);

    return { x: r.x, y: r.y, theta: theta,vx:v.x,vy:v.y }
}

// Prograde and Retrograde 

let dv=0.2;
export function prograde() {
    v.x += dv*Math.cos(v.x/Math.sqrt(v.x**2+v.y**2));
    v.y += dv*Math.sin(v.x/Math.sqrt(v.x**2+v.y**2));
}

const probtn = document.getElementById('prograde');
probtn.addEventListener('click', (event) => {
    prograde();
})