import GUI from 'lil-gui';

export const params = {
    G: 1, // Graviational constant in ARBITRARY UNITS
    dt: 0.03, // TIME SCALE
    moonMass: 20 / 81,
};

const gui = new GUI();

gui.add(params, 'G', 0, 20, 0.1);

gui.add(params, 'dt', 0.001, 0.05, 0.001);

gui.add(params, 'moonMass', 0.01, 1, 0.01).onChange((v) => (bodies.moon.m = v)); // mass of earth is 1

let r = { x: -3, y: -2, z: 0 }; // postion and velocities
let v = { x: 0.707, y: 0, z: 0 }; //start with a stable orbital velocity

export let R = 15; //distance between earth and moon

let bodies = {
    earth: { name: 'EARTH', m: 1, r: 1.05, pos: { x: -3, y: -4, z: 0 } },
    moon: {
        name: 'MOON',
        m: params.moonMass,
        r: 0.42,
        pos: { x: 6, y: 8, z: 0 },
    },
    sun: { name: 'SUN', m: 0, pos: { x: -20, y: 0, z: 1 } }, // mass of sun dosent matter
}; //artifically increase moons pull for now

export { bodies };
export { r, v };
