/* ═══════════════════════════════════════════════════════════════
   PLATFORM DETECTION
   ───────────────────────────────────────────────────────────────
   Distinguishes:
     - 'android'  — Native Android (Capacitor APK)
     - 'mobile'   — Mobile web browser
     - 'pc'       — Desktop web browser
   ═══════════════════════════════════════════════════════════════ */
import { Capacitor } from '@capacitor/core';

export function detectPlatform() {
  try {
    if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform ? Capacitor.getPlatform() : 'android';
      if (p === 'ios') return 'ios';
      return 'android';
    }
  } catch (e) {}

  // Web — check user agent to distinguish desktop vs mobile browser
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent || '').toLowerCase();
  if (/iphone|ipod|ipad/.test(ua)) return 'mobile';
  if (/android.*mobile/.test(ua)) return 'mobile';
  if (/mobile|tablet|opera mini|iemobile/.test(ua)) return 'mobile';
  return 'pc';
}

export const PLATFORM_META = {
  android: { icon: '📱', label: 'Android', color: '#5aad5e' },
  ios:     { icon: '📱', label: 'iOS',     color: '#5aad5e' },
  mobile:  { icon: '📱', label: 'Mobile',  color: '#5aad5e' },
  pc:      { icon: '🖥', label: 'PC',      color: '#4090d0' },
};

export function platformIcon(p) { return PLATFORM_META[p]?.icon  || '❓'; }
export function platformLabel(p) { return PLATFORM_META[p]?.label || 'Unknown'; }
export function platformColor(p) { return PLATFORM_META[p]?.color || 'var(--white-dim)'; }
