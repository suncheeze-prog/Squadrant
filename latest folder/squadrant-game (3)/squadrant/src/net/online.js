/* ═══════════════════════════════════════════════════════════════
   SQUADRANT — ONLINE TRANSPORT (Firestore)
   ───────────────────────────────────────────────────────────────
   Same protocol as lan.js (register / setReady / submitGrid /
   fireAttack / playerLeft / etc.) but uses Firestore docs instead
   of TCP sockets.

   Data model:
     rooms/{roomId} = {
       code, status, difficulty, createdAt,
       players: { [uid]: { name, ready, joinedAt } },
       order: [uid, uid],
       turn, winnerId,
       weaponCounts: { [uid]: { rocket, bomb, nuke } },
       grids:        { [uid]: cells2D },
       lastAttack:   { seq, attackerId, defenderId, x, y, weapon, hits[] },
       leftBy:       uid | null,
     }

   Authoritative writes use a transaction so concurrent fires
   can't corrupt turn order.
   ═══════════════════════════════════════════════════════════════ */
import { db, auth, getCurrentUser } from '../firebase.config';
import {
  doc, collection, query, where, getDocs,
  addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, runTransaction, deleteField,
} from 'firebase/firestore';
import { checkHit, applyHit, allShipsSunk, checkShipSunk, getSkillShotTargets, SHIPS } from '../utils/gameLogic';
import { detectPlatform } from '../utils/platform';

// ── Helpers ─────────────────────────────────────────────────────
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(len = 5) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

/** Firestore disallows nested arrays. Grids are Array<Array<cell>> so we serialize. */
function packGrid(grid)   { return grid == null ? null : JSON.stringify(grid); }
function unpackGrid(data) {
  if (data == null) return null;
  if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { return null; } }
  return data;
}

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

// ── Active session bookkeeping ──────────────────────────────────
let activeSession = null;

export async function closeOnline() {
  if (!activeSession) return;
  try { activeSession.cleanup(); } catch (e) {}
  activeSession = null;
}

// ── Socket-shaped wrapper around a room doc subscription ───────
function makeSocketShim({ uid, roomId, roomRef }) {
  const listeners = {};   // event → handler
  const lastEmits = {};   // event → last payload (for replay to late-registering handlers)
  // Events that represent CURRENT STATE — safe to replay
  const REPLAYABLE = new Set(['roomUpdate', 'gameStart', 'startPlacement', 'gameOver']);
  let lastSeenAttackSeq = 0;
  let lastSeenStatus    = null;
  let lastPlayersKey    = null;
  let prevLeftBy        = null;
  let lastChatCount     = 0;

  const emit = (event) => (payload) => {
    if (REPLAYABLE.has(event)) lastEmits[event] = payload;
    const handler = listeners[event];
    if (handler) try { handler(payload); } catch (e) { console.error('listener error', event, e); }
  };

  const unsub = onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) {
      emit('playerLeft')({ name: 'Opponent', reason: 'room-deleted' });
      return;
    }
    const data = snap.data();

    // ── Room update event ──
    const playersKey = JSON.stringify(Object.keys(data.players || {}).sort()
      .map(uid => ({ uid, ready: data.players[uid].ready, name: data.players[uid].name, platform: data.players[uid].platform })));
    if (playersKey !== lastPlayersKey) {
      lastPlayersKey = playersKey;
      emit('roomUpdate')({
        roomId,
        difficulty: data.difficulty,
        players: Object.values(data.players || {}).map(p => ({
          name: p.name,
          ready: !!p.ready,
          platform: p.platform || 'pc',
        })),
        ready: data.players?.[uid]?.ready || false,
        full: Object.keys(data.players || {}).length >= 2,
      });
    }

    // ── Placement start ──
    if (data.status === 'placement' && lastSeenStatus !== 'placement') {
      lastSeenStatus = 'placement';
      emit('startPlacement')({ difficulty: data.difficulty });
    }

    // ── Game start ──
    if (data.status === 'playing' && lastSeenStatus !== 'playing') {
      lastSeenStatus = 'playing';
      emit('gameStart')({
        myGrid: unpackGrid(data.grids?.[uid]),
        yourTurn: data.turn === uid,
        difficulty: data.difficulty,
      });
    }

    // ── Attack result ──
    if (data.lastAttack && data.lastAttack.seq > lastSeenAttackSeq) {
      lastSeenAttackSeq = data.lastAttack.seq;
      if (!data.lastAttack.skipped) {
        emit('attackResult')({
          attackerId: data.lastAttack.attackerId,
          defenderId: data.lastAttack.defenderId,
          x: data.lastAttack.x,
          y: data.lastAttack.y,
          weapon: data.lastAttack.weapon,
          hits: data.lastAttack.hits || [],
          weaponCounts: data.weaponCounts,
        });
      }
      // Turn change event always fires (after attack or skip)
      emit('turnChange')({ turn: data.turn });
    }

    // ── Game over ──
    if (data.status === 'ended' && data.winnerId && lastSeenStatus !== 'ended') {
      lastSeenStatus = 'ended';
      emit('gameOver')({
        winnerId: data.winnerId,
        winnerName: data.players?.[data.winnerId]?.name || 'Player',
      });
    }

    // ── Player left detection ──
    if (data.leftBy && data.leftBy !== prevLeftBy && data.leftBy !== uid) {
      prevLeftBy = data.leftBy;
      emit('playerLeft')({ name: data.players?.[data.leftBy]?.name || 'Opponent' });
    }

    // ── Chat real-time delivery ──
    const chatArr = Array.isArray(data.chat) ? data.chat : [];
    if (chatArr.length > lastChatCount) {
      // Emit each new message individually
      for (let i = lastChatCount; i < chatArr.length; i++) {
        emit('chatMsg')(chatArr[i]);
      }
      lastChatCount = chatArr.length;
    }
  });

  /** Emit handler — routes "events" to Firestore ops */
  async function emitAction(event, payload, ack) {
    try {
      switch (event) {

        case 'register': {
          // Already registered when room joined / created
          if (ack) ack({ id: uid });
          break;
        }

        case 'setReady': {
          await updateDoc(roomRef, {
            [`players.${uid}.ready`]: !!(payload && payload.ready),
          });
          // After updating, check if both ready → start placement
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) return;
            const d = snap.data();
            const playerUids = Object.keys(d.players || {});
            if (playerUids.length === 2 &&
                playerUids.every(u => d.players[u].ready) &&
                d.status === 'waiting') {
              tx.update(roomRef, {
                status: 'placement',
                order: playerUids,
                grids: {},
                weaponCounts: {},
              });
            }
          });
          if (ack) ack({ ok: true });
          break;
        }

        case 'submitGrid': {
          // Store this player's grid (serialized to bypass Firestore nested-array limit)
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) throw new Error('Room gone');
            const d = snap.data();
            const grids = { ...(d.grids || {}) };
            grids[uid] = packGrid(payload.grid);
            const both = Object.keys(grids).length === 2 && (d.order || []).every(u => grids[u]);

            const update = { grids };
            if (both) {
              update.status = 'playing';
              update.turn = d.order[0];
              update.weaponCounts = {};
              d.order.forEach(u => { update.weaponCounts[u] = { rocket: 999, bomb: 3, nuke: 1 }; });
            }
            tx.update(roomRef, update);
          });
          if (ack) ack({ ok: true });
          break;
        }

        case 'fireAttack': {
          // Authoritative: read room, validate turn, compute hits using defender grid,
          // apply hits, write back atomically.
          let blockedMsg = null;  // signals interference block (so transaction can COMMIT)
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists())          throw new Error('Room not found');
            const d = snap.data();
            if (d.status !== 'playing') throw new Error(`Game not started (status=${d.status})`);
            if (d.turn !== uid)          throw new Error('Not your turn');

            // Interference check: if opponent armed Interference, this turn is blocked.
            // CRITICAL: must NOT throw here — throwing aborts the transaction and the
            // flag-clearing update is rolled back, causing the block to persist forever.
            if (d.blockNextTurn?.[uid]) {
              const enemyId0 = (d.order || []).find(u => u !== uid);
              const blockedNext = { ...(d.blockNextTurn || {}) };
              delete blockedNext[uid];
              tx.update(roomRef, {
                turn: enemyId0,
                blockNextTurn: blockedNext,
                lastAttack: {
                  seq: (d.lastAttack?.seq || 0) + 1,
                  attackerId: uid,
                  defenderId: enemyId0,
                  x: 0, y: 0, weapon: 'rocket',
                  hits: [],
                  skipped: true,
                  blocked: true,
                },
              });
              blockedMsg = 'Your turn was blocked by Interference!';
              return;   // exit callback — transaction COMMITS, clearing the flag
            }

            const weapon = payload.weapon;
            const wc = d.weaponCounts?.[uid] || { rocket: 999, bomb: 3, nuke: 1 };
            const usingSkill = !!payload.pendingShot;
            if (!usingSkill && (wc[weapon] == null || wc[weapon] <= 0)) {
              throw new Error(`No ${weapon} ammo`);
            }

            const enemyId = (d.order || []).find(u => u !== uid);
            if (!enemyId) throw new Error('Opponent not in room');
            if (!(d.grids || {})[enemyId]) throw new Error('Opponent grid missing — they may have left');

            // Expand target pattern — skill shot takes priority over weapon
            const pendingShot = payload.pendingShot;
            const targets = pendingShot
              ? getSkillShotTargets(pendingShot, payload.x, payload.y)
              : expandTargets(weapon, payload.x, payload.y);
            let defenderGrid = unpackGrid((d.grids || {})[enemyId]);
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
              // IMPORTANT: Firestore disallows undefined values — coerce to null.
              return {
                x, y,
                hit:        !!result.hit,
                defenseHit: !!result.defenseHit,
                miss:       !result.hit && !result.defenseHit && !result.alreadyHit,
                shipId:     result.shipId    ?? null,
                defenseId:  result.defenseId ?? null,
                sunk,
              };
            });

            // Authoritative win check
            const won = defenderGrid && allShipsSunk(defenderGrid);

            const newWeaponCounts = { ...d.weaponCounts };
            if (!usingSkill) {
              newWeaponCounts[uid] = { ...newWeaponCounts[uid], [weapon]: wc[weapon] - 1 };
            }

            const newGrids = { ...d.grids, [enemyId]: packGrid(defenderGrid) };

            const seq = (d.lastAttack?.seq || 0) + 1;

            const update = {
              weaponCounts: newWeaponCounts,
              grids: newGrids,
              turn: won ? d.turn : enemyId,
              lastAttack: {
                seq,
                attackerId: uid,
                defenderId: enemyId,
                x: payload.x, y: payload.y,
                weapon, hits,
              },
            };
            if (won) {
              update.status   = 'ended';
              update.winnerId = uid;
            }
            tx.update(roomRef, update);
          });
          // Send block error AFTER the transaction commits (so the flag is cleared)
          if (blockedMsg) { if (ack) ack({ error: blockedMsg }); break; }
          if (ack) ack({ ok: true });
          break;
        }

        case 'useRadar': {
          // Server scans defender's actual grid for ships of matching sizes
          // and returns the cells to reveal. Client adds them to revealedCells.
          const snap = await getDoc(roomRef);
          if (!snap.exists()) throw new Error('Room not found');
          const d = snap.data();
          const enemyId = (d.order || []).find(u => u !== uid);
          if (!enemyId) throw new Error('Opponent not in room');
          const defenderGrid = unpackGrid((d.grids || {})[enemyId]);
          if (!defenderGrid) throw new Error('Opponent grid missing');

          const sizes = payload?.skillId === 'a-radar' ? [3, 4, 5] : [2];
          // Group unrevealed unhit ship cells by shipId
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
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) throw new Error('Room not found');
            const d = snap.data();
            const enemyId = (d.order || []).find(u => u !== uid);
            if (!enemyId) throw new Error('Opponent not in room');
            const blockNext = { ...(d.blockNextTurn || {}) };
            blockNext[enemyId] = true;
            tx.update(roomRef, { blockNextTurn: blockNext });
          });
          if (ack) ack({ ok: true });
          break;
        }

        case 'passTurn': {
          // Time-out skip — just hand the turn to the opponent
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) return;
            const d = snap.data();
            if (d.status !== 'playing') return;
            if (d.turn !== uid) return;
            const enemyId = (d.order || []).find(u => u !== uid);
            if (!enemyId) return;
            tx.update(roomRef, {
              turn: enemyId,
              lastAttack: {
                seq: (d.lastAttack?.seq || 0) + 1,
                attackerId: uid,
                defenderId: enemyId,
                x: 0, y: 0, weapon: 'rocket',
                hits: [],            // empty hits = skipped turn
                skipped: true,
              },
            });
          });
          if (ack) ack({ ok: true });
          break;
        }

        case 'leaveRoom': {
          // Mark this player as having left; opponent's snapshot listener picks it up
          try {
            await updateDoc(roomRef, {
              leftBy: uid,
              status: 'ended',
            });
          } catch (e) {}
          if (ack) ack({ ok: true });
          break;
        }

        case 'reportGameOver': {
          // The host-authoritative win check already handles this. No-op for online.
          if (ack) ack({ ok: true });
          break;
        }

        case 'chatMsg': {
          // Light-weight chat: append to recent[] capped at 50
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) return;
            const d = snap.data();
            const recent = (d.chat || []).slice(-49);
            recent.push({
              from: d.players?.[uid]?.name || '?',
              text: String((payload && payload.text) || '').slice(0, 200),
              ts: Date.now(),
            });
            tx.update(roomRef, { chat: recent });
          });
          if (ack) ack({ ok: true });
          break;
        }

        default:
          if (ack) ack({ error: `unknown event: ${event}` });
      }
    } catch (err) {
      console.error('[online emit]', event, err);
      if (ack) ack({ error: err.message || String(err) });
    }
  }

  return {
    id: uid,
    emit: (event, payload, ack) => emitAction(event, payload, ack),
    on:  (event, handler) => {
      listeners[event] = handler;
      // Replay last cached "state" event (deferred to microtask so React doesn't get
      // a set-state-during-render warning if the consumer triggers state changes)
      if (REPLAYABLE.has(event) && lastEmits[event] !== undefined) {
        const cached = lastEmits[event];
        Promise.resolve().then(() => {
          if (listeners[event] === handler) {
            try { handler(cached); } catch (e) { console.error('replay error', event, e); }
          }
        });
      }
    },
    off: (event) => { delete listeners[event]; },
    cleanup: () => { try { unsub(); } catch (e) {} Object.keys(listeners).forEach(k => delete listeners[k]); },
  };
}

// ── PUBLIC API ──────────────────────────────────────────────────

/** Create a new online room. Returns { socket, roomId, code } */
export async function createOnlineRoom({ name, difficulty }) {
  await closeOnline();
  const u = await getCurrentUser();
  if (!u) throw new Error('You must be logged in to play online');
  const uid = u.uid;
  const code = generateRoomCode(5);
  const roomRef = await addDoc(collection(db, 'rooms'), {
    code,
    status: 'waiting',
    difficulty: difficulty || 'easy',
    createdAt: serverTimestamp(),
    hostId: uid,
    players: {
      [uid]: { name: name || 'Host', ready: false, joinedAt: Date.now(), platform: detectPlatform() },
    },
    order: [uid],
    turn: null,
    winnerId: null,
    weaponCounts: {},
    grids: {},
    lastAttack: null,
    leftBy: null,
    chat: [],
  });
  const socket = makeSocketShim({ uid, roomId: roomRef.id, roomRef });
  activeSession = { socket, roomRef };
  return { socket, roomId: roomRef.id, code };
}

/** Join an existing room by code. Returns { socket, roomId, code } */
export async function joinOnlineRoom({ name, code }) {
  await closeOnline();
  const u = await getCurrentUser();
  if (!u) throw new Error('You must be logged in to play online');
  const uid = u.uid;
  if (!code || code.length < 4) throw new Error('Invalid room code');
  const upper = code.toUpperCase().trim();
  const q = query(
    collection(db, 'rooms'),
    where('code', '==', upper),
    where('status', 'in', ['waiting', 'placement']),
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Room not found or already started');
  const roomDoc = snap.docs[0];
  const data = roomDoc.data();
  const playerUids = Object.keys(data.players || {});
  if (playerUids.length >= 2 && !playerUids.includes(uid)) {
    throw new Error('Room is full');
  }
  await updateDoc(roomDoc.ref, {
    [`players.${uid}`]: { name: name || 'Guest', ready: false, joinedAt: Date.now(), platform: detectPlatform() },
    order: playerUids.includes(uid) ? data.order : [...(data.order || []), uid],
  });
  const socket = makeSocketShim({ uid, roomId: roomDoc.id, roomRef: roomDoc.ref });
  activeSession = { socket, roomRef: roomDoc.ref };
  return { socket, roomId: roomDoc.id, code: data.code };
}

/** Quick match — join any open room with the same difficulty, or create one */
export async function quickMatch({ name, difficulty }) {
  await closeOnline();
  const u = await getCurrentUser();
  if (!u) throw new Error('You must be logged in to play online');
  const uid = u.uid;
  const q = query(
    collection(db, 'rooms'),
    where('status', '==', 'waiting'),
    where('difficulty', '==', difficulty || 'easy'),
  );
  const snap = await getDocs(q);
  // Find a room with exactly 1 player
  const openRoom = snap.docs.find(d => {
    const ds = d.data();
    const uids = Object.keys(ds.players || {});
    return uids.length === 1 && !uids.includes(uid);
  });
  if (openRoom) {
    return joinOnlineRoom({ name, code: openRoom.data().code });
  }
  return createOnlineRoom({ name, difficulty });
}
