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
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
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

function leaveRoom(ws) {
  const client = clients.get(ws);
  if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId);
  client.roomId = null;
  if (!room) return;

  room.players = room.players.filter((p) => p.ws !== ws);
  room.states.delete(client.id);

  if (room.players.length === 0) {
    clearInterval(room.tick);
    rooms.delete(room.roomId);
    broadcastRoomList();
    return;
  }

  if (room.hostId === client.id) {
    room.hostId = room.players[0].id;
    room.hostName = room.players[0].name;
  }

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
        players: [{ id: c.id, name: c.name, ws }],
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
      if (room.players.length >= room.maxPlayers) return send(ws, { type: 'error', message: 'Room full.' });
      leaveRoom(ws);
      room.players.push({ id: c.id, name: c.name, ws });
      c.roomId = room.roomId;
      send(ws, { type: 'room_joined', room: roomPayload(room) });
      broadcastRoomUpdate(room);
      return;
    }

    if (msg.type === 'leave_room') {
      leaveRoom(ws);
      return;
    }

    if (msg.type === 'start_match') {
      const room = rooms.get(c.roomId);
      if (!room) return;
      if (room.hostId !== c.id) return send(ws, { type: 'error', message: 'Only the host can start.' });
      room.started = true;
      room.worldSeed = Math.floor(Math.random() * 2147483647);
      const payload = { type: 'match_started', room: roomPayload(room), worldSeed: room.worldSeed };
      for (const p of room.players) send(p.ws, payload);
      broadcastRoomList();
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

server.listen(PORT, () => {
  console.log(`DeadTown online co-op server listening on :${PORT}`);
});
