const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
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

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
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
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: !!p.ready,
    })),
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

function maybeStartCountdown(room) {
  if (room.started) return;
  if (room.players.length === 0) return;
  const allReady = room.players.every((p) => !!p.ready);
  if (!allReady) {
    if (room.countdownEndsAt) {
      cancelCountdown(room);
      broadcastRoomUpdate(room);
    }
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
    if (!stillAllReady) {
      current.countdownEndsAt = null;
      broadcastRoomUpdate(current);
      return;
    }
    current.started = true;
    current.countdownEndsAt = null;
    current.worldSeed = Math.floor(Math.random() * 2147483647);
    const payload = { type: 'match_started', room: roomPayload(current), worldSeed: current.worldSeed };
    for (const p of current.players) send(p.ws, payload);
    broadcastRoomList();
  }, 5000);
  broadcastRoomUpdate(room);
}

function leaveRoom(ws) {
  const client = clients.get(ws);
  if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId);
  client.roomId = null;
  if (!room) return;

  room.players = room.players.filter((p) => p.ws !== ws);
  room.states.delete(client.id);

  if (room.players.length === 0) {
    cancelCountdown(room);
    clearInterval(room.tick);
    rooms.delete(room.roomId);
    broadcastRoomList();
    return;
  }

  if (room.hostId === client.id) {
    room.hostId = room.players[0].id;
    room.hostName = room.players[0].name;
  }

  maybeStartCountdown(room);
  send(ws, { type: 'left_room' });
  broadcastRoomUpdate(room);
}

function startRoomTicker(room) {
  if (room.tick) clearInterval(room.tick);
  room.tick = setInterval(() => {
    if (!rooms.has(room.roomId)) return;
    const players = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: !!p.ready,
      ...(room.states.get(p.id) || {}),
    }));
    const payload = { type: 'snapshot', roomId: room.roomId, players };
    for (const p of room.players) send(p.ws, payload);
  }, 50);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DeadTown online co-op server is running.');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const client = { id: id(), name: 'Player', roomId: null };
  clients.set(ws, client);
  send(ws, { type: 'welcome', clientId: client.id });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON.' });
      return;
    }

    const c = clients.get(ws);
    if (!c) return;

    if (msg.type === 'hello') {
      c.name = cleanName(msg.name);
      send(ws, { type: 'room_list', rooms: roomListPayload() });
      return;
    }

    if (msg.type === 'list_rooms') {
      send(ws, { type: 'room_list', rooms: roomListPayload() });
      return;
    }

    if (msg.type === 'create_room') {
      leaveRoom(ws);
      const roomId = id(6);
      const room = {
        roomId,
        roomName: cleanRoomName(msg.roomName, `${c.name} Room`),
        hostId: c.id,
        hostName: c.name,
        maxPlayers: 4,
        started: false,
        worldSeed: null,
        countdownEndsAt: null,
        countdownTimer: null,
        players: [{ id: c.id, name: c.name, ws, ready: false }],
        states: new Map(),
        tick: null,
      };
      rooms.set(roomId, room);
      c.roomId = roomId;
      send(ws, { type: 'room_joined', room: roomPayload(room) });
      broadcastRoomUpdate(room);
      startRoomTicker(room);
      return;
    }

    if (msg.type === 'join_room') {
      const room = rooms.get(msg.roomId);
      if (!room) return send(ws, { type: 'error', message: 'Room not found.' });
      if (room.started) return send(ws, { type: 'error', message: 'Match already started.' });
      if (room.players.length >= room.maxPlayers) return send(ws, { type: 'error', message: 'Room full.' });
      leaveRoom(ws);
      room.players.push({ id: c.id, name: c.name, ws, ready: false });
      c.roomId = room.roomId;
      send(ws, { type: 'room_joined', room: roomPayload(room) });
      broadcastRoomUpdate(room);
      return;
    }

    if (msg.type === 'leave_room') {
      leaveRoom(ws);
      return;
    }

    if (msg.type === 'toggle_ready') {
      const room = rooms.get(c.roomId);
      if (!room || room.started) return;
      const player = room.players.find((p) => p.id === c.id);
      if (!player) return;
      player.ready = !player.ready;
      broadcastRoomUpdate(room);
      maybeStartCountdown(room);
      return;
    }

    if (msg.type === 'player_state') {
      const room = rooms.get(c.roomId);
      if (!room) return;
      room.states.set(c.id, {
        x: Number(msg.state?.x || 0),
        y: Number(msg.state?.y || 0),
        hp: Number(msg.state?.hp || 0),
        maxHp: Number(msg.state?.maxHp || 100),
        faceDir: Number(msg.state?.faceDir || 1),
        weapon: String(msg.state?.weapon || 'shotgun'),
        score: Number(msg.state?.score || 0),
        kills: Number(msg.state?.kills || 0),
      });
      return;
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
    clients.delete(ws);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DeadTown online co-op server listening on :${PORT}`);
});
