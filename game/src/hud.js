// Solara Bay v9 — the HUD: every panel the dossier needs to see, painted
// as DOM over the 3D canvas. The minimap is circular (the v8 nit, fixed);
// the meta screen is a real in-game screen, opened with Tab, not a mock.
import { CREW, DISTRICTS, MISSIONS, PALETTE, WEAPONS } from './config.js';

const HINTS = {
  strand: 'OPEN ROAD, OPEN SKY',
  marina: 'BOATS LEAVE NO TRAIL',
  central: 'CROWDS HIDE A FACE',
  oldtown: 'OLD WALLS, QUIET STREETS',
  market: 'DUCK BY A STALL TO HIDE',
  harbor: 'CRATES MAKE COVER',
  heights: 'HIGH GROUND, LONG VIEW',
};

const RP = [
  { value: 1675, max: 1800 },
  { value: 3900, max: 5200 },
  { value: 2400, max: 3200 },
];

const META_PROGRESS = [
  ['Story missions', 5, 8],
  ['Street races won', 1, 4],
  ['Stunt jumps', 5, 8],
  ['Hidden geckos', 12, 20],
  ['Export list', 3, 5],
  ['District jobs', 5, 7],
  ['Districts FRIENDLY', 3, 7],
  ['Crew recruited', 3, 3],
  ['Gold mission ratings', 2, 8],
];

const META_STATS = [
  ['41', 'CARS STOLEN'], ['12', 'COPS ESCAPED'],
  ['★★★★', 'HIGHEST WANTED'], ['48.2 km', 'DISTANCE DRIVEN'],
  ['23', 'PEOPLE TAKEN OUT'], ['47 m', 'LONGEST JUMP'],
  ['38', 'CREW ABILITIES'], ['9', 'HIDDEN BY LOCALS'],
];

function el(id) {
  return document.getElementById(id);
}

function stars(n) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '☆';
  return out;
}

function bar(percent, color) {
  return `<div class="bar"><div class="fill" style="width:${Math.round(percent * 100)}%;background:${color}"></div></div>`;
}

// The circular minimap: districts as tinted blocks, roads as lines, the
// ocean as a teal strip along the bottom, the player as an amber arrow,
// police as blue dots, the objective as a pulsing ring.
function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const C = S / 2;
  const R = C - 3;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.clip();
  // Ground.
  ctx.fillStyle = '#10151f';
  ctx.fillRect(0, 0, S, S);
  const scale = S / 460;
  const px = (x) => C + x * scale;
  const pz = (z) => C + (z + 20) * scale;
  // Ocean along the south edge.
  ctx.fillStyle = PALETTE.cssTeal;
  ctx.fillRect(0, pz(186), S, S - pz(186));
  ctx.fillStyle = '#d9b078';
  ctx.fillRect(0, pz(150), S, pz(186) - pz(150));
  // Districts, tinted by standing.
  for (const d of DISTRICTS) {
    const standing = d.standing;
    ctx.fillStyle = standing >= 70 ? 'rgba(61,220,132,0.5)' : standing >= 45 ? 'rgba(255,196,107,0.42)' : 'rgba(255,46,136,0.4)';
    ctx.fillRect(px(d.x) - 22, pz(d.z) - 14, 44, 28);
    ctx.fillStyle = 'rgba(238,241,245,0.85)';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.short, px(d.x), pz(d.z) + 2);
  }
  // Roads.
  ctx.strokeStyle = 'rgba(238,241,245,0.28)';
  ctx.lineWidth = 1;
  for (let x = -160; x <= 160; x += 40) {
    ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), S); ctx.stroke();
  }
  for (let z = -160; z <= 140; z += 40) {
    ctx.beginPath(); ctx.moveTo(0, pz(z)); ctx.lineTo(S, pz(z)); ctx.stroke();
  }
  // Objective ring.
  const pulse = 4 + Math.sin(state.time * 4) * 1.5;
  ctx.strokeStyle = PALETTE.cssLamp;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px(state.objective.x), pz(state.objective.z), pulse + 3, 0, Math.PI * 2);
  ctx.stroke();
  // Police dots.
  ctx.fillStyle = '#5aa2ff';
  for (const unit of state.police) {
    ctx.beginPath();
    ctx.arc(px(unit.x), pz(unit.z), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, an amber arrow pointing where they face.
  ctx.save();
  ctx.translate(px(state.player.x), pz(state.player.z));
  ctx.rotate(Math.atan2(Math.sin(state.player.heading), -Math.cos(state.player.heading)) + Math.PI / 2);
  ctx.fillStyle = PALETTE.cssAmber;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Rim + north tick.
  ctx.strokeStyle = PALETTE.cssAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eef1f5';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', C, 13);
}

export function createHud() {
  const meta = el('meta');
  // Build the meta screen once: tabs, completion ring, progress, map,
  // career stats, save slots, and the Dockside Customs workshop panel.
  meta.innerHTML = `
    <div class="meta-inner">
      <div class="meta-head">
        <div class="meta-title">SOLARA BAY</div>
        <div class="meta-tabs"><span>MAP</span><span>STORY</span><span class="on">STATS</span><span>CREW</span><span>SETTINGS</span><span>CONTROLS</span><span>SAVE</span></div>
        <div class="meta-cash" id="meta-cash">$21,340</div>
      </div>
      <div class="meta-cols">
        <div class="meta-col">
          <div class="panel">
            <svg class="ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#232a38" stroke-width="10"/>
              <circle cx="60" cy="60" r="48" fill="none" stroke="#ffb347" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="301.6" stroke-dashoffset="102.2" transform="rotate(-90 60 60)"/>
              <text x="60" y="56" text-anchor="middle" fill="#eef1f5" font-size="20" font-weight="700">66.1%</text>
              <text x="60" y="74" text-anchor="middle" fill="#8b93a3" font-size="9">COMPLETE</text>
            </svg>
            ${META_PROGRESS.map(([label, got, total]) => `
              <div class="prog"><span>${label}</span>${bar(got / total, '#00e5ff')}<b>${got}/${total}</b></div>`).join('')}
          </div>
          <div class="panel">
            <div class="panel-title">MISSION RATINGS</div>
            <div class="ratings">${['G', 'S', 'G', 'B', 'S', '—', '—', '—'].map((r, i) => `<span class="rate ${r === '—' ? 'todo' : ''}">${i + 1}<b>${r}</b></span>`).join('')}</div>
          </div>
          <div class="panel">
            <div class="panel-title">SAVE SLOTS</div>
            ${[1, 2, 3].map((n) => `<div class="save"><span>${n} · ${['Marina Row', 'Harbor', 'Lantern Market'][n - 1]}</span><span class="muted">66.1% · 15:1${n}</span><button>SAVE</button></div>`).join('')}
          </div>
        </div>
        <div class="meta-col">
          <div class="panel map-panel">
            <svg viewBox="0 0 300 220" class="district-map">
              <rect x="8" y="8" width="284" height="204" fill="#0b1424" stroke="#232a38"/>
              ${DISTRICTS.map((d) => {
                const x = 40 + ((d.x + 160) / 320) * 220;
                const y = 20 + ((d.z + 160) / 320) * 170;
                const fill = d.standing >= 70 ? '#1d5c38' : d.standing >= 45 ? '#6b4d1a' : '#5c1a30';
                return `<g><rect x="${x - 26}" y="${y - 12}" width="52" height="24" fill="${fill}" stroke="#8b93a3" stroke-width="0.5"/>
                  <text x="${x}" y="${y - 1}" text-anchor="middle" fill="#eef1f5" font-size="6.5" font-weight="700">${d.name}</text>
                  <text x="${x}" y="${y + 8}" text-anchor="middle" fill="#ffc46b" font-size="6">${d.standing >= 70 ? 'FRIENDLY' : d.standing >= 45 ? 'NEUTRAL' : 'WARY'} · ${d.standing}</text></g>`;
              }).join('')}
              <polyline points="70,60 120,90 150,140 200,120" fill="none" stroke="#ffc46b" stroke-width="1.5" stroke-dasharray="4 3"/>
              <circle cx="150" cy="140" r="4" fill="#ffc46b"/>
              <text x="150" y="158" text-anchor="middle" fill="#ffc46b" font-size="7">YOU</text>
            </svg>
            <div class="map-foot">Street race: Terrace Climb · 0.79 km</div>
          </div>
          <div class="panel">
            <div class="panel-title">CAREER</div>
            <div class="stats">${META_STATS.map(([v, label]) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`).join('')}</div>
          </div>
        </div>
        <div class="meta-col">
          <div class="panel">
            <div class="panel-title">RANK 5 · FIXER</div>
            <div class="rank-line">3,900 RP · 1,300 to Shot Caller</div>
            ${bar(3900 / 5200, '#ffb347')}
            <div class="muted">Next: Garage · SBP Bastion</div>
          </div>
          <div class="panel">
            <div class="panel-title">DOCKSIDE CUSTOMS · WORKSHOP</div>
            <div class="mech">Pilar Santos · mechanic · “You break it, I bill it.”</div>
            ${[
              ['FIX', 'FULL REPAIR', '$250', ''],
              ['PAINT', 'RESPRAY', '$400', ''],
              ['+12%', 'STAGE 2 TUNE', '✓ OWNED', 'owned'],
              ['PLATE', 'ARMOUR PLATING', '$3,600', 'sel'],
              ['NITRO', 'NITRO KIT', 'LOCKED · LV 6', ''],
            ].map(([tag, name, price, cls]) => `<div class="shop ${cls}"><span class="tag">${tag}</span><span>${name}</span><b>${price}</b></div>`).join('')}
            <div class="panel-title" style="margin-top:10px">WEAPONS &amp; GEAR</div>
            ${[
              ['RATTLER SMG', 'OWNED'],
              ['TIDEBREAKER', 'OWNED'],
              ['HARRIER LR', '$6,800'],
              ['FLARE CHARGES X3', '$600'],
              ['AMMO', '$200'],
              ['BODY ARMOUR', '$350'],
            ].map(([name, price]) => `<div class="shop"><span>${name}</span><b>${price}</b></div>`).join('')}
            <button class="back">BACK TO THE STREET</button>
          </div>
        </div>
      </div>
    </div>`;

  function update(state) {
    const mission = MISSIONS[state.mission];
    const stage = mission.stages[state.stage];
    el('chapter').textContent = mission.chapter;
    el('mission-name').textContent = mission.name;
    el('stage-label').textContent = `STAGE ${state.stage + 1}/${mission.stages.length}`;
    el('stage-fill').style.width = `${Math.round((state.stage + (state.missionDone ? 1 : state.stageProgress)) / mission.stages.length * 100)}%`;
    el('objective').textContent = state.objective.label;
    el('next-line').textContent = `NEXT ${stage.next}`;
    el('timer').textContent = state.timer > 0 ? `0:${String(Math.ceil(state.timer)).padStart(2, '0')}` : '';
    el('timer').style.display = state.timer > 0 ? '' : 'none';
    el('cash').textContent = `$${state.cash.toLocaleString('en-US')}`;
    el('wanted').textContent = stars(state.wanted);
    el('rank-line').textContent = `RANK ${mission.rank} ${mission.rankName}`;
    el('rp-line').textContent = `${RP[state.mission].value.toLocaleString('en-US')} / ${RP[state.mission].max.toLocaleString('en-US')} RP`;
    el('rp-fill').style.width = `${Math.round(RP[state.mission].value / RP[state.mission].max * 100)}%`;
    el('clock').textContent = state.clock;
    el('radio').textContent = `♪ ${['LUMEN FM 98.6 — Glass Hours — Vela', 'OMBO 98.4 — Tide Runner — Sol Mara', 'SOLARA 101 — Night Desk — Harbor FM'][state.radio]}`;
    el('feed').textContent = state.feed;
    el('insight').style.display = state.wanted >= 4 ? '' : 'none';
    el('airunit').style.display = state.wanted >= 3 ? '' : 'none';

    // Crew chips with countdowns that tick with game time.
    const chips = CREW.map((c, i) => {
      const cd = c.cd === 0 ? 'READY' : `${Math.max(0, c.cd - Math.floor(state.time % 45))}S`;
      return `<span class="chip"><b>${c.key}</b> ${c.name.split(' ')[0]} ${i === 0 ? 'GETAWAY' : i === 1 ? 'QUICK FIX' : 'LOOKOUT'} ${cd}</span>`;
    }).join('');
    el('crew-chips').innerHTML = chips;

    // Police panel: named units, roles, live distances.
    el('police-list').innerHTML = state.police.map((u) => `
      <div class="unit"><span class="dot"></span><b>${u.name}</b><span class="role ${u.role.toLowerCase()}">${u.role}</span><span class="dist">${u.dist} m</span></div>`).join('');
    el('unit-count').textContent = `${state.police.length} UNITS`;

    const district = DISTRICTS.find((d) => d.id === state.district) || DISTRICTS[0];
    el('district-name').textContent = district.name;
    el('district-label').textContent = district.label;
    el('standing-label').textContent = `${district.standing >= 70 ? 'FRIENDLY' : district.standing >= 45 ? 'NEUTRAL' : 'WARY'} · ${district.standing}`;
    el('standing-fill').style.width = `${district.standing}%`;
    el('hint-line').textContent = HINTS[state.district] || '';

    // Weapon slots: SMG selected.
    el('weapons').innerHTML = WEAPONS.map((w) => `
      <div class="weapon ${w.slot === 3 ? 'sel' : ''}"><span class="wnum">${w.slot}</span><b>${w.name}</b><span>${w.sub}</span><i>${w.ammo}</i></div>`).join('');

    // Crew ability cards.
    el('crew-cards').innerHTML = CREW.map((c) => `
      <div class="crew-card"><span class="avatar" style="background:${c.key === 'MK' ? '#3b6ea5' : c.key === 'LO' ? '#c96a1e' : '#7b2fbe'}">${c.key}</span>
      <div><b>${c.ability}</b><span>${c.name.split(' ')[0]} · ${c.role}</span></div><span class="key">${c.key === 'MK' ? 'Z' : c.key === 'LO' ? 'X' : 'C'}</span></div>`).join('');

    // Speed, vehicle, condition.
    const kmh = Math.round(Math.abs(state.player.inCar ? state.car.speed : state.player.speed) * 3.6);
    el('speed').textContent = kmh;
    el('vehicle').textContent = state.player.inCar ? state.car.name : 'ON FOOT';
    el('condition').textContent = `CONDITION ${state.car.condition}% · ${state.car.condition >= 80 ? 'CLEAN' : 'DENTED'}`;
    el('cond-fill').style.width = `${state.car.condition}%`;
    el('health-fill').style.width = `${state.player.health}%`;
    el('health-num').textContent = state.player.health;
    el('armor-fill').style.width = `${state.player.armor}%`;
    el('armor-num').textContent = state.player.armor;

    // Dialogue.
    el('dlg-who').textContent = `${state.dialogue.name} · ${state.dialogue.role}`;
    el('dlg-text').textContent = state.dialogue.text;
    el('dlg-ava').textContent = state.dialogue.who;

    drawMinimap(el('minimap'), state);
    el('meta-cash').textContent = `$${state.cash.toLocaleString('en-US')}`;
  }

  function showMeta(show) {
    meta.style.display = show ? 'flex' : 'none';
    el('hud').style.display = show ? 'none' : '';
  }

  return { update, showMeta };
}
