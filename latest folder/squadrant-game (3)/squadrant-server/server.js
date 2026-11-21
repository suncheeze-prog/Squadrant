/**
 * SQUADRANT — LAN/Hotspot Multiplayer Server
 * Node.js + Socket.IO — works without internet
 *
 * Run: node server.js
 * Default port: 3001
 */

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');
const os      = require('os');

const app    = express();
const server = http.createServer(app);

// ── CORS: allow ALL origins (needed for Capacitor/Android & browser clients)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  // Allow both transport types — polling is the reliable fallback
  transports: ['polling', 'websocket'],
  // Increase timeouts for slow hotspot connections
  pingTimeout:      20000,
  pingInterval:     10000,
  connectTimeout:   15000,
  // Needed for Android WebView / Capacitor
  allowEIO3: true,
});

// ── Serve the React build as static files so the same server
//    handles both the game UI AND the socket connections
//    (eliminates cross-origin issues entirely)
const buildPath = path.join(__dirname, '..', 'squadrant', 'build');
app.use(express.static(buildPath));

// Health-check / info endpoint
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Squadrant Multiplayer',
    version: '1.0.0',
    rooms: rooms.size,
    players: players.size,
    time: Date.now(),
  });
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).json({ status: 'Squadrant server running', port: PORT });
  });
});

const PORT = process.env.PORT || 3001;

// ── State ──────────────────────────────────────────────────────────────────
const rooms   = new Map(); // roomId → Room
const players = new Map(); // socketId → Player

function genId(len = 6) {
  return Math.random().toString(36).substr(2, len).toUpperCase();
}

function getRoom(id) { return rooms.get(id); }

function broadcastRoomList() {
  const list = [...rooms.values()]
    .filter(r => r.status === 'waiting')
    .map(r => ({
      id:         r.id,
      name:       r.name,
      host:       r.hostName,
      players:    r.players.length,
      maxPlayers: 2,
      difficulty: r.difficulty,
    }));
  io.emit('roomList', list);
}

function roomSummary(room) {
  return {
    id:         room.id,
    name:       room.name,
    host:       room.hostName,
    players:    room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    status:     room.status,
    difficulty: room.difficulty,
  };
}

// ── Socket events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id} via ${socket.conn.transport.name}`);

  // Log transport upgrades (polling → websocket)
  socket.conn.on('upgrade', (transport) => {
    console.log(`[↑] Transport upgraded: ${socket.id} → ${transport.name}`);
  });

  // Register player
  socket.on('register', ({ name }) => {
    players.set(socket.id, {
      id:     socket.id,
      name:   (name || 'Commander').substring(0, 20),
      ready:  false,
      roomId: null,
    });
    socket.emit('registered', { id: socket.id });
    broadcastRoomList();
    console.log(`[R] Registered: ${name} (${socket.id})`);
  });

  socket.on('getRoomList', () => broadcastRoomList());

  // Create room
  socket.on('createRoom', ({ roomName, difficulty }, cb) => {
    const player = players.get(socket.id);
    if (!player) { cb?.({ error: 'Not registered' }); return; }

    // Remove player from any existing room first
    if (player.roomId) handleLeave(socket);

    const room = {
      id:           genId(),
      name:         (roomName || `${player.name}'s Room`).substring(0, 30),
      hostId:       socket.id,
      hostName:     player.name,
      players:      [player],
      status:       'waiting',
      difficulty:   difficulty || 'easy',
      grids:        {},
      turn:         null,
      weaponCounts: {},
    };

    player.roomId = room.id;
    rooms.set(room.id, room);
    socket.join(room.id);

    cb?.({ room: roomSummary(room) });
    broadcastRoomList();
    console.log(`[+] Room created: ${room.id} by ${player.name}`);
  });

  // Join room
  socket.on('joinRoom', ({ roomId }, cb) => {
    const player = players.get(socket.id);
    const room   = getRoom(roomId);

    if (!player)                      { cb?.({ error: 'Not registered' }); return; }
    if (!room)                        { cb?.({ error: 'Room not found' }); return; }
    if (room.status !== 'waiting')    { cb?.({ error: 'Game already in progress' }); return; }
    if (room.players.length >= 2)     { cb?.({ error: 'Room is full' }); return; }
    if (player.roomId === room.id)    { cb?.({ room: roomSummary(room) }); return; } // already in

    if (player.roomId) handleLeave(socket);

    player.roomId = room.id;
    room.players.push(player);
    socket.join(room.id);

    cb?.({ room: roomSummary(room) });
    io.to(room.id).emit('roomUpdate', roomSummary(room));
    broadcastRoomList();
    console.log(`[J] ${player.name} joined room ${room.id}`);
  });

  // Toggle ready
  socket.on('setReady', ({ ready }) => {
    const player = players.get(socket.id);
    if (!player?.roomId) return;
    player.ready = !!ready;
    const room = getRoom(player.roomId);
    if (!room) return;

    io.to(room.id).emit('roomUpdate', roomSummary(room));

    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.status = 'placement';
      io.to(room.id).emit('startPlacement', { difficulty: room.difficulty });
      broadcastRoomList();
      console.log(`[S] Placement started in room ${room.id}`);
    }
  });

  // Submit ship grid
  socket.on('submitGrid', ({ grid }, cb) => {
    const player = players.get(socket.id);
    if (!player?.roomId) { cb?.({ error: 'No room' }); return; }
    const room = getRoom(player.roomId);
    if (!room) { cb?.({ error: 'Room gone' }); return; }

    room.grids[socket.id] = grid;
    socket.to(room.id).emit('opponentGridReady');
    console.log(`[G] Grid submitted by ${player.name} in room ${room.id} (${Object.keys(room.grids).length}/2)`);

    if (Object.keys(room.grids).length === 2) {
      room.status = 'playing';
      room.turn   = room.hostId;
      room.players.forEach(p => {
        room.weaponCounts[p.id] = { rocket: 999, bomb: 3, nuke: 1 };
      });

      room.players.forEach(p => {
        const enemyId   = room.players.find(x => x.id !== p.id)?.id;
        io.to(p.id).emit('gameStart', {
          myGrid:     room.grids[p.id],
          enemyGrid:  room.grids[enemyId] || null,
          yourTurn:   p.id === room.turn,
          difficulty: room.difficulty,
        });
      });
      console.log(`[!] Game started in room ${room.id}`);
    }
    cb?.({ ok: true });
  });

  // Fire attack
  socket.on('fireAttack', ({ x, y, weapon }, cb) => {
    const player = players.get(socket.id);
    if (!player?.roomId) { cb?.({ error: 'No room' }); return; }
    const room = getRoom(player.roomId);
    if (!room || room.status !== 'playing') { cb?.({ error: 'Not in game' }); return; }
    if (room.turn !== socket.id)            { cb?.({ error: 'Not your turn' }); return; }

    const wc = room.weaponCounts[socket.id];
    if (!wc || wc[weapon] <= 0) { cb?.({ error: 'No ammo' }); return; }
    wc[weapon]--;

    const enemyId = room.players.find(p => p.id !== socket.id)?.id;
    io.to(room.id).emit('attackResult', {
      attackerId: socket.id,
      defenderId: enemyId,
      x, y, weapon,
      weaponCounts: room.weaponCounts,
    });

    room.turn = enemyId;
    io.to(room.id).emit('turnChange', { turn: room.turn });
    cb?.({ ok: true });
  });

  // Game over report
  socket.on('reportGameOver', ({ winnerId }) => {
    const player = players.get(socket.id);
    if (!player?.roomId) return;
    const room = getRoom(player.roomId);
    if (!room) return;
    room.status = 'ended';
    const winner = players.get(winnerId);
    io.to(room.id).emit('gameOver', {
      winnerId,
      winnerName: winner?.name || 'Unknown',
    });
    broadcastRoomList();
  });

  // Chat
  socket.on('chatMsg', ({ text }) => {
    const player = players.get(socket.id);
    if (!player?.roomId) return;
    io.to(player.roomId).emit('chatMsg', {
      from: player.name,
      text: String(text).substring(0, 200),
      ts:   Date.now(),
    });
  });

  socket.on('leaveRoom', () => handleLeave(socket));

  socket.on('disconnect', (reason) => {
    console.log(`[-] Disconnected: ${socket.id} — ${reason}`);
    handleLeave(socket);
    players.delete(socket.id);
  });
});

function handleLeave(socket) {
  const player = players.get(socket.id);
  if (!player?.roomId) return;
  const room = getRoom(player.roomId);
  if (!room) { player.roomId = null; return; }

  room.players = room.players.filter(p => p.id !== socket.id);
  socket.leave(room.id);
  player.roomId = null;

  if (room.players.length === 0) {
    rooms.delete(room.id);
    console.log(`[x] Room ${room.id} deleted (empty)`);
  } else {
    if (['playing', 'placement'].includes(room.status)) {
      room.status   = 'waiting';
      room.hostId   = room.players[0].id;
      room.hostName = room.players[0].name;
      room.players.forEach(p => { p.ready = false; });
      room.grids = {};
    }
    io.to(room.id).emit('playerLeft', {
      name: player.name,
      room: roomSummary(room),
    });
  }
  broadcastRoomList();
}

// ── Start ──────────────────────────────────────────────────────────────────
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips  = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ iface: name, ip: net.address });
      }
    }
  }
  return ips;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        SQUADRANT MULTIPLAYER SERVER          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Port    : ${PORT}                                 ║`);
  console.log('║  Network : All interfaces (0.0.0.0)           ║');
  console.log('╠══════════════════════════════════════════════╣');
  if (ips.length === 0) {
    console.log('║  No network interfaces found                 ║');
  } else {
    ips.forEach(({ iface, ip }) => {
      const line = `  ${iface}: http://${ip}:${PORT}`;
      console.log(`║${line.padEnd(46)}║`);
    });
  }
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Serving React build at /                    ║');
  console.log('║  Socket.IO at /socket.io                     ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log('► Players open browser to http://<IP>:3001');
  console.log('► Or use the Capacitor APK and enter the IP above\n');
});
