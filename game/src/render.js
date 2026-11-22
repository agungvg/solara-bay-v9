// Solara Bay v9 — the renderer: a Three.js scene painted from the world
// state. The city, the ocean, the yacht, the tank, the heli, the crowds and
// the Lamborghini are all low-poly boxes built here, in-session, from the
// numbers the world hands over. Nothing is copied in as an image.
import * as THREE from '../three.module.min.js';
import { PALETTE, WORLD } from './config.js';

// ---------------------------------------------------------------------------
// Canvas textures: window grids, road dashes, awning stripes, the ocean.
// Generated once at boot, so the game needs no image files at all.
// ---------------------------------------------------------------------------
function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowTexture(base, lit, litRatio) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) {
      for (let x = 8; x < w - 8; x += 16) {
        const on = Math.random() < litRatio;
        ctx.fillStyle = on ? lit : 'rgba(10,14,24,0.85)';
        ctx.fillRect(x, y, 10, 11);
      }
    }
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#23262e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3e48';
    ctx.fillRect(0, 0, 6, h);
    ctx.fillRect(w - 6, 0, 6, h);
    ctx.fillStyle = '#ffc46b';
    ctx.fillRect(w / 2 - 2, 8, 4, 34);
    ctx.fillRect(w / 2 - 2, 72, 4, 34);
  });
}

function awningTexture(color) {
  return canvasTexture(128, 32, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? color : '#f2ede4';
      ctx.fillRect(x, 0, 16, h);
    }
  });
}

function oceanTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e7f9e');
    grad.addColorStop(0.55, '#16607e');
    grad.addColorStop(1, '#0e1e3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // The sun's reflection path: a warm streak down the water.
    const path = ctx.createLinearGradient(0, 0, 0, h);
    path.addColorStop(0, 'rgba(255,179,71,0.55)');
    path.addColorStop(1, 'rgba(255,122,51,0.05)');
    ctx.fillStyle = path;
    ctx.fillRect(w * 0.42, 0, w * 0.16, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    for (let y = 12; y < h; y += 22) {
      for (let x = 0; x < w; x += 46) {
        const len = 18 + ((x * 7 + y * 3) % 22);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
    }
  });
}

function skyTexture(night) {
  // 512 wide so painted clouds and stars resolve as shapes, not smears.
  // A tiny seeded LCG keeps the sky identical on every load.
  let seed = night ? 1234567 : 7654321;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 4294967296);
  };
  return canvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (night) {
      grad.addColorStop(0, '#070d1f');
      grad.addColorStop(0.5, '#0e1e3a');
      grad.addColorStop(0.8, '#3a1c5e');
      grad.addColorStop(1, '#ff2e88');
    } else {
      grad.addColorStop(0, '#5a2a8c');
      grad.addColorStop(0.35, '#7b2fbe');
      grad.addColorStop(0.62, '#ff2e88');
      grad.addColorStop(0.85, '#ff7a33');
      grad.addColorStop(1, '#ffb347');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Soft cloud puffs: several overlapping radial-gradient ellipses each,
    // warm-lit from below at sunset, dark violet at night.
    const cloudCount = night ? 10 : 22;
    for (let i = 0; i < cloudCount; i += 1) {
      const cx = rnd() * w;
      const cy = h * (0.08 + rnd() * 0.5);
      const cw = 40 + rnd() * 110;
      const ch = 8 + rnd() * 16;
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let p = 0; p < puffs; p += 1) {
        const px = cx + (rnd() - 0.5) * cw;
        const py = cy + (rnd() - 0.5) * ch;
        const r = (cw / puffs) * (0.7 + rnd() * 0.6);
        const g2 = ctx.createRadialGradient(px, py, 0, px, py, r);
        if (night) {
          g2.addColorStop(0, 'rgba(30,22,60,0.5)');
          g2.addColorStop(1, 'rgba(30,22,60,0)');
        } else {
          const warm = rnd() < 0.5;
          g2.addColorStop(0, warm ? 'rgba(255,214,170,0.5)' : 'rgba(255,180,200,0.42)');
          g2.addColorStop(1, 'rgba(255,180,200,0)');
        }
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (night) {
      // Stars above the haze.
      for (let i = 0; i < 140; i += 1) {
        const sx = rnd() * w;
        const sy = rnd() * h * 0.55;
        const sa = 0.35 + rnd() * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${sa})`;
        ctx.fillRect(sx, sy, rnd() < 0.2 ? 2 : 1, rnd() < 0.2 ? 2 : 1);
      }
    } else {
      // Warm haze hugging the horizon.
      const haze = ctx.createLinearGradient(0, h * 0.72, 0, h);
      haze.addColorStop(0, 'rgba(255,179,71,0)');
      haze.addColorStop(1, 'rgba(255,179,71,0.35)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
    }
  });
}

function signTexture(text, color) {
  return canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = color;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// ---------------------------------------------------------------------------
// Small builders: every vehicle and person is a group of boxes.
// ---------------------------------------------------------------------------
function box(w, h, d, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.15, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.glow ?? 0 })
  );
  mesh.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.shadow ?? false;
  return mesh;
}

function wheel(radius, width, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 12),
    new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.9 })
  );
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

// The hero: a low, wide supercar — long nose, sloped cabin, rear wing.
function makeLambo(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.65, emissive: color, emissiveIntensity: 0.22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.6), paint);
  body.position.y = 0.55;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 1.1), paint);
  nose.position.set(0, 0.42, 2.5);
  nose.rotation.x = -0.18;
  g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.9), new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.15, metalness: 0.8 }));
  cabin.position.set(0, 1.0, -0.35);
  g.add(cabin);
  const wing = box(2.0, 0.08, 0.5, 0x11141a, { y: 1.25, z: -2.15, metal: 0.6 });
  g.add(wing);
  // White racing stripe down the spine: hood to roof, like the reference hero.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.3, metalness: 0.4 });
  const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 3.4), stripeMat);
  stripeHood.position.set(0, 0.84, 0.6);
  g.add(stripeHood);
  const stripeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.9), stripeMat);
  stripeRoof.position.set(0, 1.27, -0.35);
  g.add(stripeRoof);
  g.add(box(0.08, 0.35, 0.08, 0x11141a, { x: -0.7, y: 1.05, z: -2.15 }));
  g.add(box(0.08, 0.35, 0.08, 0x11141a, { x: 0.7, y: 1.05, z: -2.15 }));
  const head = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffc46b, emissiveIntensity: 2.2 });
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), head);
    lamp.position.set(s * 0.62, 0.5, 3.02);
    g.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.08), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2e3e, emissiveIntensity: 1.6 }));
    tail.position.set(s * 0.62, 0.62, -2.32);
    g.add(tail);
  }
  for (const [x, z] of [[-0.95, 1.55], [0.95, 1.55], [-0.95, -1.55], [0.95, -1.55]]) {
    g.add(wheel(0.42, 0.3, x, 0.42, z));
  }
  return g;
}

function makeSedan(color, police = false) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.6, 4.2, police ? 0xe8e8e8 : color, { y: 0.6, metal: 0.4 }));
  g.add(box(1.6, 0.55, 2.2, 0x10151f, { y: 1.15, z: -0.2, metal: 0.6 }));
  if (police) {
    g.add(box(1.9, 0.18, 4.2, 0x14181f, { y: 0.32 }));
    // Dark door stripe so the white cruiser reads as a police car.
    g.add(box(0.02, 0.24, 3.6, 0x1d2733, { x: -0.96, y: 0.78 }));
    g.add(box(0.02, 0.24, 3.6, 0x1d2733, { x: 0.96, y: 0.78 }));
    // Big light bar: the flash has to read from a distance at night.
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 4.5 }));
    barR.position.set(-0.4, 1.52, -0.2);
    g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2266ff, emissiveIntensity: 4.5 }));
    barB.position.set(0.4, 1.52, -0.2);
    g.add(barB);
    g.userData.barR = barR;
    g.userData.barB = barB;
  }
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    g.add(wheel(0.36, 0.26, x, 0.36, z));
  }
  return g;
}

function makeScooter(color) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 1.6, color, { y: 0.55 }));
  g.add(box(0.4, 0.5, 0.5, 0x14181f, { y: 0.9, z: -0.4 }));
  for (const z of [0.7, -0.7]) g.add(wheel(0.26, 0.16, 0, 0.26, z));
  return g;
}

// A tall boxy van — chunky silhouette, reads at a glance unlike a sedan.
function makeVan(color) {
  const g = new THREE.Group();
  g.add(box(2.0, 1.5, 4.6, color, { y: 1.05, metal: 0.35 }));
  g.add(box(1.9, 0.6, 0.9, 0x10151f, { y: 1.5, z: 1.9, metal: 0.6 }));
  g.add(box(2.02, 0.3, 4.2, 0x14181f, { y: 0.35 }));
  const head = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffc46b, emissiveIntensity: 2 });
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), head);
    lamp.position.set(s * 0.65, 0.7, 2.32);
    g.add(lamp);
  }
  for (const [x, z] of [[-0.9, 1.6], [0.9, 1.6], [-0.9, -1.6], [0.9, -1.6]]) {
    g.add(wheel(0.4, 0.28, x, 0.4, z));
  }
  return g;
}

// Flames + smoke for a burning van: two emissive cones and grey puffs.
function makeFlames() {
  const g = new THREE.Group();
  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xff7a33, emissive: 0xff7a33, emissiveIntensity: 3 })
  );
  fire.position.y = 0.9;
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.95, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffc46b, emissiveIntensity: 3.5 })
  );
  core.position.y = 0.75;
  g.add(fire, core);
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, roughness: 1 });
  for (let i = 0; i < 3; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + i * 0.25, 8, 6), smokeMat);
    puff.position.set((i - 1) * 0.4, 2 + i * 0.8, (i % 2 ? 0.3 : -0.3));
    g.add(puff);
  }
  g.userData.fire = fire;
  g.userData.core = core;
  return g;
}

function makeTank() {
  const g = new THREE.Group();
  // Lighter olive than the road so the hull reads at dusk, not as a black slab.
  const olive = 0x7d8a58;
  const dark = 0x3a4432;
  g.add(box(3.4, 0.9, 5.6, dark, { y: 0.55 }));
  g.add(box(2.6, 0.8, 4.6, olive, { y: 1.35 }));
  const turret = new THREE.Group();
  turret.position.y = 1.9;
  turret.add(box(1.9, 0.7, 2.4, olive, { y: 0.35 }));
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 10), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5, metalness: 0.6 }));
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, 0.4, 2.6);
  turret.add(cannon);
  turret.add(box(0.05, 0.9, 0.05, 0x11141a, { x: 0.7, y: 0.9, z: -0.8 }));
  // Amber marker lights so the tank reads at dusk.
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xffb347, emissiveIntensity: 2.5 });
  for (const s of [-1, 1]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), markerMat);
    marker.position.set(s * 0.85, 0.75, 1.25);
    turret.add(marker);
  }
  g.add(turret);
  g.userData.turret = turret;
  for (const s of [-1, 1]) {
    g.add(box(0.7, 0.7, 5.4, 0x2c2f28, { x: s * 1.5, y: 0.5 }));
    for (let i = 0; i < 5; i += 1) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 10), new THREE.MeshStandardMaterial({ color: 0x3a3d33, roughness: 0.9 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 1.5, 0.32, -2 + i);
      g.add(w);
    }
  }
  return g;
}

function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.4, metalness: 0.5 }));
  body.position.y = 0;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.15, metalness: 0.7 }));
  nose.position.set(0, -0.1, 2.4);
  g.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 4.6, 8), new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.4, metalness: 0.5 }));
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.3, -4.2);
  g.add(boom);
  const rotor = new THREE.Group();
  rotor.position.y = 1.1;
  rotor.add(box(0.25, 0.08, 9.5, 0x11141a));
  rotor.add(box(9.5, 0.08, 0.25, 0x11141a));
  g.add(rotor);
  g.userData.rotor = rotor;
  const skids = box(2.4, 0.1, 0.3, 0x11141a, { y: -1.15, z: 0.6 });
  g.add(skids);
  // The searchlight cone, aimed down at the player.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  cone.position.set(0, -13.5, 1.5);
  g.add(cone);
  g.userData.cone = cone;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffc46b, emissiveIntensity: 3 }));
  lamp.position.set(0, -0.9, 1.8);
  g.add(lamp);
  return g;
}

function makeYacht() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.35, metalness: 0.25 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 16), white);
  hull.position.y = 1.1;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 3), white);
  bow.position.set(0, 1.0, 9);
  bow.rotation.x = 0.35;
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 7), white);
  cabin.position.set(0, 3.0, -1);
  g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.7, 6.5), new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 3.3, -1);
  g.add(glass);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 4), white);
  top.position.set(0, 4.4, -2);
  g.add(top);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.4 }));
  mast.position.set(0, 6.5, -3.5);
  g.add(mast);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.35, 15.5), new THREE.MeshStandardMaterial({ color: PALETTE.neonPink, emissive: PALETTE.neonPink, emissiveIntensity: 0.7 }));
  stripe.position.y = 1.9;
  g.add(stripe);
  return g;
}

// A person built from boxes with a round head — like the reference frames:
// round head, solid shirt, visible arms that swing as they walk, a cap on
// some, a rifle held forward in both hands when armed, a pistol for the
// player. A downed one lies flat with a red ring under it.
function makePedMesh(ped) {
  const g = new THREE.Group();
  const torso = box(0.62, 0.7, 0.34, ped.shirt, { y: 1.05 });
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 12, 10),
    new THREE.MeshStandardMaterial({ color: ped.skin, roughness: 0.8 })
  );
  head.position.y = 1.62;
  g.add(torso, head);
  const legs = box(0.5, 0.72, 0.3, 0x1c2027, { y: 0.36 });
  g.add(legs);
  // Arms: visible, hanging at the sides, swinging with the walk. The
  // geometry is translated so each arm pivots at the shoulder, and the
  // hand rides at its end.
  const armMat = new THREE.MeshStandardMaterial({ color: ped.shirt, roughness: 0.8 });
  const armGeo = new THREE.BoxGeometry(0.13, 0.62, 0.13);
  armGeo.translate(0, -0.31, 0);
  const skinMat = new THREE.MeshStandardMaterial({ color: ped.skin, roughness: 0.8 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.39, 1.32, 0);
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.39, 1.32, 0);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skinMat);
  handL.position.set(0, -0.62, 0);
  armL.add(handL);
  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skinMat);
  handR.position.set(0, -0.62, 0);
  armR.add(handR);
  g.add(armL, armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  if (ped.cap) {
    const capMat = new THREE.MeshStandardMaterial({ color: ped.capColor || 0xff2e88, roughness: 0.7 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.09, 12), capMat);
    cap.position.y = 1.83;
    g.add(cap);
    const brim = box(0.3, 0.04, 0.2, ped.capColor || 0xff2e88, { y: 1.8, z: 0.22 });
    g.add(brim);
  }
  if (ped.player) {
    // The player: pistol held forward in both hands, arms extended.
    const pistol = box(0.08, 0.14, 0.38, 0x14161a, { y: 1.28, z: 0.52 });
    g.add(pistol);
    armL.rotation.x = -1.25;
    armR.rotation.x = -1.25;
    g.userData.aiming = true;
  } else if (ped.armed) {
    // Rifle held forward across the body, both hands on it.
    const rifle = box(0.09, 0.09, 1.15, 0x14161a, { y: 1.28, z: 0.5 });
    g.add(rifle);
    const vest = box(0.66, 0.4, 0.38, 0x2b2f36, { y: 1.12 });
    g.add(vest);
    armL.rotation.x = -1.1;
    armR.rotation.x = -1.1;
    g.userData.aiming = true;
  }
  if (ped.rival) {
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 4), new THREE.MeshBasicMaterial({ color: 0xff2e3e }));
    mark.position.y = 2.35;
    mark.rotation.x = Math.PI;
    g.add(mark);
  }
  g.userData.legs = legs;
  return g;
}

// ---------------------------------------------------------------------------
// The renderer: builds the static city once, syncs the moving pieces every
// frame, and aims the camera. Two grades: sunset (missions 0 and 1) and
// night (mission 2) — the fog, sky and lights switch with the mission.
// ---------------------------------------------------------------------------
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);

  const hemi = new THREE.HemisphereLight(0xffb347, 0x1e2a44, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa050, 1.5);
  sun.position.set(-180, 90, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.7);
  moon.position.set(120, 140, -100);
  scene.add(moon);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(false), side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);
  const skyNight = skyTexture(true);

  // The sun disc, low over the ocean to the south-east, so it hangs in the
  // cover frame above the water and the yacht.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(19, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false, transparent: true, opacity: 0.95 })
  );
  sunDisc.position.set(240, 35, 420);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xff7a33, fog: false, transparent: true, opacity: 0.25, depthWrite: false })
  );
  sunGlow.position.copy(sunDisc.position).multiplyScalar(1.001);
  sunGlow.lookAt(0, 20, 0);
  scene.add(sunGlow);

  // 3D sunset clouds: flat warm ellipsoids ringing the city, so the sky has
  // real depth instead of a painted gradient. Hidden at night.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9c0, transparent: true, opacity: 0.5, depthWrite: false });
  const cloudMatPink = new THREE.MeshBasicMaterial({ color: 0xffb4c8, transparent: true, opacity: 0.42, depthWrite: false });
  const cloudSpots = [
    [-260, 190, 260, 42], [-140, 210, 330, 52], [0, 200, 360, 46], [150, 220, 320, 54], [280, 185, 250, 40],
    [-300, 170, -80, 44], [-180, 205, -260, 50], [60, 215, -300, 48], [220, 180, -220, 42], [320, 200, 40, 46],
    [-60, 230, 120, 56], [120, 175, 120, 38],
  ];
  for (let ci = 0; ci < cloudSpots.length; ci += 1) {
    const [x, y, z, s] = cloudSpots[ci];
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), ci % 2 === 0 ? cloudMat : cloudMatPink);
    c.scale.set(s, s * 0.22, s * 0.55);
    c.position.set(x, y, z);
    clouds.add(c);
  }
  scene.add(clouds);

  // Mountain silhouettes on the far north and east horizons, so the skyline
  // has depth behind the towers (visible up the night avenue and over the
  // market roofs). Fog softens them into the haze.
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x241640, roughness: 1 });
  const ridge = new THREE.Group();
  const peaks = [
    [-180, -215, 55, 42], [-120, -215, 70, 52], [-60, -215, 48, 38], [0, -215, 78, 56],
    [60, -215, 52, 40], [120, -215, 66, 48], [180, -215, 44, 36],
    [215, -60, 55, 44], [215, 0, 42, 36], [215, 60, 60, 46],
  ];
  for (const [x, z, h, r] of peaks) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), ridgeMat);
    peak.position.set(x, h / 2 - 2, z);
    ridge.add(peak);
  }
  scene.add(ridge);

  let cityBuilt = false;
  let night = false;
  const dyn = {
    hero: null, regent: null, tank: null, heli: null, yacht: null,
    police: [], traffic: [], peds: [], playerPed: null,
  };
  const shotCamera = { active: false, pos: new THREE.Vector3(), look: new THREE.Vector3() };

  const textures = {
    glass: windowTexture('#2a3450', '#ffc46b', 0.42),
    neon: windowTexture('#1a1030', '#00e5ff', 0.5),
    brick: windowTexture('#3a2a26', '#ff7a33', 0.3),
    road: roadTexture(),
    ocean: oceanTexture(),
  };
  textures.road.wrapS = THREE.RepeatWrapping;
  textures.road.wrapT = THREE.RepeatWrapping;
  textures.ocean.wrapS = THREE.RepeatWrapping;
  textures.ocean.wrapT = THREE.RepeatWrapping;

  function buildCity(city) {
    if (cityBuilt) return;
    cityBuilt = true;

    // Ground: grass-grey in the north, sand along the beach.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.half * 2 + 160, WORLD.half * 2 + 160),
      new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -20);
    ground.receiveShadow = true;
    scene.add(ground);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 40),
      new THREE.MeshStandardMaterial({ color: 0xd9b078, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, WORLD.beachZ - 2);
    sand.receiveShadow = true;
    scene.add(sand);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 220),
      new THREE.MeshStandardMaterial({ map: textures.ocean, roughness: 0.35, metalness: 0.35 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.12, WORLD.oceanZ + 108);
    scene.add(ocean);

    // Roads: dark strips with a dashed centre line, laid over the ground.
    const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.95 });
    for (const road of city.roads) {
      const len = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(road.vertical ? 11 : len, road.vertical ? len : 11), roadMat.clone());
      mesh.material.map = textures.road.clone();
      mesh.material.map.needsUpdate = true;
      mesh.material.map.repeat.set(road.vertical ? 1 : len / 14, road.vertical ? len / 14 : 1);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((road.x1 + road.x2) / 2, 0.08, (road.z1 + road.z2) / 2);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Buildings: boxes with window-grid skins, taller toward the centre.
    // A few downtown towers get a stepped crown so the skyline is not flat.
    const mats = {
      glass: new THREE.MeshStandardMaterial({ map: textures.glass, roughness: 0.35, metalness: 0.5, emissive: 0xffffff, emissiveMap: textures.glass, emissiveIntensity: 0.32 }),
      neon: new THREE.MeshStandardMaterial({ map: textures.neon, roughness: 0.3, metalness: 0.55, emissive: 0xffffff, emissiveMap: textures.neon, emissiveIntensity: 0.38 }),
      brick: new THREE.MeshStandardMaterial({ map: textures.brick, roughness: 0.9, metalness: 0.05, emissive: 0xffffff, emissiveMap: textures.brick, emissiveIntensity: 0.22 }),
    };
    for (const b of city.buildings) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mats[b.variant]);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      if (b.h > 55) {
        const crown = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.55, 5, b.d * 0.55), mats[b.variant]);
        crown.position.set(b.x, b.h + 2.5, b.z);
        scene.add(crown);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2e3e }));
        beacon.position.set(b.x, b.h + 5.5, b.z);
        scene.add(beacon);
      }
    }

    // Palms along the beachfront, leaning toward the sea.
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d5b, roughness: 0.9, side: THREE.DoubleSide });
    for (const palm of city.palms) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7 * palm.scale, 7), trunkMat);
      trunk.position.y = 3.5 * palm.scale;
      trunk.rotation.z = palm.lean;
      g.add(trunk);
      for (let i = 0; i < 6; i += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9 * palm.scale, 3.4 * palm.scale, 4), frondMat);
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 1.2 * palm.scale, 7 * palm.scale, Math.sin(a) * 1.2 * palm.scale);
        frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
        g.add(frond);
      }
      g.position.set(palm.x, 0, palm.z);
      scene.add(g);
    }

    // Market stalls: counter, posts, striped awning, goods, string lights.
    for (const stall of city.stalls) {
      const g = new THREE.Group();
      g.add(box(stall.w, 1.1, stall.d, 0x4a3527, { y: 0.55 }));
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(stall.w + 1, stall.d + 1.6),
        new THREE.MeshStandardMaterial({ map: awningTexture(stall.awning), side: THREE.DoubleSide, roughness: 0.8 })
      );
      awn.rotation.x = -Math.PI / 2 + 0.12;
      awn.position.y = stall.h;
      g.add(awn);
      for (const [px, pz] of [[-stall.w / 2, -stall.d / 2], [stall.w / 2, -stall.d / 2], [-stall.w / 2, stall.d / 2], [stall.w / 2, stall.d / 2]]) {
        g.add(box(0.12, stall.h, 0.12, 0x2c2118, { x: px, y: stall.h / 2, z: pz }));
      }
      g.add(box(stall.w * 0.7, 0.5, stall.d * 0.6, stall.awning, { y: 1.35, emissive: 0x000000 }));
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
      for (let i = 0; i < 5; i += 1) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), bulbMat);
        bulb.position.set(-stall.w / 2 + (i * stall.w) / 4, stall.h - 0.25, stall.d / 2 + 0.6);
        g.add(bulb);
      }
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 1.1),
        new THREE.MeshBasicMaterial({ map: signTexture(stall.goods, stall.awning), transparent: true })
      );
      label.position.set(0, 2.6, stall.d / 2 + 0.85);
      g.add(label);
      g.position.set(stall.x, 0, stall.z);
      scene.add(g);
    }

    // Streetlights: pole, arm, warm lamp.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.6 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (const light of city.lights) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 8), poleMat);
      pole.position.y = 3.25;
      g.add(pole);
      const arm = box(0.12, 0.12, 1.6, 0x22262e, { y: 6.4, z: 0.7 });
      g.add(arm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
      lamp.position.set(0, 6.3, 1.5);
      g.add(lamp);
      g.position.set(light.x, 0, light.z);
      scene.add(g);
    }

    // Neon signs on the towers.
    for (const sign of city.signs) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sign.w, sign.h),
        new THREE.MeshBasicMaterial({ map: signTexture(sign.text, sign.color), transparent: true })
      );
      mesh.position.set(sign.x, sign.y, sign.z);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
    }

    // The interchange: a raised loop ramp with pillars, north-east.
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.9 });
    const loop = new THREE.Mesh(new THREE.TorusGeometry(city.interchange.radius, 2.2, 8, 40, Math.PI * 1.5), rampMat);
    loop.rotation.x = Math.PI / 2;
    loop.rotation.z = 0.4;
    loop.position.set(city.interchange.x, city.interchange.height, city.interchange.z);
    scene.add(loop);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, city.interchange.height, 8), rampMat);
      pillar.position.set(city.interchange.x + Math.cos(a) * city.interchange.radius, city.interchange.height / 2, city.interchange.z + Math.sin(a) * city.interchange.radius);
      scene.add(pillar);
    }
  }

  function buildDynamic(state) {
    // The hero: red with a white racing stripe, like the reference frames.
    dyn.hero = makeLambo(0xd8232e);
    scene.add(dyn.hero);
    dyn.regent = makeSedan(0x8a1f2d);
    scene.add(dyn.regent);
    dyn.tank = makeTank();
    dyn.tank.scale.setScalar(1.18);
    scene.add(dyn.tank);
    dyn.heli = makeHeli();
    scene.add(dyn.heli);
    dyn.yacht = makeYacht();
    dyn.yacht.scale.setScalar(1.9);
    scene.add(dyn.yacht);
    for (const unit of state.police) {
      const mesh = makeSedan(0, true);
      scene.add(mesh);
      dyn.police.push(mesh);
    }
    for (const car of state.traffic) {
      const mesh = car.kind === 'scooter' ? makeScooter(car.color) : car.kind === 'van' ? makeVan(car.color) : makeSedan(car.color);
      if (car.burning) {
        const flames = makeFlames();
        flames.position.set(0, 1.7, 1.2);
        mesh.add(flames);
        mesh.userData.flames = flames;
      }
      scene.add(mesh);
      dyn.traffic.push(mesh);
    }
    for (const ped of state.peds) {
      const mesh = makePedMesh(ped);
      scene.add(mesh);
      dyn.peds.push(mesh);
    }
    // The player on foot: a distinct figure (teal jacket, pink cap, pistol
    // held forward) so the third-person camera always has someone to follow.
    dyn.playerPed = makePedMesh({ shirt: 0x00e5ff, skin: 0xe8b98a, armed: true, rival: false, player: true, cap: true, capColor: 0xff2e88 });
    scene.add(dyn.playerPed);
  }

  function syncDynamic(state) {
    const hero = dyn.hero;
    hero.position.set(state.car.x, 0, state.car.z);
    hero.rotation.y = state.car.heading;
    hero.visible = true;
    // The player on foot, shown whenever they are out of the car.
    if (dyn.playerPed) {
      dyn.playerPed.position.set(state.player.x, 0, state.player.z);
      dyn.playerPed.rotation.y = state.player.heading;
      dyn.playerPed.visible = !state.player.inCar && state.mode !== 'title';
      dyn.playerPed.userData.legs.rotation.x = Math.sin(state.time * 8) * 0.3;
    }
    // A dented car lists a little and puffs smoke from the hood.
    hero.rotation.z = state.car.condition < 70 ? 0.03 : 0;
    const regent = dyn.regent;
    regent.position.set(state.regent.x, 0, state.regent.z);
    regent.rotation.y = state.regent.heading;
    regent.visible = state.regent.alive;
    const tank = dyn.tank;
    tank.position.set(state.tank.x, 0, state.tank.z);
    tank.rotation.y = state.tank.heading;
    tank.userData.turret.rotation.y = state.tank.turret;
    tank.visible = state.tank.active;
    const heli = dyn.heli;
    heli.position.set(state.heli.x, state.heli.y, state.heli.z);
    heli.rotation.y = Math.atan2(state.player.x - state.heli.x, state.player.z - state.heli.z);
    heli.userData.rotor.rotation.y = state.heli.rotor;
    heli.visible = state.wanted >= 3;
    const yacht = dyn.yacht;
    yacht.position.set(state.yacht.x, 0.1, state.yacht.z);
    yacht.rotation.y = state.yacht.heading;
    yacht.rotation.z = state.yacht.bob;
    for (let i = 0; i < state.police.length && i < dyn.police.length; i += 1) {
      const unit = state.police[i];
      const mesh = dyn.police[i];
      mesh.position.set(unit.x, 0, unit.z);
      mesh.rotation.y = unit.heading;
      mesh.visible = true;
      const flash = Math.sin(state.time * 10 + i) > 0;
      mesh.userData.barR.material.emissiveIntensity = flash ? 4.5 : 0.6;
      mesh.userData.barB.material.emissiveIntensity = flash ? 0.6 : 4.5;
    }
    for (let i = 0; i < state.traffic.length && i < dyn.traffic.length; i += 1) {
      const car = state.traffic[i];
      const mesh = dyn.traffic[i];
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      if (mesh.userData.flames) {
        const fl = mesh.userData.flames;
        fl.userData.fire.scale.y = 1 + Math.sin(state.time * 13 + i * 2) * 0.18;
        fl.userData.core.scale.y = 1 + Math.sin(state.time * 17 + i) * 0.22;
      }
    }
    for (let i = 0; i < state.peds.length && i < dyn.peds.length; i += 1) {
      const ped = state.peds[i];
      const mesh = dyn.peds[i];
      if (ped.down) {
        mesh.position.set(ped.x, 0.25, ped.z);
        mesh.rotation.set(-Math.PI / 2, 0, ped.heading);
      } else {
        mesh.position.set(ped.x, 0, ped.z);
        mesh.rotation.set(0, ped.heading, 0);
        mesh.userData.legs.rotation.x = Math.sin(ped.walkPhase) * 0.35;
        if (!mesh.userData.aiming) {
          mesh.userData.armL.rotation.x = Math.sin(ped.walkPhase) * 0.45;
          mesh.userData.armR.rotation.x = -Math.sin(ped.walkPhase) * 0.45;
        }
      }
      mesh.visible = true;
    }
    // The downed enemy's red ring — big, pulsing, with a marker above it,
    // so the body reads instantly in the crowd.
    if (state.downed) {
      if (!dyn.ring) {
        dyn.ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 24), new THREE.MeshBasicMaterial({ color: 0xff2e3e, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
        dyn.ring.rotation.x = -Math.PI / 2;
        scene.add(dyn.ring);
        dyn.downMarker = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xff2e3e }));
        dyn.downMarker.rotation.x = Math.PI;
        scene.add(dyn.downMarker);
      }
      dyn.ring.position.set(state.downed.x, 0.06, state.downed.z);
      dyn.ring.visible = true;
      const rpulse = 1 + Math.sin(state.time * 4) * 0.12;
      dyn.ring.scale.set(rpulse, rpulse, 1);
      dyn.downMarker.position.set(state.downed.x, 2.9 + Math.sin(state.time * 3) * 0.25, state.downed.z);
      dyn.downMarker.visible = true;
    } else {
      if (dyn.ring) dyn.ring.visible = false;
      if (dyn.downMarker) dyn.downMarker.visible = false;
    }
    // The objective marker: a pulsing amber ring on the ground.
    if (!dyn.marker) {
      dyn.marker = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      dyn.marker.rotation.x = -Math.PI / 2;
      scene.add(dyn.marker);
    }
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    dyn.marker.scale.set(pulse, pulse, 1);
    dyn.marker.position.set(state.objective.x, 0.07, state.objective.z);
    dyn.marker.visible = !state.missionDone;
  }

  function aimCamera(state) {
    if (shotCamera.active) {
      camera.position.copy(shotCamera.pos);
      camera.lookAt(shotCamera.look);
      return;
    }
    const p = state.player;
    if (p.inCar) {
      // Chase cam: low and close, just behind and to the left, so the hero
      // car fills the lower frame and the road ahead stays wide.
      const back = 11;
      const up = 4.2;
      camera.position.set(
        p.x - Math.sin(p.heading) * back - Math.cos(p.heading) * 2.5,
        up,
        p.z - Math.cos(p.heading) * back + Math.sin(p.heading) * 2.5
      );
      camera.lookAt(p.x + Math.sin(p.heading) * 14, 1.6, p.z + Math.cos(p.heading) * 14);
    } else {
      // On foot: over the shoulder, low, down the street the player faces.
      camera.position.set(p.x - Math.sin(p.heading) * 5.5, 3.4, p.z - Math.cos(p.heading) * 5.5);
      camera.lookAt(p.x + Math.sin(p.heading) * 8, 1.4, p.z + Math.cos(p.heading) * 8);
    }
  }

  function setGrade(isNight) {
    if (isNight === night) return;
    night = isNight;
    skyDome.material.map = isNight ? skyNight : skyTexture(false);
    skyDome.material.needsUpdate = true;
    scene.fog = new THREE.Fog(isNight ? 0x0e1e3a : 0xcc5a3a, 120, 620);
    sun.intensity = isNight ? 0.25 : 1.5;
    moon.intensity = isNight ? 1.2 : 0.7;
    hemi.intensity = isNight ? 0.8 : 1.05;
    sunDisc.visible = !isNight;
    sunGlow.visible = !isNight;
    clouds.visible = !isNight;
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function draw(state) {
    buildCity(state.city);
    if (!dyn.hero) buildDynamic(state);
    setGrade(state.mission === 2);
    syncDynamic(state);
    aimCamera(state);
    renderer.render(scene, camera);
  }

  return {
    draw,
    resize,
    setShotCamera(x, y, z, lx, ly, lz) {
      shotCamera.active = true;
      shotCamera.pos.set(x, y, z);
      shotCamera.look.set(lx, ly, lz);
    },
    clearShotCamera() {
      shotCamera.active = false;
    },
  };
}
