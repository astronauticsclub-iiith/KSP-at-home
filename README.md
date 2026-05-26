# KSP-at-home
> A browser-based orbital mechanics sandbox inspired by KSP.

---

## Preview
<img width="1871" height="962" alt="image" src="https://github.com/user-attachments/assets/170ef3f3-9170-47c5-90f4-bf39bb2db865" />
---

## What is this?

A real-time 2D orbital mechanics simulator running in the browser. You control a spacecraft under gravitational influence of the Earth, Moon, and Sun — with prograde/retrograde burns, trajectory prediction, and a tunable physics engine.

---

## Tech Stack

- [Three.js](https://threejs.org/)  Object rendering
- [Vite](https://vitejs.dev/) build tool
- [Tailwind CSS](https://tailwindcss.com/) UI styling
- [lil-gui](https://lil-gui.georgealways.com/)  physics parameter controls

---

## Physics

- Velocity Verlet integration
- N-body gravitational acceleration
- Prograde / retrograde burns
- Real-time trajectory prediction (2000 steps ahead)

---

## Controls

| Input | Action |
|---|---|
| `PROGRADE` button | Accelerate along velocity vector |
| `RETROGRADE` button | Decelerate along velocity vector |
| `Predict Trajectory` | Toggle trajectory preview |
| Scroll | Zoom |
| GUI sliders | Tune G, timestep, moon mass |

---

## Getting Started

Go to: https://github.com/astronauticsclub-iiith/KSP-at-home
to play directly

OR

```bash
git clone https://github.com/astronauticsclub-iiith/KSP-at-home
cd KSP-at-home
npm install
npm run dev
```
