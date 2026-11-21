import React, { useState, useEffect } from 'react';
import GameIcon from '../components/GameIcon';
import { useApp, THEMES } from '../context/AppContext';
import { LEVELS, getLevelProgress } from '../utils/levels';

export default function ModeSelectScreen({ mode, onBack, onConfirm }) {
  const { play } = useApp();
  const [step, setStep]         = useState(1);
  const [subMode, setSubMode]   = useState(null);
  const [progress]              = useState(() => getLevelProgress());
  const [toast, setToast]       = useState(null);
  const isVsComputer = mode === 'vs-computer';
  const lockLevels   = isVsComputer;

  useEffect(() => { if (isVsComputer && step === 1) setStep(2); }, [isVsComputer, step]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const handleDiff = (diff) => {
    const level = LEVELS.find(l => l.id === diff);
    if (!level) return;

    if (lockLevels && !progress.unlocked.includes(diff)) {
      const idx  = LEVELS.findIndex(l => l.id === diff);
      const prev = idx > 0 ? LEVELS[idx - 1] : null;
      play('miss');
      setToast(`🔒 WIN ${prev ? prev.label : 'THE PREVIOUS THEATER'} TO UNLOCK ${level.label}`);
      return;
    }

    play('select');
    setTimeout(() => onConfirm({ subMode: subMode || 'vs-computer', difficulty: diff }), 200);
  };

  const handleSub = (sm) => {
    play('select'); setSubMode(sm); setStep(2);
  };

  const breadcrumb = isVsComputer
    ? 'VS COMPUTER >> THEATER'
    : step === 1 ? 'PLAYER VS PLAYER >> MODE' : 'PLAYER VS PLAYER >> BATTLEFIELD';

  const unlockedCount = progress.unlocked.length;

  return (
    <div className="screen" style={{ background:'var(--bg-void)', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ padding:'max(clamp(0.7rem,3vw,1.2rem), var(--safe-top)) clamp(0.8rem,3vw,1.5rem) clamp(0.7rem,3vw,1.2rem)', borderBottom:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.75rem', background:'var(--bg-panel)', position:'sticky', top:0, zIndex:10 }}>
        <button className="back-btn" onClick={()=>{ play('click'); step===2&&!isVsComputer ? setStep(1) : onBack(); }} aria-label="Back">
          <GameIcon id="back" size={16}/>
        </button>
        <div>
          <div className="label-xs">{breadcrumb}</div>
          <h2 className="title-font" style={{ fontSize:'clamp(1.1rem,5vw,1.5rem)', color:'var(--white-cream)' }}>
            {step===2 ? (isVsComputer ? 'SELECT THEATER' : 'SELECT BATTLEFIELD') : isVsComputer ? 'VS. COMPUTER' : 'SELECT MODE'}
          </h2>
        </div>
      </div>

      <div style={{ padding:'clamp(1rem,4vw,2rem)', paddingBottom:'max(clamp(1rem,4vw,2rem), var(--safe-bottom))', display:'flex', flexDirection:'column', gap:'clamp(0.7rem,2.5vw,1rem)', maxWidth:520, width:'100%', margin:'0 auto' }}>

        {/* PvP sub-mode */}
        {!isVsComputer && step===1 && [
          { id:'pass-play',   label:'PASS & PLAY',   desc:'2 players, 1 device — take turns passing', icon:'📱', note:null },
          { id:'create-room', label:'CREATE A ROOM', desc:'2 players on separate devices (network)', icon:'🌐', note:'DEMO ONLY' },
        ].map((m,i) => (
          <button key={m.id} onClick={()=>{ if(!m.note) handleSub(m.id); }}
            style={{ width:'100%', padding:'clamp(1rem,4vw,1.5rem)', background:'var(--bg-card)', border:'var(--border-panel)', cursor:m.note?'not-allowed':'pointer', color:'var(--white-cream)', display:'flex', alignItems:'center', gap:'clamp(0.8rem,3vw,1.2rem)', transition:'all 0.2s', textAlign:'left', opacity:m.note?0.55:1, animation:`screenIn 0.4s ${i*0.1}s both`, clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))' }}
            onMouseEnter={e=>{ if(!m.note) e.currentTarget.style.borderColor='rgba(90,173,94,0.6)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(90,173,94,0.2)'; }}>
            <span style={{ fontSize:'clamp(1.6rem,6vw,2.2rem)', flexShrink:0 }}>{m.icon}</span>
            <div>
              <div className="title-font" style={{ fontSize:'clamp(0.9rem,4vw,1.15rem)', color:'var(--green-bright)' }}>{m.label}</div>
              <div style={{ fontSize:'clamp(0.62rem,2.5vw,0.78rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', marginTop:'0.15rem', lineHeight:1.4 }}>{m.desc}</div>
              {m.note && <div style={{ fontSize:'clamp(0.52rem,1.8vw,0.62rem)', color:'var(--amber)', fontFamily:'Share Tech Mono', marginTop:'0.2rem' }}>⚠ {m.note}</div>}
            </div>
            {!m.note && <div style={{ marginLeft:'auto', color:'var(--green-dim)', fontSize:'1.1rem', flexShrink:0 }}>▶</div>}
          </button>
        ))}

        {/* Campaign progress (VS Computer only) */}
        {step===2 && isVsComputer && (
          <div style={{
            padding:'clamp(0.6rem,2.5vw,0.85rem)',
            background:'var(--bg-card)',
            border:'var(--border-panel)',
            animation:'screenIn 0.35s both',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
              <span className="label-xs">▸ CAMPAIGN PROGRESS</span>
              <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.52rem,2vw,0.64rem)', color:'var(--amber)', fontWeight:700 }}>
                {unlockedCount}/{LEVELS.length} THEATERS
              </span>
            </div>
            <div className="progress-bar" style={{ marginTop:'0.45rem', height:4 }}>
              <div style={{
                height:'100%',
                width:`${(unlockedCount / LEVELS.length) * 100}%`,
                background:'linear-gradient(90deg,var(--green-bright),var(--amber))',
                transition:'width 0.4s ease',
              }}/>
            </div>
            <div style={{ fontSize:'clamp(0.52rem,2vw,0.64rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', marginTop:'0.35rem', lineHeight:1.5 }}>
              Win a VS Computer battle to unlock the next theater. Progress is saved on this device.
            </div>
          </div>
        )}

        {step===2 && !isVsComputer && (
          <div style={{
            padding:'0.45rem 0.6rem',
            background:'rgba(90,173,94,0.07)',
            border:'1px solid rgba(90,173,94,0.25)',
            fontFamily:'Share Tech Mono',
            fontSize:'clamp(0.54rem,2vw,0.66rem)',
            color:'var(--green-accent)',
            letterSpacing:'0.08em',
            animation:'screenIn 0.35s both',
          }}>
            ✓ ALL THEATERS OPEN — LOCAL PVP
          </div>
        )}

        {/* Theaters / difficulty */}
        {step===2 && LEVELS.map((d,i) => {
          const theme    = THEMES[d.theme];
          const accent   = theme?.vars['--green-bright'] || d.color;
          const unlocked = !lockLevels || progress.unlocked.includes(d.id);
          const done     = progress.completed.includes(d.id);
          const idx      = LEVELS.findIndex(l => l.id === d.id);
          const prev     = idx > 0 ? LEVELS[idx - 1] : null;

          return (
            <button key={d.id} onClick={()=>handleDiff(d.id)} disabled={!unlocked}
              style={{
                width:'100%', padding:'clamp(1rem,4vw,1.5rem)',
                background: unlocked ? 'var(--bg-card)' : 'rgba(20,20,20,0.45)',
                border:`1px solid ${unlocked ? `${accent}66` : 'rgba(90,90,90,0.25)'}`,
                cursor:unlocked ? 'pointer' : 'not-allowed',
                color:'var(--white-cream)',
                display:'flex', alignItems:'center', gap:'clamp(0.8rem,3vw,1.2rem)',
                transition:'all 0.2s', textAlign:'left',
                animation:`screenIn 0.4s ${i*0.1}s both`,
                clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))',
                position:'relative', overflow:'hidden',
                opacity: unlocked ? 1 : 0.62,
              }}
              onMouseEnter={e=>{ if(unlocked){ e.currentTarget.style.borderColor=`${accent}aa`; e.currentTarget.style.boxShadow=`0 0 28px ${accent}22`; e.currentTarget.style.background=`${accent}0a`; } }}
              onMouseLeave={e=>{ if(unlocked){ e.currentTarget.style.borderColor=`${accent}66`; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='var(--bg-card)'; } }}>
              {/* Left accent bar */}
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:unlocked ? accent : '#555', opacity:0.8 }}/>
              {unlocked
                ? <GameIcon id={d.iconId} size={26} style={{flexShrink:0, marginLeft:'0.2rem'}} />
                : <span style={{ fontSize:'clamp(1.2rem,4vw,1.5rem)', flexShrink:0, marginLeft:'0.2rem', opacity:0.7 }}>🔒</span>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', flexWrap:'wrap' }}>
                  <div className="title-font" style={{ fontSize:'clamp(0.9rem,4vw,1.15rem)', color:unlocked ? accent : 'rgba(160,160,160,0.65)', letterSpacing:'0.05em' }}>{d.label}</div>
                  {done && (
                    <span style={{ padding:'0.08rem 0.35rem', background:'rgba(90,173,94,0.14)', border:'1px solid rgba(90,173,94,0.4)', color:'var(--green-bright)', fontFamily:'Share Tech Mono', fontSize:'clamp(0.42rem,1.6vw,0.52rem)', letterSpacing:'0.1em' }}>✓ CLEARED</span>
                  )}
                  {!unlocked && (
                    <span style={{ padding:'0.08rem 0.35rem', background:'rgba(192,57,43,0.14)', border:'1px solid rgba(192,57,43,0.4)', color:'#ff8a80', fontFamily:'Share Tech Mono', fontSize:'clamp(0.42rem,1.6vw,0.52rem)', letterSpacing:'0.1em' }}>LOCKED</span>
                  )}
                </div>
                <div className="label-xs" style={{ marginTop:'0.16rem', color:unlocked ? accent : 'rgba(150,150,150,0.45)', opacity:unlocked ? 0.9 : 0.7 }}>
                  {d.codename} · {theme?.icon} {theme?.label}
                </div>
                <div style={{ fontSize:'clamp(0.62rem,2.5vw,0.78rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', marginTop:'0.15rem', lineHeight:1.4 }}>
                  {unlocked ? d.desc : `Win ${prev ? prev.label : 'the previous theater'} to unlock this theater.`}
                </div>
              </div>
              <div style={{ color:unlocked ? accent : 'rgba(150,150,150,0.45)', fontSize:'1.1rem', flexShrink:0, opacity:0.8 }}>
                {unlocked ? '▶' : '🔒'}
              </div>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="toast warn" style={{ position:'absolute', zIndex:50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
