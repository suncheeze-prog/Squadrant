import React, { useState, useCallback, useEffect } from 'react';
import { AppProvider, useApp, THEMES } from './context/AppContext';
import LoginScreen          from './screens/LoginScreen';
import SignupScreen         from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ScoreboardScreen     from './screens/ScoreboardScreen';
import MainMenuScreen     from './screens/MainMenuScreen';
import ModeSelectScreen   from './screens/ModeSelectScreen';
import ShipPlacementScreen    from './screens/ShipPlacementScreen';
import DefensePlacementScreen from './screens/DefensePlacementScreen';
import GameScreen             from './screens/GameScreen';
import SettingsScreen     from './screens/SettingsScreen';
import LanLobbyScreen     from './screens/LanLobbyScreen';
import OnlineLobbyScreen  from './screens/OnlineLobbyScreen';
import HowToPlayScreen    from './screens/HowToPlayScreen';
import CreditsScreen      from './screens/CreditsScreen';
import { placeAIShips, placeAIDefenses, getGridConfig, createEmptyGrid, gcFromGrid } from './utils/gameLogic';
import { closeLan }       from './net/lan';
import { closeOnline }    from './net/online';
import { watchAuth, signOut } from './firebase.config';
import { getUserProfile }     from './utils/userProfile';
import { getLevel }           from './utils/levels';

const LEVEL_SCREENS = new Set([
  'ship-placement',
  'defense-placement',
  'ship-placement-p2',
  'defense-placement-p2',
  'game',
  'lan-waiting',
]);

const MENU_MUSIC_SCREENS = new Set([
  'login', 'signup', 'forgot',
  'main-menu', 'mode-select', 'settings', 'how-to-play', 'credits', 'scoreboard',
]);

const GAME_MUSIC_SCREENS = new Set([
  'ship-placement', 'defense-placement', 'ship-placement-p2', 'defense-placement-p2',
  'game', 'lan-waiting',
]);

function AppInner() {
  const { play, playMenuMusic, playGameMusic, stopMusic, audioResume } = useApp();
  const [screen, setScreen]       = useState('login');
  const [user, setUser]           = useState(null);
  const [gameMode, setMode]       = useState(null);
  const [gameConfig, setCfg]      = useState(null);
  const [p1Grid, setP1Grid]       = useState(null);
  const [p2Grid, setP2Grid]       = useState(null);
  const [lanSocket, setLanSocket] = useState(null);

  // Theater theme override — applies only to the active level's screens.
  // The player's saved global theme is restored on the menu automatically.
  const activeLevel = gameConfig?.difficulty ? getLevel(gameConfig.difficulty) : null;
  const levelTheme  = activeLevel && LEVEL_SCREENS.has(screen) ? THEMES[activeLevel.theme] : null;

  const go = useCallback((s) => setScreen(s), []);

  // ── Persistent auth: restore session on reload ──
  useEffect(() => {
    const unsub = watchAuth(async (fbUser) => {
      if (fbUser) {
        try {
          const profile = await getUserProfile(fbUser.uid);
          // Anonymous / orphan account (no Firestore profile) → force re-login
          if (!profile || !profile.username || fbUser.isAnonymous) {
            await signOut().catch(() => {});
            setUser(null);
            setScreen('login');
            return;
          }
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            username: profile.username,
            wins:   profile.wins   || 0,
            losses: profile.losses || 0,
          });
          // Auto-advance from auth screens to main-menu
          setScreen(curr => (curr === 'login' || curr === 'signup' || curr === 'forgot') ? 'main-menu' : curr);
        } catch (e) {
          console.warn('Profile load failed', e);
          await signOut().catch(() => {});
          setUser(null);
          setScreen('login');
        }
      } else {
        setUser(null);
        setScreen('login');
      }
    });
    return () => unsub();
  }, []);

  // ── gameStart listener — lives at App level so it survives screen changes
  useEffect(() => {
    if (!lanSocket) return;
    lanSocket.off('gameStart');
    lanSocket.on('gameStart', (gameData) => {
      setP1Grid(gameData.myGrid);
      // Enemy grid starts EMPTY — fog of war. Cells fill in as we attack via attackResult.
      const gc = gcFromGrid(gameData.myGrid);
      setP2Grid(createEmptyGrid(gc));
      setCfg(prev => ({ ...prev, yourTurn: gameData.yourTurn }));
      go('game');
    });
    return () => { lanSocket.off('gameStart'); };
  }, [lanSocket, go]);

  // ── Music
  useEffect(() => {
    if (MENU_MUSIC_SCREENS.has(screen)) playMenuMusic();
    else if (GAME_MUSIC_SCREENS.has(screen)) playGameMusic();
    else stopMusic();
  }, [screen, playMenuMusic, playGameMusic, stopMusic]);

  // ── Unlock AudioContext on first interaction
  useEffect(() => {
    const unlock = () => { audioResume(); };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click',      unlock, { once: true });
    window.addEventListener('keydown',    unlock, { once: true });
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click',      unlock);
      window.removeEventListener('keydown',    unlock);
    };
  }, [audioResume]);

  // ── Navigation callbacks
  const handleLogin = useCallback((u) => { setUser(u); go('main-menu'); }, [go]);

  const handleModeSelect = useCallback((m) => {
    setMode(m);
    if (m === 'lan')         go('lan-lobby');
    else if (m === 'online') go('online-lobby');
    else                     go('mode-select');
  }, [go]);

  const handleConfirm = useCallback(({ subMode, difficulty }) => {
    setCfg({ mode: gameMode, subMode, difficulty });
    setP1Grid(null);
    setP2Grid(null);
    go('ship-placement');
  }, [gameMode, go]);

  // After P1 finishes ship placement → P1 defense placement (all modes)
  const handleP1ShipsDone = useCallback((grid) => {
    setP1Grid(grid); // grid currently holds only ships
    go('defense-placement');
  }, [go]);

  // After P1 finishes defense placement → submit (LAN) or P2/AI phase
  const handleP1DefensesDone = useCallback((grid) => {
    setP1Grid(grid); // grid now holds ships + defenses

    if (gameConfig?.mode === 'lan') {
      // LAN: submit the full grid (ships + defenses) to host
      gameConfig.socket?.emit('submitGrid', { grid }, (res) => {
        if (res?.error) console.error('submitGrid error:', res.error);
      });
      go('lan-waiting');
      return;
    }

    if (gameMode === 'vs-computer') {
      const gc = getGridConfig(gameConfig?.difficulty);
      const aiWithShips = placeAIShips(gc);
      const aiFull = placeAIDefenses(aiWithShips);
      setP2Grid(aiFull);
      go('game');
    } else {
      go('ship-placement-p2');
    }
  }, [gameMode, gameConfig, go]);

  const handleP2ShipsDone = useCallback((grid) => {
    setP2Grid(grid);
    go('defense-placement-p2');
  }, [go]);

  const handleP2DefensesDone = useCallback((grid) => {
    setP2Grid(grid);
    go('game');
  }, [go]);

  const backToMenu = useCallback(() => {
    closeLan();
    closeOnline();
    setCfg(null);
    setP1Grid(null);
    setP2Grid(null);
    setLanSocket(null);
    go('main-menu');
  }, [go]);

  // ── LAN ready: either go to placement or directly to game
  const handleLanGameReady = useCallback((data) => {
    if (data.phase === 'placement') {
      setLanSocket(data.socket); // useEffect above attaches gameStart listener
      setCfg({
        mode: 'lan',
        difficulty: data.difficulty,
        socket: data.socket,
        roomId: data.roomId,
      });
      setP1Grid(null);
      setP2Grid(null);
      go('ship-placement');
      return;
    }

    // Direct gameStart (fallback path)
    setP1Grid(data.myGrid);
    setP2Grid(createEmptyGrid(gcFromGrid(data.myGrid)));
    setCfg({
      mode: 'lan',
      difficulty: data.difficulty,
      socket: data.socket,
      roomId: data.roomId,
      yourTurn: data.yourTurn,
    });
    go('game');
  }, [go]);

  // ── Render
  return (
    <div data-level={levelTheme ? activeLevel.id : undefined}
      style={{ width:'100dvw', height:'100dvh', position:'relative', overflow:'hidden', background:'var(--bg-void)', ...(levelTheme?.vars || {}) }}>

      {screen === 'login' &&
        <LoginScreen key="login"
          onLogin={handleLogin}
          onSignup={() => go('signup')}
          onForgot={() => go('forgot')} />}

      {screen === 'signup' &&
        <SignupScreen key="signup"
          onComplete={handleLogin}
          onBack={() => go('login')} />}

      {screen === 'forgot' &&
        <ForgotPasswordScreen key="forgot"
          onBack={() => go('login')} />}

      {screen === 'scoreboard' &&
        <ScoreboardScreen key="scoreboard"
          user={user}
          onBack={() => go('main-menu')} />}

      {screen === 'main-menu' &&
        <MainMenuScreen key="main" user={user} onSelect={handleModeSelect}
          onSettings={() => go('settings')}
          onHowToPlay={() => go('how-to-play')}
          onCredits={() => go('credits')}
          onScoreboard={() => go('scoreboard')}
          onLogout={async () => {
            play('click');
            closeLan(); closeOnline();
            try { await signOut(); } catch (e) {}
          }} />}

      {screen === 'settings' &&
        <SettingsScreen key="settings" onBack={() => go('main-menu')} onHowToPlay={() => go('how-to-play')} />}

      {screen === 'how-to-play' &&
        <HowToPlayScreen key="htp" onBack={() => go('main-menu')} />}

      {screen === 'credits' &&
        <CreditsScreen key="credits" onBack={() => go('main-menu')} />}

      {screen === 'mode-select' &&
        <ModeSelectScreen key="mode" mode={gameMode} onBack={() => go('main-menu')} onConfirm={handleConfirm} />}

      {screen === 'lan-lobby' &&
        <LanLobbyScreen key="lan" user={user} onBack={() => go('main-menu')} onGameReady={handleLanGameReady} />}

      {screen === 'online-lobby' &&
        <OnlineLobbyScreen key="online" user={user} onBack={() => go('main-menu')} onGameReady={handleLanGameReady} />}

      {screen === 'ship-placement' &&
        <ShipPlacementScreen key="place1"
          difficulty={gameConfig?.difficulty}
          playerLabel={gameMode === 'vs-computer' ? 'SQUAD 1 — SHIPS' : 'PLAYER 1 — SHIPS'}
          onDone={handleP1ShipsDone} onBack={() => go('mode-select')} />}

      {screen === 'defense-placement' && p1Grid &&
        <DefensePlacementScreen key="defense1"
          shipGrid={p1Grid}
          playerLabel={gameMode === 'vs-computer' ? 'SQUAD 1 — DEFENSES' : 'PLAYER 1 — DEFENSES'}
          onDone={handleP1DefensesDone} onBack={() => go('ship-placement')} />}

      {screen === 'ship-placement-p2' &&
        <ShipPlacementScreen key="place2"
          difficulty={gameConfig?.difficulty}
          playerLabel="PLAYER 2 — SHIPS"
          onDone={handleP2ShipsDone} onBack={() => go('defense-placement')} />}

      {screen === 'defense-placement-p2' && p2Grid &&
        <DefensePlacementScreen key="defense2"
          shipGrid={p2Grid}
          playerLabel="PLAYER 2 — DEFENSES"
          onDone={handleP2DefensesDone} onBack={() => go('ship-placement-p2')} />}

      {screen === 'game' && p1Grid && (p2Grid || gameConfig?.mode === 'lan') &&
        <GameScreen key="game" user={user} config={gameConfig} p1Grid={p1Grid} p2Grid={p2Grid} onBack={backToMenu} />}

      {screen === 'lan-waiting' && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(2,12,4,0.97)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1rem',
        }}>
          <div className="title-font" style={{
            fontSize: '1.5rem', color: 'var(--green-bright)',
            letterSpacing: '0.15em', animation: 'pulse 1.5s infinite',
          }}>
            ⏳ WAITING FOR OPPONENT...
          </div>
          <div style={{ fontSize: '0.7rem', fontFamily: 'Share Tech Mono', color: 'var(--white-dim)' }}>
            Fleet deployed — standby for battle
          </div>
          <button className="btn" onClick={backToMenu} style={{ marginTop: '1rem', fontSize: '0.65rem' }}>
            ABORT MISSION
          </button>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return <AppProvider><AppInner /></AppProvider>;
}