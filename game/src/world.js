// Solara Bay v9 — the world: a Leonida-style coastal city, its vehicles,
// its crowds, its police, and the three missions that run on it.
// This module owns state and rules only; render.js paints it, hud.js reads it.
import { CAR, DISTRICTS, MISSIONS, PLAYER, POLICE_NAMES, POLICE_ROLES, WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_STAGE = 1;
export const EVENT_COMPLETE = 2;
export const EVENT_RAM = 4;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

function turnToward(heading, target, maxStep) {
  let diff = target - heading;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return heading + clamp(diff, -maxStep, maxStep);
}

// ---------------------------------------------------------------------------
// City layout: roads, building plots, palms, stalls, lights, the interchange.
// Built once per world from the seeded generator, so a shot always sees the
// same streets. Buildings are axis-aligned boxes; their footprints double as
// the collision map (the car's push-out below reads them).
// ---------------------------------------------------------------------------
function buildCity(random) {
  const roads = [];
  const buildings = [];
  const palms = [];
  const stalls = [];
  const lights = [];
  const signs = [];

  // The grid: avenues every 40 units, plus the beachfront road along the sand.
  for (let x = -160; x <= 160; x += 40) roads.push({ x1: x, z1: -170, x2: x, z2: 150, vertical: true });
  for (let z = -160; z <= 140; z += 40) roads.push({ x1: -170, z1: z, x2: 170, z2: z, vertical: false });
  roads.push({ x1: -200, z1: 150, x2: 200, z2: 150, vertical: false }); // the beachfront strip
  roads.push({ x1: 150, z1: -40, x2: 150, z2: 150, vertical: true }); // the dock road

  // Which district a block belongs to, by its centre.
  function districtAt(x, z) {
    if (z > 140) return 'strand';
    if (x > 120) return 'harbor';
    if (x < -80 && z > -80 && z < -20) return 'market';
    if (x < -80 && z >= 40) return 'oldtown';
    if (z < -120) return 'heights';
    if (Math.abs(x) < 60 && Math.abs(z) < 60) return 'central';
    return 'marina';
  }

  // One block = the ground between four roads. Fill it with towers or houses.
  for (let bx = -160; bx < 160; bx += 40) {
    for (let bz = -160; bz < 140; bz += 40) {
      const cx = bx + 20;
      const cz = bz + 20;
      const district = districtAt(cx, cz);
      if (district === 'market' || district === 'strand' || district === 'harbor') continue;
      if (cx > 100 && cz < -100) continue; // the interchange owns the north-east
      const count = district === 'central' ? 2 : 1 + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const w = range(random, 12, 22);
        const d = range(random, 12, 22);
        const x = cx + range(random, -8, 8);
        const z = cz + range(random, -8, 8);
        let h;
        if (district === 'central') h = range(random, 38, 88);
        else if (district === 'heights') h = range(random, 22, 46);
        else h = range(random, 10, 30);
        const variant = random() < 0.45 ? 'glass' : random() < 0.5 ? 'neon' : 'brick';
        buildings.push({ x, z, w, d, h, variant, district });
        // A neon sign on some glass towers, facing the nearest avenue.
        if (variant !== 'brick' && random() < 0.4) {
          signs.push({ x: x + w / 2 + 0.2, z, y: h * (0.55 + random() * 0.3), w: 6, h: 2.2, text: pick(random, ['HOTEL', 'BAR', '24H', 'NOODLE', 'CLUB', 'TAXI', 'PIER', 'SUSHI']), color: pick(random, ['#ff2e88', '#00e5ff', '#ffb347']) });
        }
      }
    }
  }

  // Palms line the beachfront road and the Strand, leaning toward the sea.
  for (let x = -195; x <= 195; x += 15) {
    if (random() < 0.25) continue;
    palms.push({ x: x + range(random, -2, 2), z: 158 + range(random, -2, 4), lean: range(random, -0.12, 0.12), scale: range(random, 0.8, 1.25) });
    if (random() < 0.5) palms.push({ x: x + range(random, -2, 2), z: 142 + range(random, -2, 2), lean: range(random, -0.1, 0.1), scale: range(random, 0.7, 1.1) });
  }

  // The Lantern Market: two aisles of stalls with striped awnings.
  const awningColors = ['#ff2e88', '#ffb347', '#00e5ff', '#ff7a33'];
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 7; i += 1) {
      const x = -132 + i * 8;
      const z = -58 + row * 16;
      stalls.push({ x, z, w: 6, d: 5, h: 3.4, awning: awningColors[(i + row) % awningColors.length], goods: pick(random, ['FRUIT', 'NOODLE', 'FISH', 'FLOWER', 'TEA', 'SPICE']) });
    }
  }

  // Streetlights along the beachfront road and Central avenue.
  for (let x = -180; x <= 180; x += 30) lights.push({ x, z: 144, on: true });
  for (let z = -140; z <= 120; z += 30) lights.push({ x: 6, z, on: true });

  // The interchange: a loop ramp in the north-east, drawn as a raised ring road.
  const interchange = { x: 130, z: -130, radius: 26, height: 9 };

  return { roads, buildings, palms, stalls, lights, signs, interchange };
}

// ---------------------------------------------------------------------------
// Vehicles, people, police — all built from boxes in the renderer, but their
// shapes live here as numbers: size, colour, where they are, where they go.
// ---------------------------------------------------------------------------
function makePed(random, x, z, opts = {}) {
  const shirts = ['#ff2e88', '#00e5ff', '#ffb347', '#f2ede4', '#7b2fbe', '#3ddc84', '#e5534b'];
  return {
    x, z,
    heading: range(random, 0, TAU),
    walkPhase: range(random, 0, TAU),
    speed: range(random, 0.8, 1.6),
    shirt: opts.shirt || pick(random, shirts),
    skin: pick(random, ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0']),
    cap: opts.cap ?? random() < 0.35,
    capColor: opts.capColor || pick(random, ['#ff2e88', '#00e5ff', '#ffb347', '#f2ede4', '#e5534b']),
    armed: !!opts.armed,
    rival: !!opts.rival,
    down: false,
    home: { x, z },
    roam: opts.roam ?? 12,
  };
}

function makeTrafficCar(random, color) {
  return {
    x: 0, z: 0, heading: 0, speed: range(random, 7, 11),
    color,
    kind: pick(random, ['sedan', 'sedan', 'taxi', 'van', 'scooter']),
    loop: 0, // which road loop it follows
    t: random(),
  };
}

export function createWorld(seed = 7) {
  const random = createRandom(seed);
  const city = buildCity(random);

  const state = {
    time: 0,
    mode: 'title',
    seed,
    city,
    mission: 1,
    stage: 0,
    stageProgress: 0,
    missionDone: false,
    cash: MISSIONS[1].cash,
    wanted: 4,
    timer: 23,
    clock: '18:45',
    radio: 0,
    player: { x: 0, z: 150, heading: Math.PI / 2, speed: 0, inCar: true, health: PLAYER.health, armor: PLAYER.armor },
    car: { x: 0, z: 150, heading: Math.PI / 2, speed: 0, condition: 62, name: 'RUKAN PELO GT' },
    regent: { x: 60, z: 150, heading: Math.PI / 2, speed: 9, hp: 3, alive: true },
    police: [],
    tank: { x: 40, z: 150, heading: Math.PI / 2, speed: 0, active: true, turret: 0 },
    heli: { x: 10, y: 42, z: 120, heading: 0, rotor: 0, searchX: 0, searchZ: 150 },
    yacht: { x: 96, z: 212, heading: -0.4, bob: 0 },
    traffic: [],
    peds: [],
    rivals: [],
    downed: null,
    objective: { x: 60, z: 150, radius: 9, label: 'Ram the Regent 0/3' },
    ramHits: 0,
    rivalsDown: 0,
    heat: 0,
    dialogue: { who: 'MK', name: 'MIRA KESANG', role: 'Crew · Driver', text: "He's making for the pier! Ram the Regent before it reaches the water!" },
    feed: 'CORAL-48: shots fired in the Pasaru night market',
    district: 'strand',
    errors: [],
  };

  // Traffic: eight cars and two scooters looping the grid.
  const trafficColors = ['#e8e8e8', '#2b2f36', '#c23b2e', '#3b6ea5', '#e8b13c', '#5b8c5a', '#d8d8d8', '#7b2fbe'];
  for (let i = 0; i < 10; i += 1) {
    const car = makeTrafficCar(random, trafficColors[i % trafficColors.length]);
    car.loop = i % 3;
    car.t = random();
    state.traffic.push(car);
  }

  // The crowd: dense on the Strand and in the market, thinner everywhere else.
  function scatterPeds(count, cx, cz, spread, opts = {}) {
    for (let i = 0; i < count; i += 1) {
      state.peds.push(makePed(random, cx + range(random, -spread, spread), cz + range(random, -spread, spread), opts));
    }
  }
  scatterPeds(14, 0, 158, 60); // beachfront strollers
  scatterPeds(34, -110, -50, 26, { roam: 8 }); // the night market, packed
  scatterPeds(10, 0, 10, 50);
  scatterPeds(8, -110, 70, 30);
  scatterPeds(6, 150, 40, 20);

  // Armed peds: market regulars with rifles, plus the SWAT line on the Strand.
  // No caps on the armed ones — they read as guards, not shoppers.
  for (let i = 0; i < 6; i += 1) {
    state.peds.push(makePed(random, -126 + i * 7, -44 + (i % 2) * 6, { armed: true, roam: 4, shirt: '#2b2f36', cap: false }));
  }
  for (let i = 0; i < 4; i += 1) {
    state.peds.push(makePed(random, -30 + i * 6, 146, { armed: true, roam: 3, shirt: '#1d2733', cap: false }));
  }

  function spawnPolice(count) {
    state.police = [];
    for (let i = 0; i < count; i += 1) {
      state.police.push({
        id: i,
        name: POLICE_NAMES[i % POLICE_NAMES.length],
        role: POLICE_ROLES[i % POLICE_ROLES.length],
        x: state.player.x + range(random, -40, 40),
        z: state.player.z + range(random, -30, 30),
        heading: range(random, 0, TAU),
        speed: 0,
        dist: 40 + i * 4,
      });
    }
  }

  function districtAt(x, z) {
    let best = DISTRICTS[0];
    let bestD = Infinity;
    for (const d of DISTRICTS) {
      const dd = dist2(x, z, d.x, d.z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  function collideBuildings(entity, radius) {
    for (const b of city.buildings) {
      const dx = entity.x - b.x;
      const dz = entity.z - b.z;
      if (Math.abs(dx) < b.w / 2 + radius && Math.abs(dz) < b.d / 2 + radius) {
        const pushX = b.w / 2 + radius - Math.abs(dx);
        const pushZ = b.d / 2 + radius - Math.abs(dz);
        if (pushX < pushZ) entity.x += dx >= 0 ? pushX : -pushX;
        else entity.z += dz >= 0 ? pushZ : -pushZ;
      }
    }
    entity.x = clamp(entity.x, -WORLD.half, WORLD.half);
    entity.z = clamp(entity.z, -WORLD.half, WORLD.half);
  }

  function stepCar(dt, drive, steer, braking) {
    const car = state.car;
    const accel = drive > 0 ? CAR.accel : drive < 0 ? -CAR.accel * 0.7 : 0;
    car.speed += accel * dt;
    if (braking) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
    if (drive === 0 && !braking) car.speed -= Math.sign(car.speed) * 6 * dt;
    car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
    car.heading += steer * CAR.steer * dt * clamp(Math.abs(car.speed) / 10, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideBuildings(car, 2.2);
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.heading = car.heading;
    state.player.speed = Math.abs(car.speed);
  }

  function stepOnFoot(dt, drive, steer) {
    const p = state.player;
    const target = p.heading + steer * 2.4 * dt;
    p.heading = target;
    const speed = drive !== 0 ? PLAYER.walkSpeed * drive : 0;
    p.x += Math.sin(p.heading) * speed * dt;
    p.z += Math.cos(p.heading) * speed * dt;
    p.speed = Math.abs(speed);
    collideBuildings(p, 0.9);
  }

  function stepPolice(dt) {
    for (const unit of state.police) {
      const target = angleTo(unit.x, unit.z, state.player.x, state.player.z);
      const want = unit.role === 'ROADBLOCK'
        ? angleTo(unit.x, unit.z, state.player.x + Math.sin(state.player.heading) * 26, state.player.z + Math.cos(state.player.heading) * 26)
        : target;
      unit.heading = turnToward(unit.heading, want, 2.2 * dt);
      const targetSpeed = unit.role === 'ROADBLOCK' ? 0 : 24 + Math.sin(state.time * 0.7 + unit.id) * 3;
      unit.speed += clamp(targetSpeed - unit.speed, -20 * dt, 12 * dt);
      unit.x += Math.sin(unit.heading) * unit.speed * dt;
      unit.z += Math.cos(unit.heading) * unit.speed * dt;
      collideBuildings(unit, 2);
      unit.dist = Math.round(Math.sqrt(dist2(unit.x, unit.z, state.player.x, state.player.z)));
    }
  }

  function stepTraffic(dt) {
    // Each car loops a rectangle of avenues; the loop index picks its ring.
    const rings = [
      { x0: -120, x1: 120, z0: -120, z1: 120 },
      { x0: -80, x1: 80, z0: -80, z1: 80 },
      { x0: -160, x1: 160, z0: -160, z1: 140 },
    ];
    for (const car of state.traffic) {
      const ring = rings[car.loop];
      const perimeter = 2 * (ring.x1 - ring.x0 + ring.z1 - ring.z0);
      car.t = (car.t + (car.speed * dt) / perimeter) % 1;
      const d = car.t * perimeter;
      const w = ring.x1 - ring.x0;
      const h = ring.z1 - ring.z0;
      if (d < w) { car.x = ring.x0 + d; car.z = ring.z0; car.heading = Math.PI / 2; }
      else if (d < w + h) { car.x = ring.x1; car.z = ring.z0 + (d - w); car.heading = Math.PI; }
      else if (d < 2 * w + h) { car.x = ring.x1 - (d - w - h); car.z = ring.z1; car.heading = -Math.PI / 2; }
      else { car.x = ring.x0; car.z = ring.z1 - (d - 2 * w - h); car.heading = 0; }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down) continue;
      ped.walkPhase += dt * (ped.armed ? 2 : 4);
      const homeD = dist2(ped.x, ped.z, ped.home.x, ped.home.z);
      if (homeD > ped.roam * ped.roam) {
        ped.heading = turnToward(ped.heading, angleTo(ped.x, ped.z, ped.home.x, ped.home.z), 3 * dt);
      } else if (random() < dt * 0.12) {
        ped.heading = range(random, 0, TAU);
      }
      ped.x += Math.sin(ped.heading) * ped.speed * dt * 0.4;
      ped.z += Math.cos(ped.heading) * ped.speed * dt * 0.4;
    }
    // The Regent cruises the beachfront road, turning at each end.
    const regent = state.regent;
    if (regent.alive) {
      regent.x += Math.sin(regent.heading) * regent.speed * dt;
      regent.z += Math.cos(regent.heading) * regent.speed * dt;
      if (regent.x > 170) regent.heading = -Math.PI / 2;
      if (regent.x < -170) regent.heading = Math.PI / 2;
      regent.z = 150 + Math.sin(state.time * 0.5) * 0.4;
    }
    // The tank grinds toward the player along the road, turret tracking.
    const tank = state.tank;
    if (tank.active) {
      const target = angleTo(tank.x, tank.z, state.player.x, state.player.z);
      tank.heading = turnToward(tank.heading, target, 0.5 * dt);
      tank.speed = clamp(6 - Math.sqrt(dist2(tank.x, tank.z, state.player.x, state.player.z)) * 0.02, 2, 6);
      tank.x += Math.sin(tank.heading) * tank.speed * dt;
      tank.z += Math.cos(tank.heading) * tank.speed * dt;
      tank.turret = turnToward(tank.turret, target - tank.heading, 1.2 * dt);
    }
    // The heli holds above and behind the player, rotor spinning, lamp on them.
    const heli = state.heli;
    heli.rotor += dt * 22;
    const hx = state.player.x - Math.sin(state.player.heading) * 18;
    const hz = state.player.z - Math.cos(state.player.heading) * 18;
    heli.x += (hx - heli.x) * Math.min(1, dt * 0.8);
    heli.z += (hz - heli.z) * Math.min(1, dt * 0.8);
    heli.y = 42 + Math.sin(state.time * 0.6) * 1.5;
    heli.searchX = state.player.x;
    heli.searchZ = state.player.z;
    state.yacht.bob = Math.sin(state.time * 0.8) * 0.03;
  }

  function missionStage() {
    return MISSIONS[state.mission].stages[state.stage];
  }

  // The three market rivals: armed, marked, standing in the stalls.
  function spawnRivals() {
    state.rivals = [];
    const spots = [[-118, -52], [-104, -44], [-112, -60]];
    for (const [x, z] of spots) {
      const rival = makePed(random, x, z, { armed: true, roam: 2, shirt: '#e5534b', cap: false });
      rival.rival = true;
      state.rivals.push(rival);
      state.peds.push(rival);
    }
  }

  function advanceStage() {
    const mission = MISSIONS[state.mission];
    if (state.stage + 1 < mission.stages.length) {
      state.stage += 1;
      state.stageProgress = 0;
      const next = missionStage();
      state.objective = { x: next.x, z: next.z, radius: next.radius, label: next.objective };
      // Entering the market stage brings the rivals in, however the player
      // got here — resetting straight to it or driving in from stage 0.
      if (state.mission === 0 && state.stage === 1) spawnRivals();
      return EVENT_STAGE;
    }
    state.missionDone = true;
    state.mode = 'complete';
    state.cash += state.mission === 0 ? 1200 : state.mission === 1 ? 1500 : 900;
    return EVENT_COMPLETE;
  }

  function checkObjective() {
    const obj = state.objective;
    const d = Math.sqrt(dist2(state.player.x, state.player.z, obj.x, obj.z));
    state.stageProgress = clamp(1 - d / 120, 0, 1);
    if (d > obj.radius) return EVENT_NONE;
    if (state.mission === 0 && state.stage === 1) return EVENT_NONE; // rivals, not the marker
    if (state.mission === 1 && state.stage === 0) return EVENT_NONE; // the Regent, not the marker
    return advanceStage();
  }

  function checkRam() {
    if (state.mission !== 1 || state.stage !== 0 || !state.regent.alive) return EVENT_NONE;
    const d = Math.sqrt(dist2(state.car.x, state.car.z, state.regent.x, state.regent.z));
    if (d > 5 || Math.abs(state.car.speed) < 6) return EVENT_NONE;
    state.ramHits += 1;
    state.regent.hp -= 1;
    state.car.condition = Math.max(38, state.car.condition - 8);
    state.regent.speed = 16; // it bolts after each hit
    state.objective.label = `Ram the Regent ${state.ramHits}/3`;
    if (state.regent.hp <= 0) {
      state.regent.alive = false;
      return advanceStage();
    }
    return EVENT_RAM;
  }

  function resetToMission(missionIndex, stageIndex = 0) {
    const mission = MISSIONS[missionIndex];
    state.mission = missionIndex;
    state.stage = stageIndex;
    state.stageProgress = 0;
    state.missionDone = false;
    state.mode = 'playing';
    state.cash = mission.cash;
    state.wanted = mission.wanted;
    state.timer = missionIndex === 1 ? 23 : 0;
    state.clock = missionIndex === 2 ? '22:14' : missionIndex === 0 ? '19:30' : '18:45';
    state.radio = missionIndex;
    const stage = mission.stages[stageIndex];
    state.objective = { x: stage.x, z: stage.z, radius: stage.radius, label: stage.objective };
    state.ramHits = 0;
    state.rivalsDown = 0;
    state.regent.hp = 3;
    state.regent.alive = true;
    state.regent.speed = 9;
    // Starting spots per mission: market edge, beachfront, central avenue.
    const starts = [
      { x: -60, z: -50, heading: Math.PI / 2 },
      { x: 0, z: 150, heading: Math.PI / 2 },
      { x: 0, z: 40, heading: 0 },
    ];
    const start = starts[missionIndex];
    state.player.x = start.x;
    state.player.z = start.z;
    state.player.heading = start.heading;
    state.player.speed = 0;
    state.player.inCar = !(missionIndex === 0 && stageIndex === 1);
    state.car.x = start.x;
    state.car.z = start.z;
    state.car.heading = start.heading;
    state.car.speed = 0;
    state.car.condition = missionIndex === 1 ? 62 : missionIndex === 2 ? 77 : 84;
    state.car.name = missionIndex === 2 ? 'VIREO GT' : 'RUKAN PELO GT';
    state.regent.x = 60;
    state.regent.z = 150;
    state.regent.heading = Math.PI / 2;
    state.tank.x = 40;
    state.tank.z = 150;
    state.tank.heading = Math.PI / 2;
    state.tank.active = missionIndex === 1;
    state.heli.x = 10;
    state.heli.z = 120;
    state.yacht.x = 96;
    state.yacht.z = 212;
    // Rivals only exist in the market stage; three of them, marked.
    state.rivals = [];
    if (missionIndex === 0 && stageIndex === 1) spawnRivals();
    state.downed = null;
    spawnPolice(mission.wanted + 2);
    state.district = districtAt(state.player.x, state.player.z).id;
    state.dialogue = missionIndex === 0
      ? { who: 'MK', name: 'MIRA KESANG', role: 'Crew · Driver', text: 'Two down the left aisle! I’ve got the stall side, Tomo.' }
      : missionIndex === 1
        ? { who: 'MK', name: 'MIRA KESANG', role: 'Crew · Driver', text: "He's making for the pier! Ram the Regent before it reaches the water!" }
        : { who: 'KK', name: 'KIKI TAN', role: 'Crew · Lookout', text: 'Three cruisers on your tail and a ramp at the harbor. Jump it and the tide does the rest.' };
    state.feed = missionIndex === 0 ? 'CORAL-48: shots fired in the Lantern Market' : 'SBP: roadblock forming on Central — KITE-1 closing';
  }

  function step(dt, input, autopilot = null) {
    state.time += dt;
    if (state.mode !== 'playing') {
      stepPeds(dt);
      stepTraffic(dt);
      return EVENT_NONE;
    }
    const drive = autopilot ? autopilot.drive : input.drive();
    const steer = autopilot ? autopilot.steer : input.steer();
    const braking = autopilot ? autopilot.brake : input.brake();
    const actions = autopilot ? autopilot.actions : input.takeActions();

    if (actions & 4) { // E: get in or out of the car
      if (state.player.inCar) {
        state.player.inCar = false;
        state.car.speed = 0; // a parked car reads 0, not its last speed
        state.player.x = state.car.x - Math.sin(state.car.heading) * 3;
        state.player.z = state.car.z - Math.cos(state.car.heading) * 3;
        state.player.heading = state.car.heading;
      } else if (dist2(state.player.x, state.player.z, state.car.x, state.car.z) < 25) {
        state.player.inCar = true;
      }
    }
    if (actions & 16) { // F: take down a rival up close, on foot
      if (!state.player.inCar) {
        for (const rival of state.rivals) {
          if (!rival.down && dist2(state.player.x, state.player.z, rival.x, rival.z) < 9) {
            rival.down = true;
            state.rivalsDown += 1;
            state.downed = { x: rival.x, z: rival.z };
            state.objective.label = `Take out the rivals ${state.rivalsDown}/3`;
            if (state.rivalsDown >= 3) return advanceStage();
          }
        }
      }
    }

    if (state.player.inCar) stepCar(dt, drive, steer, braking);
    else stepOnFoot(dt, drive, steer);
    stepPolice(dt);
    stepTraffic(dt);
    stepPeds(dt);
    state.district = districtAt(state.player.x, state.player.z).id;
    if (state.timer > 0) state.timer = Math.max(0, state.timer - dt);
    const ram = checkRam();
    if (ram) return ram;
    return checkObjective();
  }

  // The autopilot the shot stager and the playtest use: steer toward the
  // current target, brake into it, handle the E/F beats for the foot stage.
  function autopilotFor() {
    const p = state.player;
    let target = { x: state.objective.x, z: state.objective.z };
    if (state.mission === 1 && state.stage === 0) target = { x: state.regent.x, z: state.regent.z };
    let actions = 0;
    if (state.mission === 0 && state.stage === 1 && !p.inCar) {
      // On foot in the market: walk to the nearest standing rival.
      const rival = state.rivals.find((r) => !r.down);
      if (rival) {
        target = { x: rival.x, z: rival.z };
        const rd = Math.sqrt(dist2(p.x, p.z, rival.x, rival.z));
        if (rd < 2.6) actions |= 16;
      }
    }
    if (state.mission === 0 && state.stage === 1 && p.inCar) actions |= 4; // get out at the market
    if (state.mission === 0 && state.stage === 2 && !p.inCar) {
      // Walk back to the car first, then drive to the safehouse.
      target = { x: state.car.x, z: state.car.z };
      if (Math.sqrt(dist2(p.x, p.z, state.car.x, state.car.z)) < 4.5) actions |= 4;
    }
    const want = angleTo(p.x, p.z, target.x, target.z);
    let diff = want - p.heading;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const d = Math.sqrt(dist2(p.x, p.z, target.x, target.z));
    return {
      drive: d < 4 ? 0 : 1,
      steer: clamp(diff * 1.6, -1, 1),
      brake: d < 8 && Math.abs(p.speed) > 6,
      actions,
    };
  }

  resetToMission(1, 0);
  // Boot on the title screen: the world idles (peds walk, traffic loops)
  // until the player presses Space or clicks.
  state.mode = 'title';

  return {
    state,
    city,
    step,
    resetToMission,
    spawnPolice,
    autopilotFor,
    districtAt,
  };
}
