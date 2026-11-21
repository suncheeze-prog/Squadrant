import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  lanAvailable, createHostSession, createGuestSession,
  startScan, closeLan,
} from '../net/lan';
import GameIcon from '../components/GameIcon';

/* ─────────────────────────────────────────────────────────────
   MATCHMAKING LOADER
───────────────────────────────────────────────────────────── */
function MatchmakingLoader({ text = 'SEARCHING...', sub = '' }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', background: 'rgba(2,12,4,0.97)',
    }}>
      <video autoPlay muted loop playsInline
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.3 }}
        onError={e => e.target.style.display='none'}>
        <source src="/matchmaking.mp4" type="video/mp4"/>
      </video>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(2,12,4,0.92) 0%,rgba(2,12,4,0.7) 50%,rgba(2,12,4,0.92) 100%)' }}/>
      <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)' }}/>

      <div style={{ position:'relative', zIndex:10, textAlign:'center', padding:'2rem' }}>
        <div style={{ width:110, height:110, margin:'0 auto 1.8rem', position:'relative' }}>
          <svg viewBox="0 0 120 120" style={{ width:'100%', height:'100%', animation:'spin 2s linear infinite' }}>
            <style>{'@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'}</style>
            {[1,2,3].map(i=><circle key={i} cx={60} cy={60} r={i*18} fill="none" stroke="rgba(90,173,94,0.3)" strokeWidth="1"/>)}
            <line x1={60} y1={60} x2={60} y2={8} stroke="var(--green-bright)" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx={60} cy={60} r={3} fill="var(--green-bright)"/>
          </svg>
          {[0.3,0.6,1.0].map((s,i)=>(
            <div key={i} style={{ position:'absolute', top:'50%', left:'50%', width:8, height:8, borderRadius:'50%', background:'var(--green-bright)', transform:`translate(-50%,-50%) rotate(${i*120}deg) translateY(-${28+i*16}px)`, animation:`pulse 1.5s ${i*0.3}s infinite`, opacity:s }}/>
          ))}
        </div>
        <div className="title-font" style={{ fontSize:'clamp(1.3rem,5.5vw,1.8rem)', color:'var(--green-bright)', letterSpacing:'0.15em' }}>
          {text}<span style={{opacity:0.6}}>{dots}</span>
        </div>
        {sub && <div style={{ marginTop:'0.5rem', fontSize:'clamp(0.62rem,2.5vw,0.78rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono' }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN LAN LOBBY SCREEN — serverless (hotspot + NSD)
───────────────────────────────────────────────────────────── */
export default function LanLobbyScreen({ user, onBack, onGameReady }) {
  const { play } = useApp();

  // phase: 'choose' | 'hosting' | 'scanning' | 'room'
  const [phase, setPhase]         = useState('choose');
  const [role, setRole]           = useState(null);
  const [hostDifficulty, setDiff] = useState('easy');

  const [myRoom, setMyRoom]       = useState(null);
  const [isReady, setIsReady]     = useState(false);
  const [chatLog, setChatLog]     = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [statusMsg, setStatus]    = useState('');
  const [error, setError]         = useState('');

  const [hostInfo, setHostInfo]   = useState(null);   // { ip, port, roomName }
  const [foundHosts, setFound]    = useState([]);     // [{ name, host, port, difficulty, hostName }]

  const [isLoading, setLoading]   = useState(false);
  const [loadText, setLoadText]   = useState('');
  const [loadSub, setLoadSub]     = useState('');

  const socketRef   = useRef(null);
  const scanRef     = useRef(null);
  const chatRef     = useRef(null);
  const myRoomRef   = useRef(null);
  const keepSession = useRef(false);

  useEffect(() => { myRoomRef.current = myRoom; }, [myRoom]);

  const addChat = useCallback((from, text, type='msg') => {
    setChatLog(l => [...l.slice(-80), { from, text, type, id: Date.now()+Math.random() }]);
    setTimeout(()=>{ if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 60);
  }, []);

  const showLoader = (text, sub='') => { setLoadText(text); setLoadSub(sub); setLoading(true); };
  const hideLoader = () => setLoading(false);

  /* ── attach socket listeners shared by host & guest ── */
  const attachListeners = useCallback((sock) => {
    sock.off('roomUpdate'); sock.on('roomUpdate', (room) => setMyRoom(room));
    sock.off('chatMsg');    sock.on('chatMsg',    ({ from, text }) => addChat(from, text));

    sock.off('playerLeft'); sock.on('playerLeft', ({ name, room }) => {
      addChat('SYSTEM', `${name} left`, 'sys');
      play('leave');
      setMyRoom(room);
      setIsReady(false);
    });

    sock.off('startPlacement'); sock.on('startPlacement', ({ difficulty }) => {
      showLoader('DEPLOYING FLEET', 'Prepare your ships...');
      setTimeout(() => {
        hideLoader();
        keepSession.current = true; // keep the LAN session alive into the game
        onGameReady({
          phase: 'placement',
          socket: sock,
          roomId: myRoomRef.current?.id,
          difficulty,
        });
      }, 1600);
    });

    sock.off('disconnect'); sock.on('disconnect', () => {
      setStatus('Connection lost');
      setError('The other device disconnected.');
      setPhase('choose');
      setRole(null); setMyRoom(null); setIsReady(false); setChatLog([]);
      hideLoader();
    });
  }, [addChat, play, onGameReady]);

  /* ── HOST ── */
  const handleHost = useCallback(async () => {
    if (!lanAvailable()) { setError('LAN multiplayer only works in the installed Android app.'); return; }
    setError('');
    setRole('host');
    showLoader('STARTING HOST', 'Opening room on this device...');
    try {
      const session = await createHostSession({
        name: user?.username || 'Commander',
        difficulty: hostDifficulty,
      });
      socketRef.current = session.socket;
      attachListeners(session.socket);
      setHostInfo({ ip: session.ip, port: session.port, roomName: session.roomName });
      setMyRoom(session.room);
      setPhase('hosting');
      hideLoader();
      play('join');
      setStatus('Hosting! Tell the other player to tap JOIN GAME.');
    } catch (e) {
      hideLoader();
      setError(`Could not start host: ${e.message || e}`);
      setRole(null);
    }
  }, [user, hostDifficulty, attachListeners, play]);

  /* ── JOIN: start scanning ── */
  const handleStartScan = useCallback(async () => {
    if (!lanAvailable()) { setError('LAN multiplayer only works in the installed Android app.'); return; }
    setError('');
    setRole('guest');
    setFound([]);
    setPhase('scanning');
    play('select');
    try {
      scanRef.current = await startScan(
        (svc) => setFound(prev => {
          const key = `${svc.host}:${svc.port}`;
          if (prev.some(p => `${p.host}:${p.port}` === key)) return prev;
          return [...prev, svc];
        }),
        (svc) => setFound(prev => prev.filter(p => p.name !== svc.name)),
      );
    } catch (e) {
      setError(`Scan failed: ${e.message || e}`);
      setPhase('choose');
      setRole(null);
    }
  }, [play]);

  const stopScan = useCallback(async () => {
    if (scanRef.current) { await scanRef.current.stop(); scanRef.current = null; }
  }, []);

  /* ── JOIN: connect to a discovered host ── */
  const handleConnect = useCallback(async (svc) => {
    showLoader('CONNECTING', `Joining ${svc.hostName || svc.name}...`);
    try {
      await stopScan();
      const session = await createGuestSession({
        host: svc.host, port: svc.port,
        name: user?.username || 'Commander',
      });
      socketRef.current = session.socket;
      attachListeners(session.socket);
      setPhase('room');
      hideLoader();
      play('join');
      addChat('SYSTEM', `Connected to ${svc.hostName || svc.name}`, 'sys');
      setStatus('Connected! Ready up to start.');
    } catch (e) {
      hideLoader();
      setError(`Could not connect: ${e.message || e}`);
      setPhase('scanning');
      handleStartScan();
    }
  }, [user, attachListeners, stopScan, play, addChat, handleStartScan]);

  /* ── Ready toggle ── */
  const handleReady = useCallback(() => {
    const next = !isReady;
    setIsReady(next);
    play('click');
    socketRef.current?.emit('setReady', { ready: next });
  }, [isReady, play]);

  /* ── Chat ── */
  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chatMsg', { text: chatInput });
    addChat(user?.username || 'Me', chatInput, 'own');
    setChatInput('');
  }, [chatInput, user, addChat]);

  /* ── Cleanup on unmount (unless leaving into the game) ── */
  useEffect(() => () => {
    if (scanRef.current) scanRef.current.stop();
    if (!keepSession.current) closeLan();
  }, []);

  /* ── Back ── */
  const handleBack = useCallback(async () => {
    play('click');
    if (phase === 'choose') { onBack(); return; }
    socketRef.current?.emit('leaveRoom');
    await stopScan();
    await closeLan();
    socketRef.current = null;
    setPhase('choose'); setRole(null); setMyRoom(null);
    setIsReady(false); setChatLog([]); setError(''); setHostInfo(null); setFound([]);
  }, [phase, play, onBack, stopScan]);

  /* ── UI bits ── */
  const diffs = [
    { id:'easy',     label:'EASY',     color:'#2d8a30' },
    { id:'average',  label:'AVERAGE',  color:'#a08020' },
    { id:'advanced', label:'ADVANCED', color:'#8a2020' },
  ];
  const panel = { background:'var(--bg-card)', border:'var(--border-panel)', borderRadius:2, padding:'clamp(0.8rem,3vw,1.2rem)' };

  const RoomWaitPanel = () => {
    if (!myRoom) return null;
    const myId = socketRef.current?.id;
    return (
      <>
        <div style={panel}>
          <div className="label-xs" style={{ marginBottom:'0.75rem' }}>▸ SQUAD — {myRoom.players.length < 2 ? 'WAITING FOR OPPONENT' : 'BOTH PLAYERS JOINED'}</div>
          <div style={{ display:'flex', gap:'0.8rem', flexWrap:'wrap' }}>
            {[0,1].map(i => {
              const p    = myRoom.players[i];
              const isMe = p?.id === myId;
              return (
                <div key={i} style={{ flex:'1 1 130px', minHeight:85, padding:'0.7rem', background:p?'rgba(90,173,94,0.08)':'rgba(20,40,20,0.25)', border:`1px solid ${p?.ready?'var(--green-bright)':'rgba(90,173,94,0.18)'}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.35rem', transition:'all 0.3s', clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))' }}>
                  {p ? (
                    <>
                      <span style={{ fontSize:'clamp(1.3rem,5vw,1.8rem)' }}>🎖️</span>
                      <div style={{ fontWeight:700, fontSize:'clamp(0.6rem,2.3vw,0.75rem)', fontFamily:'Share Tech Mono', color:'var(--white-cream)', textAlign:'center' }}>
                        {p.name}{isMe?' (YOU)':''}
                      </div>
                      <div style={{ fontSize:'clamp(0.5rem,1.8vw,0.62rem)', fontFamily:'Share Tech Mono', color:p.ready?'var(--green-bright)':'var(--amber)', animation:!p.ready?'pulse 1.5s infinite':'' }}>
                        {p.ready ? '✓ READY' : '⏳ NOT READY'}
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize:'1.4rem', opacity:0.25 }}>?</span>
                      <div style={{ fontSize:'clamp(0.5rem,1.8vw,0.6rem)', fontFamily:'Share Tech Mono', color:'var(--green-dim)', animation:'pulse 2s infinite' }}>WAITING...</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.7rem' }}>
            <button className={`btn ${isReady?'btn-danger':'btn-primary'}`} onClick={handleReady}
              disabled={myRoom.players.length < 2}
              style={{ flex:1, padding:'clamp(0.5rem,2vw,0.7rem)', fontSize:'clamp(0.62rem,2.3vw,0.78rem)', letterSpacing:'0.12em', opacity:myRoom.players.length<2?0.45:1 }}>
              {isReady ? '✕ CANCEL' : '✓ READY UP'}
            </button>
          </div>

          {myRoom.players.length === 2 && myRoom.players.every(p=>p.ready) && (
            <div style={{ marginTop:'0.6rem', textAlign:'center', fontSize:'clamp(0.58rem,2vw,0.7rem)', fontFamily:'Share Tech Mono', color:'var(--green-bright)', animation:'pulse 0.9s infinite' }}>
              ▶ ALL READY — STARTING GAME...
            </div>
          )}
        </div>

        <div style={panel}>
          <div className="label-xs" style={{ marginBottom:'0.45rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>▸ TACTICAL COMMS</span>
            <span style={{ fontSize:'0.5rem', opacity:0.5, letterSpacing:'0.1em' }}>{chatLog.length} MSG</span>
          </div>

          {/* Chat messages — styled bubbles */}
          <div ref={chatRef} style={{
            height: 150, overflowY:'auto',
            display:'flex', flexDirection:'column', gap:'0.32rem',
            marginBottom:'0.45rem', padding:'0.45rem',
            background:'var(--bg-void)', border:'var(--border-panel)',
          }}>
            {chatLog.length === 0
              ? <div style={{ color:'rgba(90,173,94,0.3)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.55rem,1.9vw,0.65rem)', textAlign:'center', marginTop:'1.2rem', letterSpacing:'0.15em' }}>
                  ◆ NO MESSAGES YET ◆<br/>
                  <span style={{ fontSize:'0.85em', opacity:0.7 }}>Be the first to drop a comm</span>
                </div>
              : chatLog.map(m => {
                  const own = m.type === 'own';
                  const sys = m.type === 'sys';
                  return (
                    <div key={m.id} style={{
                      display:'flex',
                      justifyContent: sys ? 'center' : own ? 'flex-end' : 'flex-start',
                      animation:'slideUp 0.2s ease',
                    }}>
                      <div style={{
                        maxWidth:'80%',
                        padding: sys ? '0.18rem 0.55rem' : '0.32rem 0.55rem',
                        background: sys
                          ? 'rgba(232,160,0,0.08)'
                          : own
                            ? 'color-mix(in srgb, var(--accent1) 18%, transparent)'
                            : 'rgba(40,40,40,0.6)',
                        border:`1px solid ${sys ? 'rgba(232,160,0,0.3)' : own ? 'var(--accent1)' : 'rgba(120,120,120,0.35)'}`,
                        clipPath: sys ? undefined :
                          own
                            ? 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                            : 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                        fontFamily:'Share Tech Mono',
                        fontSize:'clamp(0.5rem,1.8vw,0.65rem)',
                        color: sys ? 'var(--amber)' : 'var(--white-cream)',
                        lineHeight:1.4,
                        textAlign: sys ? 'center' : 'left',
                      }}>
                        {!sys && (
                          <div style={{
                            fontSize:'0.85em', fontWeight:700,
                            color: own ? 'var(--accent1)' : 'var(--green-dim)',
                            marginBottom:'0.1rem', letterSpacing:'0.05em',
                          }}>
                            {own ? 'YOU' : m.from}
                          </div>
                        )}
                        {sys && '▸ '}{m.text}
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* Quick-reaction buttons */}
          <div style={{ display:'flex', gap:'0.25rem', marginBottom:'0.45rem', flexWrap:'wrap' }}>
            {['👍 GG', '🔥 Lucky!', '⚓ Bring it', '😂 Lol', '🎯 Nice shot', '⚠ Watch out'].map(q => (
              <button key={q} onClick={() => { setChatInput(q); setTimeout(() => { socketRef.current?.emit('chatMsg', { text: q }); addChat(user?.username || 'Me', q, 'own'); setChatInput(''); }, 0); }}
                style={{
                  padding:'0.22rem 0.45rem',
                  background:'rgba(10,22,11,0.7)',
                  border:'1px solid rgba(90,173,94,0.25)',
                  color:'var(--white-dim)',
                  fontFamily:'Share Tech Mono',
                  fontSize:'clamp(0.48rem,1.7vw,0.6rem)',
                  cursor:'pointer',
                  letterSpacing:'0.03em',
                  transition:'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent1) 15%, transparent)'; e.currentTarget.style.borderColor = 'var(--accent1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,22,11,0.7)'; e.currentTarget.style.borderColor = 'rgba(90,173,94,0.25)'; }}>
                {q}
              </button>
            ))}
          </div>

          {/* Input + send */}
          <div style={{ display:'flex', gap:'0.4rem' }}>
            <input className="game-input"
              placeholder="Type a message..."
              value={chatInput}
              maxLength={120}
              onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&sendChat()}
              style={{ flex:1, padding:'0.4rem 0.55rem', fontSize:'clamp(0.62rem,2.2vw,0.75rem)', minHeight:38 }}/>
            <button className="btn" onClick={sendChat} disabled={!chatInput.trim()}
              style={{
                padding:'0.4rem 0.85rem', fontSize:'0.85rem', flexShrink:0,
                opacity: chatInput.trim() ? 1 : 0.4,
                background: chatInput.trim() ? 'color-mix(in srgb, var(--accent1) 25%, transparent)' : undefined,
                borderColor: chatInput.trim() ? 'var(--accent1)' : undefined,
              }}>
              ▶
            </button>
          </div>
        </div>
      </>
    );
  };

  /* ── Render ── */
  return (
    <div className="screen" style={{ background:'var(--bg-void)', overflowY:'auto' }}>
      {isLoading && <MatchmakingLoader text={loadText} sub={loadSub}/>}

      {/* Header */}
      <div style={{ padding:'clamp(0.6rem,2.5vw,1rem) clamp(0.8rem,3vw,1.4rem)', borderBottom:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.7rem', background:'var(--bg-panel)', position:'sticky', top:0, zIndex:20, flexShrink:0 }}>
        <button className="back-btn" onClick={handleBack} aria-label="Back"><GameIcon id="back" size={15}/></button>
        <div>
          <div className="label-xs">LAN — HOTSPOT / WI-FI</div>
          <h2 className="title-font" style={{ fontSize:'clamp(0.95rem,4vw,1.3rem)', color:'var(--white-cream)', lineHeight:1.1 }}>
            { phase==='choose'   ? 'LOCAL MULTIPLAYER'
            : phase==='hosting'  ? `HOSTING: ${hostInfo?.roomName || ''}`
            : phase==='scanning' ? 'NEARBY GAMES'
            : 'ROOM' }
          </h2>
        </div>
        {phase !== 'choose' && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'clamp(0.48rem,1.6vw,0.6rem)', fontFamily:'Share Tech Mono', color:'var(--green-bright)', flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green-bright)', animation:'pulse 2s infinite' }}/>
            {role==='host' ? 'HOST' : 'GUEST'}
          </div>
        )}
      </div>

      <div style={{ padding:'clamp(0.75rem,3vw,1.3rem)', display:'flex', flexDirection:'column', gap:'clamp(0.65rem,2.5vw,1rem)', maxWidth:660, width:'100%', margin:'0 auto' }}>

        {error && (
          <div style={{ padding:'0.55rem 0.7rem', background:'rgba(192,57,43,0.12)', border:'1px solid rgba(192,57,43,0.35)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.55rem,2vw,0.68rem)', color:'#ff8a80', lineHeight:1.6 }}>
            ⚠ {error}
          </div>
        )}

        {/* CHOOSE */}
        {phase === 'choose' && (
          <>
            <div style={{ textAlign:'center', padding:'clamp(0.5rem,2vw,0.8rem) 0' }}>
              <div className="label-xs" style={{ letterSpacing:'0.3em', marginBottom:'0.4rem' }}>NO SERVER · NO INTERNET · INSTANT LAN</div>
              <div style={{ width:40, height:2, background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)', margin:'0 auto' }}/>
            </div>

            <div style={panel}>
              <div className="label-xs" style={{ marginBottom:'0.6rem', color:'var(--green-bright)' }}>▸ DIFFICULTY (for hosting)</div>
              <div style={{ display:'flex', gap:'0.4rem' }}>
                {diffs.map(d=>(
                  <button key={d.id} onClick={()=>setDiff(d.id)}
                    style={{ flex:1, padding:'0.4rem', background:hostDifficulty===d.id?`${d.color}33`:'transparent', border:`1px solid ${hostDifficulty===d.id?d.color:'rgba(90,173,94,0.2)'}`, color:hostDifficulty===d.id?d.color:'var(--white-dim)', fontSize:'clamp(0.5rem,1.8vw,0.62rem)', fontFamily:'Share Tech Mono', cursor:'pointer', minHeight:36 }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleHost}
              style={{ padding:'clamp(0.8rem,3.5vw,1.1rem)', fontSize:'clamp(0.8rem,3.5vw,1rem)', letterSpacing:'0.18em' }}>
              🏠 HOST GAME
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ flex:1, height:1, background:'rgba(90,173,94,0.15)' }}/>
              <div className="label-xs" style={{ flexShrink:0 }}>OR</div>
              <div style={{ flex:1, height:1, background:'rgba(90,173,94,0.15)' }}/>
            </div>

            <button className="btn" onClick={handleStartScan}
              style={{ padding:'clamp(0.8rem,3.5vw,1.1rem)', fontSize:'clamp(0.8rem,3.5vw,1rem)', letterSpacing:'0.18em', background:'rgba(232,160,0,0.15)', borderColor:'rgba(232,160,0,0.4)', color:'var(--amber)' }}>
              🎮 JOIN GAME
            </button>

            <div style={{ ...panel, borderColor:'rgba(232,160,0,0.2)' }}>
              <div className="label-xs" style={{ marginBottom:'0.6rem', color:'var(--amber)' }}>▸ HOW IT WORKS</div>
              {[
                ['1','One player turns on their Mobile Hotspot'],
                ['2','Everyone else connects to that hotspot WiFi'],
                ['3','Host taps HOST GAME — guests tap JOIN GAME'],
                ['4','Games appear automatically — tap to connect'],
                ['5','Both READY UP and the battle begins'],
              ].map(([n,t])=>(
                <div key={n} style={{ display:'flex', gap:'0.45rem', padding:'0.22rem 0', borderBottom:'1px solid rgba(90,173,94,0.06)' }}>
                  <div style={{ width:16, height:16, background:'var(--green-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.5rem', fontFamily:'Share Tech Mono', color:'var(--green-accent)', flexShrink:0 }}>{n}</div>
                  <span style={{ fontSize:'clamp(0.58rem,2.1vw,0.7rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', lineHeight:1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* HOSTING */}
        {phase === 'hosting' && (
          <>
            <div style={panel}>
              <div className="label-xs" style={{ marginBottom:'0.5rem', color:'var(--green-bright)' }}>📡 BROADCASTING ON THIS NETWORK</div>
              <div style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2.3vw,0.75rem)', color:'var(--white-dim)', lineHeight:1.7 }}>
                Your game is now discoverable. Other players just tap <span style={{color:'var(--amber)'}}>JOIN GAME</span> — no IP address needed.
              </div>
              <div style={{ marginTop:'0.6rem', display:'flex', gap:'1rem', flexWrap:'wrap', fontFamily:'Share Tech Mono', fontSize:'clamp(0.55rem,2vw,0.68rem)' }}>
                <div><div className="label-xs">DEVICE IP</div><div style={{ color:'var(--green-accent)' }}>{hostInfo?.ip}</div></div>
                <div><div className="label-xs">PORT</div><div style={{ color:'var(--amber)' }}>{hostInfo?.port}</div></div>
              </div>
            </div>
            <RoomWaitPanel/>
          </>
        )}

        {/* SCANNING */}
        {phase === 'scanning' && (
          <>
            <div style={panel}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.65rem' }}>
                <div className="label-xs">▸ NEARBY GAMES</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'clamp(0.52rem,1.8vw,0.64rem)', fontFamily:'Share Tech Mono', color:'var(--green-bright)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green-bright)', animation:'pulse 1.2s infinite' }}/>
                  SCANNING
                </div>
              </div>
              {foundHosts.length === 0 ? (
                <div style={{ padding:'1.5rem', textAlign:'center', color:'rgba(90,173,94,0.3)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.58rem,2.2vw,0.7rem)', lineHeight:1.7 }}>
                  Searching for hosts on this network…<br/>
                  <span style={{fontSize:'0.85em',opacity:0.7}}>Make sure you're on the same hotspot / WiFi</span>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {foundHosts.map(r=>(
                    <div key={`${r.host}:${r.port}`} style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.55rem 0.75rem', background:'var(--bg-button)', border:'var(--border-panel)' }}>
                      <div style={{ flex:1, overflow:'hidden' }}>
                        <div style={{ fontWeight:700, fontSize:'clamp(0.62rem,2.3vw,0.78rem)', fontFamily:'Share Tech Mono', color:'var(--white-cream)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.hostName || r.name}</div>
                        <div className="label-xs" style={{ marginTop:'0.1rem' }}>{(r.difficulty||'easy').toUpperCase()} • {r.host}</div>
                      </div>
                      <button className="btn btn-primary" onClick={()=>handleConnect(r)}
                        style={{ padding:'0.35rem 0.7rem', fontSize:'clamp(0.52rem,1.7vw,0.62rem)', minHeight:32, flexShrink:0 }}>
                        JOIN
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {statusMsg && (
              <div style={{ padding:'0.4rem 0.6rem', background:'rgba(90,173,94,0.08)', border:'var(--border-panel)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.58rem,2vw,0.7rem)', color:'var(--green-bright)' }}>
                ▸ {statusMsg}
              </div>
            )}
          </>
        )}

        {/* ROOM (guest joined) */}
        {phase === 'room' && <RoomWaitPanel/>}

      </div>
    </div>
  );
}
