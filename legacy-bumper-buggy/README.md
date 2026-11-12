# Bumper Buggy: Sunny Hills 🚗💨

A 2.5D browser-based 3D physics driving game built with **Three.js** and **Cannon-es**, featuring a procedural toy-aesthetic blue Beetle monster truck, sunny rolling hills, expressive animations, mid-air stunt flips, fuel & coin pickups, and responsive cross-platform controls.

---

## ✨ Features

- **Procedural Cute Toy Car (`src/entities/CuteCar.js`)**
  - Glossy sky-blue Beetle body with flared wheel arches, chrome bumpers, twin exhausts, and springy roof antenna.
  - Signature cream-white cabin dome with glossy tinted windows.
  - **Expressive Headlight Eyes** that blink naturally, track vertical velocity, narrow with determination during Nitro boost, widen in surprise during big jumps, and look dizzy when flipped over.
  - **Oversized Monster-Truck Tires** with 3D radial tread blocks, beadlock rims, and live compressing coil-spring struts driven by Cannon-es suspension travel.
- **Realistic 2.5D Vehicle Physics (`src/physics/PhysicsWorld.js`)**
  - Powered by `CANNON.RaycastVehicle` + `SAPBroadphase` locked cleanly onto the 2.5D `Z = 0` driving plane.
  - Tuned spring stiffness, compression/relaxation damping, 4WD hill-climbing torque, reverse gear, and classic mid-air pitch rotation for **Frontflips** and **Backflips**.
- **Segmented Procedural 3D World (`src/world/TerrainManager.js`, `src/world/SkyEnvironment.js`)**
  - **Easy (Sunny Meadows):** Smooth rolling green hills and forgiving valleys.
  - **Medium (Canyon Jumps):** Rhythmic camelbacks, wooden booster ramps, and canyon gaps.
  - **Hard (Alpine Cliffs):** Steep ridges, deep chasms, and giant whaleback launches.
  - Automatic chunk streaming and disposal behind the vehicle for low memory footprint and 60 FPS mobile performance.
- **Cross-Platform Controls & Minimalist Toy UI**
  - **Desktop:** `A`/`D`, `W`/`S`, or `Arrow Keys` for Gas/Brake & mid-air tilt; `Mouse Click` on canvas, `Space`, or `Shift` for Nitro Boost; `R` to quick-restart.
  - **Mobile / Touch:** Multi-touch rounded **BRAKE** (left), **GAS** (right), and **BOOST** pedals that appear automatically on touch devices.
- **Zero External Asset Dependencies**
  - All 3D models, shaders, particles (`InstancedMesh`), and Web Audio sound effects (`src/audio/SoundManager.js`) are generated procedurally in code.

---

## 🚀 Quick Start (Local Development)

```bash
npm install
npm run dev
```

Build production static site (`dist/`):

```bash
npm run build
npm run preview
```

---

## 🌐 Static Hosting (Netlify, Vercel, GitHub Pages)

Because `vite.config.js` is configured with `base: './'`, the compiled `dist/` folder works out-of-the-box on **any** root domain or subpath:

- **Netlify:** Drag-and-drop the `dist/` folder into Netlify Drop, or connect the repo (`netlify.toml` is pre-configured).
- **Vercel:** Import the project into Vercel (`vercel.json` is pre-configured).
- **GitHub Pages:** Upload or deploy the contents of `dist/` to your `gh-pages` branch or Pages artifact.
