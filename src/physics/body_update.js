import { dynamicBodies } from './control_params.js';

let Rm_e = 15; // earth moon distance
let Re_s = 24; // earth sun distance

export function moon_update(bodies) {
    if (!dynamicBodies) return; // static planets: skip orbital update
    bodies.moon.pos.x =
        bodies.earth.pos.x + Rm_e * Math.cos(bodies.moon.theta + Math.PI / 3);
    bodies.moon.pos.y =
        bodies.earth.pos.y + Rm_e * Math.sin(bodies.moon.theta + Math.PI / 3);
    bodies.moon.theta -= 0.0001;
}

export function earth_update(bodies) {
    if (!dynamicBodies) return; // static planets: skip orbital update
    bodies.earth.pos.x = bodies.sun.pos.x + Re_s * Math.cos(bodies.earth.theta);
    bodies.earth.pos.y = bodies.sun.pos.y + Re_s * Math.sin(bodies.earth.theta);
    bodies.earth.theta -= 0.00005;
}
