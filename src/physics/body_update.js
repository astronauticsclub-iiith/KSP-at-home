let R=15 // earth moon distance
let Rs=24 // earth sun distance

export function moon_update(bodies) {
    bodies.moon.pos.x = bodies.earth.pos.x + R * Math.cos(bodies.moon.theta + Math.PI / 3);
    bodies.moon.pos.y = bodies.earth.pos.y + R * Math.sin(bodies.moon.theta + Math.PI / 3);
    bodies.moon.theta -= 0.0001;
}

export function earth_update(bodies) {
    bodies.earth.pos.x = bodies.sun.pos.x + Rs * Math.cos(bodies.earth.theta);
    bodies.earth.pos.y = bodies.sun.pos.y + Rs * Math.sin(bodies.earth.theta);
    bodies.earth.theta -= 0.00005;
}