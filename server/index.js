const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 8080);
const TICK_RATE = 60;
const SNAPSHOT_RATE = 60;
const ROOM_MAX_PLAYERS = 2;
const WORLD = { w: 3600, h: 2400 };
const ROCKET_JUMP_DURATION = 0.5;
const ROCKET_JUMP_BASE_SPEED = 420;
const ROCKET_JUMP_BONUS_SPEED = 280;
const ROCKET_JUMP_DAMPING_PER_SECOND = 0.12;
const CLIENT_DIR = path.join(__dirname, '..');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: clients.size }));
    return;
  }
  const normalizedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const allowed = {
    '/index.html': 'index.html',
    '/client-online.js': 'client-online.js',
  };
  const relative = allowed[normalizedPath];
  if (!relative) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const filePath = path.join(CLIENT_DIR, relative);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'application/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});
const wss = new WebSocket.Server({ server });

const clients = new Map();
const rooms = new Map();
let nextClientNum = 1;
let nextRoomNum = 1;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randRange(rng, a, b) { return a + rng() * (b - a); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function pointInRect(x, y, r) { return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h; }
function circleRectCollision(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function lineIntersectsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  return lineSegmentsIntersect(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
    lineSegmentsIntersect(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
    lineSegmentsIntersect(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
    lineSegmentsIntersect(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y);
}
function makeSeededRng(seed) {
  let s = (seed >>> 0) || 123456789;
  return function rng() {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function safeSend(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}
function addDamageText(room, x, y, value, color) {
  if (!room || !room.match) return;
  const rng = typeof room.rng === 'function' ? room.rng : Math.random;
  room.match.damageTexts.push({
    id: room.match.nextEntityId++,
    x: x + randRange(rng, -6, 6),
    y: y + randRange(rng, -4, 4),
    amount: Math.max(1, Math.round(value)),
    color,
    life: 0.7,
    maxLife: 0.7,
    dx: randRange(rng, -10, 10),
    vy: randRange(rng, -38, -28),
  });
  if (room.match.damageTexts.length > 160) room.match.damageTexts.splice(0, room.match.damageTexts.length - 160);
}

function pushBloodFx(room, x, y, count = 8, color = 'rgba(120,15,15,0.95)', force = 1, targetId = null) {
  if (!room || !room.match) return;
  room.match.bloodFx.push({
    id: room.match.nextEntityId++,
    x,
    y,
    count,
    color,
    force,
    targetId,
    life: 0.24,
    maxLife: 0.24,
  });
  if (room.match.bloodFx.length > 96) room.match.bloodFx.splice(0, room.match.bloodFx.length - 96);
}
function pushSoundFx(room, kind, x, y, extra = {}) {
  if (!room || !room.match) return;
  room.match.soundFx.push({
    id: room.match.nextEntityId++,
    kind,
    x,
    y,
    life: 0.22,
    maxLife: 0.22,
    ...extra,
  });
  if (room.match.soundFx.length > 120) room.match.soundFx.splice(0, room.match.soundFx.length - 120);
}
function makeRoads(world) {
  world.road = [];
  const majorV = [480, 1080, 1800, 2550, 3150];
  const majorH = [360, 960, 1560, 2100];
  for (const x of majorV) world.road.push({ x: x - 50, y: 0, w: 100, h: WORLD.h });
  for (const y of majorH) world.road.push({ x: 0, y: y - 50, w: WORLD.w, h: 100 });
}
function roadOverlap(world, rect) {
  return world.road.some((r) => rectsOverlap(rect, r));
}
function makeFurniture(seedRng, x, y, w, h) {
  const items = [];
  if (w > 120 && h > 120) {
    items.push({ x: x + 18, y: y + 18, w: 22, h: 14, c: '#5b4b39' });
    items.push({ x: x + w - 42, y: y + 20, w: 14, h: 14, c: '#6b5e50' });
    if (seedRng() > 0.45) items.push({ x: x + 24, y: y + h - 34, w: 16, h: 10, c: '#4c5f6f' });
  } else if (seedRng() > 0.35) {
    items.push({ x: x + 16, y: y + 16, w: 18, h: 12, c: '#5b4b39' });
  }
  return items;
}
function generateWorld(seed) {
  const world = { w: WORLD.w, h: WORLD.h, road: [], buildings: [] };
  const rng = makeSeededRng(seed);
  makeRoads(world);
  const safe = { x: world.w / 2 - 160, y: world.h / 2 - 120, w: 320, h: 240 };
  let tries = 0;
  while (world.buildings.length < 42 && tries < 2000) {
    tries += 1;
    const w = Math.floor(randRange(rng, 90, 220));
    const h = Math.floor(randRange(rng, 90, 220));
    const x = Math.floor(randRange(rng, 40, world.w - w - 40));
    const y = Math.floor(randRange(rng, 40, world.h - h - 40));
    const rect = { x, y, w, h };
    if (rectsOverlap(rect, safe) || roadOverlap(world, rect)) continue;
    let bad = false;
    for (const b of world.buildings) {
      if (rectsOverlap({ x: x - 20, y: y - 20, w: w + 40, h: h + 40 }, { x: b.x, y: b.y, w: b.w, h: b.h })) {
        bad = true;
        break;
      }
    }
    if (bad) continue;
    const side = ['bottom', 'top', 'left', 'right'][Math.floor(randRange(rng, 0, 4))];
    const doorSize = 30;
    let door;
    if (side === 'bottom') door = { x: x + Math.floor(w / 2 - doorSize / 2), y: y + h - 10, w: doorSize, h: 20 };
    if (side === 'top') door = { x: x + Math.floor(w / 2 - doorSize / 2), y: y - 10, w: doorSize, h: 20 };
    if (side === 'left') door = { x: x - 10, y: y + Math.floor(h / 2 - doorSize / 2), w: 20, h: doorSize };
    if (side === 'right') door = { x: x + w - 10, y: y + Math.floor(h / 2 - doorSize / 2), w: 20, h: doorSize };
    world.buildings.push({
      x, y, w, h, door,
      roofAlpha: 1,
      interiorColor: ['#171514', '#181614', '#161717'][Math.floor(randRange(rng, 0, 3))],
      furniture: makeFurniture(rng, x + 10, y + 10, w - 20, h - 20),
    });
  }
  return world;
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
  }
  if (b.door.y > b.y + b.h - 15) {
    return [
      { x: b.x, y: b.y + b.h - t, w: b.door.x - b.x, h: t },
      { x: b.door.x + b.door.w, y: b.y + b.h - t, w: b.x + b.w - (b.door.x + b.door.w), h: t },
      { x: b.x, y: b.y, w: t, h: b.h },
      { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
      { x: b.x, y: b.y, w: b.w, h: t },
    ].filter((r) => r.w > 0 && r.h > 0);
  }
  if (b.door.x < b.x + 1) {
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
function pushOutCircleRect(obj, rect) {
  const nx = clamp(obj.x, rect.x, rect.x + rect.w);
  const ny = clamp(obj.y, rect.y, rect.y + rect.h);
  let dx = obj.x - nx;
  let dy = obj.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= obj.radius * obj.radius) return false;
  if (d2 === 0) {
    const left = Math.abs(obj.x - rect.x);
    const right = Math.abs(rect.x + rect.w - obj.x);
    const top = Math.abs(obj.y - rect.y);
    const bottom = Math.abs(rect.y + rect.h - obj.y);
    const min = Math.min(left, right, top, bottom);
    if (min === left) obj.x = rect.x - obj.radius;
    else if (min === right) obj.x = rect.x + rect.w + obj.radius;
    else if (min === top) obj.y = rect.y - obj.radius;
    else obj.y = rect.y + rect.h + obj.radius;
    return true;
  }
  const d = Math.sqrt(d2);
  const overlap = obj.radius - d;
  obj.x += (dx / d) * overlap;
  obj.y += (dy / d) * overlap;
  return true;
}
function collideWithBuildingWalls(obj, b) {
  for (const r of getBuildingWallRects(b)) {
    if (circleRectCollision(obj.x, obj.y, obj.radius, r)) pushOutCircleRect(obj, r);
  }
}
function collideWithBuildings(world, obj) {
  for (const b of world.buildings) if (circleRectCollision(obj.x, obj.y, obj.radius, b)) collideWithBuildingWalls(obj, b);
}
function moveWithWallCollision(world, obj, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let i = 0; i < steps; i += 1) {
    obj.x += stepX;
    obj.x = clamp(obj.x, obj.radius + 2, world.w - (obj.radius + 2));
    collideWithBuildings(world, obj);
    obj.y += stepY;
    obj.y = clamp(obj.y, obj.radius + 2, world.h - (obj.radius + 2));
    collideWithBuildings(world, obj);
  }
}
function softSeparate(a, b, strength = 0.35) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  let d = Math.hypot(dx, dy);
  const minDist = (a.radius || 0) + (b.radius || 0);
  if (d === 0) {
    const ang = Math.random() * Math.PI * 2;
    const push = minDist * 0.5;
    a.x += Math.cos(ang) * push;
    a.y += Math.sin(ang) * push;
    b.x -= Math.cos(ang) * push;
    b.y -= Math.sin(ang) * push;
    return;
  }
  if (d >= minDist) return;
  const overlap = minDist - d;
  const nx = dx / d;
  const ny = dy / d;
  const push = overlap * strength;
  a.x += nx * push;
  a.y += ny * push;
  b.x -= nx * push;
  b.y -= ny * push;
}
function zombieColors(type) {
  if (type === 'walker') return { skin: '#7f8974', shirt: '#54463f' };
  if (type === 'runner') return { skin: '#a48f7e', shirt: '#3d3f42' };
  if (type === 'bloater') return { skin: '#747d63', shirt: '#4d3d33' };
  if (type === 'crawler') return { skin: '#8e6f67', shirt: '#5a5044' };
  if (type === 'pouncer') return { skin: '#9a9189', shirt: '#35312f' };
  if (type === 'charger') return { skin: '#8e8675', shirt: '#5d4338' };
  return { skin: '#6d7262', shirt: '#4b2626' };
}
function zombieBase(room, type) {
  const wave = room.match.wave;
  const rng = room.rng;
  const colors = zombieColors(type);
  if (type === 'walker') return { radius: 14, speed: randRange(rng, 36, 52) + wave * 2.2, hp: 45 + wave * 4, maxHp: 45 + wave * 4, damage: 28 + wave * 0.7, score: 10, touchTimer: 0, touchCooldown: 0.55, touchDamageMul: 0.12, ...colors };
  if (type === 'runner') return { radius: 12, speed: randRange(rng, 76, 102) + wave * 3.2, hp: 30 + wave * 2, maxHp: 30 + wave * 2, damage: 24 + wave * 0.6, score: 12, touchTimer: 0, touchCooldown: 0.4, touchDamageMul: 0.13, ...colors };
  if (type === 'bloater') return { radius: 18, speed: randRange(rng, 24, 34) + wave * 1.5, hp: 110 + wave * 12, maxHp: 110 + wave * 12, damage: 34 + wave * 0.9, score: 22, touchTimer: 0, touchCooldown: 0.7, touchDamageMul: 0.14, ...colors };
  if (type === 'crawler') return { radius: 10, speed: randRange(rng, 44, 68) + wave * 2.3, hp: 34 + wave * 3, maxHp: 34 + wave * 3, damage: 22 + wave * 0.6, score: 14, crawl: true, touchTimer: 0, touchCooldown: 0.42, touchDamageMul: 0.12, ...colors };
  if (type === 'pouncer') return { radius: 12, speed: randRange(rng, 58, 78) + wave * 2.8, hp: 38 + wave * 3, maxHp: 38 + wave * 3, damage: 30 + wave * 0.8, score: 20, pounceCd: randRange(rng, 1.5, 2.8), pounceTime: 0, vx: 0, vy: 0, touchTimer: 0, touchCooldown: 0.5, touchDamageMul: 0.13, ...colors };
  if (type === 'charger') return { radius: 16, speed: 58 + wave * 2.1, hp: 160 + wave * 14, maxHp: 160 + wave * 14, damage: 36 + wave * 1.0, score: 36, touchTimer: 0, touchCooldown: 0.75, touchDamageMul: 0.10, state: 'approach', chargeTimer: 0, chargeWindup: 0.7, chargeDirX: 0, chargeDirY: 0, chargeSpeed: 470.4, chargeDuration: 0.96, chargeTravel: 0, carryTime: 0, carryingId: null, wallHit: false, ...colors };
  return { radius: 34, speed: 42 + wave * 1.2, hp: 2200 + wave * 180, maxHp: 2200 + wave * 180, damage: 52 + wave * 1.2, score: 500, boss: true, pounceCd: 2.5, pounceTime: 0, vx: 0, vy: 0, touchTimer: 0, touchCooldown: 0.6, touchDamageMul: 0.13, ...colors };
}
function createPlayerState(client) {
  return {
    id: client.id,
    name: client.name || 'Player',
    x: WORLD.w / 2,
    y: WORLD.h / 2,
    radius: 10,
    speed: 175,
    speedMul: 1,
    damageMul: 1,
    hp: 100,
    maxHp: 100,
    grenades: 1,
    molotovs: 0,
    shootCooldown: 0,
    reloadTimer: 0,
    wasReloading: false,
    dashCooldown: 0,
    dashTime: 0,
    dashVX: 0,
    dashVY: 0,
    rocketJumpTime: 0,
    rocketJumpVX: 0,
    rocketJumpVY: 0,
    knockbackTime: 0,
    knockbackVX: 0,
    knockbackVY: 0,
    carryingByCharger: null,
    hurtTimer: 0,
    faceDir: 1,
    aimAngle: 0,
    weapon: 'shotgun',
    mag: 6,
    magSize: 6,
    gatlingAmmo: 0,
    rocketAmmo: 0,
    flameAmmo: 0,
    moving: false,
    alive: true,
    score: 0,
    kills: 0,
    buffAnnouncement: '',
    buffAnnouncementTimer: 0,
  };
}
function reserveKeyForWeapon(weapon) {
  if (weapon === 'gatling') return 'gatlingAmmo';
  if (weapon === 'rocket') return 'rocketAmmo';
  if (weapon === 'flamethrower') return 'flameAmmo';
  return null;
}
function createRoom(hostClient, roomName) {
  const room = {
    roomId: `room_${String(nextRoomNum++).padStart(4, '0')}`,
    roomName: String(roomName || `${hostClient.name}'s Room`).slice(0, 24),
    hostId: hostClient.id,
    hostName: hostClient.name,
    maxPlayers: ROOM_MAX_PLAYERS,
    started: false,
    countdownEndsAt: null,
    players: new Map(),
    worldSeed: null,
    world: null,
    rng: null,
    match: null,
    lastSnapshotAt: 0,
  };
  rooms.set(room.roomId, room);
  addClientToRoom(hostClient, room);
  return room;
}
function addClientToRoom(client, room) {
  client.roomId = room.roomId;
  client.ready = false;
  room.players.set(client.id, client);
}
function removeClientFromRoom(client, opts = {}) {
  const room = rooms.get(client.roomId);
  if (!room) {
    client.roomId = null;
    return;
  }
  room.players.delete(client.id);
  client.roomId = null;
  client.ready = false;
  if (room.match && room.match.playersById) room.match.playersById.delete(client.id);
  if (room.players.size === 0) {
    rooms.delete(room.roomId);
    broadcastRoomList();
    return;
  }
  if (room.hostId === client.id) {
    const closeText = `${client.name || 'Host'} closed the room.`;
    for (const other of room.players.values()) {
      safeSend(other.ws, { type: 'room_closed', message: closeText });
      other.roomId = null;
      other.ready = false;
    }
    rooms.delete(room.roomId);
    broadcastRoomList();
    return;
  }
  room.hostName = rooms.get(room.roomId)?.players.get(room.hostId)?.name || room.hostName;
  room.countdownEndsAt = null;
  broadcastToRoom(room, { type: 'player_left', playerId: client.id, name: client.name });
  broadcastRoomState(room, opts.joined ? 'room_joined' : 'room_update');
  broadcastRoomList();
}
function roomPublicState(room) {
  const players = Array.from(room.players.values()).map((client) => ({
    id: client.id,
    name: client.name,
    ready: !!client.ready,
  }));
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    hostId: room.hostId,
    hostName: room.players.get(room.hostId)?.name || room.hostName,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.size,
    started: room.started,
    countdownEndsAt: room.countdownEndsAt,
    players,
  };
}
function roomListPayload() {
  return Array.from(rooms.values()).map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    hostName: room.players.get(room.hostId)?.name || room.hostName,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    started: room.started,
  }));
}
function broadcastRoomList() {
  const roomsPayload = roomListPayload();
  for (const client of clients.values()) safeSend(client.ws, { type: 'room_list', rooms: roomsPayload });
}
function broadcastToRoom(room, payload) {
  for (const client of room.players.values()) safeSend(client.ws, payload);
}
function broadcastRoomState(room, type = 'room_update') {
  const payload = { type, room: roomPublicState(room) };
  broadcastToRoom(room, payload);
}
function spawnAtRoomCenter(room) {
  const count = room.players.size;
  const spots = [
    { x: WORLD.w / 2 - 30, y: WORLD.h / 2 },
    { x: WORLD.w / 2 + 30, y: WORLD.h / 2 },
    { x: WORLD.w / 2, y: WORLD.h / 2 - 30 },
    { x: WORLD.w / 2, y: WORLD.h / 2 + 30 },
  ];
  let i = 0;
  for (const client of room.players.values()) {
    const p = createPlayerState(client);
    const spot = spots[i % Math.max(1, Math.min(spots.length, count))];
    p.x = spot.x;
    p.y = spot.y;
    collideWithBuildings(room.world, p);
    room.match.playersById.set(client.id, p);
    i += 1;
  }
}
function createMatch(room) {
  return {
    wave: 1,
    kills: 0,
    surviveTime: 0,
    spawnTimer: 0,
    waveTimer: 0,
    airdropTimer: 35,
    nextBossTime: 90,
    nextEntityId: 1,
    zombies: [],
    pickups: [],
    airdrops: [],
    fireZones: [],
    effects: [],
    pendingExplosions: [],
    projectiles: [],
    shotFx: [],
    flameFx: [],
    damageTexts: [],
    bloodFx: [],
    soundFx: [],
    bossAnnouncement: 0,
    airdropAnnouncement: 0,
    playersById: new Map(),
  };
}
function startMatch(room) {
  room.started = true;
  room.countdownEndsAt = null;
  room.worldSeed = Math.floor(Math.random() * 0x7fffffff);
  room.rng = makeSeededRng(room.worldSeed ^ 0x9e3779b9);
  room.world = generateWorld(room.worldSeed);
  room.match = createMatch(room);
  spawnAtRoomCenter(room);
  for (const client of room.players.values()) client.ready = false;
  broadcastToRoom(room, { type: 'match_started', room: roomPublicState(room), worldSeed: room.worldSeed });
  broadcastRoomList();
}
function endMatch(room, reason = 'All players down.') {
  if (!room.started) return;
  room.started = false;
  room.countdownEndsAt = null;
  room.match = null;
  room.world = null;
  room.worldSeed = null;
  room.rng = null;
  for (const client of room.players.values()) client.ready = false;
  broadcastToRoom(room, { type: 'match_over', message: reason, room: roomPublicState(room) });
  broadcastRoomState(room, 'room_update');
  broadcastRoomList();
}
function maybeStartCountdown(room) {
  if (room.started || room.players.size < 2) {
    room.countdownEndsAt = null;
    return;
  }
  const everyoneReady = Array.from(room.players.values()).every((client) => client.ready);
  room.countdownEndsAt = everyoneReady ? Date.now() + 5000 : null;
}
function canStartMatch(room, requesterId) {
  if (room.started) return false;
  if (room.hostId !== requesterId) return false;
  if (room.players.size < 1) return false;
  return true;
}
function currentPlayers(room) {
  return Array.from(room.match.playersById.values());
}
function livingPlayers(room) {
  return currentPlayers(room).filter((p) => p.alive && p.hp > 0);
}
function spawnZombie(room) {
  const match = room.match;
  const alive = livingPlayers(room);
  if (!alive.length) return;
  const target = alive[Math.floor(room.rng() * alive.length)];
  const margin = 90;
  let x = 0;
  let y = 0;
  let tries = 0;
  while (tries < 20) {
    const side = Math.floor(room.rng() * 4);
    if (side === 0) { x = -margin; y = randRange(room.rng, 0, WORLD.h); }
    else if (side === 1) { x = WORLD.w + margin; y = randRange(room.rng, 0, WORLD.h); }
    else if (side === 2) { x = randRange(room.rng, 0, WORLD.w); y = -margin; }
    else { x = randRange(room.rng, 0, WORLD.w); y = WORLD.h + margin; }
    if (dist(x, y, target.x, target.y) >= 480) break;
    tries += 1;
  }
  const roll = room.rng();
  const type = roll < 0.46 ? 'walker' : roll < 0.70 ? 'runner' : roll < 0.84 ? 'crawler' : roll < 0.93 ? 'bloater' : roll < 0.985 ? 'pouncer' : 'charger';
  match.zombies.push({ id: match.nextEntityId++, type, x, y, ...zombieBase(room, type) });
}
function spawnBoss(room) {
  const match = room.match;
  const alive = livingPlayers(room);
  if (!alive.length) return;
  let x = 0;
  let y = 0;
  let tries = 0;
  const target = alive[0];
  do {
    x = randRange(room.rng, 120, WORLD.w - 120);
    y = randRange(room.rng, 120, WORLD.h - 120);
    tries += 1;
  } while ((room.world.buildings.some((b) => pointInRect(x, y, b)) || dist(x, y, target.x, target.y) < 700) && tries < 300);
  match.zombies.push({ id: match.nextEntityId++, type: 'boss', x, y, ...zombieBase(room, 'boss') });
  match.bossAnnouncement = 3;
}
function spawnAirdrop(room) {
  const match = room.match;
  if (match.airdrops.length > 0) return;
  let x = 0;
  let y = 0;
  let tries = 0;
  const alive = livingPlayers(room);
  const target = alive[0] || { x: WORLD.w / 2, y: WORLD.h / 2 };
  do {
    x = randRange(room.rng, 120, WORLD.w - 120);
    y = randRange(room.rng, 120, WORLD.h - 120);
    tries += 1;
  } while ((room.world.buildings.some((b) => pointInRect(x, y, b)) || dist(x, y, target.x, target.y) < 380) && tries < 300);
  match.airdrops.push({ id: match.nextEntityId++, x, y, landed: false, fallY: y - 320, smoke: 0, parachute: true });
  match.airdropAnnouncement = 3;
}
function maybeSpawnPickup(room, x, y) {
  const r = room.rng();
  if (r < 0.04) room.match.pickups.push({ id: room.match.nextEntityId++, type: 'med', x, y, radius: 8, ttl: 40 });
  else if (r < 0.09) room.match.pickups.push({ id: room.match.nextEntityId++, type: 'grenade', x, y, radius: 8, ttl: 40 });
  else if (r < 0.135) room.match.pickups.push({ id: room.match.nextEntityId++, type: 'molotov', x, y, radius: 10, ttl: 40, phase: room.rng() * Math.PI * 2 });
}
function spawnBossSerum(room, x, y) {
  const buffs = ['speed', 'damage', 'health'];
  const buff = buffs[Math.floor(room.rng() * buffs.length)];
  room.match.pickups.push({ id: room.match.nextEntityId++, type: 'serum', buff, x, y, radius: 11, ttl: 40, phase: room.rng() * Math.PI * 2 });
}
function pushEffect(room, effect) {
  room.match.effects.push({ id: room.match.nextEntityId++, ...effect });
}
function addScore(player, value) {
  if (!player) return;
  player.score += value;
  player.kills += 1;
}
function damagePlayerServer(room, player, amount) {
  if (!player || !player.alive || player.hp <= 0) return;
  const wasAlive = player.alive && player.hp > 0;
  player.hp = Math.max(0, player.hp - amount);
  pushBloodFx(room, player.x, player.y, 12, 'rgba(150,24,24,0.95)', 1.1, player.id);
  pushSoundFx(room, 'player_hit', player.x, player.y, { targetId: player.id });
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    if (wasAlive) {
      const clientRef = clients.get(player.id);
      broadcastToRoom(room, { type: 'player_down', playerId: player.id, name: clientRef?.name || player.name || 'Player' });
    }
  }
}
function awardSerum(player, buff) {
  if (buff === 'damage') player.damageMul *= 1.10;
  else if (buff === 'speed') player.speedMul *= 1.05;
  else {
    player.maxHp += 15;
    player.hp = Math.min(player.maxHp, player.hp + 15);
  }
  player.buffAnnouncement = buff;
  player.buffAnnouncementTimer = 2.6;
}
function launchPlayerKnockback(player, dirX, dirY, speed, time) {
  if (!player) return;
  player.rocketJumpTime = 0;
  player.rocketJumpVX = 0;
  player.rocketJumpVY = 0;
  player.knockbackTime = time;
  player.knockbackVX = dirX * speed;
  player.knockbackVY = dirY * speed;
  player.carryingByCharger = null;
  if (player.knockbackVX < 0) player.faceDir = -1;
  else if (player.knockbackVX > 0) player.faceDir = 1;
}
function devSetWeaponLoadout(player, choice) {
  player.weapon = choice;
  if (choice === 'shotgun') {
    player.magSize = 6; player.mag = 6;
  } else if (choice === 'gatling') {
    player.magSize = 120; player.mag = 120; player.gatlingAmmo = 880;
  } else if (choice === 'rocket') {
    player.magSize = 1; player.mag = 1; player.rocketAmmo = 49;
  } else if (choice === 'flamethrower') {
    player.magSize = 200; player.mag = 200; player.flameAmmo = 1500;
  }
  player.reloadTimer = 0;
  player.wasReloading = false;
}

function spawnDevCharger(room, player) {
  let x = player.x;
  let y = player.y;
  let tries = 0;
  do {
    x = clamp(player.x + randRange(room.rng, -220, 220), 30, WORLD.w - 30);
    y = clamp(player.y + randRange(room.rng, -220, 220), 30, WORLD.h - 30);
    tries += 1;
  } while ((room.world.buildings.some((b) => pointInRect(x, y, b)) || dist(x, y, player.x, player.y) < 120) && tries < 120);
  room.match.zombies.push({ id: room.match.nextEntityId++, type: 'charger', x, y, ...zombieBase(room, 'charger') });
}

function spawnDevBloater(room, player) {
  let angle = room.rng() * Math.PI * 2;
  let spawnDist = randRange(room.rng, 150, 240);
  let x = clamp(player.x + Math.cos(angle) * spawnDist, 40, WORLD.w - 40);
  let y = clamp(player.y + Math.sin(angle) * spawnDist, 40, WORLD.h - 40);
  let tries = 0;
  while ((room.world.buildings.some((b) => pointInRect(x, y, b)) || dist(x, y, player.x, player.y) < 120) && tries < 80) {
    angle = room.rng() * Math.PI * 2;
    spawnDist = randRange(room.rng, 150, 240);
    x = clamp(player.x + Math.cos(angle) * spawnDist, 40, WORLD.w - 40);
    y = clamp(player.y + Math.sin(angle) * spawnDist, 40, WORLD.h - 40);
    tries += 1;
  }
  room.match.zombies.push({ id: room.match.nextEntityId++, type: 'bloater', x, y, ...zombieBase(room, 'bloater') });
}

function handleDevCommand(client, payload) {
  const room = rooms.get(client.roomId);
  if (!room || !room.started || !room.match) return;
  const player = room.match.playersById.get(client.id);
  if (!player) return;
  const command = String(payload.command || '');
  if (command === 'set_weapon') {
    const weapon = String(payload.weapon || '');
    if (['shotgun', 'gatling', 'rocket', 'flamethrower'].includes(weapon)) devSetWeaponLoadout(player, weapon);
    return;
  }
  if (!player.alive) return;
  if (command === 'heal') {
    player.hp = player.maxHp;
    return;
  }
  if (command === 'throwables') {
    player.grenades = 8;
    player.molotovs = 5;
    return;
  }
  if (command === 'spawn_charger') {
    spawnDevCharger(room, player);
    return;
  }
  if (command === 'spawn_boss') {
    spawnBoss(room);
    return;
  }
  if (command === 'spawn_bloater') {
    spawnDevBloater(room, player);
  }
}

function triggerBloaterDeathBurst(room, x, y, ownerId = null, deadId = null) {
  const radius = 74;
  pushEffect(room, { x, y, radius: 0, maxRadius: radius, life: 0.22, maxLife: 0.22, ring: 0, rocket: false, bloaterBurst: true, ownerId: ownerId || null });
  for (const player of currentPlayers(room)) {
    if (!player.alive) continue;
    const pd = dist(player.x, player.y, x, y);
    if (pd < radius + player.radius) {
      const dealt = Math.max(1, 12 - pd * 0.11);
      damagePlayerServer(room, player, dealt);
    }
  }
  for (let i = room.match.zombies.length - 1; i >= 0; i -= 1) {
    const other = room.match.zombies[i];
    if (other.id === deadId) continue;
    const d = dist(other.x, other.y, x, y);
    if (d < radius + other.radius) {
      const dealt = Math.max(6, 34 - d * 0.28);
      other.hp -= dealt;
      addDamageText(room, other.x, other.y - other.radius - 10, dealt, '#b9ff7a');
      if (other.hp <= 0) handleZombieDeath(room, i, ownerId);
    }
  }
}
function handleZombieDeath(room, index, ownerId = null) {
  const z = room.match.zombies[index];
  if (!z) return;
  pushBloodFx(room, z.x, z.y, z.type === 'bloater' || z.type === 'boss' ? 24 : 14, 'rgba(130,18,18,0.95)', z.type === 'boss' ? 1.15 : 1.05);
  pushSoundFx(room, 'gore', z.x, z.y, { ownerId });
  if (z.type === 'boss') spawnBossSerum(room, z.x, z.y);
  else maybeSpawnPickup(room, z.x, z.y);
  if (ownerId && room.match.playersById.has(ownerId)) addScore(room.match.playersById.get(ownerId), z.score);
  room.match.kills += 1;
  room.match.zombies.splice(index, 1);
  if (z.type === 'bloater') triggerBloaterDeathBurst(room, z.x, z.y, ownerId, z.id);
}
function updateReload(player, dt) {
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);
  player.buffAnnouncementTimer = Math.max(0, player.buffAnnouncementTimer - dt);
  if (player.reloadTimer > 0) return;
  if (player.wasReloading) {
    player.wasReloading = false;
    if (player.weapon === 'shotgun') player.mag = player.magSize;
    else {
      const reserveKey = reserveKeyForWeapon(player.weapon);
      if (reserveKey && player[reserveKey] > 0) {
        const load = Math.min(player.magSize - player.mag, player[reserveKey]);
        player.mag += load;
        player[reserveKey] -= load;
      } else {
        player.weapon = 'shotgun';
        player.magSize = 6;
        player.mag = 6;
      }
    }
    return;
  }
  if (player.mag !== 0) return;
  if (player.weapon === 'shotgun') {
    player.mag = player.magSize;
    return;
  }
  const reserveKey = reserveKeyForWeapon(player.weapon);
  if (reserveKey && player[reserveKey] > 0) {
    const load = Math.min(player.magSize, player[reserveKey]);
    player.mag = load;
    player[reserveKey] -= load;
  } else {
    player.weapon = 'shotgun';
    player.magSize = 6;
    player.mag = 6;
  }
}
function updatePlayerTransientStates(room, dt) {
  for (const player of currentPlayers(room)) {
    player.dashTime = Math.max(0, (player.dashTime || 0) - dt);
    player.rocketJumpTime = Math.max(0, (player.rocketJumpTime || 0) - dt);
    player.knockbackTime = Math.max(0, (player.knockbackTime || 0) - dt);
    player.zombiePushTime = Math.max(0, (player.zombiePushTime || 0) - dt);
    if ((player.knockbackTime || 0) > 0) {
      moveWithWallCollision(room.world, player, (player.knockbackVX || 0) * dt, (player.knockbackVY || 0) * dt);
      const knockbackDamping = Math.pow(0.08, dt);
      player.knockbackVX = (player.knockbackVX || 0) * knockbackDamping;
      player.knockbackVY = (player.knockbackVY || 0) * knockbackDamping;
    } else {
      player.knockbackVX = 0;
      player.knockbackVY = 0;
    }
  }
}
function pushShotFx(room, fx) {
  room.match.shotFx.push({ id: room.match.nextEntityId++, ...fx });
}
function pushFlameFx(room, fx) {
  room.match.flameFx.push({ id: room.match.nextEntityId++, ...fx });
}
function triggerRocketJumpForPlayer(player, explosionX, explosionY, maxRadius) {
  let dx = player.x - explosionX;
  let dy = player.y - explosionY;
  let d = Math.hypot(dx, dy);
  if (d === 0) {
    const ang = Math.atan2(player.rocketJumpVY || 0, player.rocketJumpVX || 0) || 0;
    dx = Math.cos(ang || 0);
    dy = Math.sin(ang || 0);
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  const proximity = clamp(1 - (d / Math.max(1, maxRadius)), 0, 1);
  const jumpSpeed = ROCKET_JUMP_BASE_SPEED + ROCKET_JUMP_BONUS_SPEED * proximity;
  player.rocketJumpTime = ROCKET_JUMP_DURATION;
  player.rocketJumpVX = nx * jumpSpeed;
  player.rocketJumpVY = ny * jumpSpeed;
  player.dashTime = 0;
  player.dashVX = 0;
  player.dashVY = 0;
  player.knockbackTime = 0;
  player.knockbackVX = 0;
  player.knockbackVY = 0;
  if (player.rocketJumpVX < 0) player.faceDir = -1;
  else if (player.rocketJumpVX > 0) player.faceDir = 1;
}
function spawnThrowableProjectile(room, sourcePlayer, kind, targetX, targetY, total) {
  const arc = kind === 'molotov' ? 62 : 54;
  room.match.projectiles.push({
    id: room.match.nextEntityId++,
    kind,
    type: kind,
    ownerId: sourcePlayer?.id || null,
    x: sourcePlayer.x,
    y: sourcePlayer.y,
    drawX: sourcePlayer.x,
    drawY: sourcePlayer.y,
    startX: sourcePlayer.x,
    startY: sourcePlayer.y,
    targetX,
    targetY,
    arc,
    total,
    timer: total,
    progress: 0,
    radius: 5,
  });
}
function spawnRocketProjectile(room, sourcePlayer, targetX, targetY) {
  const angle = Math.atan2(targetY - sourcePlayer.y, targetX - sourcePlayer.x);
  const speed = 620;
  const targetDist = Math.max(30, Math.hypot(targetX - sourcePlayer.x, targetY - sourcePlayer.y));
  room.match.projectiles.push({
    id: room.match.nextEntityId++,
    kind: 'rocket',
    ownerId: sourcePlayer?.id || null,
    x: sourcePlayer.x + Math.cos(angle) * 18,
    y: sourcePlayer.y + Math.sin(angle) * 18,
    targetX,
    targetY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    life: Math.min(3.5, targetDist / speed + 0.18),
    radius: 4,
  });
}
function spawnPelletProjectile(room, sourcePlayer, angle, speed, life, damage, extra = {}) {
  room.match.projectiles.push({
    id: room.match.nextEntityId++,
    kind: 'pellet',
    ownerId: sourcePlayer?.id || null,
    weaponKind: extra.weaponKind || 'shotgun',
    x: sourcePlayer.x + Math.cos(angle) * (extra.startOffset || 18),
    y: sourcePlayer.y + Math.sin(angle) * (extra.startOffset || 18),
    startX: sourcePlayer.x + Math.cos(angle) * (extra.startOffset || 18),
    startY: sourcePlayer.y + Math.sin(angle) * (extra.startOffset || 18),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life,
    maxLife: life,
    damage,
    radius: 2,
    penetration: extra.penetration ?? null,
    hitIds: [],
  });
}
function spawnFlameProjectile(room, sourcePlayer, x, y, vx, vy, life, size, damage, swirl, heat, color) {
  room.match.projectiles.push({
    id: room.match.nextEntityId++,
    kind: 'flame',
    ownerId: sourcePlayer?.id || null,
    x, y, vx, vy,
    life,
    maxLife: life,
    size,
    damage,
    hitTick: 0,
    swirl,
    heat,
    color,
  });
}
function processProjectiles(room, dt) {
  for (let i = room.match.projectiles.length - 1; i >= 0; i -= 1) {
    const p = room.match.projectiles[i];
    if (p.kind === 'grenade' || p.kind === 'molotov') {
      p.timer -= dt;
      p.progress = clamp(1 - p.timer / p.total, 0, 1);
      p.x = p.startX + (p.targetX - p.startX) * p.progress;
      p.y = p.startY + (p.targetY - p.startY) * p.progress;
      const height = Math.sin(p.progress * Math.PI) * p.arc;
      p.drawX = p.x;
      p.drawY = p.y - height;
      if (p.timer <= 0) room.match.projectiles.splice(i, 1);
      continue;
    }
    if (p.kind === 'rocket') {
      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.angle = Math.atan2(p.vy, p.vx);
      let done = dist(p.x, p.y, p.targetX, p.targetY) < 14 || p.life <= 0 || p.x < 0 || p.y < 0 || p.x > WORLD.w || p.y > WORLD.h;
      if (!done) {
        for (const b of room.world.buildings) {
          for (const wr of getBuildingWallRects(b)) {
            if (lineIntersectsRect(prevX, prevY, p.x, p.y, wr)) {
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }
      if (!done) {
        for (const targetPlayer of currentPlayers(room)) {
          if (!targetPlayer.alive) continue;
          if (dist(targetPlayer.x, targetPlayer.y, p.x, p.y) < targetPlayer.radius + p.radius + 2) {
            done = true;
            break;
          }
        }
      }
      if (done) {
        const owner = p.ownerId ? room.match.playersById.get(p.ownerId) : null;
        applyExplosion(room, owner, clamp(p.x, 10, WORLD.w - 10), clamp(p.y, 10, WORLD.h - 10), 'rocket');
        room.match.projectiles.splice(i, 1);
      }
      continue;
    }
    if (p.kind === 'pellet') {
      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let removed = false;
      for (const b of room.world.buildings) {
        for (const wr of getBuildingWallRects(b)) {
          if (lineIntersectsRect(prevX, prevY, p.x, p.y, wr) || circleRectCollision(p.x, p.y, p.radius, wr)) {
            room.match.projectiles.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) break;
      }
      if (removed) continue;
      if (p.life <= 0 || p.x < -20 || p.x > WORLD.w + 20 || p.y < -20 || p.y > WORLD.h + 20) {
        room.match.projectiles.splice(i, 1);
        continue;
      }
      for (let j = room.match.zombies.length - 1; j >= 0; j -= 1) {
        const z = room.match.zombies[j];
        if ((p.hitIds || []).includes(z.id)) continue;
        if (dist(z.x, z.y, p.x, p.y) < z.radius + p.radius + 1) {
          let dealt = p.damage;
          if (p.weaponKind === 'shotgun') {
            const travel = clamp(1 - (p.life / Math.max(0.0001, p.maxLife || p.life)), 0, 1);
            const falloffMul = 1 - travel * 0.65;
            dealt *= Math.max(0.35, falloffMul);
          }
          z.hp -= dealt;
          addDamageText(room, z.x, z.y - z.radius - 10, dealt, '#ffd84d');
          pushBloodFx(room, p.x, p.y, 5, 'rgba(120,20,20,0.9)', 0.55);
          pushSoundFx(room, 'hit', p.x, p.y, { ownerId: p.ownerId || null });
          p.hitIds = p.hitIds || [];
          p.hitIds.push(z.id);
          if (z.hp <= 0) handleZombieDeath(room, j, p.ownerId || null);
          if (p.penetration != null) {
            p.penetration -= 1;
            if (p.penetration <= 0) {
              room.match.projectiles.splice(i, 1);
            }
          } else {
            room.match.projectiles.splice(i, 1);
          }
          break;
        }
      }
      continue;
    }
    if (p.kind === 'flame') {
      const v = Math.hypot(p.vx, p.vy) || 1;
      const sideX = -p.vy / v;
      const sideY = p.vx / v;
      p.vx += sideX * (p.swirl || 0) * dt;
      p.vy += sideY * (p.swirl || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const flameDamping = Math.pow(0.42, dt);
      p.vx *= flameDamping;
      p.vy *= flameDamping;
      p.vy -= 30 * dt * (p.heat || 1);
      p.life -= dt;
      p.hitTick = (p.hitTick || 0) - dt;
      p.size += dt * 8;
      p.swirl = (p.swirl || 0) * Math.pow(0.7, dt * 60);
      let removeFlame = false;
      for (const b of room.world.buildings) {
        for (const wr of getBuildingWallRects(b)) {
          if (circleRectCollision(p.x, p.y, p.size * 0.35, wr)) {
            removeFlame = true;
            break;
          }
        }
        if (removeFlame) break;
      }
      if (!removeFlame) {
        for (let j = room.match.zombies.length - 1; j >= 0; j -= 1) {
          const z = room.match.zombies[j];
          if (dist(z.x, z.y, p.x, p.y) < z.radius + p.size) {
            if (p.hitTick <= 0) {
              const dealt = p.damage * ((room.match.playersById.get(p.ownerId)?.damageMul) || 1);
              z.hp -= dealt;
              addDamageText(room, z.x, z.y - z.radius - 10, dealt, '#ffd84d');
              pushBloodFx(room, p.x, p.y, 3, 'rgba(255,120,40,0.7)', 0.3);
              p.hitTick = 0.06;
              if (z.hp <= 0) handleZombieDeath(room, j, p.ownerId || null);
            }
          }
        }
      }
      if (removeFlame || p.life <= 0) room.match.projectiles.splice(i, 1);
    }
  }
}
function processShotFx(room, dt) {
  for (let i = room.match.shotFx.length - 1; i >= 0; i -= 1) {
    room.match.shotFx[i].life -= dt;
    if (room.match.shotFx[i].life <= 0) room.match.shotFx.splice(i, 1);
  }
  for (let i = room.match.flameFx.length - 1; i >= 0; i -= 1) {
    room.match.flameFx[i].life -= dt;
    if (room.match.flameFx[i].life <= 0) room.match.flameFx.splice(i, 1);
  }
}
function processDamageTexts(room, dt) {
  for (let i = room.match.damageTexts.length - 1; i >= 0; i -= 1) {
    const t = room.match.damageTexts[i];
    t.y += t.vy * dt;
    t.x += (t.dx || 0) * dt;
    t.life -= dt;
    if (t.life <= 0) room.match.damageTexts.splice(i, 1);
  }
}

function processTransientEventFx(room, dt) {
  for (let i = room.match.bloodFx.length - 1; i >= 0; i -= 1) {
    room.match.bloodFx[i].life -= dt;
    if (room.match.bloodFx[i].life <= 0) room.match.bloodFx.splice(i, 1);
  }
  for (let i = room.match.soundFx.length - 1; i >= 0; i -= 1) {
    room.match.soundFx[i].life -= dt;
    if (room.match.soundFx[i].life <= 0) room.match.soundFx.splice(i, 1);
  }
}
function applyExplosion(room, sourcePlayer, x, y, kind = 'normal') {
  if (kind === 'molotov') {
    room.match.fireZones.push({ id: room.match.nextEntityId++, x, y, radius: 96, life: 6, maxLife: 6, hitTick: 0, ownerId: sourcePlayer?.id || null });
    pushEffect(room, { x, y, radius: 0, maxRadius: 84, life: 0.34, maxLife: 0.34, ring: 0, rocket: false, molotov: true, ownerId: sourcePlayer?.id || null });
    pushSoundFx(room, 'boom', x, y, { ownerId: sourcePlayer?.id || null, boomKind: 'molotov' });
    return;
  }
  const rocket = kind === 'rocket';
  const maxRadius = rocket ? 150 : 128;
  pushEffect(room, { x, y, radius: 0, maxRadius, life: rocket ? 0.56 : 0.42, maxLife: rocket ? 0.56 : 0.42, ring: 0, rocket, ownerId: sourcePlayer?.id || null });
  pushSoundFx(room, 'boom', x, y, { ownerId: sourcePlayer?.id || null, boomKind: rocket ? 'rocket' : 'normal' });
  if (rocket) {
    for (const player of currentPlayers(room)) {
      if (!player.alive) continue;
      const d = dist(player.x, player.y, x, y);
      if (d < maxRadius + player.radius) triggerRocketJumpForPlayer(player, x, y, maxRadius);
    }
  } else {
    for (const player of currentPlayers(room)) {
      if (!player.alive) continue;
      const d = dist(player.x, player.y, x, y);
      if (d < maxRadius + player.radius) {
        const dealt = Math.max(1, 24 - d * 0.12) * 0.25;
        damagePlayerServer(room, player, dealt);
      }
    }
  }
  for (let i = room.match.zombies.length - 1; i >= 0; i -= 1) {
    const z = room.match.zombies[i];
    const d = dist(z.x, z.y, x, y);
    if (d < maxRadius + z.radius) {
      const base = rocket ? (z.type === 'boss' ? 300 : 180) : 90;
      const dealt = Math.max(8, base - d * (rocket ? 0.9 : 0.65)) * (sourcePlayer?.damageMul || 1);
      z.hp -= dealt;
      addDamageText(room, z.x, z.y - z.radius - 10, dealt, '#ffd84d');
      if (z.hp <= 0) handleZombieDeath(room, i, sourcePlayer?.id || null);
    }
  }
}
function enqueueExplosion(room, sourcePlayer, x, y, delay, kind) {
  room.match.pendingExplosions.push({ id: room.match.nextEntityId++, x, y, timer: delay, kind, ownerId: sourcePlayer?.id || null });
}
function processPendingExplosions(room, dt) {
  for (let i = room.match.pendingExplosions.length - 1; i >= 0; i -= 1) {
    const pending = room.match.pendingExplosions[i];
    pending.timer -= dt;
    if (pending.timer <= 0) {
      const owner = pending.ownerId ? room.match.playersById.get(pending.ownerId) : null;
      applyExplosion(room, owner, pending.x, pending.y, pending.kind);
      room.match.pendingExplosions.splice(i, 1);
    }
  }
}
function nearestAlivePlayer(room, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const player of livingPlayers(room)) {
    const d = dist(x, y, player.x, player.y);
    if (d < bestD) {
      bestD = d;
      best = player;
    }
  }
  return { player: best, distance: bestD };
}
function updateCharger(room, z, dt) {
  const targetData = nearestAlivePlayer(room, z.x, z.y);
  const target = targetData.player;
  if (!target) return;
  const dx = target.x - z.x;
  const dy = target.y - z.y;
  const d = Math.hypot(dx, dy) || 1;
  if (z.state === 'approach') {
    moveWithWallCollision(room.world, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
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
      const nd = Math.hypot(target.x - z.x, target.y - z.y) || 1;
      z.chargeDirX = (target.x - z.x) / nd;
      z.chargeDirY = (target.y - z.y) / nd;
      z.state = 'charge';
      z.chargeTimer = z.chargeDuration;
      z.chargeTravel = 0;
      z.carryingId = null;
      z.carryTime = 0;
      z.wallHit = false;
    }
    return;
  }
  if (z.state === 'charge') {
    const stepX = z.chargeDirX * z.chargeSpeed * dt;
    const stepY = z.chargeDirY * z.chargeSpeed * dt;
    const prevX = z.x;
    const prevY = z.y;
    moveWithWallCollision(room.world, z, stepX, stepY);
    const moved = Math.hypot(z.x - prevX, z.y - prevY);
    z.chargeTravel += moved;
    z.chargeTimer -= dt;
    if (!z.carryingId && target.alive && (target.dashTime || 0) <= 0 && (target.rocketJumpTime || 0) <= 0 && dist(z.x, z.y, target.x, target.y) < z.radius + target.radius + 3) {
      z.carryingId = target.id;
      z.carryTime = 0.32;
      target.carryingByCharger = z.id;
      damagePlayerServer(room, target, z.damage * 0.09);
    }
    if (z.carryingId) {
      const carried = room.match.playersById.get(z.carryingId);
      if (carried && carried.alive) {
        const carryX = z.x + z.chargeDirX * (z.radius + carried.radius - 1);
        const carryY = z.y + z.chargeDirY * (z.radius + carried.radius - 1);
        carried.x = carryX;
        carried.y = carryY;
        collideWithBuildings(room.world, carried);
        if (Math.hypot(carried.x - carryX, carried.y - carryY) > 1.5) {
          z.wallHit = true;
        }
        if (z.wallHit) {
          damagePlayerServer(room, carried, z.damage * 0.31);
          launchPlayerKnockback(carried, z.chargeDirX, z.chargeDirY, 360, 0.32);
          z.carryingId = null;
          z.state = 'recover';
          z.chargeTimer = 0.55;
        }
      } else {
        z.carryingId = null;
      }
    }
    if (z.chargeTimer <= 0 || z.chargeTravel >= 450) {
      if (z.carryingId) {
        const carried = room.match.playersById.get(z.carryingId);
        if (carried && carried.alive) {
          launchPlayerKnockback(carried, z.chargeDirX, z.chargeDirY, 420, 0.42);
        }
        z.carryingId = null;
      }
      z.state = 'recover';
      z.chargeTimer = 0.8;
    }
    return;
  }
  if (z.state === 'recover') {
    z.chargeTimer -= dt;
    if (z.chargeTimer <= 0) z.state = 'approach';
  }
}
function updateZombies(room, dt) {
  const match = room.match;
  for (let i = match.zombies.length - 1; i >= 0; i -= 1) {
    const z = match.zombies[i];
    z.touchTimer = Math.max(0, (z.touchTimer || 0) - dt);
    if (z.type === 'charger') {
      updateCharger(room, z, dt);
    } else if (z.type === 'pouncer' || z.type === 'boss') {
      z.pounceCd -= dt;
      if (z.pounceTime > 0) {
        z.pounceTime -= dt;
        moveWithWallCollision(room.world, z, z.vx * dt, z.vy * dt);
      } else {
        const targetData = nearestAlivePlayer(room, z.x, z.y);
        const target = targetData.player;
        if (target) {
          const dx = target.x - z.x;
          const dy = target.y - z.y;
          const d = Math.hypot(dx, dy) || 1;
          moveWithWallCollision(room.world, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
          const triggerDist = z.type === 'boss' ? 320 : 240;
          if (d < triggerDist && z.pounceCd <= 0) {
            z.pounceCd = z.type === 'boss' ? 1.8 : randRange(room.rng, 2.2, 3.4);
            z.pounceTime = z.type === 'boss' ? 0.35 : 0.28;
            const leap = z.type === 'boss' ? 430 : 360;
            z.vx = (dx / d) * leap;
            z.vy = (dy / d) * leap;
          }
        }
      }
    } else {
      const targetData = nearestAlivePlayer(room, z.x, z.y);
      const target = targetData.player;
      if (target) {
        const dx = target.x - z.x;
        const dy = target.y - z.y;
        const d = Math.hypot(dx, dy) || 1;
        moveWithWallCollision(room.world, z, (dx / d) * z.speed * dt, (dy / d) * z.speed * dt);
      }
    }
    z.x = clamp(z.x, 10, WORLD.w - 10);
    z.y = clamp(z.y, 10, WORLD.h - 10);
    for (const player of livingPlayers(room)) {
      if (z.type !== 'charger' && dist(z.x, z.y, player.x, player.y) < z.radius + player.radius + 1 && z.touchTimer <= 0) {
        let contactDamage;
        if (match.wave <= 5) contactDamage = 1;
        else {
          const earlyWaveFactor = 0.22 + Math.min(match.wave, 20) * 0.014;
          contactDamage = Math.max(1, z.damage * (z.touchDamageMul || 0.14) * earlyWaveFactor);
        }
        damagePlayerServer(room, player, contactDamage);
        z.touchTimer = z.touchCooldown || (z.type === 'boss' ? 0.6 : z.type === 'bloater' ? 0.7 : z.type === 'runner' ? 0.4 : 0.55);
      }
    }
  }
  for (const player of livingPlayers(room)) {
    if ((player.rocketJumpTime || 0) <= 0) {
      for (let i = 0; i < match.zombies.length; i += 1) {
        const z = match.zombies[i];
        softSeparate(player, z, z.type === 'boss' ? 0.22 : 0.18);
        player.x = clamp(player.x, player.radius + 2, WORLD.w - (player.radius + 2));
        player.y = clamp(player.y, player.radius + 2, WORLD.h - (player.radius + 2));
        z.x = clamp(z.x, 10, WORLD.w - 10);
        z.y = clamp(z.y, 10, WORLD.h - 10);
        collideWithBuildings(room.world, z);
        collideWithBuildings(room.world, player);
      }
    }
  }
  for (let i = 0; i < match.zombies.length; i += 1) {
    for (let j = i + 1; j < match.zombies.length; j += 1) {
      softSeparate(match.zombies[i], match.zombies[j], 0.12);
    }
  }
}
function processFireZones(room, dt) {
  for (let i = room.match.fireZones.length - 1; i >= 0; i -= 1) {
    const zone = room.match.fireZones[i];
    zone.life -= dt;
    zone.hitTick = (zone.hitTick || 0) - dt;
    if (zone.hitTick <= 0) {
      for (const player of livingPlayers(room)) {
        if (dist(zone.x, zone.y, player.x, player.y) < zone.radius + player.radius) damagePlayerServer(room, player, 18 * 0.25);
      }
      for (let j = room.match.zombies.length - 1; j >= 0; j -= 1) {
        const z = room.match.zombies[j];
        if (dist(zone.x, zone.y, z.x, z.y) < zone.radius + z.radius) {
          const dealt = 18 * ((room.match.playersById.get(zone.ownerId)?.damageMul) || 1);
          z.hp -= dealt;
          addDamageText(room, z.x, z.y - z.radius - 10, dealt, '#ffd84d');
          if (z.hp <= 0) handleZombieDeath(room, j, zone.ownerId || null);
        }
      }
      zone.hitTick = 0.18;
    }
    if (zone.life <= 0) room.match.fireZones.splice(i, 1);
  }
}
function processAirdropsAndPickups(room, dt) {
  for (let i = room.match.airdrops.length - 1; i >= 0; i -= 1) {
    const a = room.match.airdrops[i];
    if (!a.landed) {
      a.fallY += 190 * dt;
      if (a.fallY >= a.y) {
        a.fallY = a.y;
        a.landed = true;
        a.parachute = false;
      }
    } else {
      a.smoke += dt;
      for (const player of livingPlayers(room)) {
        if (dist(a.x, a.y, player.x, player.y) < 28) {
          const options = ['gatling', 'rocket', 'flamethrower'];
          const choice = options[Math.floor(room.rng() * options.length)];
          player.weapon = choice;
          if (choice === 'gatling') {
            player.magSize = 120; player.mag = 120; player.gatlingAmmo = 880;
          } else if (choice === 'rocket') {
            player.magSize = 1; player.mag = 1; player.rocketAmmo = 49;
          } else {
            player.magSize = 200; player.mag = 200; player.flameAmmo = 1500;
          }
          player.reloadTimer = 0;
          player.wasReloading = false;
          pushSoundFx(room, 'pickup', a.x, a.y, { ownerId: player.id });
          room.match.airdrops.splice(i, 1);
          break;
        }
      }
    }
  }
  for (let i = room.match.pickups.length - 1; i >= 0; i -= 1) {
    const item = room.match.pickups[i];
    item.ttl = (item.ttl ?? 40) - dt;
    if (item.ttl <= 0) {
      room.match.pickups.splice(i, 1);
      continue;
    }
    for (const player of livingPlayers(room)) {
      if (dist(item.x, item.y, player.x, player.y) < item.radius + player.radius + 3) {
        let picked = false;
        if (item.type === 'med') { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.10); picked = true; }
        else if (item.type === 'grenade' && player.grenades < 8) { player.grenades += 1; picked = true; }
        else if (item.type === 'molotov' && player.molotovs < 5) { player.molotovs += 1; picked = true; }
        else if (item.type === 'serum') { awardSerum(player, item.buff); picked = true; }
        if (picked) {
          pushSoundFx(room, 'pickup', item.x, item.y, { ownerId: player.id });
          room.match.pickups.splice(i, 1);
          break;
        }
      }
    }
  }
}
function processEffects(room, dt) {
  for (let i = room.match.effects.length - 1; i >= 0; i -= 1) {
    const e = room.match.effects[i];
    e.life -= dt;
    const t = 1 - e.life / e.maxLife;
    e.radius = e.maxRadius * t;
    e.ring = 24 + e.maxRadius * t * 0.65;
    if (e.life <= 0) room.match.effects.splice(i, 1);
  }
}
function lineBlockedByWalls(world, x1, y1, x2, y2) {
  for (const b of world.buildings) {
    for (const wr of getBuildingWallRects(b)) {
      if (lineIntersectsRect(x1, y1, x2, y2, wr)) return true;
    }
  }
  return false;
}
function rayDamage(room, sourcePlayer, angle, range, pelletDamage, maxHits = 1, spread = 0, hitIds = null) {
  const startX = sourcePlayer.x + Math.cos(angle + spread) * 18;
  const startY = sourcePlayer.y + Math.sin(angle + spread) * 18;
  const endX = startX + Math.cos(angle + spread) * range;
  const endY = startY + Math.sin(angle + spread) * range;
  const candidates = [];
  for (let i = 0; i < room.match.zombies.length; i += 1) {
    const z = room.match.zombies[i];
    if (hitIds && hitIds.has(z.id)) continue;
    const along = ((z.x - startX) * Math.cos(angle + spread) + (z.y - startY) * Math.sin(angle + spread));
    if (along < 0 || along > range) continue;
    const projX = startX + Math.cos(angle + spread) * along;
    const projY = startY + Math.sin(angle + spread) * along;
    const perpendicular = dist(z.x, z.y, projX, projY);
    if (perpendicular > z.radius + 3) continue;
    if (lineBlockedByWalls(room.world, startX, startY, z.x, z.y)) continue;
    candidates.push({ index: i, along });
  }
  candidates.sort((a, b) => a.along - b.along);
  let hits = 0;
  for (const hit of candidates) {
    const z = room.match.zombies[hit.index];
    if (!z) continue;
    const dealt = pelletDamage * (sourcePlayer.damageMul || 1);
    z.hp -= dealt;
    addDamageText(room, z.x, z.y - z.radius - 10, dealt, '#ffd84d');
    if (hitIds) hitIds.add(z.id);
    if (z.hp <= 0) handleZombieDeath(room, hit.index, sourcePlayer.id);
    hits += 1;
    if (hits >= maxHits) break;
  }
}
function handleFireAction(room, sourcePlayer, payload) {
  if (!sourcePlayer.alive) return;
  if (sourcePlayer.shootCooldown > 0 || sourcePlayer.reloadTimer > 0 || sourcePlayer.mag <= 0) return;
  const aimAngle = Number(payload.aimAngle || 0);
  const targetX = clamp(Number(payload.targetX || sourcePlayer.x), 0, WORLD.w);
  const targetY = clamp(Number(payload.targetY || sourcePlayer.y), 0, WORLD.h);
  if (sourcePlayer.weapon === 'shotgun') {
    sourcePlayer.mag -= 1;
    sourcePlayer.shootCooldown = 0.48;
    pushSoundFx(room, 'shot', sourcePlayer.x, sourcePlayer.y, { ownerId: sourcePlayer.id, weapon: 'shotgun' });
    for (let i = 0; i < 9; i += 1) {
      const spread = randRange(room.rng, -0.18, 0.18);
      const a = aimAngle + spread;
      const speed = randRange(room.rng, 620, 780);
      const damage = randRange(room.rng, 15, 26);
      spawnPelletProjectile(room, sourcePlayer, a, speed, 0.42, damage, { weaponKind: 'shotgun', startOffset: 18 });
    }
  } else if (sourcePlayer.weapon === 'gatling') {
    sourcePlayer.mag -= 1;
    sourcePlayer.shootCooldown = 0.055;
    pushSoundFx(room, 'shot', sourcePlayer.x, sourcePlayer.y, { ownerId: sourcePlayer.id, weapon: 'gatling' });
    const a = aimAngle + randRange(room.rng, -0.038, 0.038);
    spawnPelletProjectile(room, sourcePlayer, a, 980, 0.62, 20, { weaponKind: 'gatling', startOffset: 22, penetration: 5 });
  } else if (sourcePlayer.weapon === 'rocket') {
    sourcePlayer.mag -= 1;
    sourcePlayer.shootCooldown = 0.42;
    pushSoundFx(room, 'shot', sourcePlayer.x, sourcePlayer.y, { ownerId: sourcePlayer.id, weapon: 'rocket' });
    spawnRocketProjectile(room, sourcePlayer, targetX, targetY);
  } else if (sourcePlayer.weapon === 'flamethrower') {
    sourcePlayer.mag -= 1;
    sourcePlayer.shootCooldown = 0.024;
    pushSoundFx(room, 'shot', sourcePlayer.x, sourcePlayer.y, { ownerId: sourcePlayer.id, weapon: 'flamethrower' });
    const muzzleX = sourcePlayer.x + Math.cos(aimAngle) * 18;
    const muzzleY = sourcePlayer.y + Math.sin(aimAngle) * 18;
    for (let i = 0; i < 6; i += 1) {
      const spread = room.rng() < 0.3 ? randRange(room.rng, -0.28, 0.28) : randRange(room.rng, -0.18, 0.18);
      const a = aimAngle + spread;
      const speed = randRange(room.rng, 180, 390);
      const life = randRange(room.rng, 0.34, 0.62);
      const size = randRange(room.rng, 2.5, 5.5);
      const swirl = randRange(room.rng, -110, 110);
      const heat = randRange(room.rng, 0.85, 1.2);
      const colorRoll = room.rng();
      const color = colorRoll > 0.6 ? 'rgba(255,205,110,0.96)' : colorRoll > 0.45 ? 'rgba(255,130,40,0.92)' : 'rgba(255,85,25,0.88)';
      spawnFlameProjectile(
        room,
        sourcePlayer,
        muzzleX + randRange(room.rng, -2.5, 2.5),
        muzzleY + randRange(room.rng, -2.5, 2.5),
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        life,
        size,
        0.8,
        swirl,
        heat,
        color,
      );
    }
  }
}
function handleThrowAction(room, sourcePlayer, payload) {
  if (!sourcePlayer.alive) return;
  const throwable = payload.throwable || payload.type || payload.kindName || 'grenade';
  const kind = throwable === 'molotov' ? 'molotov' : 'grenade';
  const targetX = clamp(Number(payload.targetX || sourcePlayer.x), 10, WORLD.w - 10);
  const targetY = clamp(Number(payload.targetY || sourcePlayer.y), 10, WORLD.h - 10);
  if (kind === 'molotov') {
    if (sourcePlayer.molotovs <= 0) return;
    sourcePlayer.molotovs -= 1;
    spawnThrowableProjectile(room, sourcePlayer, 'molotov', targetX, targetY, 0.82);
    enqueueExplosion(room, sourcePlayer, targetX, targetY, 0.82, 'molotov');
  } else {
    if (sourcePlayer.grenades <= 0) return;
    sourcePlayer.grenades -= 1;
    spawnThrowableProjectile(room, sourcePlayer, 'grenade', targetX, targetY, 0.95);
    enqueueExplosion(room, sourcePlayer, targetX, targetY, 0.95, 'normal');
  }
}
function handleReloadAction(sourcePlayer) {
  const reserveKey = reserveKeyForWeapon(sourcePlayer.weapon);
  const hasReserve = sourcePlayer.weapon === 'shotgun' || (reserveKey && sourcePlayer[reserveKey] > 0);
  if (sourcePlayer.reloadTimer > 0 || sourcePlayer.mag === sourcePlayer.magSize || !hasReserve) return;
  sourcePlayer.reloadTimer = sourcePlayer.weapon === 'gatling' ? 1.9 : sourcePlayer.weapon === 'rocket' ? 0.95 : sourcePlayer.weapon === 'flamethrower' ? 1.0 : 1.3;
  sourcePlayer.wasReloading = true;
}
function handlePlayerAction(client, payload) {
  const room = rooms.get(client.roomId);
  if (!room || !room.started || !room.match) return;
  const player = room.match.playersById.get(client.id);
  if (!player) return;
  if (payload.kind === 'fire') handleFireAction(room, player, payload);
  else if (payload.kind === 'throw') handleThrowAction(room, player, payload);
  else if (payload.kind === 'reload') handleReloadAction(player);
}
function updatePlayerFromClient(client, state) {
  const room = rooms.get(client.roomId);
  if (!room || !room.started || !room.match) return;
  const player = room.match.playersById.get(client.id);
  if (!player || !player.alive) return;
  if (typeof state.name === 'string' && state.name.trim()) client.name = state.name.trim().slice(0, 18);
  const incomingDashTime = Number.isFinite(state.dashTime) ? Math.max(0, Number(state.dashTime) || 0) : 0;
  if (incomingDashTime > 0.12 && (player.dashTime || 0) <= 0.02) pushSoundFx(room, 'dash', player.x, player.y, { ownerId: player.id });
  if (Number.isFinite(state.dashTime)) player.dashTime = Math.max(player.dashTime || 0, incomingDashTime);
  if (!(player.carryingByCharger || (player.knockbackTime || 0) > 0 || (player.zombiePushTime || 0) > 0) && Number.isFinite(state.x) && Number.isFinite(state.y)) {
    player.x = clamp(Number(state.x), player.radius + 2, WORLD.w - (player.radius + 2));
    player.y = clamp(Number(state.y), player.radius + 2, WORLD.h - (player.radius + 2));
    collideWithBuildings(room.world, player);
  }
  if (Number.isFinite(state.faceDir)) player.faceDir = state.faceDir < 0 ? -1 : 1;
  if (Number.isFinite(state.aimAngle)) player.aimAngle = Number(state.aimAngle);
  player.moving = !!state.moving;
  player.name = client.name;
}
function snapshotForClient(room, client) {
  const players = currentPlayers(room).map((p) => ({
    id: p.id,
    name: clients.get(p.id)?.name || p.name,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp: p.maxHp,
    faceDir: p.faceDir,
    aimAngle: p.aimAngle || 0,
    weapon: p.weapon,
    moving: p.moving,
    score: p.score,
    kills: p.kills,
    mag: p.mag,
    magSize: p.magSize,
    grenades: p.grenades,
    molotovs: p.molotovs,
    gatlingAmmo: p.gatlingAmmo,
    rocketAmmo: p.rocketAmmo,
    flameAmmo: p.flameAmmo,
    speedMul: p.speedMul,
    damageMul: p.damageMul,
    rocketJumpTime: p.rocketJumpTime || 0,
    rocketJumpVX: p.rocketJumpVX || 0,
    rocketJumpVY: p.rocketJumpVY || 0,
    knockbackTime: p.knockbackTime || 0,
    knockbackVX: p.knockbackVX || 0,
    knockbackVY: p.knockbackVY || 0,
    carryingByCharger: p.carryingByCharger || null,
    zombiePushTime: p.zombiePushTime || 0,
    alive: p.alive,
    buffAnnouncement: p.id === client.id ? p.buffAnnouncement : '',
    buffAnnouncementTimer: p.id === client.id ? p.buffAnnouncementTimer : 0,
  }));
  return {
    type: 'snapshot',
    room: roomPublicState(room),
    selfId: client.id,
    players,
    match: {
      wave: room.match.wave,
      surviveTime: room.match.surviveTime,
      kills: room.match.kills,
      bossAnnouncement: room.match.bossAnnouncement,
      airdropAnnouncement: room.match.airdropAnnouncement,
      zombies: room.match.zombies.map((z) => ({
        id: z.id,
        type: z.type,
        x: z.x,
        y: z.y,
        radius: z.radius,
        hp: z.hp,
        maxHp: z.maxHp,
        skin: z.skin,
        shirt: z.shirt,
        state: z.state,
        crawl: z.crawl,
      })),
      pickups: room.match.pickups.map((p) => ({ ...p })),
      airdrops: room.match.airdrops.map((a) => ({ ...a })),
      fireZones: room.match.fireZones.map((f) => ({ ...f })),
      effects: room.match.effects.map((e) => ({ ...e })),
      pendingExplosions: room.match.pendingExplosions.map((e) => ({ ...e })),
      projectiles: room.match.projectiles.map((p) => ({ ...p })),
      shotFx: room.match.shotFx.map((fx) => ({ ...fx })),
      flameFx: room.match.flameFx.map((fx) => ({ ...fx })),
      damageTexts: room.match.damageTexts.map((t) => ({ ...t })),
      bloodFx: room.match.bloodFx.map((fx) => ({ ...fx })),
      soundFx: room.match.soundFx.map((fx) => ({ ...fx })),
    },
  };
}
function broadcastSnapshots() {
  for (const room of rooms.values()) {
    if (!room.started || !room.match) continue;
    for (const client of room.players.values()) safeSend(client.ws, snapshotForClient(room, client));
  }
}
function updateRoom(room, dt) {
  if (!room.started || !room.match) return;
  const match = room.match;
  match.surviveTime += dt;
  match.waveTimer += dt;
  match.spawnTimer += dt;
  match.airdropTimer -= dt;
  match.bossAnnouncement = Math.max(0, match.bossAnnouncement - dt);
  match.airdropAnnouncement = Math.max(0, match.airdropAnnouncement - dt);
  if (match.waveTimer >= 18) {
    match.waveTimer = 0;
    match.wave += 1;
  }
  if (match.surviveTime >= match.nextBossTime) {
    spawnBoss(room);
    match.nextBossTime += 70;
  }
  if (match.airdropTimer <= 0) {
    match.airdropTimer = randRange(room.rng, 50, 75);
    spawnAirdrop(room);
  }
  const spawnRate = Math.max(0.22, 1.0 - match.wave * 0.05);
  while (match.spawnTimer >= spawnRate) {
    match.spawnTimer -= spawnRate;
    spawnZombie(room);
  }
  updatePlayerTransientStates(room, dt);
  for (const player of currentPlayers(room)) updateReload(player, dt);
  processPendingExplosions(room, dt);
  processProjectiles(room, dt);
  processFireZones(room, dt);
  updateZombies(room, dt);
  processAirdropsAndPickups(room, dt);
  processEffects(room, dt);
  processShotFx(room, dt);
  processDamageTexts(room, dt);
  processTransientEventFx(room, dt);
  if (!livingPlayers(room).length) endMatch(room, 'All players were defeated.');
}

wss.on('connection', (ws) => {
  const client = {
    id: `p_${String(nextClientNum++).padStart(4, '0')}`,
    ws,
    name: `Player${nextClientNum - 1}`,
    lang: 'en',
    roomId: null,
    ready: false,
  };
  clients.set(client.id, client);
  safeSend(ws, { type: 'welcome', clientId: client.id });
  safeSend(ws, { type: 'room_list', rooms: roomListPayload() });

  ws.on('message', (raw) => {
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch (_err) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'hello') {
      if (typeof msg.name === 'string' && msg.name.trim()) client.name = msg.name.trim().slice(0, 18);
      if (typeof msg.lang === 'string') client.lang = msg.lang;
      safeSend(ws, { type: 'room_list', rooms: roomListPayload() });
      return;
    }
    if (msg.type === 'list_rooms') {
      safeSend(ws, { type: 'room_list', rooms: roomListPayload() });
      return;
    }
    if (msg.type === 'create_room') {
      if (client.roomId) removeClientFromRoom(client);
      const room = createRoom(client, msg.roomName);
      broadcastRoomState(room, 'room_joined');
      broadcastRoomList();
      return;
    }
    if (msg.type === 'join_room') {
      const room = rooms.get(String(msg.roomId || ''));
      if (!room) { safeSend(ws, { type: 'error', message: 'Room not found.' }); return; }
      if (room.started) { safeSend(ws, { type: 'error', message: 'Room already started.' }); return; }
      if (room.players.size >= room.maxPlayers) { safeSend(ws, { type: 'error', message: 'Room is full.' }); return; }
      if (client.roomId) removeClientFromRoom(client);
      addClientToRoom(client, room);
      maybeStartCountdown(room);
      broadcastRoomState(room, 'room_joined');
      broadcastRoomList();
      return;
    }
    if (msg.type === 'leave_room') {
      if (!client.roomId) {
        safeSend(ws, { type: 'left_room' });
        return;
      }
      const oldRoom = rooms.get(client.roomId);
      removeClientFromRoom(client);
      safeSend(ws, { type: 'left_room' });
      if (oldRoom && rooms.has(oldRoom.roomId)) {
        maybeStartCountdown(oldRoom);
        broadcastRoomState(oldRoom, 'room_update');
      }
      broadcastRoomList();
      return;
    }
    if (msg.type === 'toggle_ready') {
      const room = rooms.get(client.roomId);
      if (!room || room.started) return;
      client.ready = !client.ready;
      maybeStartCountdown(room);
      broadcastRoomState(room, 'room_update');
      broadcastRoomList();
      return;
    }
    if (msg.type === 'start_match') {
      const room = rooms.get(client.roomId);
      if (!room) return;
      if (!canStartMatch(room, client.id)) {
        safeSend(ws, { type: 'error', message: 'Only the host can start when everyone is ready.' });
        return;
      }
      startMatch(room);
      return;
    }
    if (msg.type === 'player_state') {
      updatePlayerFromClient(client, msg.state || {});
      return;
    }
    if (msg.type === 'player_action') {
      handlePlayerAction(client, msg.action || {});
      return;
    }
    if (msg.type === 'dev_command') {
      handleDevCommand(client, msg || {});
      return;
    }
  });

  ws.on('close', () => {
    if (client.roomId) removeClientFromRoom(client);
    clients.delete(client.id);
    broadcastRoomList();
  });

  ws.on('error', () => {
    try { ws.close(); } catch (_err) {}
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.started && room.countdownEndsAt && room.countdownEndsAt <= Date.now()) startMatch(room);
  }
}, 100);

setInterval(() => {
  const dt = 1 / TICK_RATE;
  for (const room of rooms.values()) updateRoom(room, dt);
}, 1000 / TICK_RATE);

setInterval(() => {
  broadcastSnapshots();
}, 1000 / SNAPSHOT_RATE);

server.listen(PORT, () => {
  console.log(`DeadTown P0 server listening on http://localhost:${PORT}`);
});
