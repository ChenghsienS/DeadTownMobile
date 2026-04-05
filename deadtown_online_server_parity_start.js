
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const TICK_RATE = 50;
const DT = TICK_RATE / 1000;
const WORLD = { w: 3600, h: 2400, cx: 1800, cy: 1200 };

const rooms = new Map();
const clients = new Map();

function id(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function cleanName(name) {
  const v = String(name || '').trim().slice(0, 18);
  return v || 'Player';
}
function cleanRoomName(name, owner = 'DeadTown Room') {
  const v = String(name || '').trim().slice(0, 24);
  return v || owner;
}
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function send(ws, payload) { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); }

function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circleRectCollision(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w), ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function pushOutCircleRect(obj, rect) {
  const nx = clamp(obj.x, rect.x, rect.x + rect.w), ny = clamp(obj.y, rect.y, rect.y + rect.h);
  let dx = obj.x - nx, dy = obj.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= obj.radius * obj.radius) return false;
  if (d2 === 0) {
    const left = Math.abs(obj.x - rect.x), right = Math.abs(rect.x + rect.w - obj.x), top = Math.abs(obj.y - rect.y), bottom = Math.abs(rect.y + rect.h - obj.y);
    const min = Math.min(left, right, top, bottom);
    if (min === left) obj.x = rect.x - obj.radius;
    else if (min === right) obj.x = rect.x + rect.w + obj.radius;
    else if (min === top) obj.y = rect.y - obj.radius;
    else obj.y = rect.y + rect.h + obj.radius;
    return true;
  }
  const d = Math.sqrt(d2), overlap = obj.radius - d;
  obj.x += (dx / d) * overlap;
  obj.y += (dy / d) * overlap;
  return true;
}
function makeSeededRng(seed) {
  let s = (seed >>> 0) || 123456789;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function generateServerMap(seed) {
  const rnd = makeSeededRng(seed);
  const roads = [];
  const majorV = [480, 1080, 1800, 2550, 3150], majorH = [360, 960, 1560, 2100];
  for (const x of majorV) roads.push({ x: x - 50, y: 0, w: 100, h: WORLD.h });
  for (const y of majorH) roads.push({ x: 0, y: y - 50, w: WORLD.w, h: 100 });
  const buildings = [];
  const safe = { x: WORLD.cx - 160, y: WORLD.cy - 120, w: 320, h: 240 };
  const roadOverlap = (rect) => roads.some((r) => rectsOverlap(rect, r));
  let tries = 0;
  while (buildings.length < 42 && tries < 2000) {
    tries++;
    const w = Math.floor(90 + rnd() * 130);
    const h = Math.floor(90 + rnd() * 130);
    const x = Math.floor(40 + rnd() * (WORLD.w - w - 80));
    const y = Math.floor(40 + rnd() * (WORLD.h - h - 80));
    const rect = { x, y, w, h };
    if (rectsOverlap(rect, safe) || roadOverlap(rect)) continue;
    let bad = false;
    for (const b of buildings) {
      if (rectsOverlap({ x: x - 20, y: y - 20, w: w + 40, h: h + 40 }, b)) { bad = true; break; }
    }
    if (bad) continue;
    const sides = ['bottom', 'top', 'left', 'right'];
    const side = sides[Math.floor(rnd() * 4)];
    const doorSize = 30;
    let door;
    if (side === 'bottom') door = { x: x + Math.floor(w / 2 - doorSize / 2), y: y + h - 10, w: doorSize, h: 20 };
    if (side === 'top') door = { x: x + Math.floor(w / 2 - doorSize / 2), y: y - 10, w: doorSize, h: 20 };
    if (side === 'left') door = { x: x - 10, y: y + Math.floor(h / 2 - doorSize / 2), w: 20, h: doorSize };
    if (side === 'right') door = { x: x + w - 10, y: y + Math.floor(h / 2 - doorSize / 2), w: 20, h: doorSize };
    buildings.push({ x, y, w, h, door });
  }
  return { roads, buildings };
}
function getBuildingWallRects(b) {
  const t = 6;
  if (b.door.y < b.y + 1) {
    return [
      { x: b.x, y: b.y, w: b.door.x - b.x, h: t },
      { x: b.door.x + b.door.w, y: b.y, w: b.x + b.w - (b.door.x + b.door.w), h: t },
      { x: b.x, y: b.y, w: t, h: b.h },
      { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
      { x: b.x, y: b.y + b.h - t, w: b.w, h: t },
    ].filter((r) => r.w > 0 && r.h > 0);
  } else if (b.door.y > b.y + b.h - 15) {
    return [
      { x: b.x, y: b.y + b.h - t, w: b.door.x - b.x, h: t },
      { x: b.door.x + b.door.w, y: b.y + b.h - t, w: b.x + b.w - (b.door.x + b.door.w), h: t },
      { x: b.x, y: b.y, w: t, h: b.h },
      { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
      { x: b.x, y: b.y, w: b.w, h: t },
    ].filter((r) => r.w > 0 && r.h > 0);
  } else if (b.door.x < b.x + 1) {
    return [
      { x: b.x, y: b.y, w: t, h: b.door.y - b.y },
      { x: b.x, y: b.door.y + b.door.h, w: t, h: b.y + b.h - (b.door.y + b.door.h) },
      { x: b.x, y: b.y, w: b.w, h: t },
      { x: b.x, y: b.y + b.h - t, w: b.w, h: t },
      { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
    ].filter((r) => r.w > 0 && r.h > 0);
  }
  return [
    { x: b.x + b.w - t, y: b.y, w: t, h: b.door.y - b.y },
    { x: b.x + b.w - t, y: b.door.y + b.door.h, w: t, h: b.y + b.h - (b.door.y + b.door.h) },
    { x: b.x, y: b.y, w: b.w, h: t },
    { x: b.x, y: b.y + b.h - t, w: b.w, h: t },
    { x: b.x, y: b.y, w: t, h: b.h },
  ].filter((r) => r.w > 0 && r.h > 0);
}
function collideWithBuildingsMap(obj, map) {
  if (!map || !map.buildings) return;
  for (const b of map.buildings) {
    if (!circleRectCollision(obj.x, obj.y, obj.radius, b)) continue;
    for (const r of getBuildingWallRects(b)) {
      if (circleRectCollision(obj.x, obj.y, obj.radius, r)) pushOutCircleRect(obj, r);
    }
  }
}
function moveWithWorldCollision(room, obj, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const stepX = dx / steps, stepY = dy / steps;
  for (let i = 0; i < steps; i++) {
    obj.x += stepX;
    obj.x = clamp(obj.x, obj.radius + 2, WORLD.w - (obj.radius + 2));
    collideWithBuildingsMap(obj, room.map);
    obj.y += stepY;
    obj.y = clamp(obj.y, obj.radius + 2, WORLD.h - (obj.radius + 2));
    collideWithBuildingsMap(obj, room.map);
  }
}
function collidePlayerState(room, st, radius = 10) {
  const proxy = { x: clamp(num(st.x, WORLD.cx), radius + 2, WORLD.w - (radius + 2)), y: clamp(num(st.y, WORLD.cy), radius + 2, WORLD.h - (radius + 2)), radius };
  collideWithBuildingsMap(proxy, room.map);
  st.x = proxy.x;
  st.y = proxy.y;
}

function roomListPayload() {
  return [...rooms.values()].map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
    hostName: room.hostName,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    started: room.started,
  }));
}
function roomPayload(room) {
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
    hostName: room.hostName,
    maxPlayers: room.maxPlayers,
    started: room.started,
    worldSeed: room.worldSeed,
    countdownEndsAt: room.countdownEndsAt,
    wave: room.game ? room.game.wave : 1,
    players: room.players.map((p) => ({ id: p.id, name: p.name, ready: !!p.ready })),
  };
}
function broadcastRoomList() {
  const payload = { type: 'room_list', rooms: roomListPayload() };
  for (const ws of clients.keys()) send(ws, payload);
}
function broadcastRoomUpdate(room) {
  const payload = { type: 'room_update', room: roomPayload(room) };
  for (const p of room.players) send(p.ws, payload);
  broadcastRoomList();
}
function cancelCountdown(room) {
  room.countdownEndsAt = null;
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function zombieBase(type, wave) {
  if (type === 'walker') return { radius: 14, speed: 40 + wave * 2.2, hp: 45 + wave * 4, damage: 28 + wave * 0.7, score: 10, touchCooldown: 0.55, touchDamageMul: 0.12 };
  if (type === 'runner') return { radius: 12, speed: 82 + wave * 3.2, hp: 30 + wave * 2, damage: 24 + wave * 0.6, score: 12, touchCooldown: 0.40, touchDamageMul: 0.13 };
  if (type === 'bloater') return { radius: 18, speed: 28 + wave * 1.5, hp: 110 + wave * 12, damage: 34 + wave * 0.9, score: 22, touchCooldown: 0.70, touchDamageMul: 0.14 };
  if (type === 'crawler') return { radius: 10, speed: 50 + wave * 2.3, hp: 34 + wave * 3, damage: 22 + wave * 0.6, score: 14, touchCooldown: 0.42, touchDamageMul: 0.12 };
  if (type === 'pouncer') return { radius: 12, speed: 64 + wave * 2.8, hp: 38 + wave * 3, damage: 30 + wave * 0.8, score: 20, touchCooldown: 0.50, touchDamageMul: 0.13, pounceCd: 2.4, pounceTime: 0, vx: 0, vy: 0 };
  if (type === 'charger') return { radius: 16, speed: 58 + wave * 2.1, hp: 160 + wave * 14, damage: 36 + wave * 1.0, score: 36, touchCooldown: 0.75, touchDamageMul: 0.10, state: 'approach', chargeTimer: 0, chargeWindup: 0.7, chargeDirX: 0, chargeDirY: 0, chargeSpeed: 470.4, chargeDuration: 0.96, chargeTravel: 0 };
  return { radius: 34, speed: 42 + wave * 1.2, hp: 2200 + wave * 180, maxHp: 2200 + wave * 180, damage: 52 + wave * 1.2, score: 500, touchCooldown: 0.60, touchDamageMul: 0.13, boss: true, pounceCd: 2.5, pounceTime: 0, vx: 0, vy: 0 };
}
function createZombie(game, type, x, y) {
  const base = zombieBase(type, game.wave);
  return {
    id: game.nextZombieId++, type, x, y,
    hp: base.maxHp || base.hp, maxHp: base.maxHp || base.hp,
    radius: base.radius, speed: base.speed, damage: base.damage, score: base.score,
    touchCooldown: base.touchCooldown, touchDamageMul: base.touchDamageMul, touchTimer: 0,
    boss: !!base.boss, pounceCd: base.pounceCd || 0, pounceTime: base.pounceTime || 0,
    vx: base.vx || 0, vy: base.vy || 0,
    state: base.state || 'approach', chargeTimer: base.chargeTimer || 0,
    chargeWindup: base.chargeWindup || 0, chargeDirX: base.chargeDirX || 0, chargeDirY: base.chargeDirY || 0,
    chargeSpeed: base.chargeSpeed || 0, chargeDuration: base.chargeDuration || 0, chargeTravel: base.chargeTravel || 0,
    carrying: false, carryPlayerId: null, carryTime: 0, wallHit: false,
  };
}
function createAuthPlayer(spawnIndex = 0) {
  return {
    hp: 100, maxHp: 100, score: 0, kills: 0, spawnIndex,
    weapon: 'shotgun', mag: 6, magSize: 6,
    gatlingAmmo: 0, rocketAmmo: 0, flameAmmo: 0,
    grenades: 1, molotovs: 0,
    damageMul: 1, speedMul: 1,
  };
}
function createRoomGame(room) {
  const game = {
    wave: 1,
    waveTimer: 0,
    spawnTimer: 0,
    elapsed: 0,
    nextBossTime: 90,
    airdropTimer: 35,
    zombies: [],
    nextZombieId: 1,
    players: new Map(),
    pickups: [],
    nextPickupId: 1,
    airdrops: [],
    nextAirdropId: 1,
    fireZones: [],
    nextFireZoneId: 1,
    effects: [],
    nextEffectId: 1,
  };
  room.players.forEach((p, idx) => {
    game.players.set(p.id, createAuthPlayer(idx));
  });
  room.states = room.states || new Map();
  room.players.forEach((p, idx) => {
    if (!room.states.has(p.id)) room.states.set(p.id, { x: WORLD.cx + (idx - 1.5) * 32, y: WORLD.cy + ((idx % 2) ? 24 : -24), faceDir: 1, weapon: 'shotgun' });
  });
  return game;
}
function ensureAuthPlayer(room, playerRecord) {
  if (!room.game) room.game = createRoomGame(room);
  let auth = room.game.players.get(playerRecord.id);
  if (!auth) {
    auth = createAuthPlayer(room.game.players.size);
    room.game.players.set(playerRecord.id, auth);
  }
  return auth;
}
function playerSnapshot(room, playerRecord) {
  const st = room.states.get(playerRecord.id) || {};
  const auth = room.game ? ensureAuthPlayer(room, playerRecord) : createAuthPlayer();
  return {
    id: playerRecord.id,
    name: playerRecord.name,
    ready: !!playerRecord.ready,
    x: clamp(num(st.x, WORLD.cx), 10, WORLD.w - 10),
    y: clamp(num(st.y, WORLD.cy), 10, WORLD.h - 10),
    hp: Math.max(0, Math.round(auth.hp)),
    maxHp: Math.max(1, Math.round(auth.maxHp)),
    faceDir: num(st.faceDir, 1) < 0 ? -1 : 1,
    weapon: String(auth.weapon || st.weapon || 'shotgun'),
    score: Math.round(auth.score || 0),
    kills: Math.round(auth.kills || 0),
    mag: Math.max(0, Math.round(auth.mag || 0)),
    magSize: Math.max(1, Math.round(auth.magSize || 1)),
    gatlingAmmo: Math.max(0, Math.round(auth.gatlingAmmo || 0)),
    rocketAmmo: Math.max(0, Math.round(auth.rocketAmmo || 0)),
    flameAmmo: Math.max(0, Math.round(auth.flameAmmo || 0)),
    grenades: Math.max(0, Math.round(auth.grenades || 0)),
    molotovs: Math.max(0, Math.round(auth.molotovs || 0)),
    damageMul: Number(auth.damageMul || 1),
    speedMul: Number(auth.speedMul || 1),
  };
}
function contactDamage(zombie, wave) {
  if (wave <= 5) return 1;
  const earlyWaveFactor = 0.22 + Math.min(wave, 20) * 0.014;
  return Math.max(1, zombie.damage * (zombie.touchDamageMul || 0.14) * earlyWaveFactor);
}
function softSeparate(a, b, strength = 0.12) {
  const dx = a.x - b.x, dy = a.y - b.y; let d = Math.hypot(dx, dy); const minDist = (a.radius || 0) + (b.radius || 0);
  if (d === 0) {
    const ang = Math.random() * Math.PI * 2, push = minDist * 0.5;
    a.x += Math.cos(ang) * push; a.y += Math.sin(ang) * push; b.x -= Math.cos(ang) * push; b.y -= Math.sin(ang) * push; return;
  }
  if (d >= minDist) return;
  const overlap = minDist - d, nx = dx / d, ny = dy / d, push = overlap * strength;
  a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
}
function pushEffect(game, kind, x, y, ttl = 1200) {
  game.effects.push({ id: game.nextEffectId++, kind, x, y, expireAt: Date.now() + ttl });
}
function maybeSpawnPickup(game, x, y) {
  const r = Math.random();
  if (r < 0.04) game.pickups.push({ id: game.nextPickupId++, type: 'med', x, y, radius: 8, ttl: 40 });
  else if (r < 0.09) game.pickups.push({ id: game.nextPickupId++, type: 'grenade', x, y, radius: 8, ttl: 40 });
  else if (r < 0.135) game.pickups.push({ id: game.nextPickupId++, type: 'molotov', x, y, radius: 10, phase: Math.random() * Math.PI * 2, ttl: 40 });
}
function spawnBossSerum(game, x, y) {
  const buffs = ['speed', 'damage', 'health'];
  const buff = buffs[Math.floor(Math.random() * buffs.length)];
  game.pickups.push({ id: game.nextPickupId++, type: 'serum', buff, x, y, radius: 11, phase: Math.random() * Math.PI * 2, ttl: 40 });
}
function applySerumBuff(auth, buff) {
  if (buff === 'damage') auth.damageMul *= 1.10;
  else if (buff === 'speed') auth.speedMul *= 1.05;
  else { auth.maxHp += 15; auth.hp = Math.min(auth.maxHp, auth.hp + 15); }
}
function giveAirdropWeapon(auth) {
  const options = ['gatling', 'rocket', 'flamethrower'];
  const choice = options[Math.floor(Math.random() * options.length)];
  auth.weapon = choice;
  if (choice === 'gatling') { auth.magSize = 120; auth.mag = 120; auth.gatlingAmmo = 880; }
  else if (choice === 'rocket') { auth.magSize = 1; auth.mag = 1; auth.rocketAmmo = 49; }
  else { auth.magSize = 200; auth.mag = 200; auth.flameAmmo = 1500; }
}
function spawnAirdrop(game) {
  if (game.airdrops.length > 0) return;
  const x = 120 + Math.random() * (WORLD.w - 240);
  const y = 120 + Math.random() * (WORLD.h - 240);
  game.airdrops.push({ id: game.nextAirdropId++, x, y, landed: false, fallY: y - 320, smoke: 0, parachute: true });
}
function awardKill(room, attackerId, zombie) {
  if (!room.game) return;
  const playerRecord = room.players.find((p) => p.id === attackerId);
  if (!playerRecord) return;
  const auth = ensureAuthPlayer(room, playerRecord);
  auth.kills += 1;
  auth.score += zombie.score || 10;
}
function triggerBloaterDeathBurst(room, attackerId, zombie) {
  if (!room.game || !zombie) return;
  const radius = 74;
  pushEffect(room.game, 'bloater', zombie.x, zombie.y, 1000);
  for (const p of room.players) {
    const st = room.states.get(p.id); if (!st) continue;
    const auth = ensureAuthPlayer(room, p);
    if (auth.hp <= 0) continue;
    const d = dist(st.x, st.y, zombie.x, zombie.y);
    if (d < radius + 10) {
      const dealt = Math.max(1, 12 - d * 0.11);
      auth.hp = clamp(auth.hp - dealt, 0, auth.maxHp);
    }
  }
  for (let i = room.game.zombies.length - 1; i >= 0; i--) {
    const other = room.game.zombies[i];
    if (!other || other.id === zombie.id) continue;
    const d = dist(other.x, other.y, zombie.x, zombie.y);
    if (d < radius + other.radius) {
      const dealt = Math.max(6, 34 - d * 0.28);
      other.hp -= dealt;
      if (other.hp <= 0) {
        onZombieDeath(room, attackerId, other);
        room.game.zombies.splice(i, 1);
      }
    }
  }
}
function onZombieDeath(room, attackerId, zombie) {
  if (!room.game) return;
  if (zombie.type === 'boss') spawnBossSerum(room.game, zombie.x, zombie.y);
  else maybeSpawnPickup(room.game, zombie.x, zombie.y);
  if (attackerId) awardKill(room, attackerId, zombie);
  if (zombie.type === 'bloater') triggerBloaterDeathBurst(room, attackerId, zombie);
}
function applyHitToZombie(room, attackerId, zombieId, damage) {
  if (!room.game) return false;
  const idx = room.game.zombies.findIndex((z) => z.id === zombieId);
  if (idx === -1) return false;
  const zombie = room.game.zombies[idx];
  zombie.hp -= damage;
  if (zombie.hp <= 0) {
    onZombieDeath(room, attackerId, zombie);
    room.game.zombies.splice(idx, 1);
  }
  return true;
}
function applyExplosion(room, attackerId, x, y, kind) {
  if (!room.game) return;
  const game = room.game;
  const rocket = kind === 'rocket';
  const molotov = kind === 'molotov';
  const radius = rocket ? 150 : molotov ? 84 : 128;
  pushEffect(game, molotov ? 'molotov' : (rocket ? 'rocket' : 'normal'), x, y, 1400);
  if (molotov) {
    game.fireZones.push({ id: game.nextFireZoneId++, ownerId: attackerId, x, y, radius: 96, life: 6, maxLife: 6, hitTick: 0 });
  }
  for (let i = game.zombies.length - 1; i >= 0; i--) {
    const z = game.zombies[i];
    const d = dist(x, y, z.x, z.y);
    if (d >= radius) continue;
    let dealt;
    if (rocket && z.type === 'boss') dealt = Math.max(140, 300 - d * 0.6);
    else if (molotov) dealt = Math.max(18, 52 - d * 0.18);
    else dealt = Math.max(rocket ? 80 : 30, (rocket ? 175 : 125) - d * 0.78);
    z.hp -= dealt;
    if (z.hp <= 0) {
      onZombieDeath(room, attackerId, z);
      game.zombies.splice(i, 1);
    }
  }
}
function simulateCharger(room, z, target, dt) {
  const dx = target.state.x - z.x, dy = target.state.y - z.y, d = Math.hypot(dx, dy) || 1;
  if (z.state === 'approach') {
    moveWithWorldCollision(room, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
    if (d < 170) {
      z.state = 'windup';
      z.chargeTimer = z.chargeWindup;
      z.chargeDirX = dx / d;
      z.chargeDirY = dy / d;
    }
    return;
  }
  if (z.state === 'windup') {
    z.chargeTimer -= dt;
    if (z.chargeTimer <= 0) {
      const nd = Math.hypot(target.state.x - z.x, target.state.y - z.y) || 1;
      z.chargeDirX = (target.state.x - z.x) / nd;
      z.chargeDirY = (target.state.y - z.y) / nd;
      z.state = 'charge';
      z.chargeTimer = z.chargeDuration;
      z.chargeTravel = 0;
      z.carrying = false;
      z.carryPlayerId = null;
      z.wallHit = false;
    }
    return;
  }
  if (z.state === 'charge') {
    const stepX = z.chargeDirX * z.chargeSpeed * dt;
    const stepY = z.chargeDirY * z.chargeSpeed * dt;
    const prevX = z.x, prevY = z.y;
    moveWithWorldCollision(room, z, stepX, stepY);
    const moved = Math.hypot(z.x - prevX, z.y - prevY);
    z.chargeTravel += moved;
    z.chargeTimer -= dt;
    if (!z.carrying && target.auth.hp > 0 && dist(z.x, z.y, target.state.x, target.state.y) < z.radius + 10 + 3) {
      z.carrying = true;
      z.carryPlayerId = target.id;
      target.auth.hp = clamp(target.auth.hp - z.damage * 0.09, 0, target.auth.maxHp);
    }
    if (z.carrying) {
      const carried = room.players.find((p) => p.id === z.carryPlayerId);
      const carriedState = carried ? room.states.get(carried.id) : null;
      const carriedAuth = carried ? ensureAuthPlayer(room, carried) : null;
      if (carriedState && carriedAuth && carriedAuth.hp > 0) {
        const carryX = z.x + z.chargeDirX * (z.radius + 10 - 1);
        const carryY = z.y + z.chargeDirY * (z.radius + 10 - 1);
        const proxy = { x: carryX, y: carryY, radius: 10 };
        collideWithBuildingsMap(proxy, room.map);
        carriedState.x = clamp(proxy.x, 12, WORLD.w - 12);
        carriedState.y = clamp(proxy.y, 12, WORLD.h - 12);
        if (Math.hypot(proxy.x - carryX, proxy.y - carryY) > 1.5) z.wallHit = true;
        if (z.wallHit) {
          carriedAuth.hp = clamp(carriedAuth.hp - z.damage * 0.31, 0, carriedAuth.maxHp);
          carriedState.x = clamp(carriedState.x + z.chargeDirX * 42, 12, WORLD.w - 12);
          carriedState.y = clamp(carriedState.y + z.chargeDirY * 42, 12, WORLD.h - 12);
          collidePlayerState(room, carriedState, 10);
          z.carrying = false;
          z.carryPlayerId = null;
          z.state = 'recover';
          z.chargeTimer = 0.55;
          return;
        }
      }
    }
    if (z.chargeTimer <= 0 || z.chargeTravel >= 450) {
      if (z.carrying) {
        const carried = room.players.find((p) => p.id === z.carryPlayerId);
        const carriedState = carried ? room.states.get(carried.id) : null;
        if (carriedState) {
          carriedState.x = clamp(carriedState.x + z.chargeDirX * 58, 12, WORLD.w - 12);
          carriedState.y = clamp(carriedState.y + z.chargeDirY * 58, 12, WORLD.h - 12);
          collidePlayerState(room, carriedState, 10);
        }
      }
      z.carrying = false;
      z.carryPlayerId = null;
      z.state = 'recover';
      z.chargeTimer = 0.8;
    }
    return;
  }
  z.chargeTimer -= dt;
  if (z.chargeTimer <= 0) z.state = 'approach';
}
function simulateLeaper(room, z, target, dt) {
  z.pounceCd = Math.max(0, (z.pounceCd || 0) - dt);
  if ((z.pounceTime || 0) > 0) {
    moveWithWorldCollision(room, z, (z.vx || 0) * dt, (z.vy || 0) * dt);
    z.pounceTime -= dt;
    return;
  }
  const dx = target.state.x - z.x, dy = target.state.y - z.y, d = Math.hypot(dx, dy) || 1;
  moveWithWorldCollision(room, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
  const triggerDist = z.boss ? 320 : 240;
  if (d < triggerDist && z.pounceCd <= 0) {
    z.pounceCd = z.boss ? 1.8 : 2.2 + Math.random() * 1.2;
    z.pounceTime = z.boss ? 0.35 : 0.28;
    const leap = z.boss ? 430 : 360;
    z.vx = (dx / d) * leap;
    z.vy = (dy / d) * leap;
  }
}
function spawnZombieForWave(room, forcedType = null) {
  const game = room.game; if (!game) return;
  const side = Math.floor(Math.random() * 4), margin = 90;
  let x, y;
  if (side === 0) { x = -margin; y = Math.random() * WORLD.h; }
  else if (side === 1) { x = WORLD.w + margin; y = Math.random() * WORLD.h; }
  else if (side === 2) { x = Math.random() * WORLD.w; y = -margin; }
  else { x = Math.random() * WORLD.w; y = WORLD.h + margin; }
  let type = forcedType;
  if (!type) {
    const roll = Math.random();
    type = roll < 0.46 ? 'walker' : roll < 0.70 ? 'runner' : roll < 0.84 ? 'crawler' : roll < 0.93 ? 'bloater' : roll < 0.985 ? 'pouncer' : 'charger';
  }
  game.zombies.push(createZombie(game, type, x, y));
}
function simulateGame(room, dt) {
  const game = room.game; if (!game) return;

  const now = Date.now();
  game.effects = game.effects.filter((fx) => (fx.expireAt || 0) > now);
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    game.pickups[i].ttl -= dt;
    if (game.pickups[i].ttl <= 0) game.pickups.splice(i, 1);
  }
  for (let i = game.fireZones.length - 1; i >= 0; i--) {
    const zone = game.fireZones[i];
    zone.life -= dt; zone.hitTick = (zone.hitTick || 0) - dt;
    if (zone.life <= 0) { game.fireZones.splice(i, 1); continue; }
    if (zone.hitTick <= 0) {
      for (const p of room.players) {
        const st = room.states.get(p.id); if (!st) continue;
        const auth = ensureAuthPlayer(room, p);
        if (auth.hp <= 0) continue;
        if (dist(zone.x, zone.y, st.x, st.y) < zone.radius + 10) auth.hp = clamp(auth.hp - 18 * 0.125, 0, auth.maxHp);
      }
      for (let j = game.zombies.length - 1; j >= 0; j--) {
        const z = game.zombies[j];
        if (dist(zone.x, zone.y, z.x, z.y) < zone.radius + z.radius) {
          z.hp -= 18;
          if (z.hp <= 0) {
            onZombieDeath(room, zone.ownerId, z);
            game.zombies.splice(j, 1);
          }
        }
      }
      zone.hitTick = 0.18;
    }
  }

  game.elapsed += dt;
  game.waveTimer += dt;
  if (game.waveTimer >= 18) { game.waveTimer -= 18; game.wave += 1; }
  if (game.elapsed >= game.nextBossTime) { spawnZombieForWave(room, 'boss'); game.nextBossTime += 70; }
  game.airdropTimer -= dt;
  if (game.airdropTimer <= 0) { game.airdropTimer = 50 + Math.random() * 25; spawnAirdrop(game); }
  for (const ad of game.airdrops) {
    if (!ad.landed) {
      ad.fallY += 190 * dt;
      if (ad.fallY >= ad.y) { ad.fallY = ad.y; ad.landed = true; ad.parachute = false; }
    } else ad.smoke += dt;
  }

  for (let i = game.airdrops.length - 1; i >= 0; i--) {
    const ad = game.airdrops[i];
    if (!ad.landed) continue;
    let taken = false;
    for (const p of room.players) {
      const st = room.states.get(p.id); if (!st) continue;
      if (dist(ad.x, ad.y, st.x, st.y) < 28) {
        giveAirdropWeapon(ensureAuthPlayer(room, p));
        taken = true;
        break;
      }
    }
    if (taken) game.airdrops.splice(i, 1);
  }

  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const item = game.pickups[i];
    let picked = false;
    for (const p of room.players) {
      const st = room.states.get(p.id); if (!st) continue;
      const auth = ensureAuthPlayer(room, p);
      if (dist(item.x, item.y, st.x, st.y) > (item.radius || 8) + 12) continue;
      if (item.type === 'med') { auth.hp = Math.min(auth.maxHp, auth.hp + auth.maxHp * 0.10); picked = true; }
      else if (item.type === 'grenade' && auth.grenades < 8) { auth.grenades += 1; picked = true; }
      else if (item.type === 'molotov' && auth.molotovs < 5) { auth.molotovs += 1; picked = true; }
      else if (item.type === 'serum') { applySerumBuff(auth, item.buff); picked = true; }
      if (picked) break;
    }
    if (picked) game.pickups.splice(i, 1);
  }

  game.spawnTimer += dt;
  const spawnRate = Math.max(0.22, 1.0 - game.wave * 0.05);
  while (game.spawnTimer >= spawnRate) { game.spawnTimer -= spawnRate; spawnZombieForWave(room); }

  const aliveTargets = room.players.map((p) => {
    const state = room.states.get(p.id);
    const auth = ensureAuthPlayer(room, p);
    if (!state || auth.hp <= 0) return null;
    collidePlayerState(room, state, 10);
    return { id: p.id, record: p, state, auth };
  }).filter(Boolean);
  if (!aliveTargets.length) return;

  for (const z of game.zombies) {
    z.touchTimer = Math.max(0, (z.touchTimer || 0) - dt);
    const target = aliveTargets.reduce((best, p) => !best ? p : (dist(z.x, z.y, p.state.x, p.state.y) < dist(z.x, z.y, best.state.x, best.state.y) ? p : best), null);
    if (!target) continue;

    if (z.type === 'charger') simulateCharger(room, z, target, dt);
    else if (z.type === 'pouncer' || z.type === 'boss') simulateLeaper(room, z, target, dt);
    else {
      const dx = target.state.x - z.x, dy = target.state.y - z.y, d = Math.hypot(dx, dy) || 1;
      moveWithWorldCollision(room, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
    }

    z.x = clamp(z.x, z.radius + 2, WORLD.w - (z.radius + 2));
    z.y = clamp(z.y, z.radius + 2, WORLD.h - (z.radius + 2));
    collideWithBuildingsMap(z, room.map);

    for (const tp of aliveTargets) {
      if (z.type === 'charger') continue;
      const playerProxy = { x: tp.state.x, y: tp.state.y, radius: 10 };
      if (dist(z.x, z.y, playerProxy.x, playerProxy.y) < (z.radius || 12) + playerProxy.radius) {
        softSeparate(playerProxy, z, z.type === 'boss' ? 0.22 : 0.18);
        tp.state.x = clamp(playerProxy.x, 12, WORLD.w - 12);
        tp.state.y = clamp(playerProxy.y, 12, WORLD.h - 12);
        collidePlayerState(room, tp.state, 10);
        z.x = clamp(z.x, z.radius + 2, WORLD.w - (z.radius + 2));
        z.y = clamp(z.y, z.radius + 2, WORLD.h - (z.radius + 2));
        collideWithBuildingsMap(z, room.map);
      }
      if (dist(z.x, z.y, tp.state.x, tp.state.y) < (z.radius || 12) + 11 && z.touchTimer <= 0) {
        tp.auth.hp = clamp(tp.auth.hp - contactDamage(z, game.wave), 0, tp.auth.maxHp);
        z.touchTimer = z.touchCooldown || (z.type === 'boss' ? 0.6 : z.type === 'bloater' ? 0.7 : z.type === 'runner' ? 0.4 : 0.55);
      }
    }
  }

  for (let i = 0; i < game.zombies.length; i++) {
    for (let j = i + 1; j < game.zombies.length; j++) {
      softSeparate(game.zombies[i], game.zombies[j], 0.12);
      collideWithBuildingsMap(game.zombies[i], room.map);
      collideWithBuildingsMap(game.zombies[j], room.map);
    }
  }
}
function forceStartMatch(room) {
  if (!room || room.started) return;
  cancelCountdown(room);
  room.started = true;
  room.worldSeed = Math.floor(Math.random() * 2147483647);
  room.map = generateServerMap(room.worldSeed);
  room.game = createRoomGame(room);
  const payload = { type: 'match_started', room: roomPayload(room), worldSeed: room.worldSeed };
  for (const p of room.players) send(p.ws, payload);
  broadcastRoomList();
}
function maybeStartCountdown(room) {
  if (room.started || room.players.length === 0) return;
  const allReady = room.players.every((p) => !!p.ready);
  if (!allReady) {
    if (room.countdownEndsAt) { cancelCountdown(room); broadcastRoomUpdate(room); }
    return;
  }
  if (room.countdownEndsAt) return;
  room.countdownEndsAt = Date.now() + 5000;
  room.countdownTimer = setTimeout(() => {
    room.countdownTimer = null;
    if (!rooms.has(room.roomId)) return;
    const current = rooms.get(room.roomId);
    if (!current || current.started) return;
    const stillAllReady = current.players.length > 0 && current.players.every((p) => !!p.ready);
    if (!stillAllReady) { current.countdownEndsAt = null; broadcastRoomUpdate(current); return; }
    forceStartMatch(current);
  }, 5000);
  broadcastRoomUpdate(room);
}
function closeRoom(room, message, excludeWs = null) {
  cancelCountdown(room);
  if (room.tick) { clearInterval(room.tick); room.tick = null; }
  const payload = { type: 'room_closed', roomId: room.roomId, message };
  for (const p of room.players) { if (excludeWs && p.ws === excludeWs) continue; send(p.ws, payload); }
  rooms.delete(room.roomId);
  broadcastRoomList();
}
function leaveRoom(ws) {
  const client = clients.get(ws); if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId); client.roomId = null; if (!room) return;
  const wasStarted = !!room.started, wasHost = room.hostId === client.id, leaverName = client.name || 'Player';
  room.players = room.players.filter((p) => p.ws !== ws);
  room.states.delete(client.id);
  if (room.game) room.game.players.delete(client.id);
  if (wasHost) {
    send(ws, { type: 'left_room' });
    const message = wasStarted ? `${leaverName} disconnected. The room was closed. Returning to the main menu.` : `${leaverName} closed the room.`;
    closeRoom(room, message, ws); return;
  }
  send(ws, { type: 'left_room' });
  if (room.players.length === 0) {
    cancelCountdown(room);
    if (room.tick) { clearInterval(room.tick); room.tick = null; }
    rooms.delete(room.roomId); broadcastRoomList(); return;
  }
  if (!wasStarted) {
    maybeStartCountdown(room); broadcastRoomUpdate(room);
    for (const p of room.players) send(p.ws, { type: 'player_left', playerId: client.id, name: leaverName, message: `${leaverName} left the room.` });
    return;
  }
  broadcastRoomUpdate(room);
  for (const p of room.players) send(p.ws, { type: 'player_left', playerId: client.id, name: leaverName, message: `${leaverName} disconnected.` });
}
function snapshotPayload(room) {
  const players = room.players.map((p) => playerSnapshot(room, p));
  const zombies = room.game ? room.game.zombies.map((z) => ({ id: z.id, type: z.type, x: z.x, y: z.y, hp: Math.max(0, z.hp), maxHp: Math.max(1, z.maxHp || z.hp), radius: z.radius, state: z.state, carrying: !!z.carrying })) : [];
  const pickups = room.game ? room.game.pickups.map((v) => ({ id: v.id, type: v.type, buff: v.buff, x: v.x, y: v.y, radius: v.radius, ttl: v.ttl, phase: v.phase || 0 })) : [];
  const airdrops = room.game ? room.game.airdrops.map((v) => ({ id: v.id, x: v.x, y: v.y, landed: !!v.landed, fallY: v.fallY, smoke: v.smoke || 0, parachute: !!v.parachute })) : [];
  const fireZones = room.game ? room.game.fireZones.map((v) => ({ id: v.id, x: v.x, y: v.y, radius: v.radius, life: v.life, maxLife: v.maxLife })) : [];
  const effects = room.game ? room.game.effects.map((v) => ({ id: v.id, kind: v.kind, x: v.x, y: v.y })) : [];
  return { type: 'snapshot', roomId: room.roomId, wave: room.game ? room.game.wave : 1, players, zombies, pickups, airdrops, fireZones, effects };
}
function startRoomTicker(room) {
  if (room.tick) clearInterval(room.tick);
  room.tick = setInterval(() => {
    if (!rooms.has(room.roomId)) return;
    const liveRoom = rooms.get(room.roomId); if (!liveRoom) return;
    if (liveRoom.started && liveRoom.game) simulateGame(liveRoom, DT);
    const payload = snapshotPayload(liveRoom);
    for (const p of liveRoom.players) send(p.ws, payload);
  }, TICK_RATE);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DeadTown online authoritative co-op server is running.');
});
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  const client = { id: id(), name: 'Player', roomId: null };
  clients.set(ws, client);
  send(ws, { type: 'welcome', clientId: client.id });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); }
    catch { send(ws, { type: 'error', message: 'Invalid JSON.' }); return; }
    const c = clients.get(ws); if (!c) return;
    if (msg.type === 'hello') { c.name = cleanName(msg.name); send(ws, { type: 'room_list', rooms: roomListPayload() }); return; }
    if (msg.type === 'list_rooms') { send(ws, { type: 'room_list', rooms: roomListPayload() }); return; }
    if (msg.type === 'create_room') {
      leaveRoom(ws);
      const roomId = id(6);
      const room = { roomId, roomName: cleanRoomName(msg.roomName, `${c.name}'s Room`), hostId: c.id, hostName: c.name, maxPlayers: 4, started: false, worldSeed: null, countdownEndsAt: null, countdownTimer: null, players: [{ id: c.id, name: c.name, ws, ready: false }], states: new Map(), tick: null, game: null };
      rooms.set(roomId, room); c.roomId = roomId;
      room.states.set(c.id, { x: WORLD.cx, y: WORLD.cy, faceDir: 1, weapon: 'shotgun' });
      send(ws, { type: 'room_joined', room: roomPayload(room) });
      broadcastRoomUpdate(room); startRoomTicker(room); return;
    }
    if (msg.type === 'join_room') {
      const room = rooms.get(msg.roomId);
      if (!room) return send(ws, { type: 'error', message: 'Room not found.' });
      if (room.started) return send(ws, { type: 'error', message: 'Match already started.' });
      if (room.players.length >= room.maxPlayers) return send(ws, { type: 'error', message: 'Room full.' });
      leaveRoom(ws);
      room.players.push({ id: c.id, name: c.name, ws, ready: false }); c.roomId = room.roomId;
      room.states.set(c.id, { x: WORLD.cx + room.players.length * 20, y: WORLD.cy + room.players.length * 18, faceDir: 1, weapon: 'shotgun' });
      send(ws, { type: 'room_joined', room: roomPayload(room) }); broadcastRoomUpdate(room); return;
    }
    if (msg.type === 'leave_room') { leaveRoom(ws); return; }
    if (msg.type === 'toggle_ready') {
      const room = rooms.get(c.roomId); if (!room || room.started) return;
      const player = room.players.find((p) => p.id === c.id); if (!player) return;
      player.ready = !player.ready; broadcastRoomUpdate(room); maybeStartCountdown(room); return;
    }
    if (msg.type === 'start_match') {
      const room = rooms.get(c.roomId); if (!room || room.started) return;
      if (room.hostId !== c.id) return send(ws, { type: 'error', message: 'Only the host can start the match.' });
      forceStartMatch(room); return;
    }
    if (msg.type === 'player_state') {
      const room = rooms.get(c.roomId); if (!room) return;
      room.states.set(c.id, {
        x: clamp(num(msg.state?.x, WORLD.cx), 10, WORLD.w - 10),
        y: clamp(num(msg.state?.y, WORLD.cy), 10, WORLD.h - 10),
        faceDir: num(msg.state?.faceDir, 1),
        weapon: String(msg.state?.weapon || 'shotgun'),
      });
      collidePlayerState(room, room.states.get(c.id), 10);
      const auth = ensureAuthPlayer(room, c);
      auth.weapon = String(msg.state?.weapon || auth.weapon || 'shotgun');
      auth.mag = clamp(num(msg.state?.mag, auth.mag), 0, 9999);
      auth.magSize = clamp(num(msg.state?.magSize, auth.magSize || 6), 1, 9999);
      auth.gatlingAmmo = clamp(num(msg.state?.gatlingAmmo, auth.gatlingAmmo), 0, 99999);
      auth.rocketAmmo = clamp(num(msg.state?.rocketAmmo, auth.rocketAmmo), 0, 99999);
      auth.flameAmmo = clamp(num(msg.state?.flameAmmo, auth.flameAmmo), 0, 99999);
      auth.grenades = clamp(num(msg.state?.grenades, auth.grenades), 0, 8);
      auth.molotovs = clamp(num(msg.state?.molotovs, auth.molotovs), 0, 5);
      auth.damageMul = clamp(num(msg.state?.damageMul, auth.damageMul), 0.1, 10);
      auth.speedMul = clamp(num(msg.state?.speedMul, auth.speedMul), 0.1, 10);
      auth.maxHp = clamp(num(msg.state?.maxHp, auth.maxHp), 1, 9999);
      auth.hp = clamp(auth.hp, 0, auth.maxHp);
      return;
    }
    if (msg.type === 'hit_report') {
      const room = rooms.get(c.roomId); if (!room || !room.started || !room.game) return;
      const weapon = String(msg.weapon || 'shotgun');
      let cap = 42; if (weapon === 'gatling') cap = 28; else if (weapon === 'flamethrower') cap = 12; else if (weapon === 'rocket') cap = 240; else if (weapon === 'grenade') cap = 190;
      const damage = clamp(num(msg.damage, 0), 0, cap); if (damage <= 0) return;
      applyHitToZombie(room, c.id, num(msg.zombieId, 0), damage); return;
    }
    if (msg.type === 'explosion_report') {
      const room = rooms.get(c.roomId); if (!room || !room.started || !room.game) return;
      const x = clamp(num(msg.x, WORLD.cx), 0, WORLD.w), y = clamp(num(msg.y, WORLD.cy), 0, WORLD.h), kind = String(msg.kind || 'normal');
      applyExplosion(room, c.id, x, y, kind); return;
    }
  });
  ws.on('close', () => { leaveRoom(ws); clients.delete(ws); });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`DeadTown online authoritative co-op server listening on :${PORT}`);
});
