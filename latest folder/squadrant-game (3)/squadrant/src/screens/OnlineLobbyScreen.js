import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import GameIcon from '../components/GameIcon';
import {
  createOnlineRoom, joinOnlineRoom, quickMatch, closeOnline,
} from '../net/online';
import { detectPlatform, platformIcon, platformLabel, platformColor } from '../utils/platform';

const DIFFICULTIES = [
  { id: 'easy',     label: 'EASY',     desc: '10x10 grid · simple coords',     color: '#5aad5e' },
  { id: 'average',  label: 'AVERAGE',  desc: '15x15 grid · smarter AI logic',  color: '#e8a000' },
  { id: 'advanced', label: 'ADVANCED', desc: '10x10 grid · y=mx+b equation',   color: '#e05050' },
];

export default function OnlineLobbyScreen({ user, onBack, onGameReady }) {
  const { play } = useApp();
  const { isLandscape } = useOrientation();
  const [phase, setPhase]     = useState('choose');  // 'choose'|'create'|'join'|'room'|'loading'
  const [difficulty, setDiff] = useState('easy');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [room, setRoom]       = useState(null);     // { socket, roomId, code, players, ready, full, difficulty }
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog]     = useState([]);
  const keepSession = useRef(false);
  const chatScrollRef = useRef(null);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatLog]);

  const sendChatText = useCallback((text) => {
    const t = (text || '').trim();
    if (!t || !room?.socket) return;
    room.socket.emit('chatMsg', { text: t });
    setChatInput('');
  }, [room]);

  // ── Cleanup on unmount unless transitioning into placement ──
  useEffect(() => () => { if (!keepSession.current) closeOnline(); }, []);

  // ── Wire socket listeners when room is set ──
  useEffect(() => {
    if (!room?.socket) return;
    const sock = room.socket;
    sock.on('roomUpdate', (info) => {
      setRoom(prev => prev ? { ...prev, players: info.players, ready: info.ready, full: info.full, difficulty: info.difficulty } : prev);
    });
    sock.on('chatMsg', (msg) => setChatLog(prev => [...prev.slice(-30), msg]));
    sock.on('startPlacement', (data) => {
      keepSession.current = true;
      onGameReady({
        phase: 'placement',
        socket: sock,
        difficulty: data.difficulty,
        roomId: room.roomId,
      });
    });
    sock.on('playerLeft', ({ name, reason }) => {
      setError(`${name || 'Opponent'} left the room`);
      setPhase('choose');
      closeOnline();
    });
    return () => {
      sock.off('roomUpdate');
      sock.off('chatMsg');
      sock.off('startPlacement');
      sock.off('playerLeft');
    };
  }, [room?.socket]); // eslint-disable-line

  // ── Actions ──
  const handleCreate = async () => {
    setError(''); setPhase('loading'); play('select');
    try {
      const res = await createOnlineRoom({ name: user?.username || 'Host', difficulty });
      // Register self & set initial room state
      await new Promise(r => res.socket.emit('register', { name: user?.username || 'Host' }, r));
      setRoom({ ...res, players: [{ name: user?.username || 'Host', ready: false }], ready: false, full: false, difficulty });
      setPhase('room');
    } catch (e) {
      setError(e.message || 'Failed to create room');
      setPhase('choose');
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) { setError('Enter room code'); return; }
    setError(''); setPhase('loading'); play('select');
    try {
      const res = await joinOnlineRoom({ name: user?.username || 'Guest', code: code.trim() });
      await new Promise(r => res.socket.emit('register', { name: user?.username || 'Guest' }, r));
      setRoom({ ...res, players: [], ready: false, full: false, difficulty });
      setPhase('room');
    } catch (e) {
      setError(e.message || 'Failed to join');
      setPhase('choose');
    }
  };

  const handleQuick = async () => {
    setError(''); setPhase('loading'); play('select');
    try {
      const res = await quickMatch({ name: user?.username || 'Player', difficulty });
      await new Promise(r => res.socket.emit('register', { name: user?.username || 'Player' }, r));
      setRoom({ ...res, players: [], ready: false, full: false, difficulty });
      setPhase('room');
    } catch (e) {
      setError(e.message || 'Quick match failed');
      setPhase('choose');
    }
  };

  const handleReady = () => {
    if (!room?.socket) return;
    const newReady = !room.ready;
    play('click');
    room.socket.emit('setReady', { ready: newReady });
  };

  const handleLeave = () => {
    play('click');
    if (room?.socket) room.socket.emit('leaveRoom', {});
    closeOnline();
    setRoom(null);
    setPhase('choose');
    setChatLog([]);
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !room?.socket) return;
    room.socket.emit('chatMsg', { text: chatInput.trim() });
    setChatInput('');
  };

  // ── UI helpers ──
  const Header = () => (
    <div style={{
      padding:`max(0.55rem,var(--safe-top)) clamp(0.6rem,2.5vw,1.2rem) 0.55rem`,
      borderBottom:'var(--border-panel)',
      background:'var(--bg-panel)',
      display:'flex', alignItems:'center', gap:'0.6rem',
      flexShrink:0,
    }}>
      <button className="back-btn" onClick={() => { play('click'); onBack(); }}>
        <GameIcon id="back" size={16}/>
      </button>
      <div>
        <div className="label-xs" style={{ opacity:0.6, letterSpacing:'0.25em' }}>NETWORK // ONLINE PVP</div>
        <div className="title-font" style={{ fontSize:'clamp(0.95rem,3.2vw,1.25rem)', color:'var(--accent1)' }}>
          🌐 INTERNET BATTLE
        </div>
      </div>
    </div>
  );

  // ── Phase: CHOOSE (main menu of online options) ──
  if (phase === 'choose' || phase === 'loading') {
    return (
      <div className="screen" style={{ background:'var(--bg-void)', flexDirection:'column', overflow:'hidden' }}>
        <Header/>
        <div style={{
          flex:1, overflowY:'auto',
          padding:'clamp(0.8rem,3vw,1.4rem)',
          paddingBottom:'max(clamp(0.8rem,3vw,1.4rem), var(--safe-bottom))',
          display:'flex', flexDirection:'column', gap:'0.7rem',
          alignItems:'center', maxWidth:'min(560px,96vw)', margin:'0 auto', width:'100%',
        }}>

          {/* Difficulty picker */}
          <div style={{ width:'100%' }}>
            <div className="label-xs" style={{ marginBottom:'0.35rem', letterSpacing:'0.3em' }}>▸ DIFFICULTY</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.4rem' }}>
              {DIFFICULTIES.map(d => (
                <button key={d.id} onClick={() => { play('click'); setDiff(d.id); }}
                  style={{
                    padding:'0.55rem 0.4rem',
                    background: difficulty === d.id ? `${d.color}22` : 'var(--bg-button)',
                    border:`2px solid ${difficulty === d.id ? d.color : 'rgba(90,173,94,0.15)'}`,
                    color: difficulty === d.id ? d.color : 'var(--white-cream)',
                    fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.65rem,2.4vw,0.78rem)',
                    cursor:'pointer', clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <button onClick={handleQuick} disabled={phase === 'loading'}
            style={{
              width:'100%', padding:'clamp(0.9rem,3vw,1.2rem)',
              background:'rgba(40,80,42,0.4)', border:'1px solid var(--accent1)',
              color:'var(--accent1)',
              fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.8rem,2.8vw,0.95rem)',
              letterSpacing:'0.18em',
              boxShadow:'0 0 16px color-mix(in srgb, var(--accent1) 25%, transparent)',
              cursor:'pointer',
              clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
              display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem',
            }}>
            <div>⚡ QUICK MATCH</div>
            <div style={{ fontSize:'clamp(0.5rem,1.7vw,0.6rem)', opacity:0.7, fontWeight:400, letterSpacing:'0.05em' }}>
              Auto-pair with random opponent
            </div>
          </button>

          <button onClick={() => { play('click'); setError(''); setPhase('create'); handleCreate(); }} disabled={phase === 'loading'}
            style={{
              width:'100%', padding:'clamp(0.85rem,2.8vw,1.1rem)',
              background:'rgba(80,50,0,0.35)', border:'1px solid var(--amber)',
              color:'var(--amber)',
              fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.75rem,2.6vw,0.9rem)',
              letterSpacing:'0.18em', cursor:'pointer',
              clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
              display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem',
            }}>
            <div>🚪 CREATE ROOM</div>
            <div style={{ fontSize:'clamp(0.5rem,1.7vw,0.6rem)', opacity:0.7, fontWeight:400, letterSpacing:'0.05em' }}>
              Generate a code for your friend
            </div>
          </button>

          <button onClick={() => { play('click'); setError(''); setPhase('join'); }} disabled={phase === 'loading'}
            style={{
              width:'100%', padding:'clamp(0.85rem,2.8vw,1.1rem)',
              background:'rgba(10,40,80,0.35)', border:'1px solid #4090d0',
              color:'#80b0e0',
              fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.75rem,2.6vw,0.9rem)',
              letterSpacing:'0.18em', cursor:'pointer',
              clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
              display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem',
            }}>
            <div>🔑 JOIN ROOM</div>
            <div style={{ fontSize:'clamp(0.5rem,1.7vw,0.6rem)', opacity:0.7, fontWeight:400, letterSpacing:'0.05em' }}>
              Enter a friend's room code
            </div>
          </button>

          {error && (
            <div style={{
              padding:'0.5rem 0.75rem', background:'rgba(192,57,43,0.15)',
              border:'1px solid rgba(192,57,43,0.4)', color:'#ff9090',
              fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2vw,0.72rem)',
              width:'100%', textAlign:'center',
            }}>
              ⚠ {error}
            </div>
          )}

          {phase === 'loading' && (
            <div style={{
              fontFamily:'Share Tech Mono', color:'var(--accent1)',
              fontSize:'clamp(0.7rem,2.4vw,0.85rem)',
              animation:'blink 0.8s ease-in-out infinite', letterSpacing:'0.2em',
            }}>
              ⟳ CONNECTING...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: JOIN (code input) ──
  if (phase === 'join') {
    return (
      <div className="screen" style={{ background:'var(--bg-void)', flexDirection:'column', overflow:'hidden' }}>
        <Header/>
        <div style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'clamp(1rem,4vw,2rem)', gap:'1rem', maxWidth:'min(480px,94vw)', margin:'0 auto', width:'100%',
        }}>
          <div className="title-font" style={{ fontSize:'clamp(1.1rem,4vw,1.5rem)', color:'var(--accent1)', textAlign:'center' }}>
            🔑 ENTER ROOM CODE
          </div>
          <input
            className="game-input"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="ABCDE"
            style={{
              fontSize:'clamp(1.5rem,6vw,2.2rem)', textAlign:'center',
              letterSpacing:'0.4em', minHeight:60, fontFamily:'Share Tech Mono',
              fontWeight:700, color:'var(--accent1)',
            }}
            autoFocus
          />
          {error && (
            <div style={{
              padding:'0.5rem 0.75rem', background:'rgba(192,57,43,0.15)',
              border:'1px solid rgba(192,57,43,0.4)', color:'#ff9090',
              fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2vw,0.72rem)', textAlign:'center',
            }}>⚠ {error}</div>
          )}
          <div style={{ display:'flex', gap:'0.5rem', width:'100%' }}>
            <button onClick={() => { play('click'); setPhase('choose'); setError(''); }}
              style={{ flex:1, padding:'0.7rem', background:'transparent', border:'1px solid rgba(90,173,94,0.3)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', cursor:'pointer', letterSpacing:'0.2em' }}>
              CANCEL
            </button>
            <button onClick={handleJoin} disabled={!code.trim()}
              style={{ flex:1, padding:'0.7rem', background:'rgba(40,80,42,0.4)', border:'1px solid var(--accent1)', color:'var(--accent1)', fontFamily:'Share Tech Mono', fontWeight:700, cursor:'pointer', letterSpacing:'0.2em', boxShadow:'0 0 12px color-mix(in srgb,var(--accent1) 30%,transparent)' }}>
              ▶ JOIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: ROOM (waiting for opponent) ──
  if (phase === 'room' && room) {
    const playerCount = (room.players || []).length;
    const meReady = room.ready;
    const opponent = (room.players || []).find((p, i) => p.name !== user?.username);
    return (
      <div className="screen" style={{ background:'var(--bg-void)', flexDirection:'column', overflow:'hidden' }}>
        <Header/>
        <div style={{
          flex:1, overflowY:'auto',
          padding:'clamp(0.8rem,3vw,1.4rem)',
          paddingBottom:'max(clamp(0.8rem,3vw,1.4rem), var(--safe-bottom))',
          display:'flex', flexDirection:isLandscape?'row':'column', gap:'0.8rem',
          maxWidth: isLandscape ? '100%' : 'min(560px,96vw)', margin:'0 auto', width:'100%',
        }}>
          {/* Left: room info */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.7rem' }}>
            {/* Room code badge */}
            <div style={{
              padding:'clamp(0.7rem,2.5vw,1rem)',
              background:'color-mix(in srgb,var(--accent1) 10%,transparent)',
              border:'1.5px solid var(--accent1)',
              textAlign:'center',
              clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
            }}>
              <div className="label-xs" style={{ marginBottom:'0.3rem', letterSpacing:'0.3em', opacity:0.7 }}>
                ROOM CODE — SHARE THIS
              </div>
              <div className="title-font" style={{
                fontSize:'clamp(1.7rem,7vw,2.6rem)',
                color:'var(--accent1)',
                letterSpacing:'0.35em', lineHeight:1,
                textShadow:'0 0 18px color-mix(in srgb,var(--accent1) 50%,transparent)',
              }}>
                {room.code}
              </div>
              <div style={{ fontSize:'clamp(0.55rem,1.9vw,0.65rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', marginTop:'0.4rem', display:'flex', justifyContent:'center', gap:'0.6rem', flexWrap:'wrap' }}>
                <span>Difficulty: <span style={{ color:'var(--accent1)', fontWeight:700 }}>{(room.difficulty || difficulty).toUpperCase()}</span></span>
                <span style={{ opacity:0.4 }}>•</span>
                <span>You: <span style={{ color: platformColor(detectPlatform()), fontWeight:700 }}>{platformIcon(detectPlatform())} {platformLabel(detectPlatform())}</span></span>
              </div>
            </div>

            {/* Players */}
            <div style={{ padding:'0.6rem 0.7rem', background:'var(--bg-panel)', border:'var(--border-panel)' }}>
              <div className="label-xs" style={{ marginBottom:'0.4rem' }}>▸ COMMANDERS ({playerCount}/2)</div>
              {[0,1].map(i => {
                const p = (room.players || [])[i];
                const isMe = p && p.name === user?.username;
                const plat = p?.platform || 'pc';
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:'0.5rem',
                    padding:'0.4rem 0.5rem',
                    background: p ? 'rgba(90,173,94,0.08)' : 'rgba(40,40,40,0.4)',
                    border:`1px solid ${p ? 'rgba(90,173,94,0.25)' : 'rgba(90,90,90,0.2)'}`,
                    marginBottom:'0.3rem',
                  }}>
                    <span style={{ fontSize:'1.1rem' }}>{p ? (isMe ? '👤' : '🎯') : '⌛'}</span>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={{ fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.7rem,2.4vw,0.85rem)', color: p ? 'var(--white-cream)' : 'var(--white-dim)' }}>
                        {p ? p.name : 'Waiting for player...'}
                      </div>
                    </div>
                    {/* Platform chip */}
                    {p && (
                      <div title={platformLabel(plat)} style={{
                        padding:'0.18rem 0.42rem',
                        background:`${platformColor(plat)}22`,
                        border:`1px solid ${platformColor(plat)}`,
                        fontFamily:'Share Tech Mono', fontSize:'clamp(0.5rem,1.6vw,0.6rem)',
                        color: platformColor(plat),
                        letterSpacing:'0.08em',
                        display:'flex', alignItems:'center', gap:'0.2rem',
                        flexShrink:0,
                      }}>
                        <span style={{ fontSize:'0.85em' }}>{platformIcon(plat)}</span>
                        {platformLabel(plat)}
                      </div>
                    )}
                    {/* Ready chip */}
                    {p && (
                      <div style={{
                        padding:'0.15rem 0.45rem',
                        background: p.ready ? 'rgba(40,100,42,0.5)' : 'rgba(60,60,60,0.5)',
                        border:`1px solid ${p.ready ? 'var(--green-bright)' : 'rgba(120,120,120,0.5)'}`,
                        fontFamily:'Share Tech Mono', fontSize:'clamp(0.5rem,1.6vw,0.6rem)',
                        color: p.ready ? 'var(--green-accent)' : 'var(--white-dim)',
                        letterSpacing:'0.1em',
                        flexShrink:0,
                      }}>
                        {p.ready ? '✓ READY' : 'WAIT'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ready / Leave buttons */}
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <button onClick={handleLeave}
                style={{ flex:1, padding:'0.7rem', background:'rgba(120,30,30,0.3)', border:'1px solid #c04040', color:'#ff9090', fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.7rem,2.4vw,0.85rem)', letterSpacing:'0.2em', cursor:'pointer' }}>
                ✕ LEAVE
              </button>
              <button onClick={handleReady} disabled={playerCount < 2}
                style={{
                  flex:2, padding:'0.7rem',
                  background: meReady ? 'rgba(232,160,0,0.25)' : 'rgba(40,100,42,0.45)',
                  border:`1px solid ${meReady ? 'var(--amber)' : 'var(--green-bright)'}`,
                  color: meReady ? 'var(--amber)' : 'var(--green-bright)',
                  fontFamily:'Share Tech Mono', fontWeight:700, fontSize:'clamp(0.78rem,2.6vw,0.95rem)',
                  letterSpacing:'0.2em', cursor: playerCount < 2 ? 'not-allowed' : 'pointer',
                  boxShadow: meReady ? 'none' : '0 0 14px rgba(90,173,94,0.3)',
                  opacity: playerCount < 2 ? 0.5 : 1,
                }}>
                {meReady ? '⏸ UNREADY' : '▶ READY UP'}
              </button>
            </div>
            {playerCount < 2 && (
              <div style={{ fontSize:'clamp(0.55rem,1.9vw,0.65rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', textAlign:'center', opacity:0.7 }}>
                ⏳ Waiting for opponent to join...
              </div>
            )}
          </div>

          {/* Right: chat — enhanced bubbles + quick reactions */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.4rem', minHeight: isLandscape ? 0 : 220 }}>
            <div className="label-xs" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>▸ TACTICAL COMMS</span>
              <span style={{ fontSize:'0.5rem', opacity:0.5, letterSpacing:'0.1em' }}>{chatLog.length} MSG</span>
            </div>

            {/* Messages — bubble layout */}
            <div ref={chatScrollRef} style={{
              flex:1, minHeight: 140, maxHeight: 280, overflowY:'auto',
              background:'rgba(10,22,11,0.6)', border:'var(--border-panel)',
              padding:'0.45rem', display:'flex', flexDirection:'column', gap:'0.32rem',
            }}>
              {chatLog.length === 0
                ? <div style={{ color:'rgba(90,173,94,0.3)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.55rem,1.9vw,0.65rem)', textAlign:'center', marginTop:'1.5rem', letterSpacing:'0.15em' }}>
                    ◆ NO MESSAGES YET ◆<br/>
                    <span style={{ fontSize:'0.85em', opacity:0.7 }}>Be the first to drop a comm</span>
                  </div>
                : chatLog.map((m, i) => {
                    const own = m.from === user?.username;
                    return (
                      <div key={i} style={{
                        display:'flex',
                        justifyContent: own ? 'flex-end' : 'flex-start',
                        animation:'slideUp 0.2s ease',
                      }}>
                        <div style={{
                          maxWidth:'80%',
                          padding:'0.32rem 0.55rem',
                          background: own
                            ? 'color-mix(in srgb, var(--accent1) 18%, transparent)'
                            : 'rgba(40,40,40,0.6)',
                          border:`1px solid ${own ? 'var(--accent1)' : 'rgba(120,120,120,0.35)'}`,
                          clipPath: own
                            ? 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                            : 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
                          fontFamily:'Share Tech Mono',
                          fontSize:'clamp(0.5rem,1.8vw,0.65rem)',
                          color:'var(--white-cream)',
                          lineHeight:1.4,
                        }}>
                          <div style={{
                            fontSize:'0.85em', fontWeight:700,
                            color: own ? 'var(--accent1)' : 'var(--green-dim)',
                            marginBottom:'0.1rem', letterSpacing:'0.05em',
                          }}>
                            {own ? 'YOU' : m.from}
                          </div>
                          {m.text}
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            {/* Quick-reaction chips */}
            <div style={{ display:'flex', gap:'0.25rem', flexWrap:'wrap' }}>
              {['👍 GG', '🔥 Lucky!', '⚓ Bring it', '😂 Lol', '🎯 Nice shot', '⚠ Watch out'].map(q => (
                <button key={q} onClick={() => sendChatText(q)}
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
            <div style={{ display:'flex', gap:'0.3rem' }}>
              <input
                className="game-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatText(chatInput)}
                placeholder="Type message..."
                maxLength={120}
                style={{ flex:1, minHeight:38, fontSize:'clamp(0.65rem,2.2vw,0.8rem)' }}
              />
              <button onClick={() => sendChatText(chatInput)} disabled={!chatInput.trim()}
                style={{
                  padding:'0 0.9rem',
                  background: chatInput.trim() ? 'color-mix(in srgb, var(--accent1) 25%, transparent)' : 'rgba(40,40,40,0.5)',
                  border:`1px solid ${chatInput.trim() ? 'var(--accent1)' : 'rgba(120,120,120,0.3)'}`,
                  color: chatInput.trim() ? 'var(--accent1)' : 'rgba(150,150,150,0.5)',
                  fontFamily:'Share Tech Mono', fontWeight:700,
                  cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize:'clamp(0.78rem,2.5vw,0.95rem)',
                }}>
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
