// Keyboard input, read once a frame. Keys are tracked as a set so holding
// two of them (drive + steer, walk + run) works, and actions are edges:
// pressing a key queues it once, the game drains the queue each step.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MAP = 8;
export const ACTION_TAKEDOWN = 16;
export const ACTION_CREW = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  Tab: ACTION_MAP,
  KeyF: ACTION_TAKEDOWN,
  KeyM: ACTION_MAP,
  KeyC: ACTION_CREW,
  KeyZ: ACTION_CREW,
  KeyX: ACTION_CREW,
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;

  function onKeyDown(event) {
    if (event.code === 'Tab') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) queued |= action;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', () => {
    queued |= ACTION_CONFIRM;
  });

  return {
    // -1 left, +1 right (A/D or arrows); in the car this steers, on foot it strafes.
    steer() {
      let value = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) value -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) value += 1;
      return value;
    },
    // -1 back, +1 forward (W/S or arrows).
    drive() {
      let value = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) value += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) value -= 1;
      return value;
    },
    brake() {
      return held.has('Space');
    },
    // Drain the queued edge actions and clear them.
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
