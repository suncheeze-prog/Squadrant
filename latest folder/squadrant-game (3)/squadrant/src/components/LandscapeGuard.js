import React, { useEffect, useState } from 'react';

/**
 * Shows a "rotate device" prompt when the device is in portrait
 * and the `active` prop is true (i.e. during gameplay/placement).
 * On desktop (wide screens) it never shows.
 */
export default function LandscapeGuard({ active, children }) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    if (!active) { setIsPortrait(false); return; }

    const check = () => {
      // Only show on mobile-ish widths in portrait
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
      setIsPortrait(portrait);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 200));
    return () => {
      window.removeEventListener('resize', check);
    };
  }, [active]);

  if (isPortrait) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#020c04',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '1.5rem', padding: '2rem',
      }}>
        <div style={{ fontSize: '4rem', animation: 'rotateHint 2s ease-in-out infinite' }}>📱</div>
        <style>{`
          @keyframes rotateHint {
            0%,100% { transform: rotate(0deg); }
            40%      { transform: rotate(90deg); }
            60%      { transform: rotate(90deg); }
          }
        `}</style>
        <div style={{ fontFamily: 'Black Ops One, serif', fontSize: 'clamp(1.2rem,6vw,1.8rem)', color: '#5aad5e', textAlign: 'center', letterSpacing: '0.08em' }}>
          ROTATE DEVICE
        </div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 'clamp(0.7rem,3.5vw,0.9rem)', color: '#9ab89d', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
          For the best experience, please rotate your device to landscape mode.
        </div>
        <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg,transparent,#5aad5e,transparent)', marginTop: '0.5rem' }} />
      </div>
    );
  }

  return children;
}
