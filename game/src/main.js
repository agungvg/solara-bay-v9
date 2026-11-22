// Solara Bay v9 — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between title, play, paused, complete and meta.
//
// ?shot=cover|foot|night|meta (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady.
// ?playtest=1&mission=N runs the autopilot through mission N and logs every
// stage to the console, then sets window.__missionDone.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MAP, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const playtest = params.get('playtest') === '1';
const playMission = Number.parseInt(params.get('mission') ?? '0', 10);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const hud = createHud();
const random = createRandom(seed);

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// What the playtest driver and the screenshot driver read.
window.__game = null;
window.__shotReady = false;
window.__missionDone = false;
window.__missionFailed = false;

function snapshot() {
  const s = world.state;
  return {
    mode: s.mode,
    mission: s.mission,
    missionName: s.missionName || '',
    stage: s.stage,
    missionDone: s.missionDone,
    player: { x: +s.player.x.toFixed(1), z: +s.player.z.toFixed(1), heading: +s.player.heading.toFixed(2), speed: +s.player.speed.toFixed(1), inCar: s.player.inCar },
    car: { x: +s.car.x.toFixed(1), z: +s.car.z.toFixed(1), speed: +s.car.speed.toFixed(1) },
    speedSigned: +s.car.speed.toFixed(2),
    gameTime: +s.time.toFixed(2),
    objective: { x: s.objective.x, z: s.objective.z, radius: s.objective.radius },
    wanted: s.wanted,
    cash: s.cash,
    enemiesAlive: s.rivals.filter((r) => !r.down).length,
    stageCount: 3,
    stageProgress: +s.stageProgress.toFixed(2),
    regentHp: s.regent.hp,
    police: s.police.length,
    roadblock: s.police.some((u) => u.role === 'ROADBLOCK'),
    errors: s.errors,
  };
}

function runShot(name) {
  document.getElementById('title-screen').style.display = 'none';
  const scene = stageShot(name, world, renderer);
  hud.update(world.state);
  if (scene.screen === 'meta') hud.showMeta(true);
  let painted = 0;
  function paint() {
    renderer.draw(world.state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__game = snapshot();
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const hudEl = document.getElementById('hud');
  const titleEl = document.getElementById('title-screen');
  const titleHead = titleEl.querySelector('h1');
  const titleGo = titleEl.querySelector('.go');
  hudEl.style.display = 'none'; // the HUD appears once the first mission starts
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let announced = '';

  function announce(message) {
    if (message === announced) return;
    announced = message;
    status.textContent = message;
  }

  function startMission(missionIndex) {
    world.resetToMission(missionIndex, 0);
    screen = 'playing';
    titleEl.style.display = 'none';
    hudEl.style.display = '';
    announce(`Playing. ${missionIndex + 1} of 3 missions.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'complete')) startMission(screen === 'title' ? 0 : (world.state.mission + 1) % 3);
    else if (actions & ACTION_PAUSE && screen === 'playing') {
      screen = 'paused';
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'playing';
      announce('Playing.');
    } else if (actions & ACTION_MAP && (screen === 'playing' || screen === 'meta')) {
      if (screen === 'meta') {
        screen = 'playing';
        hud.showMeta(false);
      } else {
        screen = 'meta';
        hud.showMeta(true);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'playing' || screen === 'title') {
      while (accumulator >= STEP && (screen === 'playing' || screen === 'title')) {
        const events = world.step(STEP, input);
        accumulator -= STEP;
        if (events === 2) {
          screen = 'complete';
          titleHead.textContent = 'MISSION COMPLETE';
          titleGo.textContent = `CASH $${world.state.cash.toLocaleString('en-US')} — PRESS SPACE FOR THE NEXT MISSION`;
          titleEl.style.display = 'flex';
          announce(`Mission complete. Cash $${world.state.cash.toLocaleString('en-US')}.`);
        }
      }
    } else {
      accumulator = 0;
    }
    if (screen !== 'meta') {
      renderer.draw(world.state);
      hud.update(world.state);
    }
    window.__game = snapshot();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'playing') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

// The playtest: the autopilot drives mission N end to end, logging stages.
function runPlaytest() {
  document.getElementById('title-screen').style.display = 'none';
  const input = createInput(canvas);
  world.resetToMission(playMission, 0);
  const t0 = performance.now();
  let lastLog = 0;
  let lastStage = -1;
  let lastEvent = 0;
  console.log(`[playtest] start ${JSON.stringify(snapshot())}`);
  function tick() {
    // Batch fixed steps per frame: software rendering makes rAF slow, so
    // the mission advances in chunks and paints once per chunk instead.
    for (let i = 0; i < 600; i += 1) {
      const events = world.step(STEP, input, world.autopilotFor());
      const s = world.state;
      if (s.stage !== lastStage) {
        lastStage = s.stage;
        console.log(`[playtest] STAGE ${s.stage} reached. state=${JSON.stringify(snapshot())}`);
      }
      if (events !== 0 && events !== lastEvent) {
        lastEvent = events;
        console.log(`[playtest] event ${events} state=${JSON.stringify(snapshot())}`);
      }
      if (Math.floor(s.time) >= lastLog + 5) {
        lastLog = Math.floor(s.time);
        console.log(`[playtest] t=${lastLog}s stage=${s.stage} inCar=${s.player.inCar} pos=(${s.player.x.toFixed(1)},${s.player.z.toFixed(1)}) objDist=${Math.hypot(s.player.x - s.objective.x, s.player.z - s.objective.z).toFixed(1)} kmh=${Math.round(Math.abs(s.car.speed) * 3.6)} wanted=${s.wanted}`);
      }
      if (s.missionDone) {
        console.log(`[playtest] MISSION COMPLETE! ${JSON.stringify(snapshot())}`);
        console.log(`[playtest] RESULT: MISSION COMPLETED END-TO-END in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        window.__missionDone = true;
        return;
      }
      if (s.time > 240) {
        console.log('[playtest] RESULT: TIMEOUT after 240s');
        window.__missionFailed = true;
        return;
      }
    }
    const s = world.state;
    renderer.draw(s);
    hud.update(s);
    window.__game = snapshot();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (shot) runShot(shot);
else if (playtest) runPlaytest();
else runGame();
