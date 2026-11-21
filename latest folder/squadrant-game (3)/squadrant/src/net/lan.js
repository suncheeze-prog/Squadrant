/* ═══════════════════════════════════════════════════════════════
   SQUADRANT — SERVERLESS LAN TRANSPORT
   ───────────────────────────────────────────────────────────────
   Replaces the Node/Socket.IO server. The HOST phone runs the
   authoritative game state in-process (GameHost) and exchanges
   newline-delimited JSON with the single guest over a native TCP
   socket. Discovery is done with NSD (no IP typing).

   The rest of the app keeps using a socket.io-shaped object
   (.emit / .on / .off / .id) so screens need no transport rewrite.
   ═══════════════════════════════════════════════════════════════ */
import { registerPlugin, Capacitor } from '@capacitor/core';
import { checkHit, applyHit, allShipsSunk, checkShipSunk, getSkillShotTargets, SHIPS } from '../utils/gameLogic';

const Net = registerPlugin('SquadrantNet');

/** Expand weapon pattern around base (x,y) — must match client's getWeaponTargets */
function expandTargets(weapon, x, y) {
  if (weapon === 'bomb') {
    return [{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
  }
  if (weapon === 'nuke') {
    const t = [{x,y}];
    for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) if (dx||dy) t.push({x:x+dx,y:y+dy});
    return t;
  }
  return [{x,y}];
}

/** True only when running inside the native Android shell. */
export function lanAvailable() {
  return Capacitor.isNativePlatform();
}

/* The single active host/guest session (one match at a time). */
let activeSession = null;

/** Tear down whatever LAN session is active (server or guest connection). */
export async function closeLan() {
  const s = activeSession;
  activeSession = null;
  if (s) { try { await s.close(); } catch (e) { /* noop */ } }
}

/* ── tiny event emitter used by the socket shims ───────────────── */
function makeEmitter() {
  const handlers = {};
  return {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    off(ev, fn) {
      if (!handlers[ev]) return;
      handlers[ev] = fn ? handlers[ev].filter(h => h !== fn) : [];
    },
    emit(ev, ...args) {
      (handlers[ev] || []).slice().forEach(fn => {
        try { fn(...args); } catch (e) { console.error(`[lan] handler "${ev}"`, e); }
      });
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   GAME HOST — authoritative engine for one 1v1 match.
   Player ids are fixed: 'host' (local) and 'guest' (remote).
   Mirrors the original server.js room logic.
   ═══════════════════════════════════════════════════════════════ */
class GameHost {
  constructor(sendToGuest) {
    this.sendToGuest = sendToGuest;     // (event, payload) => void  (serialize over TCP)
    this.local = makeEmitter();         // host self-socket event sink
    this.players = {};                  // id -> { id, name, ready }
    this.order = [];                    // join order
    this.status = 'waiting';
    this.difficulty = 'easy';
    this.roomName = '';
    this.grids = {};
    this.turn = null;
    this.weaponCounts = {};
  }

  emitTo(target, event, payload) {
    if (target === 'host' || target === 'all') this.local.emit(event, payload);
    if (target === 'guest' || target === 'all') this.sendToGuest(event, payload);
  }

  summary() {
    return {
      id: 'room',
      name: this.roomName,
      host: this.players.host ? this.players.host.name : '',
      players: this.order.map(id => ({ id, name: this.players[id].name, ready: this.players[id].ready })),
      status: this.status,
      difficulty: this.difficulty,
    };
  }

  addPlayer(id, name) {
    if (!this.players[id]) {
      this.players[id] = { id, name, ready: false };
      this.order.push(id);
    } else if (name) {
      this.players[id].name = name;
    }
  }

  removePlayer(id) {
    if (!this.players[id]) return;
    delete this.players[id];
    this.order = this.order.filter(x => x !== id);
  }

  /** Process an intent coming from either player. `ack` is optional. */
  handle(fromId, event, payload, ack) {
    switch (event) {
      case 'register': {
        this.addPlayer(fromId, (payload && payload.name) || (fromId === 'host' ? 'Host' : 'Guest'));
        if (ack) ack({ id: fromId });
        this.emitTo(fromId, 'registered', { id: fromId });
        this.emitTo('all', 'roomUpdate', this.summary());
        break;
      }

      case 'setReady': {
        if (this.players[fromId]) this.players[fromId].ready = !!(payload && payload.ready);
        this.emitTo('all', 'roomUpdate', this.summary());
        if (this.order.length === 2 && this.order.every(id => this.players[id].ready)) {
          // Reset stale state from any previous round so a new placement starts clean
          this.grids = {};
          this.weaponCounts = {};
          this.status = 'placement';
          this.turn = null;
          this.emitTo('all', 'startPlacement', { difficulty: this.difficulty });
        }
        break;
      }

      case 'submitGrid': {
        this.grids[fromId] = payload && payload.grid;
        if (ack) ack({ ok: true });
        if (Object.keys(this.grids).length === 2 && this.order.length === 2) {
          this.status = 'playing';
          this.turn = 'host';
          this.order.forEach(id => { this.weaponCounts[id] = { rocket: 999, bomb: 3, nuke: 1 }; });
          this.order.forEach(id => {
            this.emitTo(id, 'gameStart', {
              myGrid: this.grids[id],
              yourTurn: id === this.turn,
              difficulty: this.difficulty,
            });
          });
        }
        break;
      }

      case 'fireAttack': {
        if (this.status !== 'playing') { if (ack) ack({ error: 'Not in game' }); break; }
        if (this.turn !== fromId)      { if (ack) ack({ error: 'Not your turn' }); break; }

        // Interference check: if this player's turn was blocked, skip and notify
        if (this.blockNextTurn && this.blockNextTurn[fromId]) {
          this.blockNextTurn[fromId] = false;
          const enemyId0 = this.order.find(id => id !== fromId);
          this.turn = enemyId0;
          this.emitTo('all', 'turnChange', { turn: this.turn });
          if (ack) ack({ error: 'Your turn was blocked by Interference!' });
          break;
        }

        const weapon = payload && payload.weapon;
        const pendingShot = payload && payload.pendingShot;
        const usingSkill = !!pendingShot;
        const wc = this.weaponCounts[fromId];
        if (!usingSkill && (!wc || wc[weapon] <= 0)) { if (ack) ack({ error: 'No ammo' }); break; }
        if (!usingSkill) wc[weapon]--;
        const enemyId = this.order.find(id => id !== fromId);

        // ── Authoritative hit computation using defender's actual grid ──
        const baseX = payload.x, baseY = payload.y;
        const targets = usingSkill
          ? getSkillShotTargets(pendingShot, baseX, baseY)
          : expandTargets(weapon, baseX, baseY);
        let defenderGrid = this.grids[enemyId];
        const sunkAlready = new Set();
        const hits = targets.map(({ x, y }) => {
          if (!defenderGrid) return { x, y, miss: true };
          const result = checkHit(defenderGrid, x, y);
          let sunk = false;
          if (result.valid && !result.alreadyHit) {
            defenderGrid = applyHit(defenderGrid, x, y);
            if (result.hit && result.shipId != null) {
              if (!sunkAlready.has(result.shipId) && checkShipSunk(defenderGrid, result.shipId)) {
                sunk = true;
                sunkAlready.add(result.shipId);
              }
            }
          }
          return {
            x, y,
            hit:        !!result.hit,
            defenseHit: !!result.defenseHit,
            miss:       !result.hit && !result.defenseHit && !result.alreadyHit,
            shipId:     result.shipId,
            defenseId:  result.defenseId,
            sunk,
          };
        });
        this.grids[enemyId] = defenderGrid;

        this.emitTo('all', 'attackResult', {
          attackerId: fromId,
          defenderId: enemyId,
          x: baseX, y: baseY, weapon,
          hits,
          weaponCounts: this.weaponCounts,
        });

        // ── Authoritative gameOver check using defender's actual grid ──
        if (defenderGrid && allShipsSunk(defenderGrid)) {
          this.status = 'ended';
          this.emitTo('all', 'gameOver', {
            winnerId:   fromId,
            winnerName: this.players[fromId] ? this.players[fromId].name : 'Player',
          });
          if (ack) ack({ ok: true });
          break;
        }

        this.turn = enemyId;
        this.emitTo('all', 'turnChange', { turn: this.turn });
        if (ack) ack({ ok: true });
        break;
      }

      case 'useRadar': {
        // Server scans defender's actual grid for ships of matching sizes
        const enemyId = this.order.find(id => id !== fromId);
        const defenderGrid = this.grids[enemyId];
        if (!defenderGrid) { if (ack) ack({ error: 'Opponent grid missing' }); break; }
        const sizes = payload?.skillId === 'a-radar' ? [3, 4, 5] : [2];
        const candidates = {};
        for (let r = 0; r < defenderGrid.length; r++) {
          for (let c = 0; c < defenderGrid.length; c++) {
            const cell = defenderGrid[r]?.[c];
            if (cell?.shipId != null && !cell.hit) {
              const ship = SHIPS.find(s => s.id === cell.shipId);
              if (ship && sizes.includes(ship.size)) {
                (candidates[cell.shipId] = candidates[cell.shipId] || []).push({ r, c });
              }
            }
          }
        }
        const shipIds = Object.keys(candidates);
        let reveal = [];
        if (shipIds.length > 0) {
          const pick = shipIds[Math.floor(Math.random() * shipIds.length)];
          const cellsOfShip = candidates[pick];
          const revealCount = payload?.skillId === 'a-radar'
            ? Math.min(2, cellsOfShip.length)
            : cellsOfShip.length;
          const shuffled = [...cellsOfShip].sort(() => Math.random() - 0.5);
          reveal = shuffled.slice(0, revealCount);
        }
        if (ack) ack({ ok: true, cells: reveal });
        break;
      }

      case 'useInterference': {
        // Arm interference: opponent's next fire is blocked
        const enemyId = this.order.find(id => id !== fromId);
        if (!enemyId) { if (ack) ack({ error: 'Opponent not in room' }); break; }
        this.blockNextTurn = this.blockNextTurn || {};
        this.blockNextTurn[enemyId] = true;
        if (ack) ack({ ok: true });
        break;
      }

      case 'passTurn': {
        // Time-out skip — hand turn to opponent without firing
        if (this.status !== 'playing') { if (ack) ack({ error: 'Not in game' }); break; }
        if (this.turn !== fromId)      { if (ack) ack({ error: 'Not your turn' }); break; }
        const enemyId = this.order.find(id => id !== fromId);
        this.turn = enemyId;
        this.emitTo('all', 'turnChange', { turn: this.turn });
        if (ack) ack({ ok: true });
        break;
      }

      case 'reportGameOver': {
        this.status = 'ended';
        const winnerId = payload && payload.winnerId;
        this.emitTo('all', 'gameOver', {
          winnerId,
          winnerName: this.players[winnerId] ? this.players[winnerId].name : 'Unknown',
        });
        break;
      }

      case 'chatMsg': {
        this.emitTo('all', 'chatMsg', {
          from: this.players[fromId] ? this.players[fromId].name : '?',
          text: String((payload && payload.text) || '').slice(0, 200),
          ts: Date.now(),
        });
        break;
      }

      case 'leaveRoom': {
        const name = this.players[fromId] ? this.players[fromId].name : '?';
        this.removePlayer(fromId);
        if (this.status === 'playing' || this.status === 'placement') {
          this.status = 'waiting';
          this.grids = {};
          this.order.forEach(id => { this.players[id].ready = false; });
        }
        this.emitTo('all', 'playerLeft', { name, room: this.summary() });
        break;
      }

      default:
        break;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   HOST SESSION
   ═══════════════════════════════════════════════════════════════ */
export async function createHostSession({ name, difficulty, roomName }) {
  const host = new GameHost((event, payload) => {
    Net.sendMessage({ data: JSON.stringify({ event, payload }) })
      .catch(e => console.warn('[lan] host send failed', e));
  });
  host.difficulty = difficulty || 'easy';
  host.roomName = roomName || `${name || 'Commander'}'s Room`;

  // Host self-socket — emits feed straight into the engine (synchronous ack).
  const socket = {
    id: 'host',
    on:  (ev, fn) => host.local.on(ev, fn),
    off: (ev, fn) => host.local.off(ev, fn),
    emit: (event, payload, cb) => host.handle('host', event, payload, cb),
  };

  const subs = [];
  subs.push(await Net.addListener('clientDisconnected', () => {
    host.handle('guest', 'leaveRoom', {});
  }));
  subs.push(await Net.addListener('messageReceived', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.event === '__ack') return; // host issues acks, never receives them
    const ack = msg.reqId
      ? (ackData) => Net.sendMessage({ data: JSON.stringify({ event: '__ack', reqId: msg.reqId, ack: ackData }) })
      : undefined;
    host.handle('guest', msg.event, msg.payload, ack);
  }));

  // Register the host player locally.
  host.handle('host', 'register', { name }, null);

  const started = await Net.startServer({
    port: 0,
    serviceName: host.roomName,
    difficulty: host.difficulty,
    hostName: name || 'Commander',
  });

  const session = {
    socket,
    role: 'host',
    ip: started.ip,
    port: started.port,
    roomName: host.roomName,
    room: host.summary(),
    async close() {
      subs.forEach(s => s.remove());
      try { await Net.stopServer(); } catch (e) { /* noop */ }
    },
  };
  activeSession = session;
  return session;
}

/* ═══════════════════════════════════════════════════════════════
   GUEST SESSION
   ═══════════════════════════════════════════════════════════════ */
export async function createGuestSession({ host, port, name }) {
  const em = makeEmitter();
  const pending = new Map();
  let reqCounter = 0;

  const socket = {
    id: 'guest',
    on:  (ev, fn) => em.on(ev, fn),
    off: (ev, fn) => em.off(ev, fn),
    emit: (event, payload, cb) => {
      if (cb) {
        const reqId = 'r' + (++reqCounter);
        pending.set(reqId, cb);
        Net.sendMessage({ data: JSON.stringify({ event, payload, reqId }) })
          .catch(e => console.warn('[lan] guest send failed', e));
      } else {
        Net.sendMessage({ data: JSON.stringify({ event, payload }) })
          .catch(e => console.warn('[lan] guest send failed', e));
      }
    },
  };

  const subs = [];
  subs.push(await Net.addListener('messageReceived', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.event === '__ack') {
      const cb = pending.get(msg.reqId);
      if (cb) { pending.delete(msg.reqId); cb(msg.ack); }
      return;
    }
    em.emit(msg.event, msg.payload);
  }));
  subs.push(await Net.addListener('disconnected', () => em.emit('disconnect')));

  await Net.connectToHost({ host, port });

  // Register and wait for the host's acknowledgement (with a fallback timeout).
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; em.off('registered', finish); resolve(); } };
    em.on('registered', finish);
    socket.emit('register', { name });
    setTimeout(finish, 4000);
  });

  const session = {
    socket,
    role: 'guest',
    async close() {
      subs.forEach(s => s.remove());
      try { await Net.closeConnection(); } catch (e) { /* noop */ }
    },
  };
  activeSession = session;
  return session;
}

/* ═══════════════════════════════════════════════════════════════
   DISCOVERY (guest scans for hosts via NSD)
   ═══════════════════════════════════════════════════════════════ */
export async function startScan(onFound, onLost) {
  const subs = [];
  subs.push(await Net.addListener('serviceFound', (svc) => onFound && onFound(svc)));
  subs.push(await Net.addListener('serviceLost', (svc) => onLost && onLost(svc)));
  await Net.startDiscovery({});
  return {
    async stop() {
      subs.forEach(s => s.remove());
      try { await Net.stopDiscovery(); } catch (e) { /* noop */ }
    },
  };
}

export async function getDeviceIp() {
  try {
    const { ip } = await Net.getIpAddress();
    return ip;
  } catch {
    return '0.0.0.0';
  }
}
