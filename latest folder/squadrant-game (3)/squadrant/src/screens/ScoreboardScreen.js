import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import GameIcon from '../components/GameIcon';
import { getLeaderboard } from '../utils/userProfile';

export default function ScoreboardScreen({ user, onBack }) {
  const { play } = useApp();
  const [list, setList]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLeaderboard(50);
        if (!cancelled) { setList(data); setLoading(false); }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load leaderboard');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const myRank  = list && user ? list.findIndex(u => u.uid === user.uid) + 1 : 0;
  const myEntry = list && user ? list.find(u => u.uid === user.uid) : null;

  return (
    <div className="screen" style={{
      background:'var(--bg-void)', flexDirection:'column', overflow:'hidden',
    }}>
      <style>{`
        @keyframes ldrShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ldrSlide   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        .ldr-row { animation: ldrSlide 0.35s ease forwards; opacity:0; }
        .ldr-row:nth-child(1) { animation-delay: 0.04s; }
        .ldr-row:nth-child(2) { animation-delay: 0.08s; }
        .ldr-row:nth-child(3) { animation-delay: 0.12s; }
        .ldr-row:nth-child(4) { animation-delay: 0.16s; }
        .ldr-row:nth-child(5) { animation-delay: 0.20s; }
        .ldr-row:nth-child(6) { animation-delay: 0.24s; }
        .ldr-row:nth-child(7) { animation-delay: 0.28s; }
        .ldr-row:nth-child(8) { animation-delay: 0.32s; }
        .ldr-row:nth-child(9) { animation-delay: 0.36s; }
        .ldr-row:nth-child(10){ animation-delay: 0.40s; }
      `}</style>

      {/* Header */}
      <div style={{
        padding:`max(0.55rem,var(--safe-top)) clamp(0.6rem,2.5vw,1.2rem) 0.55rem`,
        borderBottom:'var(--border-panel)',
        background:'var(--bg-panel)',
        display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0,
      }}>
        <button className="back-btn" onClick={() => { play('click'); onBack(); }}>
          <GameIcon id="back" size={16}/>
        </button>
        <div style={{ flex:1 }}>
          <div className="label-xs" style={{ opacity:0.6, letterSpacing:'0.3em' }}>HALL OF FAME</div>
          <div className="title-font" style={{ fontSize:'clamp(1rem,3.5vw,1.35rem)', color:'var(--accent1)', letterSpacing:'0.05em' }}>
            🏆 LEADERBOARD
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex:1, overflowY:'auto',
        padding:'clamp(0.8rem,3vw,1.4rem)',
        paddingBottom:'max(clamp(0.8rem,3vw,1.4rem), var(--safe-bottom))',
        display:'flex', flexDirection:'column', gap:'0.6rem',
        maxWidth:'min(700px,98vw)', margin:'0 auto', width:'100%',
      }}>

        {/* Your stats card */}
        {user && (
          <div style={{
            background:'color-mix(in srgb, var(--accent1) 14%, transparent)',
            border:'1.5px solid var(--accent1)',
            padding:'clamp(0.6rem,2.2vw,0.9rem)',
            display:'flex', alignItems:'center', gap:'clamp(0.5rem,2vw,0.85rem)',
            clipPath:'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))',
          }}>
            <div style={{
              width:'clamp(40px,10vw,56px)', height:'clamp(40px,10vw,56px)',
              borderRadius:'50%',
              background:'color-mix(in srgb, var(--accent1) 25%, transparent)',
              border:'2px solid var(--accent1)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'clamp(1.1rem,3.5vw,1.5rem)',
              color:'var(--accent1)', flexShrink:0,
              textShadow:'0 0 10px var(--accent1)',
            }}>
              {myRank > 0 ? `#${myRank}` : '—'}
            </div>
            <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
              <div className="label-xs" style={{ marginBottom:'0.15rem', opacity:0.7 }}>YOUR RANK</div>
              <div className="title-font" style={{
                fontSize:'clamp(0.85rem,3vw,1.05rem)', color:'var(--white-cream)',
                letterSpacing:'0.04em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {user.username || '—'}
              </div>
            </div>
            <div style={{ display:'flex', gap:'clamp(0.5rem,1.8vw,0.8rem)', flexShrink:0 }}>
              <Stat label="WINS"   value={myEntry?.wins   ?? user.wins   ?? 0} color="var(--green-bright)"/>
              <Stat label="LOSSES" value={myEntry?.losses ?? user.losses ?? 0} color="var(--red-bright)"/>
            </div>
          </div>
        )}

        {/* Section header */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.3rem 0', marginTop:'0.4rem' }}>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent1) 45%,transparent))' }}/>
          <div className="label-xs" style={{ letterSpacing:'0.4em', color:'var(--accent1)' }}>▶ TOP COMMANDERS ◀</div>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,color-mix(in srgb,var(--accent1) 45%,transparent),transparent)' }}/>
        </div>

        {/* List */}
        {loading && (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--accent1)',
            fontFamily:'Share Tech Mono', fontSize:'clamp(0.7rem,2.5vw,0.85rem)',
            letterSpacing:'0.2em', animation:'blink 0.8s infinite' }}>
            ⟳ LOADING ROSTER...
          </div>
        )}

        {error && (
          <div style={{ padding:'0.7rem', background:'rgba(192,57,43,0.12)',
            border:'1px solid rgba(192,57,43,0.4)', color:'#ff9090',
            fontFamily:'Share Tech Mono', fontSize:'clamp(0.65rem,2.2vw,0.78rem)', textAlign:'center' }}>
            ⚠ {error}
          </div>
        )}

        {list && list.length === 0 && (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--white-dim)',
            fontFamily:'Share Tech Mono', fontSize:'clamp(0.65rem,2.2vw,0.78rem)',
            letterSpacing:'0.15em' }}>
            ◆ NO COMMANDERS RANKED YET ◆<br/>
            <span style={{ fontSize:'0.85em', opacity:0.7 }}>Win a battle to claim the throne!</span>
          </div>
        )}

        {list && list.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
            {list.map((u, i) => {
              const rank = i + 1;
              const isMe = user && u.uid === user.uid;
              const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--white-dim)';
              const rankIcon  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
              const totalGames = (u.wins||0) + (u.losses||0);
              const winRate    = totalGames > 0 ? Math.round((u.wins||0) / totalGames * 100) : 0;
              return (
                <div key={u.uid} className="ldr-row" style={{
                  display:'flex', alignItems:'center', gap:'clamp(0.45rem,1.6vw,0.7rem)',
                  padding:'clamp(0.4rem,1.5vw,0.6rem) clamp(0.5rem,1.8vw,0.75rem)',
                  background: isMe ? 'color-mix(in srgb, var(--accent1) 15%, transparent)' : 'var(--bg-panel)',
                  border:`1px solid ${isMe ? 'var(--accent1)' : 'var(--border-panel)'}`,
                  borderLeftWidth: isMe ? '3px' : '1px',
                }}>
                  <div style={{
                    width:'clamp(28px,7vw,38px)', textAlign:'center',
                    fontFamily:'Share Tech Mono', fontWeight:700,
                    fontSize:'clamp(0.85rem,2.7vw,1.05rem)',
                    color: rankColor,
                    flexShrink:0,
                  }}>
                    {rankIcon || `#${rank}`}
                  </div>
                  <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                    <div style={{
                      fontFamily:'Share Tech Mono', fontWeight:700,
                      fontSize:'clamp(0.72rem,2.5vw,0.9rem)',
                      color: isMe ? 'var(--accent1)' : 'var(--white-cream)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      letterSpacing:'0.04em',
                    }}>
                      {u.username || '???'}
                      {isMe && <span style={{ marginLeft:'0.4rem', fontSize:'0.7em', color:'var(--accent1)', opacity:0.7 }}>(YOU)</span>}
                    </div>
                    <div style={{ fontSize:'clamp(0.5rem,1.7vw,0.6rem)', color:'var(--green-dim)', fontFamily:'Share Tech Mono', marginTop:'0.1rem' }}>
                      {totalGames} battles · {winRate}% win rate
                    </div>
                  </div>
                  <Stat label="W" value={u.wins   || 0} color="var(--green-bright)" compact/>
                  <Stat label="L" value={u.losses || 0} color="var(--red-bright)"   compact/>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <div style={{
          marginTop:'1rem',
          padding:'0.4rem 0.6rem', background:'var(--bg-panel)', border:'var(--border-panel)',
          fontSize:'clamp(0.52rem,1.8vw,0.62rem)', color:'var(--white-dim)',
          fontFamily:'Share Tech Mono', textAlign:'center', letterSpacing:'0.08em', opacity:0.7,
        }}>
          ⚓ Stats updated after every battle · Wins from all modes count
        </div>
      </div>
    </div>
  );
}

/** Compact stat chip */
function Stat({ label, value, color, compact }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      padding: compact ? '0.15rem 0.4rem' : '0.2rem 0.5rem',
      background:`color-mix(in srgb, ${color} 12%, transparent)`,
      border:`1px solid ${color}`,
      minWidth: compact ? 36 : 48,
      clipPath:'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))',
    }}>
      <div style={{ fontSize: compact ? 'clamp(0.4rem,1.3vw,0.5rem)' : 'clamp(0.45rem,1.5vw,0.55rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', lineHeight:1, opacity:0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: compact ? 'clamp(0.7rem,2.4vw,0.85rem)' : 'clamp(0.85rem,3vw,1.05rem)', color, fontFamily:'Share Tech Mono', fontWeight:700, lineHeight:1.1 }}>
        {value}
      </div>
    </div>
  );
}
