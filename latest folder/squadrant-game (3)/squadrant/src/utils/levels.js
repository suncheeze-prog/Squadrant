// ──────────────────────────────────────────────────────────
// SQUADRANT — Campaign levels / theaters
// Easy is always open. Winning a VS Computer level unlocks
// the next theater. Progress is stored locally on the device.
// ──────────────────────────────────────────────────────────

export const LEVELS = [
  {
    id: 'easy',
    label: 'EASY',
    codename: 'OCEAN OPS',
    theme: 'ocean',
    iconId: 'easyDot',
    color: '#2d8a30',
    desc: 'Random AI — standard coordinate attacks',
    brief: 'Open water. A predictable enemy. Learn the grid.',
  },
  {
    id: 'average',
    label: 'AVERAGE',
    codename: 'DESERT STORM',
    theme: 'desert',
    iconId: 'avgDot',
    color: '#a08020',
    desc: 'Smart AI hunts near hits',
    brief: 'Dust and heat. The enemy remembers where you struck.',
  },
  {
    id: 'advanced',
    label: 'ADVANCED',
    codename: 'DEEP SPACE',
    theme: 'space',
    iconId: 'hardDot',
    color: '#8a2020',
    desc: 'Linear equations y=mx+b to target',
    brief: 'Zero gravity. Every shot must be calculated.',
  },
];

export const LEVEL_ORDER = LEVELS.map(l => l.id);
export const LEVEL_STORAGE_KEY = 'sq_level_progress_v1';

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}

export function getNextLevel(id) {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

const DEFAULT_PROGRESS = { unlocked: ['easy'], completed: [] };

function normalizeProgress(raw) {
  const completed = new Set(
    Array.isArray(raw?.completed)
      ? raw.completed.filter(id => LEVEL_ORDER.includes(id))
      : []
  );
  const unlocked = new Set(['easy']);

  // Sequential unlock: a level is open if the previous theater was cleared
  // (or if it was already explicitly unlocked in a previous save).
  LEVEL_ORDER.forEach((id, i) => {
    if (i === 0) return;
    const explicitlyUnlocked = Array.isArray(raw?.unlocked) && raw.unlocked.includes(id);
    if (completed.has(LEVEL_ORDER[i - 1]) || explicitlyUnlocked) unlocked.add(id);
  });

  return { unlocked: [...unlocked], completed: [...completed] };
}

function writeProgress(progress) {
  try {
    localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // Storage can be unavailable in private mode — game still works.
  }
}

export function getLevelProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEVEL_STORAGE_KEY) || 'null');
    return normalizeProgress(raw);
  } catch (e) {
    return { ...DEFAULT_PROGRESS, unlocked: [...DEFAULT_PROGRESS.unlocked], completed: [] };
  }
}

export function isLevelUnlocked(id) {
  if (id === 'easy') return true;
  return getLevelProgress().unlocked.includes(id);
}

/**
 * Record a VS Computer victory.
 * Returns the id of a newly unlocked next theater, or null.
 */
export function completeLevel(id) {
  if (!LEVEL_ORDER.includes(id)) return null;
  const progress = getLevelProgress();
  const alreadyCompleted = progress.completed.includes(id);
  if (!alreadyCompleted) progress.completed.push(id);

  const next = getNextLevel(id);
  let newlyUnlocked = null;
  if (next && !progress.unlocked.includes(next.id)) {
    progress.unlocked.push(next.id);
    newlyUnlocked = next.id;
  }

  writeProgress(progress);
  return alreadyCompleted ? null : newlyUnlocked;
}

export function resetLevelProgress() {
  writeProgress({ unlocked: ['easy'], completed: [] });
}
