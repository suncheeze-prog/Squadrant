import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import GameIcon from '../components/GameIcon';

const DEVELOPERS = [
  { name: 'Leoniel R. Cortero',       role: 'LEAD DEVELOPER',      icon: '⚓' },
  { name: 'Marverick F. Graciano',    role: 'SYSTEMS ENGINEER',    icon: '⚙' },
  { name: 'Faith Celestine D. Saet',  role: 'GAME DESIGNER',       icon: '✦' },
  { name: 'Elmar E. Santos',          role: 'STRATEGY ARCHITECT',  icon: '▲' },
];

const CAPTION =
  'Squadrant is a game-based learning strategy that transforms the traditional Battleship ' +
  'game into an engaging tool for mastering the Cartesian Coordinate Plane through strategy, ' +
  'spatial reasoning, and coordinate plotting. The game is designed to help improve the skills ' +
  'in plotting ordered pairs and identifying quadrants in an engaging and interactive way.';

export default function CreditsScreen({ onBack }) {
  const { play } = useApp();
  const { isLandscape } = useOrientation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen" style={{
      background: 'var(--bg-void)',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes credGridDrift  { 0%{background-position:0 0} 100%{background-position:40px 40px} }
        @keyframes credLogoPulse  { 0%,100%{opacity:0.85; text-shadow:0 0 22px var(--accent1), 0 0 8px var(--accent1)} 50%{opacity:1; text-shadow:0 0 38px var(--accent1), 0 0 14px var(--accent1)} }
        @keyframes credSlideIn    { from{opacity:0; transform:translateY(22px)} to{opacity:1; transform:translateY(0)} }
        @keyframes credSlideRight { from{opacity:0; transform:translateX(-22px)} to{opacity:1; transform:translateX(0)} }
        @keyframes credScanBar    { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes credPing       { 0%{transform:scale(0.85);opacity:0.6} 50%{transform:scale(1);opacity:1} 100%{transform:scale(0.85);opacity:0.6} }
        @keyframes credRadar      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes credTwinkle    { 0%,100%{opacity:0.15} 50%{opacity:0.55} }
        @keyframes credBadgeGlow  { 0%,100%{box-shadow:0 0 12px color-mix(in srgb,var(--accent1) 30%,transparent), inset 0 0 6px color-mix(in srgb,var(--accent1) 15%,transparent)} 50%{box-shadow:0 0 24px color-mix(in srgb,var(--accent1) 55%,transparent), inset 0 0 10px color-mix(in srgb,var(--accent1) 25%,transparent)} }

        .cred-name-card {
          position:relative;
          padding:clamp(0.55rem,1.8vw,0.85rem) clamp(0.7rem,2.2vw,1.05rem);
          background: color-mix(in srgb, var(--bg-panel) 70%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent1) 35%, transparent);
          backdrop-filter: blur(6px);
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          overflow:hidden;
          transition:all 0.25s;
          opacity:0;
          animation: credSlideRight 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .cred-name-card::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
          background: var(--accent1); opacity:0.7;
        }
        .cred-name-card::after {
          content:''; position:absolute; top:0; left:-30%; width:25%; height:100%;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent1) 25%, transparent), transparent);
          animation: credScanBar 3.5s linear infinite;
          pointer-events:none;
        }
        .cred-name-card:nth-child(1) { animation-delay: 0.45s; }
        .cred-name-card:nth-child(2) { animation-delay: 0.60s; }
        .cred-name-card:nth-child(3) { animation-delay: 0.75s; }
        .cred-name-card:nth-child(4) { animation-delay: 0.90s; }
      `}</style>

      {/* Background — animated grid + radar */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(color-mix(in srgb,var(--accent1) 12%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--accent1) 12%,transparent) 1px,transparent 1px)',
        backgroundSize:'40px 40px',
        animation:'credGridDrift 22s linear infinite',
        opacity:0.5,
        pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse 70% 50% at 50% 40%, color-mix(in srgb,var(--accent1) 14%,transparent) 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>
      {/* Radar sweep decoration */}
      <div style={{
        position:'absolute', right:'-15%', top:'45%', transform:'translateY(-50%)',
        width:'min(380px, 55vw)', height:'min(380px, 55vw)',
        opacity:0.07, pointerEvents:'none',
      }}>
        <svg viewBox="0 0 400 400" style={{ width:'100%', height:'100%' }}>
          {[1,2,3,4,5].map(i => (
            <circle key={i} cx={200} cy={200} r={i*38} fill="none" stroke="var(--accent1)" strokeWidth="1"/>
          ))}
          <line x1={200} y1={0} x2={200} y2={400} stroke="var(--accent1)" strokeWidth="0.5" opacity={0.5}/>
          <line x1={0} y1={200} x2={400} y2={200} stroke="var(--accent1)" strokeWidth="0.5" opacity={0.5}/>
          <g style={{ transformOrigin:'200px 200px', animation:'credRadar 5s linear infinite' }}>
            <path d="M200,200 L200,20" stroke="var(--accent1)" strokeWidth="2.5"/>
          </g>
        </svg>
      </div>
      {/* Twinkling stars */}
      {[
        { left:'12%', top:'18%', size:3, delay:'0s' },
        { left:'85%', top:'25%', size:2, delay:'0.6s' },
        { left:'22%', top:'72%', size:2, delay:'1.2s' },
        { left:'78%', top:'78%', size:3, delay:'1.8s' },
        { left:'55%', top:'12%', size:2, delay:'0.3s' },
        { left:'8%',  top:'48%', size:2, delay:'2.4s' },
      ].map((s,i) => (
        <div key={i} style={{
          position:'absolute', left:s.left, top:s.top,
          width:s.size, height:s.size, borderRadius:'50%',
          background:'var(--accent1)',
          animation:`credTwinkle 3s ${s.delay} ease-in-out infinite`,
          pointerEvents:'none',
        }}/>
      ))}

      {/* Header — compact in landscape */}
      <div style={{
        padding: isLandscape
          ? `max(0.35rem, var(--safe-top)) clamp(0.5rem,1.5vw,0.9rem) 0.35rem`
          : `max(0.6rem, var(--safe-top)) clamp(0.6rem,2.5vw,1.2rem) 0.6rem`,
        borderBottom:'var(--border-panel)',
        background:'color-mix(in srgb, var(--bg-panel) 90%, transparent)',
        display:'flex', alignItems:'center', gap:'0.6rem',
        flexShrink:0, position:'relative', zIndex:5,
        backdropFilter:'blur(6px)',
      }}>
        <button className="back-btn" onClick={() => { play('click'); onBack(); }}>
          <GameIcon id="back" size={16}/>
        </button>
        <div>
          <div className="label-xs" style={{ opacity:0.6, letterSpacing:'0.3em', fontSize: isLandscape ? 'clamp(0.4rem,1vw,0.5rem)' : undefined }}>NAVAL COMMAND // ARCHIVE</div>
          <div className="title-font" style={{
            fontSize: isLandscape ? 'clamp(0.78rem,2.4vw,1.05rem)' : 'clamp(0.95rem,3.5vw,1.3rem)',
            color:'var(--accent1)', letterSpacing:'0.05em',
            textShadow:'0 0 14px color-mix(in srgb, var(--accent1) 50%, transparent)',
            margin:0, lineHeight:1.1,
          }}>
            DEVELOPMENT TEAM
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex:1, overflowY:'auto',
        padding: isLandscape ? 'clamp(0.45rem,1.5vw,0.85rem)' : 'clamp(0.8rem,3vw,1.5rem)',
        paddingBottom:`max(${isLandscape ? 'clamp(0.45rem,1.5vw,0.85rem)' : 'clamp(0.8rem,3vw,1.5rem)'}, var(--safe-bottom))`,
        display:'flex', flexDirection:'column', alignItems:'center',
        gap: isLandscape ? '0.5rem' : 'clamp(0.8rem,2.5vw,1.2rem)',
        position:'relative', zIndex:3,
      }}>

        {/* ── Main two-column / single-column wrapper ── */}
        <div style={{
          display: isLandscape ? 'grid' : 'flex',
          gridTemplateColumns: isLandscape ? '1fr 1fr' : undefined,
          flexDirection: isLandscape ? undefined : 'column',
          gap: isLandscape ? 'clamp(0.6rem,2vw,1rem)' : 'clamp(0.8rem,2.5vw,1.2rem)',
          width:'100%',
          maxWidth: isLandscape ? '100%' : 'min(640px,96vw)',
          alignItems: isLandscape ? 'stretch' : 'center',
        }}>

        {/* ─── LEFT column: insignia + caption ─── */}
        <div style={{
          display:'flex', flexDirection:'column',
          gap: isLandscape ? '0.5rem' : 'clamp(0.8rem,2.5vw,1.2rem)',
          alignItems:'center',
          width:'100%',
        }}>

        {/* Squadrant insignia + tagline */}
        <div style={{
          marginTop: isLandscape ? '0' : 'clamp(0.5rem,2vw,1rem)',
          textAlign:'center',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
          transition:'all 0.6s ease',
        }}>
          {/* Naval insignia badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width: isLandscape ? 'clamp(40px, 7vw, 60px)' : 'clamp(58px, 12vw, 86px)',
            height: isLandscape ? 'clamp(40px, 7vw, 60px)' : 'clamp(58px, 12vw, 86px)',
            borderRadius:'50%',
            border:'2px solid var(--accent1)',
            background:'color-mix(in srgb, var(--accent1) 8%, transparent)',
            animation:'credBadgeGlow 3s ease-in-out infinite',
            fontSize: isLandscape ? 'clamp(1.1rem, 3vw, 1.6rem)' : 'clamp(1.6rem, 5vw, 2.4rem)',
            marginBottom: isLandscape ? '0.3rem' : '0.6rem',
          }}>
            ⚓
          </div>
          <div className="label-xs" style={{ letterSpacing:'0.5em', opacity:0.6, marginBottom:'0.25rem', fontSize: isLandscape ? 'clamp(0.42rem,1.2vw,0.52rem)' : undefined }}>
            ▶ PRESENTING ◀
          </div>
          <div className="title-font" style={{
            fontSize: isLandscape ? 'clamp(1.1rem, 3.2vw, 1.7rem)' : 'clamp(1.6rem, 6vw, 2.6rem)',
            color:'var(--accent1)',
            letterSpacing:'0.04em', lineHeight:1,
            animation:'credLogoPulse 3s ease-in-out infinite',
            margin:0,
          }}>
            SQUADRANT
          </div>
          <div style={{
            width:80, height:1, margin: isLandscape ? '0.35rem auto' : '0.55rem auto',
            background:'linear-gradient(90deg, transparent, var(--accent1), transparent)',
          }}/>
          <div className="label-xs" style={{ opacity:0.55, letterSpacing:'0.28em', fontSize: isLandscape ? 'clamp(0.4rem,1.1vw,0.5rem)' : undefined }}>
            COORDINATE WARFARE SYSTEM
          </div>
        </div>

        {/* Caption — about the game */}
        <div style={{
          width:'100%', maxWidth:'min(640px, 96vw)',
          padding:'clamp(0.8rem, 3vw, 1.2rem) clamp(0.9rem, 3vw, 1.4rem)',
          background:'color-mix(in srgb, var(--bg-panel) 80%, transparent)',
          border:'1px solid color-mix(in srgb, var(--accent1) 28%, transparent)',
          backdropFilter:'blur(8px)',
          position:'relative',
          clipPath:'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition:'all 0.7s 0.15s ease',
        }}>
          {/* top scan-line ornament */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:2,
            background:'linear-gradient(90deg, transparent, var(--accent1), transparent)',
            opacity:0.6,
          }}/>
          <div className="label-xs" style={{
            color:'var(--accent1)', letterSpacing:'0.3em',
            marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.4rem',
          }}>
            <span style={{ animation:'credPing 2s ease-in-out infinite', display:'inline-block' }}>◆</span>
            MISSION BRIEFING
          </div>
          <div style={{
            fontSize:'clamp(0.7rem, 2.4vw, 0.88rem)',
            fontFamily:'Share Tech Mono',
            color:'var(--white-cream)',
            lineHeight:1.7, letterSpacing:'0.01em',
          }}>
            {CAPTION}
          </div>
        </div>

        </div>  {/* ── end LEFT column ── */}

        {/* ─── RIGHT column: divider + developer list ─── */}
        <div style={{
          display:'flex', flexDirection:'column',
          gap: isLandscape ? '0.5rem' : 'clamp(0.8rem,2.5vw,1.2rem)',
          alignItems:'center', justifyContent:'center',
          width:'100%',
        }}>

        {/* Section divider */}
        <div style={{
          width:'100%', maxWidth: isLandscape ? '100%' : 'min(640px, 96vw)',
          display:'flex', alignItems:'center', gap:'0.6rem',
          opacity: mounted ? 1 : 0,
          transition:'opacity 0.5s 0.3s ease',
        }}>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg, transparent, color-mix(in srgb,var(--accent1) 45%,transparent))' }}/>
          <div className="label-xs" style={{ letterSpacing:'0.4em', color:'var(--accent1)', opacity:0.8 }}>
            ▶ DEVELOPERS ◀
          </div>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg, color-mix(in srgb,var(--accent1) 45%,transparent), transparent)' }}/>
        </div>

        {/* Developer names — staggered slide-in */}
        <div style={{
          width:'100%', maxWidth:'min(640px, 96vw)',
          display:'flex', flexDirection:'column', gap:'clamp(0.45rem, 1.4vw, 0.7rem)',
        }}>
          {DEVELOPERS.map((d, i) => (
            <div key={d.name} className="cred-name-card" style={{
              display:'flex', alignItems:'center', gap:'clamp(0.55rem,1.8vw,0.8rem)',
            }}>
              {/* Rank badge */}
              <div style={{
                width:'clamp(34px, 8vw, 44px)', height:'clamp(34px, 8vw, 44px)',
                background:'color-mix(in srgb, var(--accent1) 18%, transparent)',
                border:'1px solid color-mix(in srgb, var(--accent1) 55%, transparent)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(1rem, 3.5vw, 1.4rem)',
                color:'var(--accent1)',
                flexShrink:0,
                clipPath:'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                textShadow:'0 0 8px var(--accent1)',
              }}>
                {d.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="title-font" style={{
                  fontSize:'clamp(0.78rem, 2.8vw, 1rem)',
                  color:'var(--white-cream)',
                  letterSpacing:'0.04em',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {d.name}
                </div>
                <div className="label-xs" style={{
                  color:'var(--accent1)', opacity:0.75,
                  marginTop:'0.15rem', letterSpacing:'0.18em',
                  fontSize:'clamp(0.46rem, 1.5vw, 0.55rem)',
                }}>
                  ▸ {d.role}
                </div>
              </div>
              {/* Right indicator */}
              <div style={{
                fontFamily:'Share Tech Mono', fontSize:'clamp(0.5rem,1.6vw,0.62rem)',
                color:'color-mix(in srgb, var(--accent1) 60%, transparent)',
                flexShrink:0, letterSpacing:'0.1em',
              }}>
                {String(i+1).padStart(2,'0')}/04
              </div>
            </div>
          ))}
        </div>

        </div>  {/* ── end RIGHT column ── */}

        </div>  {/* ── end 2-column / 1-column wrapper ── */}

        {/* Footer signature */}
        <div style={{
          marginTop:'auto', paddingTop:'1rem',
          textAlign:'center',
          opacity: mounted ? 1 : 0,
          transition:'opacity 0.6s 1.2s ease',
        }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:'0.4rem',
            padding:'0.4rem 0.8rem',
            background:'color-mix(in srgb, var(--bg-panel) 75%, transparent)',
            border:'1px solid color-mix(in srgb, var(--accent1) 25%, transparent)',
            fontFamily:'Share Tech Mono',
            fontSize:'clamp(0.5rem,1.7vw,0.62rem)',
            color:'var(--white-dim)',
            letterSpacing:'0.15em',
          }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent1)', boxShadow:'0 0 6px var(--accent1)' }}/>
            © 2026 SQUADRANT NAVAL COMMAND
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent1)', boxShadow:'0 0 6px var(--accent1)' }}/>
          </div>
        </div>

      </div>
    </div>
  );
}
