import React, { useState, useCallback, useEffect, useRef } from 'react';
import CoordGrid from '../components/CoordGrid';
import GameIcon from '../components/GameIcon';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import { DEFENSES, placeDefenseOnGrid, gcFromGrid } from '../utils/gameLogic';

const TIME_LIMIT = 90; // 1:30

/**
 * Defense Placement Screen
 * - Receives `shipGrid` from prior ShipPlacement step (already has ships on it)
 * - Player places 6 defense structures on the same grid
 * - Defenses absorb attacks during gameplay
 */
export default function DefensePlacementScreen({ playerLabel = 'PLAYER 1', shipGrid, onDone, onBack }) {
  const { play, startBg, stopBg } = useApp();
  const { isPortrait } = useOrientation();

  const gridConfig = useRef(gcFromGrid(shipGrid)).current;

  const [grid, setGrid]            = useState(shipGrid);
  const [placedDefs, setPlaced]    = useState([]);
  const [history, setHistory]      = useState([]);
  const [selectedDef, setSelected] = useState(DEFENSES[0]);
  const [orientation, setOrient]   = useState('h'); // 'h' | 'v' | 'd'
  const [message, setMessage]      = useState(null);
  const [timeLeft, setTimeLeft]    = useState(TIME_LIMIT);
  const [gridPx, setGridPx]        = useState(260);
  const gridWrap  = useRef(null);
  const timerRef  = useRef(null);
  const msgTimer  = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!gridWrap.current) return;
      const { width, height } = gridWrap.current.getBoundingClientRect();
      if (isPortrait) setGridPx(Math.floor(Math.min(width, height) * 0.96));
      else            setGridPx(Math.floor(Math.min(width, height - 90) * 0.97));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (gridWrap.current) ro.observe(gridWrap.current);
    return () => ro.disconnect();
  }, [isPortrait]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleAutoPlace(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line

  useEffect(() => { startBg(); return () => stopBg(); }, []); // eslint-disable-line

  const showMsg = (text, ok = true) => {
    clearTimeout(msgTimer.current);
    setMessage({ text, ok });
    msgTimer.current = setTimeout(() => setMessage(null), 2000);
  };

  const handlePlace = useCallback((x, y) => {
    if (!selectedDef) return;
    const result = placeDefenseOnGrid(grid, selectedDef, x, y, orientation);
    if (!result) { play('miss'); showMsg(`⚠ Cannot place ${selectedDef.name} here`, false); return; }
    play('deploy');
    const newPlaced = [...placedDefs, selectedDef];
    setHistory(h => [...h, { def: selectedDef, grid, placed: placedDefs }]);
    setGrid(result);
    setPlaced(newPlaced);
    showMsg(`✓ ${selectedDef.name} deployed!`, true);
    const remaining = DEFENSES.filter(d => !newPlaced.find(p => p.id === d.id));
    setSelected(remaining[0] || null);
  }, [grid, selectedDef, orientation, placedDefs, play]);

  const handleUndo = () => {
    if (history.length === 0) return;
    play('click');
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setGrid(prev.grid);
    setPlaced(prev.placed);
    setSelected(prev.def);
    showMsg('↩ Placement undone', true);
  };

  const handleAutoPlace = useCallback(() => {
    play('deploy');
    let g = shipGrid; // start fresh from the ship-only grid
    const placed = [];
    const orients = ['h', 'v', 'd'];
    for (const def of DEFENSES) {
      let ok = false, tries = 0;
      while (!ok && tries < 1500) {
        const x = Math.floor(Math.random() * gridConfig.size) + gridConfig.min;
        const y = Math.floor(Math.random() * gridConfig.size) + gridConfig.min;
        const o = orients[Math.floor(Math.random() * orients.length)];
        const res = placeDefenseOnGrid(g, def, x, y, o);
        if (res) { g = res; placed.push(def); ok = true; }
        tries++;
      }
    }
    setGrid(g); setPlaced(placed); setSelected(null); setHistory([]);
    showMsg('⚡ Defenses auto-deployed!', true);
  }, [play, gridConfig, shipGrid]);

  const handleDeploy = () => {
    play('select');
    clearInterval(timerRef.current);
    onDone(grid);
  };

  const allPlaced = placedDefs.length >= DEFENSES.length;
  const pct       = (timeLeft / TIME_LIMIT) * 100;
  const timeColor = timeLeft < 20 ? 'var(--red-bright)' : timeLeft < 45 ? 'var(--amber)' : 'var(--green-bright)';

  /** Defense item button — looks like a bunker tile */
  const DefenseTile = ({ def, size = 50 }) => {
    const placed = !!placedDefs.find(p => p.id === def.id);
    const sel    = selectedDef?.id === def.id;
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:placed?'default':'pointer' }}
        onClick={() => { if (!placed) { play('click'); setSelected(def); } }}>
        <div style={{
          width:size, height:size,
          background: placed ? 'rgba(50,50,40,0.4)' : sel ? 'rgba(90,80,40,0.45)' : 'rgba(50,45,30,0.5)',
          border: `2px solid ${placed ? 'rgba(120,110,80,0.3)' : sel ? '#d4b870' : 'rgba(180,160,90,0.5)'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.18s',
          boxShadow: sel ? '0 0 14px rgba(232,200,90,0.5), 0 0 0 3px rgba(232,200,90,0.15)' : 'none',
          flexShrink:0,
        }}>
          {placed
            ? <span role="img" style={{ fontSize:size*0.4, lineHeight:1, opacity:0.6 }}>✅</span>
            : <span role="img" style={{ fontSize:size*0.5, lineHeight:1 }}>{def.symbol}</span>
          }
        </div>
        <div style={{
          fontSize:'clamp(0.36rem,1.1vw,0.48rem)',
          color: sel ? 'var(--amber)' : placed ? 'rgba(180,160,90,0.4)' : 'rgba(180,160,90,0.6)',
          fontFamily:'Share Tech Mono', textAlign:'center', lineHeight:1.3,
          letterSpacing:'0.02em', maxWidth:size+4, wordBreak:'break-word',
        }}>
          {def.name.length > 7 ? def.name.slice(0, 7) : def.name}<br/>{def.size}u
        </div>
      </div>
    );
  };

  const Toast = () => message ? (
    <div style={{
      position:'absolute', bottom:'clamp(0.4rem,2vw,0.8rem)', left:'50%', transform:'translateX(-50%)',
      padding:'0.35rem 0.9rem',
      background: message.ok?'rgba(40,100,42,0.92)':'rgba(192,57,43,0.92)',
      border:`1px solid ${message.ok?'rgba(90,173,94,0.5)':'rgba(192,57,43,0.5)'}`,
      fontSize:'clamp(0.6rem,2.2vw,0.75rem)', fontFamily:'Share Tech Mono',
      color:'var(--white-cream)', whiteSpace:'nowrap',
      pointerEvents:'none', animation:'slideUp 0.25s ease',
      backdropFilter:'blur(4px)', zIndex:10,
    }}>
      {message.text}
    </div>
  ) : null;

  // ═══════════════ PORTRAIT ═══════════════
  if (isPortrait) {
    return (
      <div className="screen" style={{ background:'var(--bg-void)', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{
          background:'var(--bg-panel)', borderBottom:'var(--border-panel)',
          display:'flex', alignItems:'center', flexWrap:'nowrap',
          padding:`max(clamp(0.4rem,2vw,0.6rem),var(--safe-top)) clamp(0.6rem,3vw,1rem) clamp(0.4rem,2vw,0.6rem)`,
          gap:'0.5rem', flexShrink:0, overflow:'hidden',
          minHeight:'clamp(50px,8vh,62px)',
        }}>
          <button className="back-btn" onClick={()=>{play('click');onBack();}} style={{width:36,height:36,flexShrink:0}}>
            <GameIcon id="back" size={15}/>
          </button>
          <div style={{overflow:'hidden',flex:1,minWidth:0}}>
            <div className="label-xs" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',opacity:0.6}}>{playerLabel}</div>
            <div className="title-font" style={{fontSize:'clamp(0.75rem,3.5vw,1rem)',color:'var(--amber)',whiteSpace:'nowrap'}}>DEFENSES</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,flexShrink:0}}>
            <div className="title-font" style={{fontSize:'clamp(0.9rem,4vw,1.15rem)',color:timeColor,fontFamily:'Share Tech Mono',lineHeight:1}}>
              {String(Math.floor(timeLeft/60)).padStart(2,'0')}:{String(timeLeft%60).padStart(2,'0')}
            </div>
            <div style={{width:52,height:3,background:'rgba(90,173,94,0.12)',borderRadius:2}}>
              <div style={{height:'100%',width:`${pct}%`,background:timeColor,borderRadius:2,transition:'width 1s linear,background 0.5s'}}/>
            </div>
          </div>
          <button className="btn" onClick={handleAutoPlace}
            style={{fontSize:'clamp(0.58rem,2.5vw,0.72rem)',padding:'0.35rem 0.5rem',minHeight:36,flexShrink:0}}>
            <GameIcon id="lightning" size={12}/> AUTO
          </button>
          <button className="btn" onClick={handleUndo} disabled={history.length===0}
            style={{fontSize:'clamp(0.58rem,2.5vw,0.72rem)',padding:'0.35rem 0.5rem',minHeight:36,opacity:history.length?1:0.3,flexShrink:0}}>
            <GameIcon id="undo" size={12}/> UNDO
          </button>
        </div>

        {/* Grid */}
        <div ref={gridWrap} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'clamp(0.2rem,1vw,0.5rem)',overflow:'hidden',position:'relative'}}>
          <div className="label-xs" style={{textAlign:'center',marginBottom:'0.2rem',flexShrink:0}}>
            {allPlaced?'✓ DEFENSES DEPLOYED — READY TO BATTLE':'PLACE DEFENSES — PROTECT YOUR SHIPS'}
          </div>
          {gridPx>0 && (
            <CoordGrid grid={grid} showShips interactive={!allPlaced&&!!selectedDef}
              placementMode={!allPlaced} pendingShip={selectedDef} pendingOrient={orientation}
              onPlaceShip={handlePlace} size={gridPx}/>
          )}
          <Toast/>
        </div>

        {/* Bottom strip */}
        <div style={{
          background:'var(--bg-panel)', borderTop:'var(--border-panel)',
          flexShrink:0, padding:'clamp(0.4rem,2vw,0.65rem)',
          paddingBottom:'max(clamp(0.4rem,2vw,0.65rem),var(--safe-bottom))',
          display:'flex', flexDirection:'column', gap:'0.4rem',
        }}>
          <div style={{display:'flex',justifyContent:'space-around',alignItems:'flex-start',gap:'clamp(0.3rem,1.5vw,0.7rem)'}}>
            {DEFENSES.map(def => <DefenseTile key={def.id} def={def} size={48}/>)}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
            {!allPlaced && (
              <>
                <div className="label-xs" style={{flexShrink:0}}>▸ ORIENT:</div>
                {[{o:'h',l:'↔'},{o:'v',l:'↕'},{o:'d',l:'↘'}].map(({o,l})=>(
                  <button key={o} className="btn" onClick={()=>{play('click');setOrient(o);}}
                    style={{padding:'0.32rem 0.55rem',minHeight:36,fontSize:'clamp(0.7rem,3vw,0.9rem)',fontWeight:orientation===o?700:400,background:orientation===o?'rgba(232,160,0,0.2)':'transparent',borderColor:orientation===o?'var(--amber)':'rgba(232,160,0,0.2)',color:orientation===o?'var(--amber)':'var(--white-dim)',boxShadow:orientation===o?'0 0 10px rgba(232,160,0,0.2)':'none',transition:'all 0.15s',flexShrink:0}}>
                    {l}
                  </button>
                ))}
              </>
            )}
            <div className="label-xs" style={{marginLeft:'auto',color:allPlaced?'var(--amber)':'var(--green-dim)',flexShrink:0}}>
              {placedDefs.length}/{DEFENSES.length}
            </div>
            {allPlaced && (
              <button className="btn btn-primary" onClick={handleDeploy}
                style={{padding:'0.45rem 1rem',fontSize:'clamp(0.68rem,2.8vw,0.85rem)',letterSpacing:'0.14em',minHeight:40,boxShadow:'0 0 18px rgba(232,160,0,0.4)',animation:'blink 1.5s ease-in-out infinite',flexShrink:0,background:'rgba(232,160,0,0.2)',borderColor:'var(--amber)',color:'var(--amber)'}}>
                ▶ ENGAGE BATTLE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════ LANDSCAPE ═══════════════
  return (
    <div className="screen" style={{ background:'var(--bg-void)', flexDirection:'row', overflow:'hidden' }}>
      <div style={{ width:'clamp(130px,18vw,190px)', display:'flex', flexDirection:'column', background:'var(--bg-panel)', borderRight:'var(--border-panel)', overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'clamp(0.3rem,1.2vw,0.6rem) clamp(0.4rem,1.2vw,0.7rem)', borderBottom:'var(--border-panel)', display:'flex', alignItems:'center', gap:'0.4rem', flexShrink:0 }}>
          <button className="back-btn" onClick={()=>{play('click');onBack();}} style={{width:32,height:32,flexShrink:0}}>
            <GameIcon id="back" size={13}/>
          </button>
          <div style={{overflow:'hidden'}}>
            <div className="label-xs" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{playerLabel}</div>
            <div className="title-font" style={{fontSize:'clamp(0.65rem,1.8vw,0.85rem)',color:'var(--amber)',whiteSpace:'nowrap'}}>DEFENSES</div>
          </div>
        </div>

        <div style={{padding:'clamp(0.3rem,1.2vw,0.5rem)',borderBottom:'var(--border-panel)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.25rem'}}>
            <div className="label-xs">TIME</div>
            <div className="title-font" style={{fontSize:'clamp(0.8rem,2.2vw,1.1rem)',color:timeColor,fontFamily:'Share Tech Mono'}}>
              {String(Math.floor(timeLeft/60)).padStart(2,'0')}:{String(timeLeft%60).padStart(2,'0')}
            </div>
          </div>
          <div style={{height:3,background:'rgba(90,173,94,0.1)',borderRadius:2}}>
            <div style={{height:'100%',width:`${pct}%`,background:timeColor,borderRadius:2,transition:'width 1s linear,background 0.5s'}}/>
          </div>
        </div>

        {!allPlaced && (
          <div style={{padding:'clamp(0.3rem,1.2vw,0.5rem)',borderBottom:'var(--border-panel)',flexShrink:0}}>
            <div className="label-xs" style={{marginBottom:'0.25rem'}}>▸ ORIENTATION</div>
            <div style={{display:'flex',gap:'0.25rem'}}>
              {[{o:'h',l:'↔'},{o:'v',l:'↕'},{o:'d',l:'↘'}].map(({o,l})=>(
                <button key={o} className="btn" onClick={()=>{play('click');setOrient(o);}}
                  style={{flex:1,padding:'0.35rem',background:orientation===o?'rgba(232,160,0,0.2)':'transparent',borderColor:orientation===o?'var(--amber)':'rgba(232,160,0,0.2)',fontSize:'clamp(0.7rem,2.5vw,0.95rem)',fontWeight:orientation===o?700:400,color:orientation===o?'var(--amber)':'var(--white-dim)',boxShadow:orientation===o?'0 0 10px rgba(232,160,0,0.2)':'none',minHeight:36,transition:'all 0.15s'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedDef && !allPlaced && (
          <div style={{padding:'clamp(0.3rem,1vw,0.45rem)',borderBottom:'var(--border-panel)',flexShrink:0}}>
            <div className="label-xs" style={{marginBottom:'0.2rem'}}>▸ SELECTED</div>
            <div style={{background:'rgba(232,160,0,0.08)',border:'1px solid rgba(232,160,0,0.25)',padding:'0.3rem 0.4rem'}}>
              <div style={{fontSize:'clamp(0.55rem,1.8vw,0.68rem)',color:'var(--amber)',fontFamily:'Share Tech Mono',fontWeight:700}}>
                {selectedDef.symbol} {selectedDef.name}
              </div>
              <div style={{fontSize:'clamp(0.45rem,1.4vw,0.55rem)',color:'var(--white-dim)',marginTop:2}}>{'▬'.repeat(selectedDef.size)} {selectedDef.size}u</div>
            </div>
          </div>
        )}

        <div style={{flex:1,overflowY:'auto',padding:'clamp(0.3rem,1vw,0.45rem)'}}>
          <div className="label-xs" style={{marginBottom:'0.2rem'}}>▸ STATUS</div>
          {DEFENSES.map(def => {
            const placed = !!placedDefs.find(p => p.id === def.id);
            return (
              <div key={def.id} style={{display:'flex',alignItems:'center',gap:'0.25rem',padding:'0.15rem 0',fontSize:'clamp(0.45rem,1.4vw,0.56rem)',fontFamily:'Share Tech Mono',color:placed?'var(--amber)':'rgba(180,160,90,0.4)'}}>
                {placed?'✓':'—'} {def.name}
              </div>
            );
          })}
        </div>

        <div style={{padding:'clamp(0.3rem,1.2vw,0.5rem)',borderTop:'var(--border-panel)',display:'flex',flexDirection:'column',gap:'0.3rem',flexShrink:0}}>
          <button className="btn" onClick={handleAutoPlace} style={{fontSize:'clamp(0.58rem,1.9vw,0.72rem)',padding:'0.38rem',minHeight:36}}>
            <GameIcon id="lightning" size={12}/> AUTO
          </button>
          <button className="btn" onClick={handleUndo} disabled={history.length===0}
            style={{fontSize:'clamp(0.58rem,1.9vw,0.72rem)',padding:'0.38rem',opacity:history.length?1:0.3,minHeight:36}}>
            <GameIcon id="undo" size={12}/> UNDO
          </button>
          {allPlaced && (
            <button className="btn" onClick={handleDeploy}
              style={{padding:'0.5rem',fontSize:'clamp(0.62rem,1.9vw,0.78rem)',letterSpacing:'0.14em',minHeight:40,boxShadow:'0 0 18px rgba(232,160,0,0.4)',animation:'blink 1.5s ease-in-out infinite',background:'rgba(232,160,0,0.2)',borderColor:'var(--amber)',color:'var(--amber)'}}>
              ▶ ENGAGE BATTLE
            </button>
          )}
          <div className="label-xs" style={{textAlign:'center',color:allPlaced?'var(--amber)':'var(--green-dim)'}}>
            {placedDefs.length}/{DEFENSES.length} PLACED
          </div>
        </div>
      </div>

      <div ref={gridWrap} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'clamp(0.2rem,0.8vw,0.5rem)', overflow:'hidden', position:'relative', gap:'0.3rem' }}>
        <div className="label-xs" style={{textAlign:'center',flexShrink:0}}>PLACE DEFENSES — PROTECT YOUR SHIPS</div>
        {gridPx>0 && (
          <CoordGrid grid={grid} showShips interactive={!allPlaced&&!!selectedDef}
            placementMode={!allPlaced} pendingShip={selectedDef} pendingOrient={orientation}
            onPlaceShip={handlePlace} size={gridPx}/>
        )}
        <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-start', gap:'clamp(0.5rem,2vw,1.1rem)', flexWrap:'nowrap', flexShrink:0, paddingTop:'0.2rem' }}>
          {DEFENSES.map(def => <DefenseTile key={def.id} def={def} size={50}/>)}
        </div>
        <Toast/>
      </div>
    </div>
  );
}
