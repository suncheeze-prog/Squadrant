import React from 'react';

const WEAPON_LABEL = {
  rocket: 'ROCKET STRIKE',
  bomb: 'AIR BOMB',
  nuke: 'TACTICAL NUKE',
};

const RESULT_LABEL = {
  sunk: 'SHIP DOWN',
  hit: 'DIRECT HIT',
  blocked: 'BLOCKED',
  miss: 'MISS',
};

/**
 * AttackFx — shared targeting / lock / result overlay.
 *
 * fx = {
 *   stage: 'targeting' | 'lock' | 'result',
 *   side: 'player' | 'enemy',
 *   weapon: 'rocket' | 'bomb' | 'nuke',
 *   target: { x, y },
 *   outcome: { type, count, points },
 *   key,
 * }
 */
export default function AttackFx({ fx }) {
  if (!fx) return null;

  const { stage, side, weapon, target, outcome, countdown } = fx;
  const enemy = side === 'enemy';
  const accent = enemy ? 'var(--red-bright)' : 'var(--green-bright)';
  const weaponLabel = WEAPON_LABEL[weapon] || 'STRIKE';
  const coord = target ? `GRID (${target.x}, ${target.y})` : 'ACQUIRING TARGET';

  if (stage === 'targeting' || stage === 'lock') {
    const locked = stage === 'lock';
    return (
      <div className={`attack-fx ${locked ? 'is-locked' : ''}`} aria-live="polite">
        <div className="attack-fx-scan" />
        <div className={`attack-reticle ${locked ? 'locked' : ''}`}>
          <div className="reticle-ring outer" />
          <div className="reticle-ring inner" />
          <div className="reticle-cross h" />
          <div className="reticle-cross v" />
          <div className="reticle-bracket tl" />
          <div className="reticle-bracket tr" />
          <div className="reticle-bracket bl" />
          <div className="reticle-bracket br" />
          <div className="reticle-dot" />
        </div>

        {!locked && weapon === 'rocket' && <div className="fx-projectile rocket">🚀</div>}
        {!locked && weapon === 'bomb' && <div className="fx-projectile bomb">💣</div>}
        {!locked && weapon === 'nuke' && <div className="fx-projectile nuke">☢</div>}

        <div className="attack-fx-copy">
          <div className="attack-fx-kicker" style={{ color: enemy ? 'var(--red-bright)' : 'var(--green-accent)' }}>
            {enemy ? '⚠ INCOMING FIRE' : '▸ FIRE MISSION'}
          </div>
          {!locked && countdown != null && (
            <div className="attack-fx-countdown" key={countdown}
              style={{ color: enemy ? 'var(--red-bright)' : 'var(--green-bright)' }}>
              {countdown}<span>s</span>
            </div>
          )}
          <div className="attack-fx-title" style={{ color: locked ? 'var(--amber)' : accent }}>
            {locked ? 'TARGET LOCK' : 'TARGETING'}
            {!locked && <span className="attack-fx-dots">...</span>}
          </div>
          <div className="attack-fx-sub">
            {weaponLabel} <span>//</span> {coord}
          </div>
          <div className="attack-fx-status">
            <span className="attack-fx-led" style={{ background: locked ? 'var(--amber)' : accent }} />
            {locked
              ? 'SOLUTION CONFIRMED — FIRING'
              : countdown != null
                ? 'COMPUTER IS TARGETING YOUR FLEET'
                : 'CALCULATING FIRING SOLUTION'}
          </div>
        </div>
      </div>
    );
  }

  const type = outcome?.type || 'miss';
  const label = RESULT_LABEL[type] || 'MISS';
  const isMiss = type === 'miss';
  const points = outcome?.points || 0;

  return (
    <div className={`attack-fx result ${type}`} aria-live="polite">
      <div className="attack-fx-scan" />
      {weapon === 'nuke' && !isMiss && <div className="fx-nuke-flash" />}

      <div className="fx-result-stage">
        {isMiss ? (
          <>
            <div className="fx-ripple r1" />
            <div className="fx-ripple r2" />
            <div className="fx-result-title miss">MISS</div>
            <div className="fx-result-sub">
              SHOT WENT WIDE <span>//</span> {target ? `(${target.x}, ${target.y})` : 'NO CONTACT'}
            </div>
          </>
        ) : (
          <>
            <div className={`fx-burst ${type}`} />
            <div className={`fx-result-title ${type}`}>{label}</div>
            <div className="fx-result-sub">
              {type === 'blocked'
                ? 'DEFENSE ABSORBED THE STRIKE'
                : type === 'sunk'
                  ? 'TARGET DESTROYED'
                  : `TARGET CONFIRMED${outcome?.count > 1 ? ` ×${outcome.count}` : ''}`}
              <span> // </span>
              {target ? `(${target.x}, ${target.y})` : ''}
            </div>
          </>
        )}

        <div className="fx-result-meta">
          <span style={{ color: enemy ? 'var(--red-bright)' : 'var(--green-bright)' }}>
            {enemy ? 'ENEMY FIRE' : 'YOUR FIRE'}
          </span>
          <span> // </span>
          {weaponLabel}
        </div>

        {!isMiss && points > 0 && (
          <div className="fx-result-points">+{points} PTS</div>
        )}
      </div>
    </div>
  );
}
