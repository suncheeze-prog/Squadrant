import React, { useState, useCallback, useEffect, useRef } from 'react';
import CoordGrid from '../components/CoordGrid';
import AttackFx from '../components/AttackFx';
import GameIcon, { shipIcon } from '../components/GameIcon';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import { incrementStat } from '../utils/userProfile';
import { getLevel, completeLevel } from '../utils/levels';
import {
  SHIPS, WEAPONS, SKILLS, getSkillShotTargets,
  isValidCoord, coordToGrid,
  checkHit, applyHit, checkShipSunk, allShipsSunk, aiMove, gridToCoord, gcFromGrid
} from '../utils/gameLogic';

const WPN_COLOR = { rocket: '#5aad5e', bomb: '#e8a000', nuke: '#e05050' };

export default function GameScreen({ user, config, p1Grid, p2Grid, onBack }) {
  const { play, startBg, stopBg, turnTime: turnTimeSetting } = useApp();
  const { isPortrait } = useOrientation();

  const { difficulty, subMode } = config;
  const isAdvanced   = difficulty === 'advanced';
  const isVsComputer = config.mode === 'vs-computer' || subMode === 'vs-computer';
  const isLan        = config.mode === 'lan';
  const level        = getLevel(difficulty);

  const [playerGrid, setPGrid]  = useState(p1Grid);
  const [enemyGrid,  setEGrid]  = useState(p2Grid);
  const [inputX, setInputX]     = useState('');
  const [inputY, setInputY]     = useState('');
  const [lineM, setLineM]       = useState('');
  const [lineB, setLineB]       = useState('');
  const [lineX, setLineX]       = useState('');
  const [log, setLog]           = useState([]);
  const [turn, setTurn]         = useState(() => {
    if (isLan) return config.yourTurn ? 1 : 2;
    return 1;
  });
  const [selWpn, setSelWpn]     = useState(WEAPONS[0]);
  const [wpnCnt, setWpnCnt]     = useState({ rocket:999, bomb:3, nuke:1 });
  const [highlight, setHL]      = useState(null);
  const [phase, setPhase]       = useState('playing');
  const [winner, setWinner]     = useState(null);
  const [aiThink, setAiThink]   = useState(false);
  const [activeTab, setTab]     = useState('attack');

  // Shared targeting / lock / result overlay + campaign unlock notice
  const [attackFx, setAttackFx] = useState(null);
  const [unlockedNext, setUnlockedNext] = useState(null);

  // Point system: 10 per hit, +20 every 3-streak, +30 sink
  const [playerScore, setPScore]   = useState(0);
  const [enemyScore,  setEScore]   = useState(0);
  const [playerStreak, setPStreak] = useState(0);
  const [enemyStreak,  setEStreak] = useState(0);
  const [scorePopup,  setScorePopup] = useState(null); // { amount, type, key }

  // Special skills
  const [pendingShot, setPendingShot] = useState(null);    // active rocket skill id, fires next
  const [revealedCells, setRevealedCells] = useState(new Set()); // "row-col" strings
  const [skipEnemyTurn, setSkipEnemyTurn] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

  // Real-time enemy fire alert (defender's view)
  const [enemyShot, setEnemyShot] = useState(null);  // { x, y, hit, defenseHit, sunk, key }

  // Authoritative sunk-ship tracking (not derived from grid — works in fog-of-war modes)
  const [sunkEnemyIds, setSunkEnemyIds] = useState(new Set());  // enemy ships YOU sunk
  const [sunkOwnIds,   setSunkOwnIds]   = useState(new Set());  // your ships enemy sunk

  // Exit/disconnect confirmation modals
  const [confirmExit,  setConfirmExit]  = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);  // LAN only

  // Turn timer — configurable from Settings (default 30s, 0 = no limit)
  const TURN_LIMIT = turnTimeSetting > 0 ? turnTimeSetting : 0;
  const [turnTimer, setTurnTimer] = useState(TURN_LIMIT || 0);

  // Derived flags — MUST be declared before any useCallback that references them
  const isMyTurn  = turn === 1 && phase === 'playing' && !aiThink && !attackFx;
  const isVictory = winner === 'YOU' || winner === 'SQUAD 1';

  // Record win/loss to Firestore once when game ends (any mode)
  useEffect(() => {
    if (phase !== 'gameover' || !user?.uid) return;
    incrementStat(user.uid, isVictory ? 'wins' : 'losses').catch(() => {});
  }, [phase, isVictory, user?.uid]);

  // Campaign progression: only VS Computer victories unlock the next theater.
  useEffect(() => {
    if (phase !== 'gameover' || !isVictory || !isVsComputer) return;
    setUnlockedNext(completeLevel(difficulty));
  }, [phase, isVictory, isVsComputer, difficulty]);

  const enemyWrap = useRef(null);
  const miniWrap  = useRef(null);
  const fxTimers  = useRef([]);
  const aiAfterResultRef = useRef(false);
  const [enemyPx, setEnemyPx]  = useState(260);
  const [miniPx,  setMiniPx]   = useState(100);
  const logRef = useRef(null);

  // Clear any pending FX timers when the battle screen unmounts
  useEffect(() => () => {
    fxTimers.current.forEach(clearTimeout);
    fxTimers.current = [];
  }, []);

  // Responsive grid sizing — re-runs when orientation changes
  useEffect(() => {
    const measureEnemy = () => {
      if (!enemyWrap.current) return;
      const { width, height } = enemyWrap.current.getBoundingClientRect();
      setEnemyPx(Math.floor(Math.min(width, height) * 0.96));
    };
    const measureMini = () => {
      if (!miniWrap.current) return;
      const { width, height } = miniWrap.current.getBoundingClientRect();
      setMiniPx(Math.floor(Math.min(width, height) * 0.95));
    };
    measureEnemy(); measureMini();
    const ro = new ResizeObserver(() => { measureEnemy(); measureMini(); });
    if (enemyWrap.current) ro.observe(enemyWrap.current);
    if (miniWrap.current)  ro.observe(miniWrap.current);
    return () => ro.disconnect();
  }, [isPortrait]);

  useEffect(() => { startBg(); return () => stopBg(); }, []); // eslint-disable-line
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [...prev.slice(-60), { msg, type, id: Date.now() + Math.random() }]);

  const getWeaponTargets = (weaponId, x, y) => {
    if (weaponId === 'bomb')
      return [{ x,y },{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    if (weaponId === 'nuke') {
      const t = [{ x, y }];
      for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) if (dx||dy) t.push({x:x+dx,y:y+dy});
      return t;
    }
    return [{ x, y }];
  };

  const checkWin = useCallback((grid, who) => {
    if (allShipsSunk(grid)) {
      const name = who === 'player'
        ? 'SQUAD 1'
        : (isVsComputer ? 'COMPUTER' : isLan ? 'ENEMY' : 'SQUAD 2');
      setWinner(name); setPhase('gameover');
      who === 'player' ? play('victory') : play('defeat');
      return true;
    }
    return false;
  }, [isVsComputer, isLan, play]);

  const doAttack = useCallback((x, y, tGrid, setG, attacker, opts = {}) => {
    const silent = !!opts.silent;
    if (!isValidCoord(x, y, gcFromGrid(tGrid))) { addLog(`⚠ (${x},${y}) out of range`, 'warn'); return false; }
    const { col, row } = coordToGrid(x, y, gcFromGrid(tGrid));
    const cell = tGrid[row][col];
    if (cell?.miss || cell?.hit) { addLog(`⚠ (${x},${y}) already targeted`, 'warn'); return false; }
    const result  = checkHit(tGrid, x, y);
    const newGrid = applyHit(tGrid, x, y);
    if (setG) setG(newGrid);
    if (result.defenseHit) {
      if (!silent) play('blocked');
      addLog(`🛡 ${attacker} BLOCKED by defense at (${x},${y})!`, 'warn');
      return { hit: false, defenseHit: true, grid: newGrid, points: 0, sunk: false };
    }
    if (result.hit) {
      const ship = SHIPS.find(s => s.id === result.shipId);
      const sunk = checkShipSunk(newGrid, result.shipId);
      const points = 10 + (sunk ? 30 : 0); // 10 base, +30 if sunk
      if (sunk) { if (!silent) play('sunk'); addLog(`🔥 ${attacker} SUNK the ${ship.name}! +${points}pts`, 'hit'); }
      else       { if (!silent) play('hit');  addLog(`💥 ${attacker} HIT at (${x},${y})! +10pts`, 'hit'); }
      return { hit: true, grid: newGrid, points, sunk, shipId: result.shipId };
    } else {
      if (!silent) play('miss'); addLog(`💨 ${attacker} MISSED at (${x},${y})`, 'miss');
      return { hit: false, grid: newGrid, points: 0, sunk: false };
    }
  }, [play]);

  // Award points to player or enemy after a multi-target attack
  const awardPoints = useCallback((isPlayer, targetResults) => {
    let totalPts = 0;
    let hits = 0;
    let sinks = 0;
    const sunkIdsThisRound = [];
    targetResults.forEach(r => {
      if (!r) return;
      totalPts += r.points || 0;
      if (r.hit) hits++;
      if (r.sunk) sinks++;
      if (r.sunk && r.shipId != null) sunkIdsThisRound.push(r.shipId);
    });

    // Track authoritative sunk ship IDs
    if (sunkIdsThisRound.length > 0) {
      const setSunk = isPlayer ? setSunkEnemyIds : setSunkOwnIds;
      setSunk(prev => {
        const next = new Set(prev);
        sunkIdsThisRound.forEach(id => next.add(id));
        return next;
      });
    }

    const setScore  = isPlayer ? setPScore  : setEScore;
    const setStreak = isPlayer ? setPStreak : setEStreak;
    const curStreak = isPlayer ? playerStreak : enemyStreak;

    let bonusType = null;

    if (hits > 0) {
      const newStreak = curStreak + hits;
      const streakBonuses = Math.floor(newStreak / 3) - Math.floor(curStreak / 3);
      if (streakBonuses > 0) {
        totalPts += streakBonuses * 20;
        bonusType = 'STREAK!';
      }
      setStreak(newStreak);
    } else {
      setStreak(0);
    }
    if (sinks > 0) bonusType = 'SHIP SUNK!';

    if (totalPts > 0) {
      setScore(s => s + totalPts);
      if (isPlayer) {
        setScorePopup({ amount: totalPts, type: bonusType || 'HIT', key: Date.now() + Math.random() });
      }
    }
  }, [playerStreak, enemyStreak]);

  // Auto-hide score popup after 1.6s
  useEffect(() => {
    if (!scorePopup) return;
    const t = setTimeout(() => setScorePopup(null), 1600);
    return () => clearTimeout(t);
  }, [scorePopup]);

  // Auto-hide enemy-shot alert after 2.5s
  useEffect(() => {
    if (!enemyShot) return;
    const t = setTimeout(() => setEnemyShot(null), 2500);
    return () => clearTimeout(t);
  }, [enemyShot]);

  // ── Attack FX sequence: TARGETING → TARGET LOCK → result ──
  const scheduleFx = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    fxTimers.current.push(id);
    return id;
  }, []);

  const clearFxTimers = useCallback(() => {
    fxTimers.current.forEach(clearTimeout);
    fxTimers.current = [];
  }, []);

  const runAttackSequence = useCallback(({ side, weapon, target, resolve, resultMs = 900, onDone }) => {
    clearFxTimers();
    const key = Date.now() + Math.random();
    const launchSfx = weapon === 'bomb' ? 'launchBomb' : weapon === 'nuke' ? 'launchNuke' : 'launchRocket';
    play('targeting');
    play(launchSfx);
    setAttackFx({ stage: 'targeting', side, weapon, target, key });

    scheduleFx(() => {
      play('lock');
      setAttackFx(f => (f?.key === key ? { ...f, stage: 'lock' } : f));
    }, 520);

    scheduleFx(() => {
      const outcome = resolve();
      if (!outcome || outcome.gameOver) { setAttackFx(null); return; }
      setAttackFx({ stage: 'result', side, weapon, target, outcome, key });
      scheduleFx(() => {
        setAttackFx(f => (f?.key === key ? null : f));
        if (onDone) onDone();
      }, resultMs);
    }, 980);
  }, [play, scheduleFx, clearFxTimers]);

  // ── AI turn: pick a target, run the FX sequence, then resolve ──
  const startAiTurn = useCallback(() => {
    if (phase !== 'playing') return;
    const move = aiMove(playerGrid, difficulty);
    if (!move) return;
    const coord = gridToCoord(move.c, move.r, gcFromGrid(playerGrid));

    setTurn(2);
    setAiThink(true);

    runAttackSequence({
      side: 'enemy',
      weapon: 'rocket',
      target: coord,
      resolve: () => {
        const r = doAttack(coord.x, coord.y, playerGrid, null, 'COMPUTER');
        let outcome = { type: 'miss' };
        if (r) {
          awardPoints(false, [r]);
          setPGrid(r.grid);
          // Real-time alert: flash where AI fired
          setEnemyShot({
            x: coord.x, y: coord.y,
            hit: !!r.hit, defenseHit: !!r.defenseHit, sunk: !!r.sunk,
            key: Date.now() + Math.random(),
          });
          const won = checkWin(r.grid, 'enemy');
          outcome = {
            type: r.sunk ? 'sunk' : r.hit ? 'hit' : r.defenseHit ? 'blocked' : 'miss',
            gameOver: won,
          };
        }
        setAiThink(false);
        setTurn(1);
        return outcome;
      },
    });
  }, [phase, playerGrid, difficulty, runAttackSequence, doAttack, awardPoints, checkWin]);

  // ── Turn timer: configurable per attack (0 = unlimited) ──
  // Reset when it becomes my turn
  useEffect(() => {
    if (TURN_LIMIT > 0 && turn === 1 && phase === 'playing') setTurnTimer(TURN_LIMIT);
  }, [turn, phase, TURN_LIMIT]);

  // Countdown — only ticks during the player's turn (not during AI thinking / FX)
  useEffect(() => {
    if (TURN_LIMIT <= 0) return;       // unlimited mode — no timer
    if (turn !== 1 || phase !== 'playing' || aiThink || attackFx) return;
    if (turnTimer <= 0) return;
    const interval = setInterval(() => {
      setTurnTimer(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, phase, aiThink, attackFx, turnTimer, TURN_LIMIT]);

  // Handle timeout — auto-skip the player's turn
  useEffect(() => {
    if (TURN_LIMIT <= 0) return;       // unlimited mode — never times out
    if (turnTimer !== 0 || turn !== 1 || phase !== 'playing' || aiThink || attackFx) return;
    addLog('⏰ Time expired — turn skipped!', 'warn');
    play('miss');
    setPStreak(0);
    if (isLan) {
      // Send authoritative pass-turn to host so opponent's UI unblocks
      try { config.socket?.emit('passTurn', {}, () => {}); } catch (e) {}
      setTurn(2);
    } else if (isVsComputer) {
      startAiTurn();
    } else {
      setTurn(2);
    }
  }, [turnTimer, turn, phase, aiThink, attackFx, isLan, isVsComputer, startAiTurn, play, TURN_LIMIT]);

  useEffect(() => {
    if (!isLan || !config.socket) return;
    const sock = config.socket;
    sock.on('attackResult', ({ attackerId, x, y, weapon, hits, weaponCounts }) => {
      const iAmAttacker = attackerId === sock.id;

      // A response arrived — clear any outgoing targeting overlay.
      if (iAmAttacker) {
        clearFxTimers();
        setAttackFx(null);
      }

      const showLanResult = (side) => {
        if (!Array.isArray(hits) || hits.length === 0) return;
        const key = Date.now() + Math.random();
        const outcome = {
          type: hits.some(h => h.sunk) ? 'sunk'
              : hits.some(h => h.hit) ? 'hit'
              : hits.some(h => h.defenseHit) ? 'blocked'
              : 'miss',
          count: hits.filter(h => h.hit).length,
          points: hits.reduce((sum, h) => sum + (h.hit ? 10 + (h.sunk ? 30 : 0) : 0), 0),
        };
        setAttackFx({ stage: 'result', side, weapon, target: { x, y }, outcome, key });
        scheduleFx(() => setAttackFx(f => (f?.key === key ? null : f)), 900);
      };

      if (iAmAttacker && Array.isArray(hits)) {
        // ─── We attacked: update enemy grid from host's authoritative hits[] ───
        setEGrid(cur => {
          let g = cur;
          const results = [];
          hits.forEach(h => {
            const gc = gcFromGrid(g);
            if (!isValidCoord(h.x, h.y, gc)) return;
            const { col, row } = coordToGrid(h.x, h.y, gc);
            const newG = g.map(r => [...r]);
            if (h.hit) {
              newG[row][col] = { shipId: h.shipId, hit: true };
              const sunk = !!h.sunk;
              const points = 10 + (sunk ? 30 : 0);
              // Include shipId so awardPoints can track sunk enemy ship count
              results.push({ hit: true, points, sunk, shipId: h.shipId });
              if (sunk) { play('sunk'); const ship = SHIPS.find(s=>s.id===h.shipId); addLog(`🔥 YOU SUNK the ${ship?.name||'ship'}! +${points}pts`,'hit'); }
              else       { play('hit');  addLog(`💥 YOU HIT at (${h.x},${h.y})! +10pts`,'hit'); }
            } else if (h.defenseHit) {
              newG[row][col] = { defenseId: h.defenseId, hit: true };
              results.push({ hit:false, defenseHit:true, points:0, sunk:false });
              play('blocked'); addLog(`🛡 YOU BLOCKED by defense at (${h.x},${h.y})`, 'warn');
            } else {
              newG[row][col] = { miss: true };
              results.push({ hit:false, points:0, sunk:false });
              play('miss'); addLog(`💨 YOU MISSED at (${h.x},${h.y})`, 'miss');
            }
            g = newG;
          });
          awardPoints(true, results);
          // NOTE: Don't call allShipsSunk on local enemy view — it starts empty so it
          // would return true after any move. The host emits a 'gameOver' event when
          // all defender ships are actually sunk.
          return g;
        });
        showLanResult('player');
      } else if (!iAmAttacker) {
        // ─── Enemy attacked us: use our own grid which has true ship/defense data ───
        setPGrid(pg => {
          const targets = getWeaponTargets(weapon, x, y);
          let cur = pg;
          const results = [];
          const multi = targets.length > 1;
          targets.forEach(({ x: tx, y: ty }) => {
            const r = doAttack(tx, ty, cur, null, 'ENEMY', { silent: multi });
            if (r) { cur = r.grid; results.push(r); }
          });
          // One impact sound for multi-cell weapons instead of overlapping hits
          if (multi) {
            if (results.some(r => r.sunk)) play('sunk');
            else if (results.some(r => r.hit)) play('hit');
            else if (results.some(r => r.defenseHit)) play('blocked');
            else play('miss');
          }
          awardPoints(false, results);
          checkWin(cur, 'enemy');
          // Real-time alert: flash where the enemy fired
          const anyHit  = results.some(r => r?.hit);
          const anyDef  = results.some(r => r?.defenseHit);
          const anySunk = results.some(r => r?.sunk);
          setEnemyShot({ x, y, hit: anyHit, defenseHit: anyDef, sunk: anySunk, key: Date.now() + Math.random() });
          return cur;
        });
        showLanResult('enemy');
      }
      if (weaponCounts && weaponCounts[sock.id]) setWpnCnt(weaponCounts[sock.id]);
    });
    sock.on('turnChange', ({ turn: activeSockId }) => { setTurn(activeSockId === sock.id ? 1 : 2); });
    sock.on('gameOver', ({ winnerId, winnerName }) => {
      const iWon = winnerId === sock.id;
      setWinner(iWon ? 'YOU' : winnerName); setPhase('gameover');
      iWon ? play('victory') : play('defeat');
    });
    sock.on('playerLeft', ({ name }) => {
      // Opponent dropped out mid-game → show disconnect notice
      setOpponentLeft(true);
      play('defeat');
    });
    return () => {
      sock.off('attackResult');
      sock.off('turnChange');
      sock.off('gameOver');
      sock.off('playerLeft');
    };
  }, [isLan]); // eslint-disable-line

  /** Activate a special skill from the SKILLS panel */
  const activateSkill = useCallback((skillId) => {
    const skill = SKILLS.find(s => s.id === skillId);
    if (!skill) return;
    if (playerScore < skill.cost) { addLog(`⚠ Need ${skill.cost}pts for ${skill.name}`, 'warn'); play('miss'); return; }
    if (!isMyTurn && skill.category === 'rocket') { addLog(`⚠ Wait for your turn`, 'warn'); play('miss'); return; }

    setPScore(s => s - skill.cost);
    play('select');

    if (skill.category === 'rocket') {
      // Arm the next shot: handleFire will use this pattern
      setPendingShot(skillId);
      addLog(`🚀 ${skill.name} armed — tap a target & fire!`, 'info');
      setSkillsOpen(false);
      return;
    }

    if (skillId === 'radar' || skillId === 'a-radar') {
      // Online/LAN: server has the real grid — ask it to compute reveal cells
      if (isLan && config.socket) {
        config.socket.emit('useRadar', { skillId }, (res) => {
          if (res?.error) { addLog(`⚠ ${res.error}`, 'warn'); setPScore(s => s + skill.cost); return; }
          const cells = res?.cells || [];
          if (cells.length === 0) { addLog(`📡 ${skill.name} found nothing left to reveal`, 'warn'); setPScore(s => s + skill.cost); return; }
          const newRevealed = new Set(revealedCells);
          cells.forEach(({ r, c }) => newRevealed.add(`${r}-${c}`));
          setRevealedCells(newRevealed);
          addLog(`📡 ${skill.name}: ${cells.length} cell(s) revealed!`, 'info');
        });
        setSkillsOpen(false);
        return;
      }

      // Vs-computer: local grid has all ships, compute locally
      const targetSizes = skillId === 'radar' ? [2] : [3, 4, 5];
      const gc = gcFromGrid(enemyGrid);
      const candidateShips = {};
      for (let r = 0; r < gc.size; r++) {
        for (let c = 0; c < gc.size; c++) {
          const cell = enemyGrid[r]?.[c];
          if (cell?.shipId != null && !cell.hit && !revealedCells.has(`${r}-${c}`)) {
            const ship = SHIPS.find(s => s.id === cell.shipId);
            if (ship && targetSizes.includes(ship.size)) {
              (candidateShips[cell.shipId] = candidateShips[cell.shipId] || []).push(`${r}-${c}`);
            }
          }
        }
      }
      const shipIds = Object.keys(candidateShips);
      if (shipIds.length === 0) {
        addLog(`📡 ${skill.name} found nothing left to reveal`, 'warn');
        setPScore(s => s + skill.cost);  // refund
        return;
      }
      const pick = shipIds[Math.floor(Math.random() * shipIds.length)];
      const cellsOfShip = candidateShips[pick];
      const revealCount = skillId === 'radar' ? cellsOfShip.length : Math.min(2, cellsOfShip.length);
      const newRevealed = new Set(revealedCells);
      const shuffled = [...cellsOfShip].sort(() => Math.random() - 0.5);
      for (let i = 0; i < revealCount; i++) newRevealed.add(shuffled[i]);
      setRevealedCells(newRevealed);
      addLog(`📡 ${skill.name}: ${revealCount} cell(s) revealed!`, 'info');
      setSkillsOpen(false);
      return;
    }

    if (skillId === 'interfere') {
      // Online/LAN: ask server to arm interference
      if (isLan && config.socket) {
        config.socket.emit('useInterference', {}, (res) => {
          if (res?.error) { addLog(`⚠ ${res.error}`, 'warn'); setPScore(s => s + skill.cost); return; }
          addLog(`⚡ Interference armed — enemy's next turn will be BLOCKED!`, 'info');
        });
        setSkillsOpen(false);
        return;
      }
      // Vs-computer: local flag
      setSkipEnemyTurn(true);
      addLog(`⚡ Interference active — enemy's next turn is BLOCKED!`, 'info');
      setSkillsOpen(false);
      return;
    }
  }, [playerScore, isMyTurn, enemyGrid, revealedCells, play, isLan, config.socket]);

  const handleFire = useCallback(() => {
    if (turn !== 1 || phase !== 'playing' || attackFx) return;
    aiAfterResultRef.current = false;
    play('click');
    let targets = [];
    if (isAdvanced) {
      const m = parseFloat(lineM), b = parseFloat(lineB), xv = parseFloat(lineX);
      if (isNaN(m)||isNaN(b)||isNaN(xv)) { addLog('⚠ Enter valid equation values','warn'); return; }
      const yv = m * xv + b;
      if (!Number.isInteger(yv)) { addLog(`⚠ y=${yv.toFixed(2)} must be integer`,'warn'); return; }
      targets = [{ x: Math.round(xv), y: Math.round(yv) }];
      addLog(`📐 y=${m}x+${b}, x=${xv} → (${Math.round(xv)},${Math.round(yv)})`, 'info');
    } else {
      const x = parseInt(inputX), y = parseInt(inputY);
      if (isNaN(x)||isNaN(y)) { addLog('⚠ Enter valid X and Y coords','warn'); return; }
      targets = [{ x, y }];
    }
    const baseTarget = targets[0];
    // ── Skill-armed shot takes priority over current weapon ──
    if (pendingShot) {
      targets = getSkillShotTargets(pendingShot, baseTarget.x, baseTarget.y);
    } else if (selWpn.id === 'bomb') {
      const {x,y} = baseTarget;
      targets = [{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    } else if (selWpn.id === 'nuke') {
      const {x,y} = baseTarget;
      targets = [{x,y}];
      for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) if(dx||dy) targets.push({x:x+dx,y:y+dy});
    }
    if (!pendingShot && wpnCnt[selWpn.id] <= 0) { addLog(`⚠ No ${selWpn.name} left!`,'warn'); return; }

    // Validate the primary target before starting the FX sequence, so an
    // already-hit cell or out-of-range shot does not waste a turn.
    const gcEnemy = gcFromGrid(enemyGrid);
    if (!isValidCoord(baseTarget.x, baseTarget.y, gcEnemy)) {
      addLog(`⚠ (${baseTarget.x},${baseTarget.y}) out of range`, 'warn');
      play('miss');
      return;
    }
    if (targets.length === 1) {
      const { col, row } = coordToGrid(baseTarget.x, baseTarget.y, gcEnemy);
      const baseCell = enemyGrid[row]?.[col];
      if (baseCell?.miss || baseCell?.hit) {
        addLog(`⚠ (${baseTarget.x},${baseTarget.y}) already targeted`, 'warn');
        play('miss');
        return;
      }
    }

    const weaponId = pendingShot ? 'rocket' : selWpn.id;

    if (isLan) {
      // Outgoing shot: show the targeting beat while the host resolves it.
      const key = Date.now() + Math.random();
      clearFxTimers();
      setAttackFx({ stage: 'targeting', side: 'player', weapon: weaponId, target: baseTarget, key });
      scheduleFx(() => {
        setAttackFx(f => (f?.key === key ? { ...f, stage: 'lock' } : f));
      }, 520);
      scheduleFx(() => {
        setAttackFx(f => (f?.key === key ? null : f));
      }, 3200);

      // Send to host with optional pendingShot so server expands the right pattern
      const payload = {
        x: baseTarget.x,
        y: baseTarget.y,
        weapon: selWpn.id,
      };
      if (pendingShot) payload.pendingShot = pendingShot;
      config.socket?.emit('fireAttack', payload, res => {
        if (res?.error) {
          setAttackFx(null);
          addLog(`⚠ ${res.error}`,'warn');
          return;
        }
        // Optimistic UI: clear pending shot + show "waiting" turn state immediately
        setPendingShot(null);
        setTurn(2);  // snapshot listener will reconfirm via turnChange
      });
    } else {
      const finishPlayerAttack = () => {
        let cur = enemyGrid;
        const results = [];
        const multi = targets.length > 1;

        targets.forEach(({x,y}) => {
          const r = doAttack(x,y,cur,null,'SQUAD 1',{ silent: multi });
          if (r) { cur = r.grid; results.push(r); }
        });

        // Multi-cell weapons play one aggregate impact instead of N overlapping sounds
        if (multi) {
          if (results.some(r => r.sunk)) play('sunk');
          else if (results.some(r => r.hit)) play('hit');
          else if (results.some(r => r.defenseHit)) play('blocked');
          else play('miss');
        }

        awardPoints(true, results);
        setEGrid(cur);
        if (!pendingShot) {
          setWpnCnt(p => ({ ...p, [selWpn.id]: p[selWpn.id]-1 }));
        }
        setPendingShot(null);

        const won = checkWin(cur,'player');
        const outcome = {
          type: results.some(r => r.sunk) ? 'sunk'
              : results.some(r => r.hit) ? 'hit'
              : results.some(r => r.defenseHit) ? 'blocked'
              : 'miss',
          count: results.filter(r => r.hit).length,
          points: results.reduce((sum, r) => sum + (r.points || 0), 0),
          gameOver: won,
        };

        if (!won) {
          if (isVsComputer) {
            // Honor interference: skip AI turn once
            if (skipEnemyTurn) {
              setSkipEnemyTurn(false);
              addLog(`⚡ Enemy turn BLOCKED by Interference!`, 'info');
              // keep turn = 1 (player still goes)
            } else {
              // Queue the AI turn for the exact moment the result banner clears
              aiAfterResultRef.current = true;
            }
          } else {
            setTurn(p => p===1 ? 2 : 1);
          }
        }
        return outcome;
      };

      runAttackSequence({
        side: 'player',
        weapon: weaponId,
        target: baseTarget,
        resolve: finishPlayerAttack,
        onDone: () => {
          if (!aiAfterResultRef.current) return;
          aiAfterResultRef.current = false;
          startAiTurn();
        },
      });
    }
    setInputX(''); setInputY(''); setLineX(''); setHL(null);
  }, [
    turn, phase, isAdvanced, lineM, lineB, lineX, inputX, inputY, selWpn, wpnCnt,
    enemyGrid, doAttack, checkWin, isVsComputer, isLan, difficulty, play, config.socket,
    awardPoints, pendingShot, skipEnemyTurn, attackFx, runAttackSequence, scheduleFx,
    clearFxTimers, startAiTurn,
  ]);

  // Derived — for ENEMY sunk count, prefer authoritative tracking (works in fog-of-war).
  // Fall back to grid scan for vs-computer mode where enemyGrid has full ship data.
  const enemySunkFromGrid = SHIPS.filter(s => enemyGrid.some(r=>r.some(c=>c?.shipId===s.id)) && !enemyGrid.some(r=>r.some(c=>c?.shipId===s.id&&!c.hit))).length;
  const enemySunk  = isLan ? sunkEnemyIds.size : Math.max(sunkEnemyIds.size, enemySunkFromGrid);
  const playerSunk = SHIPS.filter(s => playerGrid.some(r=>r.some(c=>c?.shipId===s.id)) && !playerGrid.some(r=>r.some(c=>c?.shipId===s.id&&!c.hit))).length;
  const advTarget  = lineM&&lineB&&lineX&&!isNaN(parseFloat(lineM))&&!isNaN(parseFloat(lineB))&&!isNaN(parseFloat(lineX))
    ? { x:Math.round(parseFloat(lineX)), y:Math.round(parseFloat(lineM)*parseFloat(lineX)+parseFloat(lineB)) } : null;

  // ─── Shared sub-components ───────────────────────────────────────────
  const SharedStyle = () => (
    <style>{`
      @keyframes aiPulse   { 0%,100%{opacity:0.4}   50%{opacity:1}   }
      @keyframes turnGlow  { 0%,100%{box-shadow:0 0 8px rgba(90,173,94,0.3)} 50%{box-shadow:0 0 20px rgba(90,173,94,0.75)} }
      @keyframes scaleIn   { from{opacity:0;transform:scale(0.86)} to{opacity:1;transform:scale(1)} }
      @keyframes fadeInUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes scorePop  { 0%{opacity:0;transform:translate(-50%,0) scale(0.6)} 15%{opacity:1;transform:translate(-50%,-30px) scale(1.15)} 70%{opacity:1;transform:translate(-50%,-90px) scale(1)} 100%{opacity:0;transform:translate(-50%,-130px) scale(0.95)} }
      .log-hit  { color:#ff7070 }
      .log-miss { color:rgba(100,160,210,0.85) }
      .log-info { color:rgba(90,173,94,0.7) }
      .log-warn { color:var(--amber) }
      .wpn-btn  { transition:all 0.15s; position:relative; overflow:hidden; }
      .wpn-btn:active { transform:scale(0.96); }
    `}</style>
  );

  /** Header — identical in both orientations */
  const Header = () => (
    <div style={{
      background:'var(--bg-panel)', borderBottom:'var(--border-panel)',
      display:'flex', alignItems:'center',
      padding:`max(0.3rem, var(--safe-top)) clamp(0.35rem,1.2vw,0.7rem) 0.3rem`,
      gap:'clamp(0.3rem,1.2vw,0.6rem)',
      flexShrink:0, overflow:'hidden',
      minHeight:'clamp(44px,7vh,54px)',
    }}>
      <button className="back-btn" onClick={requestExit} style={{width:36,height:36,flexShrink:0}}>
        <GameIcon id="back" size={15}/>
      </button>
      <span className="title-font" style={{fontSize:'clamp(0.72rem,2.2vw,0.95rem)',color:'var(--green-bright)',letterSpacing:'0.08em',flexShrink:0}}>
        SQUADRANT
      </span>

      {/* Turn badge */}
      <div style={{
        padding:'0.18rem clamp(0.32rem,1.3vw,0.62rem)',
        background: aiThink?'rgba(80,60,0,0.5)':isMyTurn?'rgba(35,90,38,0.5)':'rgba(80,20,20,0.45)',
        border:`1px solid ${aiThink?'var(--amber)':isMyTurn?'var(--green-bright)':'#c03030'}`,
        boxShadow: isMyTurn?'0 0 14px rgba(90,173,94,0.4)':'none',
        animation: isMyTurn?'turnGlow 2s ease-in-out infinite':'none',
        fontSize:'clamp(0.5rem,1.6vw,0.63rem)', fontFamily:'Share Tech Mono',
        flexShrink:0, whiteSpace:'nowrap',
        display:'flex', alignItems:'center', gap:'0.28rem',
      }}>
        {aiThink
          ? <><span style={{animation:'aiPulse 0.7s ease-in-out infinite'}}>◌</span> TARGETING</>
          : isMyTurn
            ? <>
                <span style={{color:'var(--green-bright)'}}>▶</span> YOUR TURN
                <span style={{
                  marginLeft:'0.3rem',
                  padding:'0 0.28rem',
                  background: (TURN_LIMIT > 0 && turnTimer <= 3) ? 'rgba(192,57,43,0.5)' : 'rgba(0,0,0,0.35)',
                  borderLeft:`1px solid ${(TURN_LIMIT > 0 && turnTimer <= 3) ? '#ff8080' : 'rgba(90,173,94,0.4)'}`,
                  color: (TURN_LIMIT > 0 && turnTimer <= 3) ? '#ffaaaa' : 'var(--green-accent)',
                  fontFamily:'Share Tech Mono', fontWeight:700,
                  animation: (TURN_LIMIT > 0 && turnTimer <= 3) ? 'blink 0.6s step-end infinite' : 'none',
                }}>⏱{TURN_LIMIT > 0 ? `${turnTimer}s` : '∞'}</span>
              </>
            : <><span style={{animation:'blink 1s step-end infinite',color:'#ff7070'}}>●</span>{' '}
                {isLan?'ENEMY TARGETING':'ENEMY TURN'}</>
        }
      </div>

      <div style={{flex:1}}/>

      {/* Deploy Rockets button */}
      <button onClick={() => { play('click'); setSkillsOpen(true); }}
        style={{padding:'0.2rem 0.5rem',background:'rgba(232,160,0,0.18)',border:'1px solid var(--amber)',color:'var(--amber)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.46rem,1.4vw,0.6rem)',fontWeight:700,letterSpacing:'0.08em',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:'0.25rem',whiteSpace:'nowrap'}}>
        🚀 SKILLS
      </button>

      {/* Score display (clickable too) */}
      <button onClick={() => { play('click'); setSkillsOpen(true); }}
        style={{textAlign:'center',flexShrink:0,padding:'0.05rem 0.4rem',background:'rgba(40,80,42,0.35)',border:'1px solid rgba(90,173,94,0.4)',cursor:'pointer'}}>
        <div style={{fontSize:'clamp(0.36rem,1.1vw,0.48rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',lineHeight:1.2}}>SCORE</div>
        <div style={{color:'var(--green-bright)',fontWeight:700,fontFamily:'Share Tech Mono',fontSize:'clamp(0.62rem,1.9vw,0.82rem)',lineHeight:1.1}}>{playerScore}</div>
      </button>

      {/* Sunk counters */}
      {[{label:'ENEMY',val:enemySunk,color:'#ff6060'},{label:'YOURS',val:playerSunk,color:'var(--amber)'}].map(({label,val,color})=>(
        <div key={label} style={{textAlign:'center',flexShrink:0}}>
          <div style={{fontSize:'clamp(0.36rem,1.1vw,0.48rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',lineHeight:1.2}}>{label}</div>
          <div style={{color,fontWeight:700,fontFamily:'Share Tech Mono',fontSize:'clamp(0.56rem,1.7vw,0.72rem)',lineHeight:1.1}}>{val}/{SHIPS.length}</div>
        </div>
      ))}
      <div style={{padding:'0.1rem clamp(0.22rem,0.8vw,0.35rem)',background:'rgba(80,50,0,0.35)',border:'1px solid rgba(232,160,0,0.3)',fontSize:'clamp(0.4rem,1.2vw,0.52rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',flexShrink:0,letterSpacing:'0.05em'}}>
        {isLan?'LAN':level.label}
      </div>
    </div>
  );

  // ── Back-button → exit confirmation flow ──
  const requestExit = () => {
    play('click');
    if (phase === 'gameover') { onBack(); return; }    // Already over — leave directly
    setConfirmExit(true);
  };
  const confirmAndLeave = () => {
    play('select');
    setConfirmExit(false);
    if (isLan && config.socket) {
      try { config.socket.emit('leaveRoom', {}); } catch (e) {}
    }
    onBack();
  };

  /** Confirmation modal — "Do you want to leave?" */
  const ConfirmExitModal = () => confirmExit ? (
    <div onClick={() => setConfirmExit(false)}
      style={{position:'absolute',inset:0,zIndex:220,background:'rgba(2,12,4,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:'clamp(0.8rem,3vw,1.4rem)',backdropFilter:'blur(6px)',animation:'fadeInUp 0.2s ease'}}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:'min(420px,94vw)',
        background:'var(--bg-panel)',
        border:'1px solid var(--amber)',
        padding:'clamp(1rem,4vw,1.5rem)',
        boxShadow:'0 0 50px rgba(0,0,0,0.8), 0 0 24px rgba(232,160,0,0.25)',
        clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))',
      }}>
        <div className="label-xs" style={{ letterSpacing:'0.3em', opacity:0.65, marginBottom:'0.4rem' }}>
          ⚠ ABORT MISSION
        </div>
        <div className="title-font" style={{
          fontSize:'clamp(1.1rem,4.5vw,1.6rem)',
          color:'var(--amber)',
          letterSpacing:'0.04em', marginBottom:'0.5rem',
        }}>
          DO YOU WANT TO LEAVE?
        </div>
        <div style={{ fontSize:'clamp(0.65rem,2.3vw,0.78rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', marginBottom:'1rem', lineHeight:1.5 }}>
          Your current battle progress will be lost.
          {isLan && <><br/>Your opponent will be notified that you disconnected.</>}
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => { play('click'); setConfirmExit(false); }}
            style={{
              flex:1, padding:'clamp(0.55rem,2vw,0.8rem)',
              background:'rgba(40,80,42,0.35)', border:'1px solid var(--green-bright)',
              color:'var(--green-bright)',
              fontFamily:'Share Tech Mono', fontWeight:700,
              fontSize:'clamp(0.75rem,2.6vw,0.92rem)',
              letterSpacing:'0.2em', cursor:'pointer',
              clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
            }}>
            ▶ NO
          </button>
          <button onClick={confirmAndLeave}
            style={{
              flex:1, padding:'clamp(0.55rem,2vw,0.8rem)',
              background:'rgba(160,35,35,0.4)', border:'1px solid #e05050',
              color:'#ff9090',
              fontFamily:'Share Tech Mono', fontWeight:700,
              fontSize:'clamp(0.75rem,2.6vw,0.92rem)',
              letterSpacing:'0.2em', cursor:'pointer',
              boxShadow:'0 0 14px rgba(192,57,43,0.35)',
              clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
            }}>
            ▶ YES
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /** Opponent disconnected modal — LAN only */
  const OpponentLeftModal = () => opponentLeft ? (
    <div style={{position:'absolute',inset:0,zIndex:230,background:'rgba(2,12,4,0.94)',display:'flex',alignItems:'center',justifyContent:'center',padding:'clamp(0.8rem,3vw,1.4rem)',backdropFilter:'blur(8px)',animation:'fadeInUp 0.25s ease'}}>
      <div style={{
        width:'100%', maxWidth:'min(420px,94vw)',
        background:'var(--bg-panel)',
        border:'1.5px solid var(--red-bright)',
        padding:'clamp(1.2rem,4vw,1.8rem)',
        boxShadow:'0 0 55px rgba(0,0,0,0.85), 0 0 28px rgba(192,57,43,0.35)',
        textAlign:'center',
        clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))',
      }}>
        <div style={{ fontSize:'clamp(2rem,7vw,2.8rem)', marginBottom:'0.4rem' }}>📡</div>
        <div className="label-xs" style={{ letterSpacing:'0.35em', opacity:0.6, marginBottom:'0.45rem' }}>
          ── CONNECTION LOST ──
        </div>
        <div className="title-font" style={{
          fontSize:'clamp(1.2rem,5vw,1.8rem)',
          color:'var(--red-bright)',
          textShadow:'0 0 22px rgba(192,57,43,0.55)',
          letterSpacing:'0.05em', marginBottom:'0.5rem',
        }}>
          OPPONENT DISCONNECTED
        </div>
        <div style={{ fontSize:'clamp(0.68rem,2.4vw,0.82rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', marginBottom:'1.1rem', lineHeight:1.5 }}>
          Your opponent has left the battle.<br/>
          The game has been terminated.
        </div>
        <button onClick={() => { play('click'); setOpponentLeft(false); onBack(); }}
          style={{
            width:'100%', padding:'clamp(0.6rem,2.2vw,0.85rem)',
            background:'rgba(40,80,42,0.4)', border:'1px solid var(--green-bright)',
            color:'var(--green-bright)',
            fontFamily:'Share Tech Mono', fontWeight:700,
            fontSize:'clamp(0.78rem,2.7vw,0.95rem)',
            letterSpacing:'0.22em', cursor:'pointer',
            boxShadow:'0 0 16px rgba(90,173,94,0.3)',
            clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))',
          }}>
          ▶ RETURN TO MENU
        </button>
      </div>
    </div>
  ) : null;

  /** Skills modal — Deploy Rockets + Arsenal */
  const SkillsModal = () => skillsOpen ? (
    <div onClick={() => setSkillsOpen(false)}
      style={{position:'absolute',inset:0,zIndex:180,background:'rgba(2,12,4,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:'clamp(0.6rem,3vw,1.2rem)',backdropFilter:'blur(4px)',animation:'fadeInUp 0.2s ease'}}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:'min(560px,96vw)', maxHeight:'92%', overflowY:'auto',
        background:'var(--bg-panel)', border:'1px solid rgba(90,173,94,0.4)',
        padding:'clamp(0.8rem,3vw,1.3rem)',
        boxShadow:'0 0 60px rgba(0,0,0,0.7), 0 0 30px rgba(90,173,94,0.15)',
        position:'relative',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.6rem',gap:'0.5rem'}}>
          <div>
            <div className="label-xs" style={{letterSpacing:'0.3em',opacity:0.6}}>SPECIAL OPS</div>
            <div className="title-font" style={{fontSize:'clamp(1rem,4vw,1.4rem)',color:'var(--green-bright)',letterSpacing:'0.05em'}}>🚀 DEPLOY ROCKETS</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0}}>
            <div className="label-xs">YOUR SCORE</div>
            <div style={{fontFamily:'Share Tech Mono',fontWeight:700,fontSize:'clamp(0.95rem,3.5vw,1.3rem)',color:'var(--green-bright)'}}>{playerScore} pts</div>
          </div>
        </div>

        {/* Rockets section */}
        <div className="label-xs" style={{margin:'0.5rem 0 0.3rem',color:'var(--amber)'}}>▸ DEPLOY ROCKETS</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.4rem'}}>
          {SKILLS.filter(s => s.category === 'rocket').map(s => {
            const afford = playerScore >= s.cost;
            return (
              <button key={s.id} onClick={() => activateSkill(s.id)} disabled={!afford}
                style={{padding:'0.55rem 0.65rem',background:afford?'rgba(232,160,0,0.08)':'rgba(20,20,20,0.4)',border:`1px solid ${afford?'rgba(232,160,0,0.45)':'rgba(90,90,90,0.3)'}`,color:afford?'var(--white-cream)':'rgba(150,150,150,0.5)',cursor:afford?'pointer':'not-allowed',display:'flex',flexDirection:'column',gap:'0.25rem',textAlign:'left',transition:'all 0.15s'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                  <span style={{fontSize:'1.2rem'}}>{s.icon}</span>
                  <div style={{fontFamily:'Share Tech Mono',fontWeight:700,fontSize:'clamp(0.65rem,2.2vw,0.78rem)',color:afford?'var(--amber)':'rgba(150,150,150,0.5)',flex:1}}>{s.name}</div>
                  <div style={{fontSize:'clamp(0.6rem,2vw,0.7rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:afford?'var(--green-bright)':'rgba(150,150,150,0.5)'}}>{s.cost}pts</div>
                </div>
                <div style={{fontSize:'clamp(0.5rem,1.7vw,0.6rem)',fontFamily:'Share Tech Mono',color:'var(--white-dim)',lineHeight:1.3}}>{s.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Arsenal section */}
        <div className="label-xs" style={{margin:'0.8rem 0 0.3rem',color:'var(--green-accent)'}}>▸ ARSENAL</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.4rem'}}>
          {SKILLS.filter(s => s.category === 'arsenal').map(s => {
            const afford = playerScore >= s.cost;
            return (
              <button key={s.id} onClick={() => activateSkill(s.id)} disabled={!afford}
                style={{padding:'0.55rem 0.65rem',background:afford?'rgba(90,173,94,0.08)':'rgba(20,20,20,0.4)',border:`1px solid ${afford?'rgba(90,173,94,0.45)':'rgba(90,90,90,0.3)'}`,color:afford?'var(--white-cream)':'rgba(150,150,150,0.5)',cursor:afford?'pointer':'not-allowed',display:'flex',flexDirection:'column',gap:'0.25rem',textAlign:'left',transition:'all 0.15s'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                  <span style={{fontSize:'1.2rem'}}>{s.icon}</span>
                  <div style={{fontFamily:'Share Tech Mono',fontWeight:700,fontSize:'clamp(0.65rem,2.2vw,0.78rem)',color:afford?'var(--green-accent)':'rgba(150,150,150,0.5)',flex:1}}>{s.name}</div>
                  <div style={{fontSize:'clamp(0.6rem,2vw,0.7rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:afford?'var(--green-bright)':'rgba(150,150,150,0.5)'}}>{s.cost}pts</div>
                </div>
                <div style={{fontSize:'clamp(0.5rem,1.7vw,0.6rem)',fontFamily:'Share Tech Mono',color:'var(--white-dim)',lineHeight:1.3}}>{s.desc}</div>
              </button>
            );
          })}
        </div>

        {pendingShot && (
          <div style={{marginTop:'0.6rem',padding:'0.4rem 0.6rem',background:'rgba(232,160,0,0.12)',border:'1px solid var(--amber)',fontSize:'clamp(0.55rem,2vw,0.7rem)',fontFamily:'Share Tech Mono',color:'var(--amber)',textAlign:'center'}}>
            ⚡ {SKILLS.find(s => s.id === pendingShot)?.name} ARMED — tap target & FIRE
          </div>
        )}

        <button onClick={() => setSkillsOpen(false)}
          style={{marginTop:'0.7rem',width:'100%',padding:'0.5rem',background:'rgba(40,40,40,0.5)',border:'1px solid rgba(90,173,94,0.3)',color:'var(--white-dim)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.6rem,2vw,0.72rem)',letterSpacing:'0.15em',cursor:'pointer'}}>
          CLOSE
        </button>
      </div>
    </div>
  ) : null;

  /** Floating "+X" score popup, anchored to enemy-grid center */
  /** Defender alert — flashes when the enemy fires at us */
  const EnemyShotAlert = () => {
    if (!enemyShot || attackFx?.stage === 'result') return null;
    const { x, y, hit, defenseHit, sunk } = enemyShot;
    const color   = sunk ? '#ff3030' : hit ? '#ff7070' : defenseHit ? '#ffaa30' : '#7090c0';
    const label   = sunk ? 'SHIP DOWN!' : hit ? 'HIT' : defenseHit ? 'BLOCKED' : 'MISS';
    const shadow  = sunk ? 'rgba(255,50,50,0.85)' : hit ? 'rgba(255,90,90,0.7)' : defenseHit ? 'rgba(255,170,48,0.7)' : 'rgba(120,160,200,0.6)';
    const isMiss  = !hit && !defenseHit && !sunk;
    return (
      <div key={enemyShot.key} style={{
        position:'absolute', zIndex:160,
        top: 'calc(var(--safe-top, 0px) + clamp(54px, 9vh, 70px))',
        left:'50%', transform:'translateX(-50%)',
        pointerEvents:'none',
        animation:'fadeInUp 0.2s ease, scorePop 2.5s ease-out forwards',
        background:'rgba(2,12,4,0.92)',
        border:`1.5px solid ${color}`,
        boxShadow:`0 0 22px ${shadow}`,
        padding:'0.4rem 0.85rem',
        display:'flex', alignItems:'center', gap:'0.5rem',
        clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))',
        whiteSpace:'nowrap',
      }}>
        <span style={{ fontSize:'clamp(0.9rem,3vw,1.2rem)' }}>🎯</span>
        <div>
          <div style={{
            fontSize:'clamp(0.5rem,1.8vw,0.62rem)',
            fontFamily:'Share Tech Mono', color:'var(--white-dim)',
            letterSpacing:'0.15em', lineHeight:1.1,
          }}>
            ENEMY FIRED AT
          </div>
          {isMiss ? (
            <div style={{ display:'flex', alignItems:'baseline', gap:'0.4rem' }}>
              <span className="title-font" style={{
                fontSize:'clamp(1.35rem,5.5vw,1.9rem)',
                color, letterSpacing:'0.08em', lineHeight:1,
                textShadow:`0 0 18px ${shadow}`,
              }}>MISS</span>
              <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2.2vw,0.75rem)', color:'var(--white-dim)' }}>
                ({x},{y})
              </span>
            </div>
          ) : (
            <div style={{
              fontFamily:'Share Tech Mono', fontWeight:700,
              fontSize:'clamp(0.85rem,3vw,1.05rem)',
              color, letterSpacing:'0.06em', lineHeight:1.1,
            }}>
              ({x},{y}) → {label}
            </div>
          )}
        </div>
      </div>
    );
  };

  const ScorePopup = () => scorePopup ? (
    <div key={scorePopup.key} style={{
      position:'absolute', zIndex:150,
      left:'50%', top:'40%',
      pointerEvents:'none',
      animation:'scorePop 1.6s ease-out forwards',
      textAlign:'center',
    }}>
      <div style={{
        fontFamily:'Share Tech Mono', fontWeight:900,
        fontSize: scorePopup.type === 'SHIP SUNK!' ? 'clamp(1.6rem,5vw,2.4rem)'
                  : scorePopup.type === 'STREAK!'   ? 'clamp(1.4rem,4.5vw,2.1rem)'
                  : 'clamp(1.2rem,4vw,1.8rem)',
        color: scorePopup.type === 'SHIP SUNK!' ? '#ff4040'
               : scorePopup.type === 'STREAK!'   ? '#ffaa30'
               : 'var(--green-bright)',
        textShadow: `0 0 18px ${scorePopup.type === 'SHIP SUNK!' ? 'rgba(255,40,40,0.8)'
                                : scorePopup.type === 'STREAK!'   ? 'rgba(255,170,48,0.8)'
                                : 'rgba(90,173,94,0.8)'}`,
        letterSpacing:'0.05em',
      }}>
        +{scorePopup.amount}
      </div>
      {scorePopup.type && scorePopup.type !== 'HIT' && (
        <div style={{
          fontFamily:'Share Tech Mono', fontWeight:700,
          fontSize:'clamp(0.65rem,1.8vw,0.85rem)',
          color: scorePopup.type === 'SHIP SUNK!' ? '#ff8080' : '#ffd060',
          letterSpacing:'0.15em',
          marginTop:'0.15rem',
        }}>
          {scorePopup.type}
        </div>
      )}
    </div>
  ) : null;

  /** Game-over overlay — same in both orientations */
  const GameOver = () => phase==='gameover' ? (
    <div style={{position:'absolute',inset:0,zIndex:200,background:'rgba(2,12,4,0.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'clamp(0.65rem,2.5vw,1.3rem)',padding:'1.5rem',animation:'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
      <div style={{position:'absolute',top:'12%',left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${isVictory?'rgba(90,173,94,0.35)':'rgba(192,57,43,0.35)'},transparent)`}}/>
      <div style={{position:'absolute',bottom:'12%',left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${isVictory?'rgba(90,173,94,0.35)':'rgba(192,57,43,0.35)'},transparent)`}}/>
      <div style={{textAlign:'center',animation:'fadeInUp 0.4s 0.08s both'}}>
        <div className="label-xs" style={{letterSpacing:'0.55em',marginBottom:'0.55rem',opacity:0.45}}>── OPERATION COMPLETE ──</div>
        <div className="title-font" style={{fontSize:'clamp(2.5rem,11vw,5.5rem)',color:isVictory?'var(--green-bright)':'var(--red-bright)',textShadow:`0 0 55px ${isVictory?'rgba(90,173,94,0.9)':'rgba(192,57,43,0.9)'}`,lineHeight:1,letterSpacing:'0.04em'}}>
          {isVictory?'VICTORY':'DEFEAT'}
        </div>
        <div style={{fontSize:'clamp(0.72rem,3vw,1.05rem)',color:'var(--white-dim)',marginTop:'0.4rem',fontFamily:'Share Tech Mono',letterSpacing:'0.12em'}}>
          {isVictory?`✓ ${winner} WINS`:`✕ ${winner} WINS`}
        </div>
      </div>
      <div style={{display:'flex',gap:'clamp(1.2rem,4vw,2.5rem)',padding:'clamp(0.5rem,2vw,0.8rem) clamp(1rem,4vw,2.2rem)',background:'rgba(0,0,0,0.3)',border:`1px solid ${isVictory?'rgba(90,173,94,0.18)':'rgba(192,57,43,0.18)'}`,animation:'fadeInUp 0.4s 0.18s both'}}>
        <div style={{textAlign:'center'}}>
          <div className="label-xs" style={{marginBottom:'0.18rem'}}>SCORE</div>
          <div style={{fontFamily:'Share Tech Mono',fontSize:'clamp(1.2rem,4.5vw,1.9rem)',fontWeight:700,color:'var(--green-bright)'}}>{playerScore}</div>
        </div>
        <div style={{width:1,background:'rgba(90,173,94,0.18)'}}/>
        <div style={{textAlign:'center'}}>
          <div className="label-xs" style={{marginBottom:'0.18rem'}}>SHIPS SUNK</div>
          <div style={{fontFamily:'Share Tech Mono',fontSize:'clamp(1.2rem,4.5vw,1.9rem)',fontWeight:700,color:'#ff6060'}}>{enemySunk}</div>
        </div>
        <div style={{width:1,background:'rgba(90,173,94,0.18)'}}/>
        <div style={{textAlign:'center'}}>
          <div className="label-xs" style={{marginBottom:'0.18rem'}}>YOUR LOSSES</div>
          <div style={{fontFamily:'Share Tech Mono',fontSize:'clamp(1.2rem,4.5vw,1.9rem)',fontWeight:700,color:'var(--amber)'}}>{playerSunk}</div>
        </div>
      </div>
      {unlockedNext && (
        <div style={{
          textAlign:'center',
          padding:'clamp(0.45rem,1.8vw,0.7rem) clamp(0.9rem,3vw,1.4rem)',
          background:'rgba(232,160,0,0.08)',
          border:'1px solid rgba(232,160,0,0.45)',
          boxShadow:'0 0 24px rgba(232,160,0,0.18)',
          animation:'fadeInUp 0.4s 0.24s both',
          clipPath:'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))',
        }}>
          <div className="label-xs" style={{ color:'var(--amber)', letterSpacing:'0.28em', marginBottom:'0.18rem' }}>
            🔓 NEW THEATER UNLOCKED
          </div>
          <div className="title-font" style={{ fontSize:'clamp(0.9rem,4vw,1.2rem)', color:'var(--amber)', letterSpacing:'0.08em' }}>
            {getLevel(unlockedNext).codename}
          </div>
          <div style={{ fontSize:'clamp(0.52rem,2vw,0.66rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', marginTop:'0.18rem' }}>
            {getLevel(unlockedNext).brief}
          </div>
        </div>
      )}
      <button className="btn btn-primary" onClick={()=>{play('click');onBack();}}
        style={{padding:'clamp(0.6rem,2vw,0.9rem) clamp(1.8rem,6vw,3.2rem)',fontSize:'clamp(0.72rem,2.5vw,0.98rem)',letterSpacing:'0.25em',animation:'fadeInUp 0.4s 0.28s both'}}>
        ▶ MAIN MENU
      </button>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════
  // PORTRAIT LAYOUT
  // ═══════════════════════════════════════════════════
  if (isPortrait) {
    return (
      <div className="screen" style={{background:'var(--bg-void)',flexDirection:'column',overflow:'hidden'}}>
        {SharedStyle()}
        {Header()}

        {/* Enemy grid — fills all remaining space above bottom panel */}
        <div ref={enemyWrap} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'clamp(0.15rem,0.8vw,0.4rem)',overflow:'hidden',position:'relative',background:'var(--bg-void)'}}>
          <div className="label-xs" style={{marginBottom:'0.15rem',textAlign:'center',flexShrink:0}}>
            {isAdvanced?`▸ ${level.codename} — SOLVE y=mx+b`:`▸ ${level.codename} — TAP OR ENTER COORDS`}
          </div>
          {enemyPx>0 && (
            <CoordGrid grid={enemyGrid} showShips={false} interactive={isMyTurn}
              onCellClick={(x,y)=>{ play('click'); setInputX(String(x)); setInputY(String(y)); setHL({x,y}); setLineX(String(x)); }}
              highlight={highlight||advTarget} size={enemyPx}
              revealedCells={revealedCells}/>
          )}
          {/* AI thinking overlay */}
          {aiThink && (
            <div style={{position:'absolute',inset:0,background:'rgba(2,12,4,0.55)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{padding:'0.45rem 1.1rem',background:'rgba(70,50,5,0.9)',border:'1px solid var(--amber)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.7rem,2.5vw,0.9rem)',color:'var(--amber)',letterSpacing:'0.12em',animation:'aiPulse 0.8s ease-in-out infinite'}}>
                ◌ TARGETING…
              </div>
            </div>
          )}
          {/* LAN waiting overlay */}
          {isLan && turn===2 && phase==='playing' && (
            <div style={{position:'absolute',inset:0,background:'rgba(2,12,4,0.45)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{padding:'0.4rem 1rem',background:'rgba(70,15,15,0.85)',border:'1px solid rgba(192,57,43,0.5)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.65rem,2.5vw,0.8rem)',color:'rgba(255,110,110,0.9)',letterSpacing:'0.1em',animation:'aiPulse 1.2s ease-in-out infinite'}}>
                ● ENEMY IS TARGETING…
              </div>
            </div>
          )}
        </div>

        {/* Bottom control panel */}
        <div style={{height:'clamp(215px,40vh,295px)',background:'var(--bg-panel)',borderTop:'var(--border-panel)',display:'flex',flexDirection:'column',flexShrink:0,paddingBottom:'max(0px, var(--safe-bottom))'}}>

          {/* Tab bar */}
          <div style={{display:'flex',borderBottom:'var(--border-panel)',flexShrink:0}}>
            {[{id:'attack',label:'🎯 FIRE'},{id:'fleet',label:'🚢 FLEET'},{id:'log',label:'📋 LOG'}].map(({id,label})=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{flex:1,padding:'clamp(0.3rem,1.2vw,0.45rem)',background:activeTab===id?'rgba(90,173,94,0.12)':'transparent',border:'none',borderBottom:`2px solid ${activeTab===id?'var(--green-bright)':'transparent'}`,color:activeTab===id?'var(--green-accent)':'var(--green-dim)',fontSize:'clamp(0.5rem,2vw,0.65rem)',fontFamily:'Share Tech Mono',cursor:'pointer',transition:'all 0.15s',letterSpacing:'0.05em'}}>
                {label}
              </button>
            ))}
          </div>

          {/* ── FIRE tab (portrait) ── */}
          {activeTab==='attack' && (
            <div style={{flex:1,overflowY:'auto',padding:'clamp(0.4rem,1.5vw,0.6rem)',display:'flex',flexDirection:'column',gap:'0.38rem'}}>

              {/* Weapon selector row */}
              <div style={{display:'flex',gap:'0.4rem'}}>
                {WEAPONS.map(w => {
                  const cnt=wpnCnt[w.id]; const sel=selWpn.id===w.id; const c=WPN_COLOR[w.id];
                  return (
                    <button key={w.id} className="wpn-btn"
                      onClick={()=>{if(cnt>0){play('select');setSelWpn(w);}}} disabled={cnt<=0}
                      style={{flex:1,minHeight:46,background:sel?`${c}1a`:'rgba(10,22,10,0.55)',border:`1px solid ${sel?c:`${c}28`}`,color:cnt<=0?'rgba(90,90,90,0.4)':'var(--white-cream)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0.08rem',cursor:cnt>0?'pointer':'not-allowed'}}>
                      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:c,opacity:sel?1:0.3}}/>
                      <GameIcon id={w.id} size={16}/>
                      <div style={{fontSize:'clamp(0.5rem,1.8vw,0.62rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:sel?c:'var(--white-cream)'}}>{w.name}</div>
                      <span style={{fontSize:'clamp(0.44rem,1.5vw,0.56rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:cnt===0?'rgba(100,100,100,0.5)':cnt<=1?'var(--red-bright)':cnt<=3?'var(--amber)':'var(--green-dim)'}}>{cnt>99?'∞':cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Coordinate inputs */}
              {!isAdvanced ? (
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {[{label:'X',val:inputX,set:setInputX},{label:'Y',val:inputY,set:setInputY}].map(({label,val,set})=>(
                    <div key={label} style={{flex:1}}>
                      <div style={{fontSize:'clamp(0.44rem,1.6vw,0.56rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',marginBottom:'0.1rem',letterSpacing:'0.1em'}}>{label} COORD</div>
                      <input className="game-input" placeholder="-10~10" value={val}
                        type="number" min={-10} max={10}
                        onChange={e=>{set(e.target.value);const xi=parseInt(label==='X'?e.target.value:inputX),yi=parseInt(label==='Y'?e.target.value:inputY);if(!isNaN(xi)&&!isNaN(yi))setHL({x:xi,y:yi});}}
                        onKeyDown={e=>e.key==='Enter'&&handleFire()}
                        style={{width:'100%',minHeight:54,fontSize:'clamp(1rem,4vw,1.2rem)',textAlign:'center',fontFamily:'Share Tech Mono',letterSpacing:'0.1em'}}/>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{padding:'0.22rem 0.35rem',background:'rgba(232,160,0,0.08)',border:'1px solid rgba(232,160,0,0.25)',fontSize:'clamp(0.5rem,1.8vw,0.62rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',textAlign:'center',letterSpacing:'0.06em'}}>y = mx + b</div>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {[{label:'M',val:lineM,set:setLineM,ph:'slope'},{label:'B',val:lineB,set:setLineB,ph:'intercept'},{label:'X',val:lineX,set:setLineX,ph:'x value'}].map(({label,val,set,ph})=>(
                      <div key={label} style={{flex:1}}>
                        <div style={{fontSize:'clamp(0.44rem,1.5vw,0.55rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',marginBottom:'0.1rem'}}>{label}</div>
                        <input className="game-input" placeholder={ph} value={val} onChange={e=>set(e.target.value)} type="number"
                          style={{width:'100%',minHeight:48,fontSize:'clamp(0.9rem,3.5vw,1.05rem)',textAlign:'center',fontFamily:'Share Tech Mono'}}/>
                      </div>
                    ))}
                  </div>
                  {advTarget && isValidCoord(advTarget.x,advTarget.y) && (
                    <div style={{padding:'0.22rem',background:'rgba(232,160,0,0.06)',border:'1px solid rgba(232,160,0,0.18)',fontSize:'clamp(0.5rem,1.8vw,0.62rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',textAlign:'center'}}>
                      → ({advTarget.x},{advTarget.y})
                    </div>
                  )}
                </>
              )}

              {/* FIRE button */}
              <button onClick={handleFire} disabled={!isMyTurn}
                style={{width:'100%',minHeight:54,marginTop:'auto',background:isMyTurn?'rgba(160,35,35,0.28)':'rgba(18,18,18,0.45)',border:`1px solid ${isMyTurn?'#e05050':'rgba(90,173,94,0.14)'}`,color:isMyTurn?'#ff8888':'rgba(90,173,94,0.3)',boxShadow:isMyTurn?'0 0 20px rgba(192,57,43,0.38)':'none',fontFamily:'Share Tech Mono',fontSize:'clamp(0.85rem,3.5vw,1.05rem)',fontWeight:700,letterSpacing:'0.2em',cursor:isMyTurn?'pointer':'not-allowed',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem',clipPath:isMyTurn?'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))':'none'}}>
                <GameIcon id="rocket" size={16}/>
                {isMyTurn ? (pendingShot ? `🚀 ${SKILLS.find(s=>s.id===pendingShot)?.name.toUpperCase()||'SKILL'}` : 'FIRE!') : aiThink?'⟳ WAIT':'● STANDBY'}
              </button>
            </div>
          )}

          {/* ── FLEET tab (portrait) ── */}
          {activeTab==='fleet' && (
            <div style={{flex:1,overflowY:'auto',padding:'clamp(0.4rem,1.5vw,0.6rem)',display:'flex',gap:'0.6rem'}}>
              {/* Two-column fleet list */}
              {[{title:'▸ ENEMY',ships:SHIPS.map(s=>({...s,gone:enemyGrid.some(r=>r.some(c=>c?.shipId===s.id))&&!enemyGrid.some(r=>r.some(c=>c?.shipId===s.id&&!c.hit)),clr:'rgba(192,57,43,0.5)'}))},
                {title:'▸ YOURS',ships:SHIPS.map(s=>({...s,gone:!playerGrid.some(r=>r.some(c=>c?.shipId===s.id&&!c.hit)),clr:'var(--green-bright)'}))},
              ].map(col=>(
                <div key={col.title} style={{flex:1}}>
                  <div className="label-xs" style={{marginBottom:'0.25rem'}}>{col.title}</div>
                  {col.ships.map(ship=>(
                    <div key={ship.id} style={{display:'flex',alignItems:'center',gap:'0.25rem',padding:'0.18rem 0',borderBottom:'1px solid rgba(90,173,94,0.07)',fontSize:'clamp(0.5rem,2vw,0.65rem)',fontFamily:'Share Tech Mono',color:ship.gone?'rgba(192,57,43,0.5)':col.title.includes('YOURS')?'var(--green-bright)':'var(--white-dim)',textDecoration:ship.gone?'line-through':'none'}}>
                      <div style={{width:4,height:4,borderRadius:'50%',background:ship.gone?'rgba(192,57,43,0.5)':col.title.includes('YOURS')?'var(--green-bright)':'var(--green-dim)',flexShrink:0}}/>
                      {shipIcon(ship.id,11)} {ship.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── LOG tab (portrait) ── */}
          {activeTab==='log' && (
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:'clamp(0.4rem,1.5vw,0.6rem)'}}>
              <div className="label-xs" style={{marginBottom:'0.22rem',flexShrink:0}}>▸ BATTLE LOG</div>
              <div ref={logRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.1rem'}}>
                {log.length===0
                  ? <div style={{color:'rgba(90,173,94,0.3)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.55rem,2vw,0.7rem)',textAlign:'center',marginTop:'1rem'}}>AWAITING ORDERS…</div>
                  : log.map(e=>(
                      <div key={e.id} className={`log-${e.type}`} style={{fontSize:'clamp(0.5rem,2vw,0.65rem)',fontFamily:'Share Tech Mono',padding:'0.09rem 0',borderBottom:'1px solid rgba(90,173,94,0.04)',lineHeight:1.4}}>{e.msg}</div>
                    ))
                }
              </div>
            </div>
          )}
        </div>

        <AttackFx fx={attackFx}/>
        {ScorePopup()}
        {EnemyShotAlert()}
        {SkillsModal()}
        {ConfirmExitModal()}
        {OpponentLeftModal()}
        {GameOver()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // LANDSCAPE LAYOUT
  // ═══════════════════════════════════════════════════
  return (
    <div className="screen" style={{background:'var(--bg-void)',flexDirection:'column',overflow:'hidden'}}>
      {SharedStyle()}
      {Header()}

      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>

        {/* LEFT: Mini fleet + Arsenal */}
        <div style={{width:'clamp(115px,18vw,175px)',background:'var(--bg-panel)',borderRight:'var(--border-panel)',display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
          <div className="label-xs" style={{padding:'clamp(0.22rem,0.7vw,0.32rem) clamp(0.3rem,0.9vw,0.5rem)',borderBottom:'var(--border-panel)',flexShrink:0}}>▸ YOUR FLEET</div>
          <div ref={miniWrap} style={{flex:'0 0 clamp(110px,18vw,175px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'0.22rem',overflow:'hidden',borderBottom:'var(--border-panel)'}}>
            {miniPx>0 && <CoordGrid grid={playerGrid} showShips size={miniPx}/>}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'clamp(0.22rem,0.7vw,0.38rem)',display:'flex',flexDirection:'column',gap:'0.18rem'}}>
            <div className="label-xs" style={{marginBottom:'0.12rem'}}>▸ ARSENAL</div>
            {WEAPONS.map(w=>{
              const cnt=wpnCnt[w.id];const sel=selWpn.id===w.id;const c=WPN_COLOR[w.id];
              return (
                <button key={w.id} className="wpn-btn" onClick={()=>{if(cnt>0){play('select');setSelWpn(w);}}} disabled={cnt<=0} aria-pressed={sel}
                  style={{width:'100%',padding:'clamp(0.2rem,0.6vw,0.3rem) clamp(0.28rem,0.85vw,0.42rem)',background:sel?`${c}1a`:'rgba(10,22,10,0.55)',border:`1px solid ${sel?c:`${c}28`}`,color:cnt<=0?'rgba(90,90,90,0.4)':'var(--white-cream)',cursor:cnt>0?'pointer':'not-allowed',display:'flex',alignItems:'center',gap:'0.28rem',minHeight:32}}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:2,background:c,opacity:sel?1:0.3}}/>
                  <GameIcon id={w.id} size={13} style={{flexShrink:0,marginLeft:'0.08rem'}}/>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{fontSize:'clamp(0.46rem,1.4vw,0.6rem)',fontFamily:'Share Tech Mono',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:sel?c:'var(--white-cream)'}}>{w.name}</div>
                  </div>
                  <span style={{fontSize:'clamp(0.46rem,1.4vw,0.58rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:cnt===0?'rgba(100,100,100,0.5)':cnt<=1?'var(--red-bright)':cnt<=3?'var(--amber)':'var(--green-dim)',flexShrink:0,minWidth:14,textAlign:'right'}}>{cnt>99?'∞':cnt}</span>
                </button>
              );
            })}
            <div className="label-xs" style={{marginTop:'0.28rem',marginBottom:'0.12rem'}}>▸ STATUS</div>
            {SHIPS.map(ship=>{
              const alive=playerGrid.some(r=>r.some(c=>c?.shipId===ship.id&&!c.hit));
              return (
                <div key={ship.id} style={{display:'flex',alignItems:'center',gap:'0.22rem',padding:'0.07rem 0',fontSize:'clamp(0.42rem,1.3vw,0.54rem)',fontFamily:'Share Tech Mono',color:alive?'var(--green-bright)':'rgba(192,57,43,0.5)',textDecoration:alive?'none':'line-through'}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:alive?'var(--green-bright)':'rgba(192,57,43,0.5)',flexShrink:0}}/>
                  {shipIcon(ship.id,10)}
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ship.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER: Enemy grid */}
        <div ref={enemyWrap} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'clamp(0.12rem,0.5vw,0.3rem)',overflow:'hidden',background:'var(--bg-void)',position:'relative'}}>
          <div className="label-xs" style={{marginBottom:'0.12rem',textAlign:'center',flexShrink:0}}>
            {isAdvanced?`▸ ${level.codename} — SOLVE y=mx+b`:`▸ ${level.codename} — TAP OR ENTER COORDS`}
          </div>
          {enemyPx>0 && <CoordGrid grid={enemyGrid} showShips={false} interactive={isMyTurn} onCellClick={(x,y)=>{play('click');setInputX(String(x));setInputY(String(y));setHL({x,y});setLineX(String(x));}} highlight={highlight||advTarget} size={enemyPx} revealedCells={revealedCells}/>}
          {aiThink && (
            <div style={{position:'absolute',inset:0,background:'rgba(2,12,4,0.55)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{padding:'0.45rem 1.1rem',background:'rgba(70,50,5,0.9)',border:'1px solid var(--amber)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.6rem,1.8vw,0.8rem)',color:'var(--amber)',letterSpacing:'0.12em',animation:'aiPulse 0.8s ease-in-out infinite'}}>◌ TARGETING…</div>
            </div>
          )}
          {isLan && turn===2 && phase==='playing' && (
            <div style={{position:'absolute',inset:0,background:'rgba(2,12,4,0.45)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{padding:'0.4rem 1rem',background:'rgba(70,15,15,0.85)',border:'1px solid rgba(192,57,43,0.5)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.58rem,1.7vw,0.75rem)',color:'rgba(255,110,110,0.9)',letterSpacing:'0.1em',animation:'aiPulse 1.2s ease-in-out infinite'}}>● ENEMY IS TARGETING…</div>
            </div>
          )}
        </div>

        {/* RIGHT: Controls */}
        <div style={{width:'clamp(148px,23vw,218px)',background:'var(--bg-panel)',borderLeft:'var(--border-panel)',display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
          <div style={{display:'flex',borderBottom:'var(--border-panel)',flexShrink:0}}>
            {[{id:'attack',label:'🎯 FIRE'},{id:'fleet',label:'🚢 FLEET'},{id:'log',label:'📋 LOG'}].map(({id,label})=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{flex:1,padding:'clamp(0.26rem,0.85vw,0.36rem)',background:activeTab===id?'rgba(90,173,94,0.12)':'transparent',border:'none',borderBottom:`2px solid ${activeTab===id?'var(--green-bright)':'transparent'}`,color:activeTab===id?'var(--green-accent)':'var(--green-dim)',fontSize:'clamp(0.4rem,1.25vw,0.52rem)',fontFamily:'Share Tech Mono',cursor:'pointer',transition:'all 0.15s',letterSpacing:'0.05em'}}>
                {label}
              </button>
            ))}
          </div>

          {activeTab==='attack' && (
            <div style={{flex:1,overflowY:'auto',padding:'clamp(0.32rem,1.1vw,0.52rem)',display:'flex',flexDirection:'column',gap:'0.32rem'}}>
              {!isAdvanced ? (
                [{ label:'X', val:inputX, set:setInputX },{ label:'Y', val:inputY, set:setInputY }].map(({label,val,set})=>(
                  <div key={label}>
                    <div style={{fontSize:'clamp(0.42rem,1.2vw,0.52rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',marginBottom:'0.13rem',letterSpacing:'0.12em'}}>{label} COORDINATE</div>
                    <input className="game-input" placeholder="-10 to 10" value={val} type="number" min={-10} max={10}
                      onChange={e=>{set(e.target.value);const xi=parseInt(label==='X'?e.target.value:inputX),yi=parseInt(label==='Y'?e.target.value:inputY);if(!isNaN(xi)&&!isNaN(yi))setHL({x:xi,y:yi});}}
                      onKeyDown={e=>e.key==='Enter'&&handleFire()}
                      style={{width:'100%',minHeight:52,fontSize:'clamp(0.9rem,2.8vw,1.08rem)',textAlign:'center',fontFamily:'Share Tech Mono',letterSpacing:'0.1em'}}/>
                  </div>
                ))
              ) : (
                <>
                  <div style={{padding:'0.28rem 0.38rem',background:'rgba(232,160,0,0.08)',border:'1px solid rgba(232,160,0,0.25)',fontSize:'clamp(0.5rem,1.6vw,0.62rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',textAlign:'center',letterSpacing:'0.06em'}}>y = mx + b</div>
                  {[{label:'M',key:'m',val:lineM,set:setLineM,ph:'slope'},{label:'B',key:'b',val:lineB,set:setLineB,ph:'intercept'},{label:'X',key:'x',val:lineX,set:setLineX,ph:'x value'}].map(({label,key,val,set,ph})=>(
                    <div key={key}>
                      <div style={{fontSize:'clamp(0.42rem,1.2vw,0.52rem)',color:'var(--green-dim)',fontFamily:'Share Tech Mono',marginBottom:'0.12rem',letterSpacing:'0.08em'}}>{label} ({ph})</div>
                      <input className="game-input" placeholder={ph} value={val} onChange={e=>set(e.target.value)} type="number"
                        style={{width:'100%',minHeight:44,fontSize:'clamp(0.82rem,2.5vw,0.98rem)',textAlign:'center',fontFamily:'Share Tech Mono'}}/>
                    </div>
                  ))}
                  {advTarget && isValidCoord(advTarget.x,advTarget.y) && (
                    <div style={{padding:'0.25rem 0.35rem',background:'rgba(232,160,0,0.06)',border:'1px solid rgba(232,160,0,0.18)',fontSize:'clamp(0.5rem,1.6vw,0.62rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',textAlign:'center'}}>→ ({advTarget.x},{advTarget.y})</div>
                  )}
                </>
              )}
              <div style={{padding:'0.28rem 0.38rem',background:`${WPN_COLOR[selWpn.id]}0e`,border:`1px solid ${WPN_COLOR[selWpn.id]}2e`,display:'flex',alignItems:'center',gap:'0.28rem'}}>
                <GameIcon id={selWpn.id} size={15}/>
                <div style={{flex:1,overflow:'hidden'}}>
                  <div style={{fontSize:'clamp(0.46rem,1.4vw,0.58rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:WPN_COLOR[selWpn.id]}}>{selWpn.name}</div>
                  <div style={{fontSize:'clamp(0.38rem,1.1vw,0.48rem)',fontFamily:'Share Tech Mono',color:'var(--white-dim)'}}>{selWpn.desc}</div>
                </div>
                <span style={{fontSize:'clamp(0.46rem,1.4vw,0.58rem)',fontFamily:'Share Tech Mono',fontWeight:700,color:wpnCnt[selWpn.id]===0?'rgba(100,100,100,0.5)':wpnCnt[selWpn.id]<=3?'var(--red-bright)':'var(--amber)',flexShrink:0}}>{wpnCnt[selWpn.id]>99?'∞':wpnCnt[selWpn.id]}</span>
              </div>
              <button onClick={handleFire} disabled={!isMyTurn}
                style={{width:'100%',minHeight:54,marginTop:'auto',background:isMyTurn?'rgba(160,35,35,0.28)':'rgba(18,18,18,0.45)',border:`1px solid ${isMyTurn?'#e05050':'rgba(90,173,94,0.14)'}`,color:isMyTurn?'#ff8888':'rgba(90,173,94,0.3)',boxShadow:isMyTurn?'0 0 20px rgba(192,57,43,0.38)':'none',fontFamily:'Share Tech Mono',fontSize:'clamp(0.72rem,2.2vw,0.88rem)',fontWeight:700,letterSpacing:'0.2em',cursor:isMyTurn?'pointer':'not-allowed',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.38rem',clipPath:isMyTurn?'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))':'none'}}>
                <GameIcon id="rocket" size={15}/>
                {isMyTurn ? (pendingShot ? `🚀 ${SKILLS.find(s=>s.id===pendingShot)?.name.toUpperCase()||'SKILL'}` : 'FIRE!') : aiThink?'⟳ WAIT':'● STANDBY'}
              </button>
            </div>
          )}

          {activeTab==='fleet' && (
            <div style={{flex:1,overflowY:'auto',padding:'clamp(0.32rem,1.1vw,0.52rem)',display:'flex',flexDirection:'column',gap:'0.18rem'}}>
              <div className="label-xs" style={{marginBottom:'0.22rem'}}>▸ ENEMY FLEET</div>
              {SHIPS.map(ship=>{const sunk=enemyGrid.some(r=>r.some(c=>c?.shipId===ship.id))&&!enemyGrid.some(r=>r.some(c=>c?.shipId===ship.id&&!c.hit));return(<div key={ship.id} style={{display:'flex',alignItems:'center',gap:'0.28rem',padding:'0.18rem 0',borderBottom:'1px solid rgba(90,173,94,0.07)',fontSize:'clamp(0.48rem,1.5vw,0.6rem)',fontFamily:'Share Tech Mono',color:sunk?'rgba(192,57,43,0.5)':'var(--white-dim)',textDecoration:sunk?'line-through':'none'}}><div style={{width:4,height:4,borderRadius:'50%',background:sunk?'rgba(192,57,43,0.5)':'var(--green-dim)',flexShrink:0}}/>{shipIcon(ship.id,11)} {ship.name}<span style={{marginLeft:'auto',color:'var(--green-dim)',fontSize:'clamp(0.38rem,1.1vw,0.48rem)'}}>{ship.size}u</span>{sunk&&<GameIcon id="skull" size={10}/>}</div>);})}
              <div className="label-xs" style={{marginTop:'0.45rem',marginBottom:'0.22rem'}}>▸ YOUR FLEET</div>
              {SHIPS.map(ship=>{const alive=playerGrid.some(r=>r.some(c=>c?.shipId===ship.id&&!c.hit));return(<div key={ship.id} style={{display:'flex',alignItems:'center',gap:'0.28rem',padding:'0.18rem 0',borderBottom:'1px solid rgba(90,173,94,0.07)',fontSize:'clamp(0.48rem,1.5vw,0.6rem)',fontFamily:'Share Tech Mono',color:alive?'var(--green-bright)':'rgba(192,57,43,0.5)',textDecoration:alive?'none':'line-through'}}><div style={{width:4,height:4,borderRadius:'50%',background:alive?'var(--green-bright)':'rgba(192,57,43,0.5)',flexShrink:0}}/>{shipIcon(ship.id,11)} {ship.name}<span style={{marginLeft:'auto',color:'var(--green-dim)',fontSize:'clamp(0.38rem,1.1vw,0.48rem)'}}>{ship.size}u</span></div>);})}
            </div>
          )}

          {activeTab==='log' && (
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:'clamp(0.32rem,1.1vw,0.52rem)'}}>
              <div className="label-xs" style={{marginBottom:'0.22rem',flexShrink:0}}>▸ BATTLE LOG</div>
              <div ref={logRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.1rem'}}>
                {log.length===0
                  ? <div style={{color:'rgba(90,173,94,0.3)',fontFamily:'Share Tech Mono',fontSize:'clamp(0.5rem,1.5vw,0.6rem)',textAlign:'center',marginTop:'1rem'}}>AWAITING ORDERS…</div>
                  : log.map(e=>(<div key={e.id} className={`log-${e.type}`} style={{fontSize:'clamp(0.44rem,1.35vw,0.56rem)',fontFamily:'Share Tech Mono',padding:'0.09rem 0',borderBottom:'1px solid rgba(90,173,94,0.04)',lineHeight:1.4}}>{e.msg}</div>))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      <AttackFx fx={attackFx}/>
      {ScorePopup()}
      {EnemyShotAlert()}
      {SkillsModal()}
      {ConfirmExitModal()}
      {OpponentLeftModal()}
      {GameOver()}
    </div>
  );
}
