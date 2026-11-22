// A small seeded generator so a shot stages the same way every time.
// mulberry32's shape, written out here: the state is one 32-bit word, each
// call scrambles it with a fixed odd constant and folds the bits down.
export function createRandom(seed) {
  let state = (seed | 0) || 1;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry of `list` with the seeded generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A number in [min, max) from the seeded generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
