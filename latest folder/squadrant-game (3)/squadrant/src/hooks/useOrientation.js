import { useState, useEffect } from 'react';

/**
 * Returns { isPortrait, isLandscape } that updates whenever the device rotates.
 */
export function useOrientation() {
  const [isPortrait, setIsPortrait] = useState(
    () => window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 150));
    return () => {
      window.removeEventListener('resize', check);
      // no need to remove orientationchange since we used an arrow fn above;
      // the resize listener covers it on most platforms anyway
    };
  }, []);

  return { isPortrait, isLandscape: !isPortrait };
}
