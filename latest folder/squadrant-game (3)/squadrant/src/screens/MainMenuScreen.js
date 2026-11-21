import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import GameIcon from '../components/GameIcon';
import { lanAvailable } from '../net/lan';

const MODES = [
  {
    id: 'vs-computer',
    icon: '🤖',
    label: 'VS. COMPUTER',
    desc: 'Face the AI — Easy, Average, or Advanced mode.',
    sub: 'SINGLE PLAYER',
    color: '#5aad5e',
    borderColor: 'rgba(90,173,94,0.35)',
    glowColor: 'rgba(90,173,94,0.15)',
    clip: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
  },
  {
    id: 'pvp',
    icon: '⚔️',
    label: 'PLAYER vs PLAYER',
    desc: 'Pass & play on one device — take turns.',
    sub: 'LOCAL MULTIPLAYER',
    color: '#e8a000',
    borderColor: 'rgba(232,160,0,0.3)',
    glowColor: 'rgba(232,160,0,0.1)',
    clip: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
  },
  {
    id: 'lan',
    icon: '📡',
    label: 'LAN HOTSPOT PvP',
    desc: 'Real-time multiplayer over hotspot. No internet needed.',
    sub: 'NETWORK MULTIPLAYER',
    color: '#00aacc',
    borderColor: 'rgba(0,170,204,0.3)',
    glowColor: 'rgba(0,170,204,0.1)',
    clip: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
  },
  {
    id: 'online',
    icon: '🌐',
    label: 'ONLINE PvP',
    desc: 'Battle players over the internet — quick match or private rooms.',
    sub: 'INTERNET MULTIPLAYER',
    color: '#cc44ff',
    borderColor: 'rgba(204,68,255,0.3)',
    glowColor: 'rgba(204,68,255,0.12)',
    clip: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
  },
];

export default function MainMenuScreen({ user, onSelect, onSettings, onHowToPlay, onCredits, onScoreboard, onLogout }) {
  const { play } = useApp();
  const { isLandscape } = useOrientation();
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <div className="screen" style={{ background:'var(--bg-void)' }}>
      <style>{`
        @keyframes radarSweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .m-card { animation: fadeUp 0.4s ease forwards; opacity:0; }
        .m-card:nth-child(1) { animation-delay: 0.06s; }
        .m-card:nth-child(2) { animation-delay: 0.15s; }
        .m-card:nth-child(3) { animation-delay: 0.24s; }
        .m-card:nth-child(4) { animation-delay: 0.33s; }
        .mode-btn {
          width:100%; text-align:left; cursor:pointer;
          color:var(--white-cream); transition:all 0.2s;
          display:flex; align-items:center;
          gap:clamp(0.8rem,3vw,1.2rem);
          padding:clamp(1rem,3.5vw,1.4rem);
          background:rgba(10,26,11,0.6);
          border:1px solid rgba(90,173,94,0.18);
          position:relative; overflow:hidden;
          height:100%;
        }
        /* Landscape: compact 3-up grid */
        @media (orientation:landscape) {
          .mode-btn {
            flex-direction:column;
            align-items:flex-start;
            gap:0.35rem;
            padding:clamp(0.55rem,1.5vw,0.85rem) clamp(0.6rem,1.6vw,0.9rem);
          }
          .mode-btn .mode-arrow { display:none; }
        }
        .mode-btn::after {
          content:''; position:absolute; left:0; top:0; bottom:0; width:2px;
          background:transparent; transition:background 0.2s;
        }
        .mode-btn:active { transform:scale(0.985); }
      `}</style>

      {/* Radar decoration */}
      <div style={{
        position:'absolute', right:'-8%', top:'50%',
        transform:'translateY(-50%)',
        width:'min(320px,48vw)', height:'min(320px,48vw)',
        opacity:0.04, pointerEvents:'none',
      }}>
        <svg viewBox="0 0 400 400" style={{ width:'100%', height:'100%' }}>
          {[1,2,3,4,5].map(i => (
            <circle key={i} cx={200} cy={200} r={i*38} fill="none" stroke="var(--green-bright)" strokeWidth="1"/>
          ))}
          <line x1={200} y1={0} x2={200} y2={400} stroke="var(--green-bright)" strokeWidth="0.5" opacity={0.5}/>
          <line x1={0} y1={200} x2={400} y2={200} stroke="var(--green-bright)" strokeWidth="0.5" opacity={0.5}/>
          <g style={{ transformOrigin:'200px 200px', animation:'radarSweep 4s linear infinite' }}>
            <path d="M200,200 L200,20" stroke="var(--green-bright)" strokeWidth="2.5"/>
            <path d="M200,200 L200,20" stroke="var(--green-bright)" strokeWidth="40" opacity="0.04"
              style={{ transformOrigin:'200px 200px' }}/>
          </g>
        </svg>
      </div>

      {/* Header — with safe top area, more compact in landscape */}
      <div style={{
        paddingTop: `max(0.7rem, var(--safe-top))`,
        padding: isLandscape
          ? `max(0.35rem, var(--safe-top)) clamp(0.6rem,2vw,1rem) 0.35rem`
          : `max(0.7rem, var(--safe-top)) clamp(0.9rem,3.5vw,1.6rem) 0.7rem`,
        borderBottom:'var(--border-panel)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexShrink:0, background:'var(--bg-panel)',
      }}>
        <div>
          <h1 className="title-font" style={{
            fontSize: isLandscape ? 'clamp(1.1rem,3.2vw,1.6rem)' : 'clamp(1.5rem,6.5vw,2.5rem)',
            color:'var(--green-bright)', lineHeight:1,
            textShadow:'0 0 20px rgba(90,173,94,0.4)',
            margin:0,
          }}>
            SQUADRANT
          </h1>
          <div className="label-xs" style={{ marginTop:'0.15rem', letterSpacing:'0.2em', fontSize: isLandscape ? 'clamp(0.4rem,1.2vw,0.55rem)' : undefined }}>
            COORDINATE WARFARE // NAVAL DIVISION
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.35rem', alignItems:'center', flexWrap:'wrap' }}>
          {onScoreboard && (
            <button className="back-btn" onClick={() => { play('click'); onScoreboard(); }}
              title="Leaderboard" aria-label="Leaderboard"
              style={{ fontSize:'0.95rem' }}>
              🏆
            </button>
          )}
          {onCredits && (
            <button className="back-btn cred-btn" onClick={() => { play('click'); onCredits(); }}
              title="Credits" aria-label="Credits"
              style={{ fontSize:'0.95rem' }}>
              👥
            </button>
          )}
          <button className="back-btn" onClick={() => { play('click'); onHowToPlay(); }}
            title="How to Play" aria-label="How to Play"
            style={{ fontSize:'0.95rem', fontWeight:700 }}>
            ?
          </button>
          <button className="back-btn" onClick={() => { play('click'); onSettings(); }} aria-label="Settings">
            <GameIcon id="gear" size={17}/>
          </button>
          {onLogout && (
            <button
              onClick={() => { play('click'); setConfirmLogout(true); }}
              title="Logout" aria-label="Logout"
              style={{
                padding:'0.32rem clamp(0.55rem,2vw,0.85rem)',
                minHeight: 36,
                background:'rgba(160,35,35,0.25)',
                border:'1px solid #e05050',
                color:'#ff9090',
                fontFamily:'Share Tech Mono',
                fontWeight:700,
                fontSize:'clamp(0.55rem,1.9vw,0.68rem)',
                letterSpacing:'0.15em',
                cursor:'pointer',
                display:'flex', alignItems:'center', gap:'0.25rem',
                boxShadow:'0 0 8px rgba(192,57,43,0.25)',
                transition:'all 0.15s',
                clipPath:'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192,57,43,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(160,35,35,0.25)'; }}>
              ⎋ LOGOUT
            </button>
          )}
        </div>
      </div>

      {/* Content — flex-start so it scrolls cleanly when overflowing on landscape */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'flex-start',
        padding: isLandscape ? 'clamp(0.4rem,1.5vw,0.8rem) clamp(0.6rem,2vw,1rem)' : 'clamp(0.8rem,3vw,1.8rem)',
        gap: isLandscape ? '0.45rem' : 'clamp(0.6rem,2vw,0.9rem)',
        overflowY:'auto',
        minHeight: 0,
      }}>

        <div style={{ textAlign:'center', marginBottom: isLandscape ? '0.1rem' : 'clamp(0.1rem,0.8vw,0.4rem)' }}>
          <div className="label-xs" style={{ letterSpacing:'0.35em', marginBottom: isLandscape ? '0.2rem' : '0.4rem' }}>
            SELECT OPERATION MODE
          </div>
          <div style={{ width:48, height:1, background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)', margin:'0 auto' }}/>
        </div>

        {(() => {
          const visibleModes = MODES.filter(m => m.id !== 'lan' || lanAvailable());
          return (
            <div style={{
              display: isLandscape ? 'grid' : 'flex',
              gridTemplateColumns: isLandscape ? `repeat(${visibleModes.length}, 1fr)` : undefined,
              flexDirection: isLandscape ? undefined : 'column',
              gap: isLandscape ? 'clamp(0.4rem,1vw,0.7rem)' : 'clamp(0.5rem,2vw,0.8rem)',
              width:'100%',
              maxWidth: isLandscape ? '100%' : 'min(540px,96vw)',
            }}>
              {visibleModes.map(m => (
            <div key={m.id} className="m-card">
              <button
                className="mode-btn"
                onClick={() => { play('select'); onSelect(m.id); }}
                style={{ clipPath: m.clip, borderColor: m.borderColor }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = m.color;
                  e.currentTarget.style.background = m.glowColor;
                  e.currentTarget.style.boxShadow = `0 0 28px ${m.glowColor}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = m.borderColor;
                  e.currentTarget.style.background = 'rgba(10,26,11,0.6)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Left colored accent bar */}
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:m.color, opacity:0.7 }}/>

                <span style={{ fontSize:'clamp(1.6rem,6vw,2.2rem)', flexShrink:0, marginLeft:'0.2rem' }}>
                  {m.icon}
                </span>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div className="title-font" style={{
                    fontSize:'clamp(0.9rem,4vw,1.2rem)',
                    color: m.color,
                    letterSpacing:'0.06em',
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontSize:'clamp(0.6rem,2.2vw,0.72rem)',
                    color:'var(--white-dim)',
                    fontFamily:'Share Tech Mono',
                    marginTop:'0.1rem', lineHeight:1.45,
                  }}>
                    {m.desc}
                  </div>
                  <div className="label-xs" style={{ marginTop:'0.25rem', color: m.color, opacity:0.65 }}>
                    ▸ {m.sub}
                  </div>
                </div>
                <div className="mode-arrow" style={{ color: m.color, fontSize:'1.1rem', flexShrink:0, opacity:0.7 }}>▶</div>
              </button>
            </div>
              ))}
            </div>
          );
        })()}

        {/* Commander badge with stats */}
        <div style={{
          marginTop:'0.2rem',
          display:'flex', alignItems:'center', gap:'clamp(0.5rem,2vw,0.8rem)',
          padding:'0.45rem 1rem',
          background:'rgba(90,173,94,0.05)',
          border:'var(--border-panel)',
          flexWrap:'wrap',
        }}>
          <div className="status-dot"/>
          <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.52rem,1.8vw,0.65rem)', color:'var(--white-dim)' }}>
            COMMANDER: <span style={{ color:'var(--green-accent)', fontWeight:700 }}>
              {user?.username?.toUpperCase() || 'GUEST'}
            </span>
          </span>
          {user && (
            <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.5rem,1.7vw,0.62rem)', display:'flex', gap:'0.6rem' }}>
              <span style={{ color:'var(--green-bright)' }}>W: {user.wins || 0}</span>
              <span style={{ color:'var(--red-bright)' }}>L: {user.losses || 0}</span>
            </span>
          )}
        </div>
      </div>

      {/* Footer — with safe bottom area */}
      <div style={{
        padding:`0.35rem clamp(0.8rem,3vw,1.4rem)`,
        paddingBottom:`max(0.35rem, var(--safe-bottom))`,
        borderTop:'var(--border-panel)',
        background:'var(--bg-panel)',
        display:'flex', justifyContent:'space-between',
        flexShrink:0,
      }}>
        <span className="label-xs">SQUADRANT v2.0</span>
        <span className="label-xs">GRID: (-10,-10) TO (10,10)</span>
      </div>

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {confirmLogout && (
        <div onClick={() => setConfirmLogout(false)}
          style={{
            position:'absolute', inset:0, zIndex:300,
            background:'rgba(2,12,4,0.88)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'clamp(0.8rem,3vw,1.4rem)',
            backdropFilter:'blur(6px)',
            animation:'fadeInUp 0.2s ease',
          }}>
          <style>{`
            @keyframes fadeInUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          `}</style>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:'min(420px,94vw)',
            background:'var(--bg-panel)',
            border:'1px solid #e05050',
            padding:'clamp(1rem,4vw,1.5rem)',
            boxShadow:'0 0 50px rgba(0,0,0,0.8), 0 0 24px rgba(192,57,43,0.3)',
            clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))',
          }}>
            <div style={{ textAlign:'center', marginBottom:'0.7rem' }}>
              <div style={{ fontSize:'clamp(1.8rem,6vw,2.4rem)', marginBottom:'0.3rem' }}>⎋</div>
              <div className="label-xs" style={{ letterSpacing:'0.35em', opacity:0.6, marginBottom:'0.4rem' }}>
                ── SIGN OUT ──
              </div>
              <div className="title-font" style={{
                fontSize:'clamp(1.1rem,4.5vw,1.6rem)',
                color:'#ff8080',
                letterSpacing:'0.04em', marginBottom:'0.5rem',
                textShadow:'0 0 14px rgba(192,57,43,0.5)',
              }}>
                DO YOU WANT TO LOGOUT?
              </div>
              <div style={{ fontSize:'clamp(0.65rem,2.3vw,0.78rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)', lineHeight:1.5 }}>
                You'll need to login again with your email and password to play.
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
              <button onClick={() => { play('click'); setConfirmLogout(false); }}
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
              <button onClick={() => { setConfirmLogout(false); onLogout && onLogout(); }}
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
      )}
    </div>
  );
}
