import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import GameIcon from '../components/GameIcon';

/* ── Cinematic animated How To Play demo ──────────────────────────────── */

const STEPS = [
  {
    id: 'grid',
    title: 'THE COORDINATE GRID',
    sub: 'The battlefield uses a standard coordinate plane from -10 to +10',
    duration: 4000,
  },
  {
    id: 'ships',
    title: 'DEPLOY YOUR FLEET',
    sub: 'Place 6 ships on the grid lines — tap to select, tap grid to place',
    duration: 4500,
  },
  {
    id: 'attack',
    title: 'ENTER ATTACK COORDINATES',
    sub: 'Type X and Y to fire — or tap directly on the enemy grid',
    duration: 4000,
  },
  {
    id: 'advanced',
    title: 'ADVANCED: LINEAR EQUATIONS',
    sub: 'Enter y = mx + b and solve for x to calculate your target point',
    duration: 5000,
  },
  {
    id: 'weapons',
    title: 'SPECIAL WEAPONS',
    sub: 'Rocket hits 1 point · Air Bomb hits a cross · Nuke hits a 3×3 area',
    duration: 4500,
  },
  {
    id: 'win',
    title: 'SINK ALL ENEMY SHIPS',
    sub: 'The first fleet to be completely sunk loses — coordinate wisely!',
    duration: 4000,
  },
];

/* Mini SVG grid for animation */
function AnimGrid({ size = 200, highlights = [], ships = [], misses = [] }) {
  const cells = 11; // -5 to 5 visible
  const cell  = (size - 24) / cells;
  const label = 24;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect x={label} y={0} width={size-label} height={size-label} fill="rgba(5,15,6,0.9)" stroke="rgba(90,173,94,0.25)" strokeWidth="1"/>
      {Array(cells+1).fill(0).map((_,i) => (
        <g key={i}>
          <line x1={label+i*cell} y1={0} x2={label+i*cell} y2={size-label} stroke={i===Math.floor(cells/2)?'rgba(90,173,94,0.55)':'rgba(90,173,94,0.1)'} strokeWidth={i===Math.floor(cells/2)?1.5:0.5}/>
          <line x1={label} y1={i*cell} x2={size} y2={i*cell} stroke={i===Math.floor(cells/2)?'rgba(90,173,94,0.55)':'rgba(90,173,94,0.1)'} strokeWidth={i===Math.floor(cells/2)?1.5:0.5}/>
        </g>
      ))}
      {/* Axis labels */}
      {[-5,-3,-1,0,1,3,5].map((v,i) => {
        const ci = v + 5;
        return <g key={v}>
          <text x={label+ci*cell+cell/2} y={size-label+12} textAnchor="middle" fill="rgba(90,173,94,0.55)" fontSize={7} fontFamily="Share Tech Mono">{v}</text>
          <text x={label-3} y={(cells-ci-1)*cell+cell/2+3} textAnchor="end" fill="rgba(90,173,94,0.55)" fontSize={7} fontFamily="Share Tech Mono">{v}</text>
        </g>;
      })}
      {/* Ships */}
      {ships.map((s,i) => {
        const c = s[0]+5, r = 5-s[1];
        return <rect key={i} x={label+c*cell+1} y={r*cell+1} width={cell-2} height={cell-2} fill={['#2d6b2f','#1e5c3a','#3a6b1e'][i%3]} rx={1}/>;
      })}
      {/* Highlights */}
      {highlights.map((h,i) => {
        const c = h[0]+5, r = 5-h[1];
        return <rect key={i} x={label+c*cell+0.5} y={r*cell+0.5} width={cell-1} height={cell-1} fill="rgba(232,160,0,0.4)" stroke="rgba(232,160,0,0.9)" strokeWidth={1.5} rx={1}/>;
      })}
      {/* Misses */}
      {misses.map((m,i) => {
        const c = m[0]+5, r = 5-m[1];
        return <circle key={i} cx={label+c*cell+cell/2} cy={r*cell+cell/2} r={cell*0.22} fill="rgba(100,150,200,0.7)"/>;
      })}
    </svg>
  );
}

/* HP bar animation */
function HPBar({ hp, maxHp = 20, label, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontFamily: 'Share Tech Mono', color: 'var(--white-dim)' }}>
        <span>{label}</span><span style={{ color }}>{hp}/{maxHp}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(90,173,94,0.1)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(hp/maxHp)*100}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }}/>
      </div>
    </div>
  );
}

/* Step renderers */
function StepGrid({ progress }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <AnimGrid size={180} />
      <div style={{ display: 'flex', gap: '1.5rem', fontFamily: 'Share Tech Mono', fontSize: '0.65rem', color: 'var(--white-dim)' }}>
        <span>X axis: <span style={{ color: 'var(--green-bright)' }}>-10 to 10</span></span>
        <span>Y axis: <span style={{ color: 'var(--green-bright)' }}>-10 to 10</span></span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['(0,0)','(3,4)',(-2,-3)].map((c,i) => (
          <div key={i} style={{ padding: '0.25rem 0.5rem', background: 'rgba(90,173,94,0.1)', border: 'var(--border-panel)', fontFamily: 'Share Tech Mono', fontSize: '0.65rem', color: 'var(--green-accent)' }}>{String(c)}</div>
        ))}
      </div>
    </div>
  );
}

function StepShips({ progress }) {
  const showShips = progress > 0.2;
  const ships = showShips ? [[1,2],[2,2],[3,2]] : [];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <AnimGrid size={160} ships={ships} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {[{n:'Carrier',s:5},{n:'Battleship',s:4},{n:'Cruiser',s:3}].map((sh,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', background: progress>(i*0.25+0.15)?'rgba(40,100,42,0.25)':'rgba(20,40,20,0.4)', border: `1px solid ${progress>(i*0.25+0.15)?'rgba(90,173,94,0.5)':'rgba(90,173,94,0.1)'}`, transition: 'all 0.4s', fontSize: '0.65rem', fontFamily: 'Share Tech Mono', color: 'var(--white-dim)' }}>
            <GameIcon id="anchor" size={14}/> {sh.n} <span style={{ marginLeft: 'auto', color: 'var(--green-dim)' }}>{'▬'.repeat(sh.s)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepAttack({ progress }) {
  const fired = progress > 0.5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <AnimGrid size={160} highlights={fired?[[2,1]]:[]} misses={fired?[[-1,-2],[0,3]]:[]} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: '0.65rem', color: 'var(--white-dim)' }}>ATTACK PANEL</div>
        {['X', 'Y'].map((ax,i) => (
          <div key={ax} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--white-cream)', fontFamily: 'Share Tech Mono', width: 14 }}>{ax}</span>
            <div style={{ padding: '0.3rem 0.5rem', background: 'var(--bg-card)', border: 'var(--border-panel)', fontFamily: 'Share Tech Mono', fontSize: '0.7rem', color: 'var(--green-bright)', width: 60, textAlign: 'center' }}>
              {fired ? (i===0?'2':'1') : '—'}
            </div>
          </div>
        ))}
        <div style={{ padding: '0.35rem 0.6rem', background: 'var(--green-dim)', border: '1px solid var(--green-bright)', fontSize: '0.65rem', fontFamily: 'Share Tech Mono', color: 'var(--white-cream)', textAlign: 'center', cursor: 'default' }}>
          🚀 FIRE!
        </div>
        {fired && <div style={{ fontSize: '0.62rem', fontFamily: 'Share Tech Mono', color: '#ff6b6b', animation: 'pulse 0.8s infinite' }}>💥 HIT!</div>}
      </div>
    </div>
  );
}

function StepAdvanced({ progress }) {
  const m = 2, b = -1, xv = 3;
  const yv = m * xv + b;
  const show2 = progress > 0.4;
  const show3 = progress > 0.7;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', width: '100%', maxWidth: 340 }}>
      <div style={{ padding: '0.5rem 1rem', background: 'rgba(232,160,0,0.08)', border: '1px solid rgba(232,160,0,0.3)', fontFamily: 'Share Tech Mono', fontSize: 'clamp(0.65rem,2.5vw,0.8rem)', color: 'var(--amber)', textAlign: 'center' }}>
        y = mx + b
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
        {[['m (slope)', m, true], ['b (intercept)', b, show2], ['x value', xv, show3]].map(([l,v,show]) => (
          <div key={l} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', opacity: show?1:0, transition: 'opacity 0.5s' }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'Share Tech Mono', color: 'var(--white-dim)', width: 90, flexShrink: 0 }}>{l}</span>
            <div style={{ flex:1, padding: '0.25rem 0.4rem', background: 'var(--bg-card)', border: 'var(--border-panel)', fontFamily: 'Share Tech Mono', fontSize: '0.7rem', color: 'var(--green-bright)', textAlign: 'center' }}>{v}</div>
          </div>
        ))}
      </div>
      {show3 && (
        <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(90,173,94,0.1)', border: 'var(--border-panel)', fontFamily: 'Share Tech Mono', fontSize: '0.72rem', color: 'var(--green-accent)', animation: 'screenIn 0.3s ease', textAlign: 'center' }}>
          y = {m}({xv}) + {b} = <span style={{ color: 'var(--amber)' }}>{yv}</span> → Target ({xv},{yv})
        </div>
      )}
    </div>
  );
}

function StepWeapons({ progress }) {
  const wpns = [
    { id:'rocket', name:'Rocket', desc:'Single point strike', pattern:[[0,0]], color:'#5aad5e' },
    { id:'bomb',   name:'Air Bomb', desc:'Cross pattern (5 cells)', pattern:[[0,0],[1,0],[-1,0],[0,1],[0,-1]], color:'#e8a000' },
    { id:'nuke',   name:'Nuke', desc:'3×3 area (9 cells)', pattern:[...Array(9).keys()].map(i=>[(i%3)-1,Math.floor(i/3)-1]), color:'#e74c3c' },
  ];
  const active = Math.floor(progress * wpns.length);
  const w = wpns[Math.min(active, wpns.length-1)];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {wpns.map((ww, i) => (
          <div key={ww.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background: i===Math.min(active,wpns.length-1)?`${ww.color}22`:'rgba(15,30,15,0.5)', border:`1px solid ${i===Math.min(active,wpns.length-1)?ww.color:'rgba(90,173,94,0.1)'}`, fontSize:'0.62rem', fontFamily:'Share Tech Mono', color:i===Math.min(active,wpns.length-1)?ww.color:'var(--white-dim)', transition:'all 0.3s' }}>
            <GameIcon id={ww.id} size={14}/>{ww.name}<span style={{marginLeft:'auto',opacity:0.6}}>{ww.desc}</span>
          </div>
        ))}
      </div>
      <AnimGrid size={140} highlights={w.pattern} />
    </div>
  );
}

function StepWin({ progress }) {
  const [p1hp, setP1hp] = useState(20);
  const [p2hp, setP2hp] = useState(20);
  useEffect(() => {
    setP1hp(Math.max(0, Math.round(20 - progress*8)));
    setP2hp(Math.max(0, Math.round(20 - progress*20)));
  }, [progress]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: 320 }}>
      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
        <HPBar hp={p1hp} label="SQUAD 1" color="var(--green-bright)"/>
        <HPBar hp={p2hp} label="SQUAD 2" color="var(--red-bright)"/>
      </div>
      <AnimGrid size={160} misses={progress>0.3?[[-2,2],[0,1],[2,0]]:[] } highlights={progress>0.6?[[1,-1]]:[] } />
      {p2hp === 0 && (
        <div className="title-font" style={{ fontSize: 'clamp(1.2rem,5vw,1.8rem)', color: 'var(--green-bright)', animation: 'logoGlow 1s ease-in-out infinite' }}>
          VICTORY!
        </div>
      )}
      <style>{'@keyframes logoGlow{0%,100%{text-shadow:0 0 15px rgba(90,173,94,0.7)}50%{text-shadow:0 0 35px rgba(90,173,94,1),0 0 60px rgba(90,173,94,0.4)}}'}</style>
    </div>
  );
}

const RENDERERS = { grid: StepGrid, ships: StepShips, attack: StepAttack, advanced: StepAdvanced, weapons: StepWeapons, win: StepWin };

/* ── Main screen ─────────────────────────────────────────────────────── */
export default function HowToPlayScreen({ onBack }) {
  const { play } = useApp();
  const [step, setStep]       = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused]   = useState(false);
  
  const timerRef = useRef(null);
  const progRef  = useRef(null);

  const current = STEPS[step];
  const StepComp = RENDERERS[current.id];

  // Auto-advance
  useEffect(() => {
    if (paused) { clearInterval(progRef.current); return; }
    setProgress(0);
    const dur = current.duration;
    const fps = 30;
    const inc = 1 / (dur / (1000/fps));
    progRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 1) {
          clearInterval(progRef.current);
          timerRef.current = setTimeout(() => {
            setStep(s => (s+1) % STEPS.length);
          }, 300);
          return 1;
        }
        return p + inc;
      });
    }, 1000/fps);
    return () => { clearInterval(progRef.current); clearTimeout(timerRef.current); };
  }, [step, paused, current.duration]);

  const goStep = (i) => { play('click'); setStep(i); setProgress(0); };
  const togglePause = () => { play('click'); setPaused(p => !p); };

  return (
    <div className="screen" style={{ background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 'clamp(0.6rem,2.5vw,1rem) clamp(0.8rem,3vw,1.4rem)', borderBottom: 'var(--border-panel)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-panel)', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => { play('click'); onBack(); }} aria-label="Back"><GameIcon id="back" size={16}/></button>
        <div>
          <div className="label-xs">TUTORIAL</div>
          <h2 className="title-font" style={{ fontSize: 'clamp(1rem,4.5vw,1.35rem)', color: 'var(--white-cream)' }}>HOW TO PLAY</h2>
        </div>
        <button onClick={togglePause} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--green-bright)', cursor: 'pointer', fontSize: '1.2rem' }}>
          {paused ? '▶' : '⏸'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(90,173,94,0.1)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${((step + progress) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, var(--green-dim), var(--green-bright))', transition: 'width 0.1s linear' }}/>
      </div>

      {/* Main demo area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1rem,4vw,2rem)', overflow: 'hidden', gap: '1.5rem' }}>
        {/* Step title */}
        <div style={{ textAlign: 'center' }}>
          <div className="label-xs" style={{ letterSpacing: '0.3em', marginBottom: '0.4rem' }}>STEP {step+1} OF {STEPS.length}</div>
          <h3 className="title-font" style={{ fontSize: 'clamp(1rem,5vw,1.5rem)', color: 'var(--green-bright)', letterSpacing: '0.08em', animation: 'screenIn 0.4s ease' }}>
            {current.title}
          </h3>
          <p style={{ fontFamily: 'Share Tech Mono', fontSize: 'clamp(0.6rem,2.5vw,0.78rem)', color: 'var(--white-dim)', marginTop: '0.4rem', lineHeight: 1.5, maxWidth: 400 }}>
            {current.sub}
          </p>
        </div>

        {/* Animation area */}
        <div style={{ background: 'rgba(10,26,11,0.6)', border: 'var(--border-panel)', padding: 'clamp(1rem,4vw,1.8rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, width: '100%', maxWidth: 500, animation: 'screenIn 0.35s ease' }}>
          <StepComp progress={progress} />
        </div>

        {/* Pause notice */}
        {paused && (
          <div style={{ fontSize: 'clamp(0.6rem,2.2vw,0.72rem)', fontFamily: 'Share Tech Mono', color: 'var(--amber)', animation: 'pulse 1s infinite' }}>
            ⏸ PAUSED — Press ▶ to continue
          </div>
        )}
      </div>

      {/* Step nav */}
      <div style={{ padding: 'clamp(0.6rem,2vw,0.9rem)', borderTop: 'var(--border-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(0.4rem,1.5vw,0.6rem)', flexShrink: 0, background: 'var(--bg-panel)', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => goStep(i)} aria-label={s.title}
            style={{ width: 'clamp(28px,7vw,38px)', height: 'clamp(28px,7vw,38px)', background: i===step?'var(--green-dim)':'var(--bg-card)', border: `1px solid ${i===step?'var(--green-bright)':'rgba(90,173,94,0.2)'}`, color: i===step?'var(--green-accent)':'var(--white-dim)', fontSize: 'clamp(0.5rem,1.8vw,0.62rem)', fontFamily: 'Share Tech Mono', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {i+1}
          </button>
        ))}
        <button className="btn btn-primary" onClick={() => { play('click'); onBack(); }}
          style={{ padding: 'clamp(0.35rem,1.5vw,0.5rem) clamp(0.6rem,2.5vw,1rem)', fontSize: 'clamp(0.55rem,2vw,0.7rem)', letterSpacing: '0.15em', flexShrink: 0 }}>
          START PLAYING ▶
        </button>
      </div>
    </div>
  );
}
