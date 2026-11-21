import { useEffect } from 'react';

export function useLandscape(active = true) {
  useEffect(() => {
    if (!active) return;
    const tryLock = async () => {
      try {
        // eslint-disable-next-line no-restricted-globals
        const scr = window.screen;
        if (scr?.orientation?.lock) await scr.orientation.lock('landscape');
      } catch (e) { /* permission denied or desktop — handled by LandscapeGuard overlay */ }
    };
    tryLock();
    return () => {
      try {
        // eslint-disable-next-line no-restricted-globals
        const scr = window.screen;
        if (scr?.orientation?.unlock) scr.orientation.unlock();
      } catch (e) {}
    };
  }, [active]);
}
