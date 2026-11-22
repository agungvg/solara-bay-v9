// Solara Bay v9 — the screenshot scenes behind ?shot=cover|foot|night|meta.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps (so peds walk, the rotor spins and traffic moves), then
// stages the frame exactly: camera, wanted, cash, timer, the tank, the
// yacht, the downed rival. The same seed always gives the same frame.
import { MISSIONS } from './config.js';

const STEPS = 45; // 0.75 s of ambient motion before the frame is staged

function dist(ax, az, bx, bz) {
  return Math.round(Math.hypot(ax - bx, az - bz));
}

function zeroInput() {
  return { drive: () => 0, steer: () => 0, brake: () => false, takeActions: () => 0 };
}

function refreshPoliceDist(state) {
  for (const unit of state.police) {
    unit.dist = dist(unit.x, unit.z, state.player.x, state.player.z);
  }
}

function stageCover(world, renderer) {
  const { state } = world;
  world.resetToMission(1, 0);
  for (let i = 0; i < STEPS; i += 1) world.step(1 / 60, zeroInput());
  // The hero Lamborghini, fully framed, mid-chase on the beachfront road.
  state.car.x = 0; state.car.z = 150; state.car.heading = Math.PI / 2;
  state.car.speed = 31; state.car.condition = 62;
  state.player.x = 0; state.player.z = 150; state.player.heading = Math.PI / 2;
  state.player.inCar = true; state.player.speed = 31;
  // The Regent ahead, the tank big and close on the hero's right flank, the
  // heli overhead, the yacht out on the water. The tank sits just past the
  // hero, near the camera's look axis — fully framed, never behind the
  // hero, never behind a tower — so hull, turret and cannon read at a glance.
  state.regent.x = 55; state.regent.z = 150; state.regent.heading = Math.PI / 2; state.regent.speed = 14;
  state.tank.x = 6; state.tank.z = 158; state.tank.heading = Math.PI / 2; state.tank.turret = 0.3; state.tank.active = true;
  state.heli.x = 30; state.heli.y = 28; state.heli.z = 185;
  state.yacht.x = 28; state.yacht.z = 196;
  // Six units in a net: two ahead, two flanking, one behind, one roadblock.
  // None sits on the camera-to-hero line, so the Lamborghini stays clear.
  const spots = [
    [24, 138, 'RAMMING'], [-18, 150, 'PURSUIT'], [8, 160, 'FLANKING'],
    [-28, 146, 'FIRING'], [68, 150, 'ROADBLOCK'], [16, 164, 'SPOTLIGHT'],
  ];
  state.police = state.police.slice(0, 6);
  state.police.forEach((unit, i) => {
    const [x, z, role] = spots[i];
    unit.x = x; unit.z = z; unit.role = role;
    unit.heading = Math.atan2(state.player.x - x, state.player.z - z);
    unit.speed = 18;
  });
  // Traffic on the beachfront road, caught in the chase.
  const cars = [[42, 150], [-32, 150], [80, 143], [-52, 143]];
  state.traffic.forEach((car, i) => {
    if (i < cars.length) { car.x = cars[i][0]; car.z = cars[i][1]; car.heading = Math.PI / 2; }
  });
  state.cash = 18450;
  state.wanted = 4;
  state.timer = 23;
  state.clock = '18:45';
  state.objective.label = 'Ram the Regent 0/3';
  state.dialogue = { who: 'MK', name: 'MIRA KESANG', role: 'Crew · Driver', text: "He's making for the pier! Ram the Regent before it reaches the water!" };
  refreshPoliceDist(state);
  // Three-quarter rear view from the road's north edge: the Lambo shows its
  // side and rear, big in the lower frame; the look axis runs through it,
  // the ocean and the yacht fill the background to the south-east.
  renderer.setShotCamera(-10, 3.8, 143, 14, 1.2, 158);
  return { screen: 'playing', best: 0 };
}

function stageFoot(world, renderer) {
  const { state } = world;
  world.resetToMission(0, 1);
  for (let i = 0; i < STEPS; i += 1) world.step(1 / 60, zeroInput());
  // On foot in the Lantern Market aisle, rifle in hand, crowd shoulder to
  // shoulder, one rival already down in the left aisle.
  state.player.x = -126; state.player.z = -50; state.player.heading = Math.PI / 2;
  state.player.inCar = false; state.player.speed = 0;
  state.player.health = 95; state.player.armor = 27;
  state.car.x = -140; state.car.z = -38; state.car.heading = Math.PI / 2;
  const rival = state.rivals[0];
  if (rival) {
    rival.down = true;
    rival.x = -116; rival.z = -50; // dead centre of the aisle, in the open
    state.rivalsDown = 1;
    state.downed = { x: -116, z: -50 };
  }
  state.objective.label = 'Take out the rivals 1/3';
  // Pack the aisle: extra shoppers between the stalls, two rows deep.
  // Leave the downed rival in the open: no shopper stands on the body.
  let placed = 0;
  let cell = 0;
  for (const ped of state.peds) {
    if (placed >= 16 || ped.down || ped.rival) continue;
    const gx = -128 + (cell % 8) * 3.4;
    const gz = -52 + Math.floor(cell / 8) * 4;
    cell += 1;
    if (Math.hypot(gx + 116, gz + 50) < 4.5) continue;
    ped.x = gx;
    ped.z = gz;
    ped.heading = Math.PI / 2;
    placed += 1;
  }
  // Three black-uniformed guards on foot, rifles forward, facing the camera.
  let guards = 0;
  for (const ped of state.peds) {
    if (guards >= 3 || !ped.armed || ped.rival || ped.down) continue;
    const spot = [[-104, -52], [-104, -46], [-124, -48]][guards];
    ped.x = spot[0]; ped.z = spot[1];
    ped.heading = -Math.PI / 2; // face the camera down the aisle
    guards += 1;
  }
  // Keep traffic out of the market for this shot.
  const cars = [[-40, 120], [60, 120], [120, 40], [-160, 60]];
  state.traffic.forEach((car, i) => {
    if (i < cars.length) { car.x = cars[i][0]; car.z = cars[i][1]; car.heading = 0; }
  });
  // A black van burning at the end of the aisle, facing the camera down
  // the market — flames and smoke on the vanishing point.
  const van = state.traffic[0];
  van.kind = 'van'; van.color = 0x14161a; van.burning = true;
  van.x = -96; van.z = -50; van.heading = -Math.PI / 2;
  state.police = state.police.slice(0, 2);
  state.police[0].x = -96; state.police[0].z = -38; state.police[0].role = 'RAMMING';
  state.police[1].x = -140; state.police[1].z = -62; state.police[1].role = 'PURSUIT';
  state.cash = 7270;
  state.wanted = 2;
  state.timer = 0;
  state.clock = '19:30';
  state.feed = 'CORAL-48: shots fired in the Lantern Market';
  state.dialogue = { who: 'MK', name: 'MIRA KESANG', role: 'Crew · Driver', text: "Two down the left aisle! I've got the stall side, Tomo." };
  refreshPoliceDist(state);
  // Low over-the-shoulder, down the aisle: stalls both sides, crowd ahead,
  // the downed rival in the left aisle.
  renderer.setShotCamera(-132, 3.4, -50, -100, 1.4, -50);
  return { screen: 'playing', best: 0 };
}

function stageNight(world, renderer) {
  const { state } = world;
  world.resetToMission(2, 0);
  for (let i = 0; i < STEPS; i += 1) world.step(1 / 60, zeroInput());
  // Night chase up Central avenue: neon towers both sides, heli lamp on the
  // car, five units closing in.
  state.car.x = 0; state.car.z = 60; state.car.heading = Math.PI;
  state.car.speed = 27; state.car.condition = 77;
  state.player.x = 0; state.player.z = 60; state.player.heading = Math.PI;
  state.player.inCar = true; state.player.speed = 27;
  state.heli.x = 8; state.heli.y = 24; state.heli.z = 30;
  // All five units ahead of the car, inside the camera's view up the avenue.
  const spots = [
    [5, 30, 'RAMMING'], [-7, 42, 'PURSUIT'], [9, 52, 'FLANKING'],
    [-11, 24, 'ROADBLOCK'], [2, 14, 'SPOTLIGHT'],
  ];
  state.police = state.police.slice(0, 5);
  state.police.forEach((unit, i) => {
    const [x, z, role] = spots[i];
    unit.x = x; unit.z = z; unit.role = role;
    unit.heading = Math.atan2(state.player.x - x, state.player.z - z);
    unit.speed = 22;
  });
  state.cash = 12860;
  state.wanted = 3;
  state.timer = 15;
  state.clock = '22:14';
  state.objective.label = 'Outrun the first wave';
  // Traffic caught in the chase up the avenue, and shoppers on the
  // sidewalks, so the mid-street is not empty dark asphalt.
  const nightCars = [[6, 45], [-5, 58], [3, 30], [-8, 68]];
  state.traffic.forEach((car, i) => {
    if (i < nightCars.length) { car.x = nightCars[i][0]; car.z = nightCars[i][1]; car.heading = Math.PI; }
  });
  let sidewalk = 0;
  for (const ped of state.peds) {
    if (sidewalk >= 6 || ped.down || ped.rival || ped.armed) continue;
    const spot = [[-9, 28], [9, 36], [-9, 48], [9, 56], [-9, 64], [9, 70]][sidewalk];
    ped.x = spot[0]; ped.z = spot[1];
    ped.heading = spot[0] < 0 ? Math.PI / 2 : -Math.PI / 2;
    sidewalk += 1;
  }
  state.dialogue = { who: 'KK', name: 'KIKI TAN', role: 'Crew · Lookout', text: 'Three cruisers on your tail and a ramp at the harbor. Jump it and the tide does the rest.' };
  refreshPoliceDist(state);
  // Chase cam, low and close, up the avenue between the towers.
  renderer.setShotCamera(-3, 4.4, 74, 2, 1.6, 20);
  return { screen: 'playing', best: 0 };
}

function stageMeta(world, renderer) {
  const { state } = world;
  world.resetToMission(1, 0);
  for (let i = 0; i < STEPS; i += 1) world.step(1 / 60, zeroInput());
  // Parked at the docks behind the meta screen; the cash is the career total.
  state.car.x = 150; state.car.z = 40; state.car.heading = -Math.PI / 2;
  state.player.x = 150; state.player.z = 40; state.player.heading = -Math.PI / 2;
  state.player.inCar = true;
  state.cash = 21340;
  state.wanted = 0;
  state.timer = 0;
  renderer.setShotCamera(138, 42, -6, 150, 0, 40);
  return { screen: 'meta', best: 0 };
}

const STAGES = { cover: stageCover, foot: stageFoot, night: stageNight, meta: stageMeta };

/**
 * Stage the named shot and return the screen the renderer should draw.
 * Any unknown name stages the cover.
 */
export function stageShot(name, world, renderer) {
  const stage = STAGES[name] || stageCover;
  return stage(world, renderer);
}

export function shotNames() {
  return Object.keys(STAGES);
}

// The mission list the dossier's shots.json points at.
export const SHOT_LIST = [
  { name: '1-cover.png', query: '?shot=cover&seed=7' },
  { name: '2-foot.png', query: '?shot=foot&seed=7' },
  { name: '3-night.png', query: '?shot=night&seed=7' },
  { name: '4-meta.png', query: '?shot=meta&seed=7' },
];

export { MISSIONS };
