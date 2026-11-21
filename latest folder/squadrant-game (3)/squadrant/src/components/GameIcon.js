/**
 * GameIcon — drop-in replacement system for emoji assets.
 *
 * Usage:
 *   <GameIcon id="rocket" size={24} />
 *
 * To swap an emoji for a PNG, add the mapping to ICON_MAP below.
 * The PNG will automatically match the size/alignment of the original emoji.
 *
 * All icons are centralised here so designers only need to edit one file.
 */

// ── Asset map ──────────────────────────────────────────────────────────────
// key  = icon id used in code
// emoji = fallback emoji (shown when no png is mapped)
// png   = optional path under /assets/icons/ (e.g. 'rocket.png')
//         Replace null with the filename once you add the PNG to /public/assets/icons/
const ICON_MAP = {
  // Weapons
  rocket:    { emoji: '🚀', png: null, label: 'Rocket' },
  bomb:      { emoji: '💣', png: null, label: 'Air Bomb' },
  nuke:      { emoji: '☢️', png: null, label: 'Nuke' },
  // Ships
  carrier:   { emoji: '🚢', png: null, label: 'Carrier' },
  anchor:    { emoji: '⚓', png: null, label: 'Battleship' },
  speedboat: { emoji: '🚤', png: null, label: 'Patrol' },
  // UI actions
  fire:      { emoji: '🔥', png: null, label: 'Fire' },
  hit:       { emoji: '💥', png: null, label: 'Hit' },
  miss:      { emoji: '💨', png: null, label: 'Miss' },
  // Status
  check:     { emoji: '✓',  png: null, label: 'Done' },
  warning:   { emoji: '⚠️', png: null, label: 'Warning' },
  skull:     { emoji: '💀', png: null, label: 'Destroyed' },
  shield:    { emoji: '🛡️', png: null, label: 'Defense' },
  // Menu
  robot:     { emoji: '🤖', png: null, label: 'Computer' },
  swords:    { emoji: '⚔️', png: null, label: 'PvP' },
  gear:      { emoji: '⚙️', png: null, label: 'Settings' },
  back:      { emoji: '←',  png: null, label: 'Back' },
  play:      { emoji: '▶',  png: null, label: 'Play' },
  lightning: { emoji: '⚡', png: null, label: 'Auto' },
  undo:      { emoji: '↩',  png: null, label: 'Undo' },
  // Difficulty
  easyDot:   { emoji: '🟢', png: null, label: 'Easy' },
  avgDot:    { emoji: '🟡', png: null, label: 'Average' },
  hardDot:   { emoji: '🔴', png: null, label: 'Advanced' },
  // Audio
  soundOn:   { emoji: '🔊', png: null, label: 'Sound On' },
  soundOff:  { emoji: '🔇', png: null, label: 'Sound Off' },
  // Theme
  moon:      { emoji: '🌙', png: null, label: 'Dark' },
  sun:       { emoji: '☀️', png: null, label: 'Light' },
};

// ── Component ──────────────────────────────────────────────────────────────
export default function GameIcon({ id, size = 20, style = {}, className = '' }) {
  const entry = ICON_MAP[id];
  if (!entry) return <span style={{ fontSize: size, ...style }} className={className}>{id}</span>;

  const px = typeof size === 'number' ? `${size}px` : size;

  if (entry.png) {
    return (
      <img
        src={`/assets/icons/${entry.png}`}
        alt={entry.label}
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style,
        }}
        className={className}
      />
    );
  }

  // Emoji fallback — sized to match PNG slot exactly
  return (
    <span
      role="img"
      aria-label={entry.label}
      style={{
        fontSize: px,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        flexShrink: 0,
        ...style,
      }}
      className={className}
    >
      {entry.emoji}
    </span>
  );
}

// ── Ship icon helper ───────────────────────────────────────────────────────
export function shipIcon(shipId, size) {
  const map = { 1:'carrier', 2:'anchor', 3:'anchor', 4:'speedboat', 5:'speedboat', 6:'speedboat' };
  return <GameIcon id={map[shipId] || 'anchor'} size={size} />;
}
