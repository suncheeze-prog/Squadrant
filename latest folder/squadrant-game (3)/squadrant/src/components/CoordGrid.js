import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { gcFromGrid, gridToCoord as gridToCoordFn } from '../utils/gameLogic';

/**
 * CoordGrid — Responsive Cartesian battle grid.
 *
 * Grid size is auto-detected from grid.length (so 10x10, 15x15, 21x21 all work).
 *
 * Ships are rendered as continuous boat-shaped SVG overlays that span across
 * multiple cells and visibly overflow the grid lines, instead of coloring
 * individual cells.
 */
export default function CoordGrid({
  grid,
  onCellClick,
  showShips = false,
  highlight = null,
  interactive = false,
  placementMode = false,
  pendingShip = null,
  pendingHoriz = true,    // legacy boolean — kept for backward compat
  pendingOrient = null,   // 'h' | 'v' | 'd' (takes priority over pendingHoriz)
  onPlaceShip,
  mini = false,
  fill = false,
  size = null,
  revealedCells = null,   // Set of "row-col" strings revealed by radar skills
}) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [touchHover, setTouchHover] = useState(null);

  // Dynamic grid config
  const gc = gcFromGrid(grid);
  const GRID_SIZE = gc.size;

  useEffect(() => {
    if (!fill || mini || size) return;
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const update = () => {
      const s = Math.min(parent.clientWidth, parent.clientHeight);
      setContainerSize(s > 0 ? s : null);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fill, mini, size]);

  // Sizing
  let svgSize;
  if (mini)              svgSize = 120;
  else if (size)         svgSize = size;
  else if (fill && containerSize) svgSize = containerSize;
  else                   svgSize = 300;

  const LABEL    = mini ? 0 : Math.max(14, Math.round(svgSize * 0.038));
  const cellSize = (svgSize - LABEL) / GRID_SIZE;
  const totalGrid = cellSize * GRID_SIZE;
  const svgW     = totalGrid + LABEL;
  const svgH     = totalGrid + (mini ? 0 : LABEL);
  const fontSize = Math.max(5, Math.round(cellSize * 0.38));

  // ── Theme color helper ───────────────────────────────────────────
  // Uses CSS color-mix so we can vary opacity from a single theme variable.
  // var(--accent1) follows the active theme (dark=green, neon=purple, ocean=blue, cyber=cyan, light=dark-green).
  const t = (varName, alpha = 1) => {
    if (alpha >= 1) return `var(${varName})`;
    return `color-mix(in srgb, var(${varName}) ${Math.round(alpha * 100)}%, transparent)`;
  };
  const ACCENT   = '--accent1';     // primary theme accent
  const BG_GRID  = '--bg-void';     // grid playfield background
  const AMBER    = '--amber';
  const RED      = '--red-bright';
  const BLUE     = '--blue-target';

  // Ship hull colors (vibrant, distinguishable)
  const SHIP_COLORS = {
    1: { fill:'#2d4a8a', stroke:'#5a78c4', detail:'#a8b8e0' }, // Carrier — navy blue
    2: { fill:'#7a3030', stroke:'#b85858', detail:'#ddaaaa' }, // Battleship A — red
    3: { fill:'#5a4a20', stroke:'#a08840', detail:'#d8c878' }, // Battleship B — bronze
    4: { fill:'#2a5560', stroke:'#5090a0', detail:'#9cc8d4' }, // Cruiser — teal
    5: { fill:'#3a6b1e', stroke:'#6ab040', detail:'#a8d878' }, // Patrol A — green
    6: { fill:'#522b6b', stroke:'#9050b8', detail:'#c890d8' }, // Patrol B — purple
  };
  const colorOf = id => SHIP_COLORS[id] || { fill:'#444', stroke:'#888', detail:'#bbb' };

  // ── Compute ship overlays (groups of cells per shipId) ─────
  const shipOverlays = useMemo(() => {
    if (!showShips || !grid) return [];
    const ships = {};
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r]?.[c];
        if (cell?.shipId != null) {
          (ships[cell.shipId] = ships[cell.shipId] || []).push({ r, c, hit: !!cell.hit });
        }
      }
    }
    return Object.entries(ships).map(([id, cells]) => {
      const rows = cells.map(c => c.r);
      const cols = cells.map(c => c.c);
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      const horizontal = (maxC - minC) >= (maxR - minR);
      const length = Math.max(maxC - minC + 1, maxR - minR + 1);
      const allHit = cells.every(c => c.hit);
      return { id: Number(id), minR, minC, horizontal, length, allHit };
    });
  }, [grid, showShips, GRID_SIZE]);

  // ── Compute defense overlays (groups of cells per defenseId) ─
  const defenseOverlays = useMemo(() => {
    if (!showShips || !grid) return [];
    const defenses = {};
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r]?.[c];
        if (cell?.defenseId != null) {
          (defenses[cell.defenseId] = defenses[cell.defenseId] || []).push({ r, c, hit: !!cell.hit });
        }
      }
    }
    return Object.entries(defenses).map(([id, cells]) => {
      const rows = cells.map(c => c.r);
      const cols = cells.map(c => c.c);
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      const horizontal = (maxC - minC) >= (maxR - minR);
      const length = Math.max(maxC - minC + 1, maxR - minR + 1);
      const cellsHitMap = {};
      cells.forEach(c => { cellsHitMap[`${c.r}-${c.c}`] = c.hit; });
      return { id: Number(id), minR, minC, horizontal, length, cellsHitMap };
    });
  }, [grid, showShips, GRID_SIZE]);

  // ── Hover preview cells for placement ─────────────────────
  // Orientation deltas in GRID space (col, row).
  // 'h' = right, 'v' = down, 'd' = down-right (diagonal ↘).
  const orientDelta = (orient) => {
    if (orient === 'h') return { dc: 1, dr: 0 };
    if (orient === 'v') return { dc: 0, dr: 1 };
    if (orient === 'd') return { dc: 1, dr: 1 };
    return { dc: 1, dr: 0 };
  };
  const getHoverCells = () => {
    const src = touchHover || hoverCell;
    if (!src || !pendingShip || !placementMode) return new Set();
    const orient = pendingOrient || (pendingHoriz === false ? 'v' : 'h');
    const { dc, dr } = orientDelta(orient);
    const cells = new Set();
    for (let i = 0; i < pendingShip.size; i++) {
      const col = src.col + dc * i;
      const row = src.row + dr * i;
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) cells.add(`${row}-${col}`);
    }
    return cells;
  };
  const hoverCells = getHoverCells();

  const handleClick = useCallback((col, row) => {
    const coord = gridToCoordFn(col, row, gc);
    if (onCellClick) onCellClick(coord.x, coord.y, col, row);
    if (onPlaceShip && pendingShip) onPlaceShip(coord.x, coord.y);
  }, [onCellClick, onPlaceShip, pendingShip, gc]);

  const handleTouchStart = useCallback((col, row, e) => { e.preventDefault(); setTouchHover({ col, row }); }, []);
  const handleTouchEnd   = useCallback((col, row, e) => { e.preventDefault(); setTouchHover(null); if (interactive) handleClick(col, row); }, [interactive, handleClick]);

  // ── Ship shape renderer ───────────────────────────────────
  // Always draws horizontally with pointed bow on the RIGHT.
  // For vertical ships, rotate the group 90° (and offset so it lines up).
  const renderShip = (ship) => {
    const { id, minR, minC, horizontal, length, allHit } = ship;
    const c = colorOf(id);

    // Cell-space bounding box
    const cellX = LABEL + minC * cellSize;
    const cellY = minR * cellSize;
    const boxW  = horizontal ? length * cellSize : cellSize;
    const boxH  = horizontal ? cellSize : length * cellSize;

    // Inset: ship sits slightly INSIDE the cells (smaller than the grid)
    const latIn = cellSize * 0.10;   // perpendicular to length
    const lenIn = cellSize * 0.06;   // along length (bow/stern pulled in)

    const x = cellX + (horizontal ? lenIn : latIn);
    const y = cellY + (horizontal ? latIn : lenIn);
    const w = boxW - (horizontal ? 2 * lenIn : 2 * latIn);
    const h = boxH - (horizontal ? 2 * latIn : 2 * lenIn);

    // Local coords (always horizontal): len × wid
    const len = horizontal ? w : h;
    const wid = horizontal ? h : w;

    // Transform: horizontal = no rotation, vertical = rotate 90° around top-left then shift
    const transform = horizontal
      ? `translate(${x},${y})`
      : `translate(${x + w},${y}) rotate(90)`;

    // Path proportions
    const sternR = wid * 0.32;          // stern roundness
    const bowStart = len * 0.78;        // where the pointed bow begins
    const cabX = len * 0.32, cabW = len * 0.30;
    const cabY = wid * 0.28, cabH = wid * 0.44;

    return (
      <g key={`ship-${id}`} transform={transform} style={{ pointerEvents: 'none' }}>
        {/* Outer hull shadow */}
        <path d={`
          M 0 ${wid/2}
          Q 0 ${wid*0.04}, ${sternR} 0
          L ${bowStart} 0
          Q ${len*0.94} 0, ${len} ${wid/2}
          Q ${len*0.94} ${wid}, ${bowStart} ${wid}
          L ${sternR} ${wid}
          Q 0 ${wid*0.96}, 0 ${wid/2}
          Z
        `}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={Math.max(1, cellSize * 0.05)}
          opacity={allHit ? 0.45 : 0.92}
        />

        {/* Deck darker overlay */}
        <path d={`
          M ${sternR*0.5} ${wid*0.18}
          L ${bowStart} ${wid*0.18}
          Q ${len*0.92} ${wid*0.18}, ${len*0.96} ${wid/2}
          Q ${len*0.92} ${wid*0.82}, ${bowStart} ${wid*0.82}
          L ${sternR*0.5} ${wid*0.82}
          Q ${sternR*0.15} ${wid*0.82}, ${sternR*0.15} ${wid/2}
          Q ${sternR*0.15} ${wid*0.18}, ${sternR*0.5} ${wid*0.18}
          Z
        `}
          fill="rgba(0,0,0,0.18)"
          opacity={allHit ? 0.3 : 0.85}
        />

        {/* Central cabin */}
        <rect
          x={cabX} y={cabY}
          width={cabW} height={cabH}
          rx={Math.max(1, cellSize * 0.08)}
          fill={c.detail}
          opacity={allHit ? 0.25 : 0.7}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={Math.max(0.5, cellSize * 0.025)}
        />

        {/* Bow porthole */}
        <circle
          cx={len * 0.72} cy={wid / 2}
          r={Math.min(wid * 0.12, cellSize * 0.18)}
          fill={c.detail}
          opacity={allHit ? 0.25 : 0.85}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={Math.max(0.4, cellSize * 0.02)}
        />

        {/* Stern detail (square block) */}
        <rect
          x={sternR * 0.55} y={wid * 0.36}
          width={Math.max(2, wid * 0.18)} height={wid * 0.28}
          fill="rgba(0,0,0,0.45)"
          opacity={allHit ? 0.3 : 0.8}
        />

        {/* "Sunk" overlay — diagonal slash */}
        {allHit && (
          <g opacity="0.85">
            <line x1={len*0.05} y1={wid*0.15} x2={len*0.95} y2={wid*0.85}
              stroke="#ff3030" strokeWidth={Math.max(2, cellSize*0.08)} strokeLinecap="round"/>
            <line x1={len*0.05} y1={wid*0.85} x2={len*0.95} y2={wid*0.15}
              stroke="#ff3030" strokeWidth={Math.max(2, cellSize*0.08)} strokeLinecap="round"/>
          </g>
        )}
      </g>
    );
  };

  return (
    <div ref={containerRef}
      style={{ display: fill ? 'block' : 'inline-block', width: fill ? '100%' : undefined, height: fill ? '100%' : undefined }}>
      <svg
        width={svgW} height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', touchAction: 'none' }}
      >
        {/* Background — uses theme bg + accent border */}
        <rect x={LABEL} y={0} width={totalGrid} height={totalGrid}
          fill={t(BG_GRID, 0.95)}
          stroke={t(ACCENT, 0.25)}
          strokeWidth="1"/>

        {/* ── Cartesian cross — highlighted bands for x=0 column and y=0 row ── */}
        {(() => {
          const zeroCol = 0 - gc.min;          // grid column corresponding to x=0
          const zeroRow = gc.max - 0;          // grid row corresponding to y=0
          const colInRange = zeroCol >= 0 && zeroCol < GRID_SIZE;
          const rowInRange = zeroRow >= 0 && zeroRow < GRID_SIZE;
          return (
            <g style={{ pointerEvents: 'none' }}>
              {/* Vertical band: full column where x=0 */}
              {colInRange && (
                <rect
                  x={LABEL + zeroCol * cellSize} y={0}
                  width={cellSize} height={totalGrid}
                  fill={t(ACCENT, 0.09)}
                  stroke={t(ACCENT, 0.35)}
                  strokeWidth={1}/>
              )}
              {/* Horizontal band: full row where y=0 */}
              {rowInRange && (
                <rect
                  x={LABEL} y={zeroRow * cellSize}
                  width={totalGrid} height={cellSize}
                  fill={t(ACCENT, 0.09)}
                  stroke={t(ACCENT, 0.35)}
                  strokeWidth={1}/>
              )}
              {/* Intersection cell (0,0) — extra emphasis */}
              {colInRange && rowInRange && (
                <rect
                  x={LABEL + zeroCol * cellSize} y={zeroRow * cellSize}
                  width={cellSize} height={cellSize}
                  fill={t(ACCENT, 0.18)}
                  stroke={t(ACCENT, 0.65)}
                  strokeWidth={1.5}/>
              )}
            </g>
          );
        })()}

        {/* Regular grid lines (uniform thin) */}
        {Array(GRID_SIZE + 1).fill(0).map((_, i) => (
          <g key={i}>
            <line x1={LABEL + i * cellSize} y1={0} x2={LABEL + i * cellSize} y2={totalGrid}
              stroke={t(ACCENT, 0.12)} strokeWidth={0.5}/>
            <line x1={LABEL} y1={i * cellSize} x2={LABEL + totalGrid} y2={i * cellSize}
              stroke={t(ACCENT, 0.12)} strokeWidth={0.5}/>
          </g>
        ))}

        {/* Axis labels — every Nth depending on size */}
        {!mini && Array(GRID_SIZE).fill(0).map((_, i) => {
          const xVal = gc.min + i;
          const yVal = gc.max - i;
          const step = GRID_SIZE <= 12 ? 1 : GRID_SIZE <= 16 ? 2 : 5;
          return (
            <g key={i}>
              {xVal % step === 0 && (
                <text x={LABEL + i * cellSize + cellSize / 2} y={totalGrid + LABEL - 2}
                  textAnchor="middle" fill={xVal === 0 ? t(ACCENT, 0.95) : t(ACCENT, 0.6)}
                  fontSize={fontSize} fontFamily="Share Tech Mono">{xVal}</text>
              )}
              {yVal % step === 0 && (
                <text x={LABEL - 2} y={i * cellSize + cellSize / 2 + fontSize * 0.35}
                  textAnchor="end" fill={yVal === 0 ? t(ACCENT, 0.95) : t(ACCENT, 0.6)}
                  fontSize={fontSize} fontFamily="Share Tech Mono">{yVal}</text>
              )}
            </g>
          );
        })}

        {/* Interactive cell layer + hover preview + miss markers */}
        {Array(GRID_SIZE).fill(0).map((_, row) =>
          Array(GRID_SIZE).fill(0).map((_, col) => {
            const cell = grid[row]?.[col];
            const key  = `${row}-${col}`;
            const isHover = hoverCells.has(key);
            const coord = gridToCoordFn(col, row, gc);
            const isHighlight = highlight && highlight.x === coord.x && highlight.y === coord.y;
            const cx = LABEL + col * cellSize;
            const cy = row * cellSize;

            const isRevealed = revealedCells && revealedCells.has(key);
            let fill2 = 'transparent';
            if (cell?.miss)  fill2 = t(BLUE, 0.4);
            if (isRevealed && !cell?.hit) fill2 = t(AMBER, 0.28);
            if (isHover)     fill2 = t(ACCENT, 0.32);
            if (isHighlight) fill2 = t(AMBER, 0.4);

            const markerR = Math.max(2, cellSize * 0.18);

            return (
              <g key={key}>
                <rect
                  x={cx + 0.5} y={cy + 0.5}
                  width={cellSize - 1} height={cellSize - 1}
                  fill={fill2}
                  stroke={isHighlight ? t(AMBER, 0.85) : isRevealed ? t(AMBER, 0.7) : 'none'}
                  strokeWidth={isHighlight ? 1.5 : isRevealed ? 1 : 0}
                  strokeDasharray={isRevealed && !isHighlight ? '3 2' : undefined}
                  style={{ cursor: interactive ? 'crosshair' : 'default', transition: 'fill 0.08s' }}
                  onClick={() => interactive && handleClick(col, row)}
                  onMouseEnter={() => setHoverCell({ col, row })}
                  onMouseLeave={() => setHoverCell(null)}
                  onTouchStart={(e) => handleTouchStart(col, row, e)}
                  onTouchEnd={(e) => handleTouchEnd(col, row, e)}
                />
                {cell?.miss && (
                  <g style={{ pointerEvents: 'none' }}>
                    {/* Expanding ripple — one-shot when the miss is first drawn */}
                    <circle
                      className="grid-miss-ring"
                      cx={cx + cellSize/2} cy={cy + cellSize/2}
                      r={cellSize * 0.3}
                      fill="none"
                      stroke={t(BLUE, 0.75)}
                      strokeWidth={Math.max(0.8, cellSize * 0.035)}/>
                    {/* Splash core + X so a miss reads clearly even at small sizes */}
                    <circle
                      className="grid-miss-core"
                      cx={cx + cellSize/2} cy={cy + cellSize/2}
                      r={markerR}
                      fill={t(BLUE, 0.9)}
                      stroke={t(BLUE, 0.55)} strokeWidth="0.5"/>
                    <line
                      x1={cx + cellSize/2 - markerR*0.55} y1={cy + cellSize/2 - markerR*0.55}
                      x2={cx + cellSize/2 + markerR*0.55} y2={cy + cellSize/2 + markerR*0.55}
                      stroke={t(BLUE, 0.95)} strokeWidth={Math.max(0.6, cellSize*0.022)}
                      strokeLinecap="round"/>
                    <line
                      x1={cx + cellSize/2 - markerR*0.55} y1={cy + cellSize/2 + markerR*0.55}
                      x2={cx + cellSize/2 + markerR*0.55} y2={cy + cellSize/2 - markerR*0.55}
                      stroke={t(BLUE, 0.95)} strokeWidth={Math.max(0.6, cellSize*0.022)}
                      strokeLinecap="round"/>
                  </g>
                )}
              </g>
            );
          })
        )}

        {/* DEFENSE OVERLAYS — rendered first so ships sit on top */}
        {defenseOverlays.map(def => {
          const { id, minR, minC, horizontal, length } = def;
          const cellX = LABEL + minC * cellSize;
          const cellY = minR * cellSize;
          const w = (horizontal ? length : 1) * cellSize;
          const h = (horizontal ? 1 : length) * cellSize;
          const inset = cellSize * 0.08; // defenses sit INSIDE the cells, snug fit
          const x = cellX + inset;
          const y = cellY + inset;
          const dw = w - inset * 2;
          const dh = h - inset * 2;
          return (
            <g key={`def-${id}`} style={{ pointerEvents: 'none' }}>
              {/* Concrete base */}
              <rect x={x} y={y} width={dw} height={dh}
                fill="#5a5040" stroke="#8a7a60" strokeWidth={Math.max(1, cellSize * 0.04)}
                rx={Math.max(2, cellSize * 0.08)} />
              {/* Crosshatch pattern (brick lines) */}
              {horizontal && Array(length - 1).fill(0).map((_, i) => (
                <line key={`vline-${i}`}
                  x1={x + (i + 1) * cellSize - inset} y1={y + dh * 0.2}
                  x2={x + (i + 1) * cellSize - inset} y2={y + dh * 0.8}
                  stroke="#3a3424" strokeWidth={Math.max(0.5, cellSize * 0.025)} />
              ))}
              {!horizontal && Array(length - 1).fill(0).map((_, i) => (
                <line key={`hline-${i}`}
                  x1={x + dw * 0.2} y1={y + (i + 1) * cellSize - inset}
                  x2={x + dw * 0.8} y2={y + (i + 1) * cellSize - inset}
                  stroke="#3a3424" strokeWidth={Math.max(0.5, cellSize * 0.025)} />
              ))}
              {/* Corner notches (military bunker look) */}
              {[
                [x, y], [x + dw, y], [x, y + dh], [x + dw, y + dh],
              ].map(([cx, cy], i) => (
                <circle key={`corner-${i}`} cx={cx} cy={cy} r={Math.max(1.5, cellSize * 0.06)}
                  fill="#3a3424" />
              ))}
              {/* Damaged cell overlays */}
              {Object.entries(def.cellsHitMap).map(([k, isHit]) => {
                if (!isHit) return null;
                const [r, c] = k.split('-').map(Number);
                const dx = LABEL + c * cellSize;
                const dy = r * cellSize;
                return (
                  <rect key={`def-hit-${k}`}
                    x={dx + inset} y={dy + inset}
                    width={cellSize - inset * 2} height={cellSize - inset * 2}
                    fill="rgba(120,40,30,0.55)"
                    stroke="rgba(255,80,60,0.7)"
                    strokeWidth={Math.max(0.5, cellSize * 0.03)} />
                );
              })}
            </g>
          );
        })}

        {/* SHIP OVERLAYS (between defenses and hit markers) */}
        {shipOverlays.map(renderShip)}

        {/* HIT markers — rendered on top so they show through ships */}
        {Array(GRID_SIZE).fill(0).map((_, row) =>
          Array(GRID_SIZE).fill(0).map((_, col) => {
            const cell = grid[row]?.[col];
            if (!cell?.hit) return null;
            const cx = LABEL + col * cellSize;
            const cy = row * cellSize;
            return (
              <g key={`hit-${row}-${col}`} className="grid-hit-marker" style={{ pointerEvents:'none' }}>
                {/* Hit explosion circle */}
                <circle cx={cx + cellSize/2} cy={cy + cellSize/2}
                  r={cellSize * 0.32}
                  fill={t(RED, 0.55)}
                  stroke={t(RED, 0.9)} strokeWidth={Math.max(1, cellSize*0.04)}/>
                {/* X mark */}
                <text x={cx + cellSize/2} y={cy + cellSize/2 + fontSize*0.45}
                  textAnchor="middle"
                  fontSize={Math.max(8, cellSize * 0.6)}
                  fontWeight="900"
                  fill="#ffffff"
                  stroke="#900"
                  strokeWidth="0.5">✕</text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
