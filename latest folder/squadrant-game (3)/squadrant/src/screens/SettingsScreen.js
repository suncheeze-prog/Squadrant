import React from 'react';
import { useApp, THEMES } from '../context/AppContext';
import GameIcon from '../components/GameIcon';

function ToggleSwitch({ on, onToggle, label }) {
  return (
    <button onClick={onToggle} aria-label={label} aria-pressed={on}
      style={{ width:50, height:26, background:on?'var(--green-dim)':'rgba(90,173,94,0.12)', border:`1px solid ${on?'var(--green-bright)':'rgba(90,173,94,0.3)'}`, borderRadius:13, cursor:'pointer', position:'relative', transition:'all 0.25s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left:on?26:3, width:18, height:18, borderRadius:'50%', background:on?'var(--green-bright)':'rgba(90,173,94,0.4)', transition:'left 0.25s' }}/>
    </button>
  );
}

function VolumeRow({ label, value, onChange, disabled, marks }) {
  return (
    <div style={{ opacity:disabled?0.4:1, transition:'opacity 0.3s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem' }}>
        <span className="label-xs">{label}</span>
        <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2vw,0.72rem)', color:'var(--green-bright)' }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={e=>onChange(Number(e.target.value))}
        disabled={disabled} style={{ width:'100%', accentColor:'var(--green-bright)', height:20, cursor:disabled?'default':'pointer' }} aria-label={label}/>
      {marks && (
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.15rem' }}>
          {['MUTE','LOW','MED','HIGH'].map((l,i)=>(
            <span key={l} onClick={()=>!disabled&&onChange([0,33,66,100][i])}
              style={{ fontSize:'0.48rem', color:'var(--green-dim)', fontFamily:'Share Tech Mono', cursor:disabled?'default':'pointer' }}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsScreen({ onBack, onHowToPlay }) {
  const { themeId, setTheme, masterVol, setMasterVol, musicVol, setMusicVol, sfxVol, setSfxVol, soundOn, toggleSound, turnTime, setTurnTime, play } = useApp();

  const TURN_OPTIONS = [
    { val: 10, label: '10s',  desc: 'Lightning' },
    { val: 20, label: '20s',  desc: 'Fast'      },
    { val: 30, label: '30s',  desc: 'Standard'  },
    { val: 60, label: '60s',  desc: 'Relaxed'   },
    { val: 0,  label: '∞',    desc: 'No limit'  },
  ];

  const handle = (fn) => () => { play('click'); fn(); };
  const panelStyle = { background:'var(--bg-card)', border:'var(--border-panel)', padding:'clamp(0.9rem,3.5vw,1.4rem)', borderRadius:2, display:'flex', flexDirection:'column', gap:'0.75rem' };

  return (
    <div className="screen" style={{ background:'var(--bg-void)', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ padding:'max(clamp(0.6rem,2.5vw,1rem), var(--safe-top)) clamp(0.8rem,3vw,1.4rem) clamp(0.6rem,2.5vw,1rem)', borderBottom:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.75rem', background:'var(--bg-panel)', position:'sticky', top:0, zIndex:10, flexShrink:0 }}>
        <button className="back-btn" onClick={handle(onBack)} aria-label="Back"><GameIcon id="back" size={16}/></button>
        <div>
          <div className="label-xs">SYSTEM</div>
          <h2 className="title-font" style={{ fontSize:'clamp(1.1rem,4.5vw,1.5rem)', color:'var(--white-cream)' }}>SETTINGS</h2>
        </div>
      </div>

      <div style={{ padding:'clamp(0.8rem,3vw,1.4rem)', paddingBottom:'max(clamp(0.8rem,3vw,1.4rem), var(--safe-bottom))', display:'flex', flexDirection:'column', gap:'clamp(0.7rem,2.5vw,1.1rem)', maxWidth:580, width:'100%', margin:'0 auto' }}>

        {/* ── AUDIO ── */}
        <div style={panelStyle}>
          <div className="label-xs">▸ AUDIO</div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <GameIcon id={soundOn?'soundOn':'soundOff'} size={20}/>
              <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.7rem,2.8vw,0.85rem)', color:'var(--white-cream)' }}>SOUND {soundOn?'ON':'OFF'}</span>
            </div>
            <ToggleSwitch on={soundOn} onToggle={handle(toggleSound)} label="Toggle all sound"/>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            <VolumeRow label="MASTER VOLUME" value={masterVol} onChange={(v)=>{setMasterVol(v);play('click');}} disabled={!soundOn} marks/>
            <VolumeRow label="🎵 MUSIC VOLUME" value={musicVol} onChange={(v)=>{setMusicVol(v);play('click');}} disabled={!soundOn}/>
            <VolumeRow label="💥 SFX VOLUME"   value={sfxVol}   onChange={(v)=>{setSfxVol(v);play('click');}}  disabled={!soundOn}/>
          </div>

          <div style={{ padding:'0.4rem 0.6rem', background:'rgba(90,173,94,0.05)', border:'1px solid rgba(90,173,94,0.1)', fontSize:'clamp(0.52rem,1.8vw,0.62rem)', color:'var(--green-dim)', fontFamily:'Share Tech Mono', lineHeight:1.5 }}>
            ℹ Tap the screen first to activate audio.
          </div>
        </div>

        {/* ── TURN TIME ── */}
        <div style={panelStyle}>
          <div className="label-xs">▸ TURN TIME — TIME PER ATTACK</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'0.5rem' }}>
            {TURN_OPTIONS.map(opt => {
              const active = turnTime === opt.val;
              return (
                <button key={opt.val} onClick={() => { play('select'); setTurnTime(opt.val); }}
                  aria-pressed={active}
                  style={{
                    padding:'clamp(0.5rem,2vw,0.7rem) 0.4rem',
                    background: active ? 'rgba(232,160,0,0.18)' : 'var(--bg-button)',
                    border:`2px solid ${active ? 'var(--amber)' : 'rgba(232,160,0,0.15)'}`,
                    cursor:'pointer',
                    color: active ? 'var(--amber)' : 'var(--white-cream)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.2rem',
                    transition:'all 0.2s',
                    clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                    boxShadow: active ? '0 0 12px rgba(232,160,0,0.25)' : 'none',
                  }}>
                  <span className="title-font" style={{ fontSize:'clamp(0.95rem,3.5vw,1.25rem)', color: active ? 'var(--amber)' : 'var(--white-cream)', letterSpacing:'0.04em', lineHeight:1 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.48rem,1.6vw,0.6rem)', color: active ? 'var(--amber)' : 'var(--white-dim)', letterSpacing:'0.05em', opacity:0.85 }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ padding:'0.35rem 0.5rem', background:'var(--bg-void)', border:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'clamp(0.52rem,1.8vw,0.62rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--amber)', boxShadow:'0 0 6px var(--amber)', flexShrink:0 }}/>
            ACTIVE: {turnTime > 0 ? `${turnTime} seconds per turn` : 'No time limit'} — Applies to the next battle
          </div>
        </div>

        {/* ── THEME ── */}
        <div style={panelStyle}>
          <div className="label-xs">▸ VISUAL THEME</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:'0.5rem' }}>
            {Object.values(THEMES).map(t => {
              const active = themeId === t.id;
              return (
                <button key={t.id} onClick={()=>{play('select');setTheme(t.id);}}
                  aria-pressed={active} aria-label={t.label}
                  style={{ padding:'clamp(0.5rem,2vw,0.75rem) 0.4rem', background:active?`${t.vars['--accent1']}22`:'var(--bg-button)', border:`2px solid ${active?t.vars['--accent1']:'rgba(90,173,94,0.15)'}`, cursor:'pointer', color:'var(--white-cream)', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem', transition:'all 0.2s', clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))' }}>
                  <span style={{ fontSize:'clamp(1.1rem,3.5vw,1.4rem)' }}>{t.icon}</span>
                  <span className="title-font" style={{ fontSize:'clamp(0.5rem,1.8vw,0.65rem)', color:active?t.vars['--accent1']:'var(--white-dim)', letterSpacing:'0.05em', lineHeight:1.2, textAlign:'center' }}>{t.label}</span>
                  {/* Color swatches */}
                  <div style={{ display:'flex', gap:2 }}>
                    {[t.vars['--bg-void'],t.vars['--green-bright'],t.vars['--amber']].map((c,i)=>(
                      <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/>
                    ))}
                  </div>
                  {active && <div style={{ width:20, height:2, background:t.vars['--accent1'] }}/>}
                </button>
              );
            })}
          </div>
          <div style={{ padding:'0.35rem 0.5rem', background:'var(--bg-void)', border:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'clamp(0.52rem,1.8vw,0.62rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green-bright)', boxShadow:'0 0 6px var(--green-bright)', flexShrink:0 }}/>
            ACTIVE: {THEMES[themeId]?.label || 'Dark Mode'} — Applies instantly to all screens
          </div>
        </div>

        {/* ── HOW TO PLAY ── */}
        {onHowToPlay && (
          <div style={panelStyle}>
            <div className="label-xs">▸ TUTORIAL</div>
            <button className="btn btn-primary" onClick={handle(onHowToPlay)}
              style={{ padding:'clamp(0.6rem,2.5vw,0.85rem)', fontSize:'clamp(0.65rem,2.5vw,0.82rem)', letterSpacing:'0.15em' }}>
              🎬 WATCH ANIMATED HOW TO PLAY
            </button>
          </div>
        )}

        {/* ── ABOUT / GAME INFO ── */}
        <div style={panelStyle}>
          <div className="label-xs">▸ ABOUT SQUADRANT</div>

          <div style={{ fontSize:'clamp(0.62rem,2.3vw,0.75rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', lineHeight:1.65 }}>
            A naval coordinate warfare game where strategy meets mathematics.
            Deploy your fleet, fortify with defenses, and plot precise attacks across the Cartesian grid.
          </div>

          {/* Info tiles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:'0.5rem', marginTop:'0.3rem' }}>
            {[
              { label:'VERSION',  value:'2.0',          color:'var(--green-bright)' },
              { label:'DIVISION', value:'NAVAL OPS',    color:'var(--green-accent)' },
              { label:'SHIPS',    value:'6 / FLEET',    color:'var(--amber)' },
              { label:'DEFENSES', value:'6 / GRID',     color:'var(--amber)' },
              { label:'NETWORK',  value:'OFFLINE LAN',  color:'var(--green-bright)' },
              { label:'GRID',     value:'CARTESIAN',    color:'var(--green-accent)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding:'0.45rem 0.55rem',
                background:'rgba(90,173,94,0.06)',
                border:'1px solid rgba(90,173,94,0.15)',
                clipPath:'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
              }}>
                <div className="label-xs" style={{ marginBottom:'0.18rem', opacity:0.7 }}>{label}</div>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:'clamp(0.68rem,2.4vw,0.82rem)', color, fontWeight:700, letterSpacing:'0.05em' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Credits line */}
          <div style={{ padding:'0.4rem 0.55rem', marginTop:'0.2rem', background:'var(--bg-void)', border:'var(--border-panel)', fontSize:'clamp(0.5rem,1.8vw,0.6rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', letterSpacing:'0.05em', textAlign:'center', lineHeight:1.5 }}>
            ⚓ COORDINATE WARFARE SYSTEM ⚓<br/>
            <span style={{ opacity:0.55 }}>© 2026 SQUADRANT NAVAL COMMAND</span>
          </div>
        </div>

        {/* ── HOW TO PLAY text ── */}
        <div style={panelStyle}>
          <div className="label-xs">▸ QUICK RULES</div>
          {[
            ['1','Place 6 ships on the coordinate grid (-10 to +10)'],
            ['2','Ships go ON grid lines — not inside boxes'],
            ['3','Type X, Y or tap the enemy grid to fire'],
            ['4','Advanced mode: enter y = mx + b equation'],
            ['5','Bomb hits cross pattern · Nuke hits 3×3 area'],
            ['6','Sink ALL enemy ships before yours are sunk to WIN'],
          ].map(([n,t])=>(
            <div key={n} style={{ display:'flex', gap:'0.5rem', padding:'0.2rem 0', borderBottom:'1px solid rgba(90,173,94,0.06)' }}>
              <div style={{ width:16, height:16, background:'var(--green-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.5rem', fontFamily:'Share Tech Mono', color:'var(--green-accent)', flexShrink:0 }}>{n}</div>
              <span style={{ fontSize:'clamp(0.58rem,2.2vw,0.72rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', lineHeight:1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
