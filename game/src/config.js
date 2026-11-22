// Solara Bay v9 — every tuning number, colour and mission fact in one place.
// The city is a Leonida-style coastal grid: downtown towers in the middle,
// the beachfront road and the ocean along the south edge, the Lantern Market
// in the west, the docks in the east, the interchange in the north-east.
// x runs east, z runs south; the ocean starts where z passes the sand.
export const STEP = 1 / 60;

// The unified v9 palette — every shot uses these colours and no others.
export const PALETTE = {
  sunset: 0xff7a33,
  amber: 0xffb347,
  neonPink: 0xff2e88,
  duskPurple: 0x7b2fbe,
  neonCyan: 0x00e5ff,
  nightBlue: 0x0e1e3a,
  streetlight: 0xffc46b,
  oceanTeal: 0x1e7f9e,
  // CSS twins, for the HUD that paints over the canvas.
  cssSunset: '#ff7a33',
  cssAmber: '#ffb347',
  cssPink: '#ff2e88',
  cssPurple: '#7b2fbe',
  cssCyan: '#00e5ff',
  cssNight: '#0e1e3a',
  cssLamp: '#ffc46b',
  cssTeal: '#1e7f9e',
};

export const WORLD = {
  half: 210, // the ground plane reaches this far each way from the centre
  beachZ: 150, // sand starts here
  oceanZ: 186, // water starts here
  roadGap: 40, // avenues repeat every 40 units
  roadHalf: 5, // half the width of a road
};

// Seven districts, each with a standing the player can raise or lose.
export const DISTRICTS = [
  { id: 'strand', name: 'THE STRAND', short: 'STRAND', label: 'Beachfront', standing: 52, x: 0, z: 165 },
  { id: 'marina', name: 'MARINA ROW', short: 'MARINA', label: 'Marina', standing: 58, x: 80, z: 130 },
  { id: 'central', name: 'CENTRAL', short: 'CENTRAL', label: 'Solara Square', standing: 62, x: 0, z: 0 },
  { id: 'oldtown', name: 'OLD TOWN', short: 'OLD', label: 'Old Town', standing: 66, x: -110, z: 60 },
  { id: 'market', name: 'LANTERN MARKET', short: 'MARKET', label: 'Night Market', standing: 74, x: -110, z: -50 },
  { id: 'harbor', name: 'HARBOR', short: 'HARBOR', label: 'Docks', standing: 47, x: 150, z: 40 },
  { id: 'heights', name: 'HEIGHTS', short: 'HEIGHTS', label: 'Uptown', standing: 34, x: -40, z: -140 },
];

export const CREW = [
  { key: 'MK', name: 'MIRA KESANG', role: 'Driver', ability: 'SWAP PLATES', cd: 0 },
  { key: 'LO', name: 'LIO', role: 'Mechanic', ability: 'QUICK FIX', cd: 12 },
  { key: 'KK', name: 'KIKI TAN', role: 'Lookout', ability: 'EYES OUT', cd: 30 },
];

export const WEAPONS = [
  { slot: 1, name: 'FIST', sub: 'FISTS', ammo: '∞' },
  { slot: 2, name: '.38', sub: 'REVOLVER', ammo: 60 },
  { slot: 3, name: 'SMG', sub: 'SMG', ammo: '30/90' },
  { slot: 4, name: '12G', sub: '12G PUMP', ammo: 18 },
  { slot: 5, name: 'AR-9', sub: 'RIFLE', ammo: 45 },
  { slot: 6, name: 'FLR', sub: 'FLARE', ammo: 'x3' },
];

// The three chapters. Cash is what the dossier shows at the staged moment;
// finishing a mission pays the bonus on top.
export const MISSIONS = [
  {
    chapter: 'CH. 1 · FIRST LIGHT',
    name: 'MARKET SQUEEZE',
    cash: 7270,
    wanted: 2,
    rank: 9,
    rankName: 'WHEELMAN',
    stages: [
      { objective: 'Drive to the Lantern Market', next: 'Park by the stalls', x: -110, z: -50, radius: 10 },
      { objective: 'Take out the rivals 0/3', next: 'Melt away through the crowd', x: -108, z: -46, radius: 14 },
      { objective: 'Reach the safehouse', next: 'Lay low in Old Town', x: -120, z: 90, radius: 9 },
    ],
  },
  {
    chapter: 'CH. 3 · HIGH WATER',
    name: 'WRECK THE REGENT',
    cash: 18450,
    wanted: 4,
    rank: 6,
    rankName: 'FIXER',
    stages: [
      { objective: 'Ram the Regent 0/3', next: 'Lose the heat', x: 60, z: 150, radius: 9 },
      { objective: 'Lose the heat', next: 'Reach the pier', x: -40, z: 150, radius: 12 },
      { objective: 'Reach the pier', next: 'Hand off the plates', x: 120, z: 150, radius: 9 },
    ],
  },
  {
    chapter: 'CH. 4 · NEON TIDE',
    name: 'NEON TIDE',
    cash: 12860,
    wanted: 3,
    rank: 7,
    rankName: 'HUSTLER',
    stages: [
      { objective: 'Outrun the first wave', next: 'Vanish into Old Town', x: -100, z: 60, radius: 12 },
      { objective: 'Vanish into Old Town', next: 'Park it and walk away', x: -130, z: 80, radius: 9 },
    ],
  },
];

export const CAR = {
  accel: 26,
  brake: 42,
  maxSpeed: 34, // ~122 km/h
  reverseMax: 10,
  steer: 1.9,
  grip: 2.2,
};

export const PLAYER = {
  walkSpeed: 6.5,
  health: 100,
  armor: 60,
};

export const POLICE_NAMES = ['KITE-1', 'CORAL-85', 'CORAL-43', 'CORAL-48', 'HERON-2', 'TIDE-37'];
export const POLICE_ROLES = ['RAMMING', 'PURSUIT', 'FLANKING', 'ROADBLOCK', 'SPOTLIGHT', 'FIRING'];

export const RADIOS = [
  'LUMEN FM 98.6 — Glass Hours — Vela',
  'OMBO 98.4 — Tide Runner — Sol Mara',
  'SOLARA 101 — Night Desk — Harbor FM',
];

export const META_CASH = 21340;
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
