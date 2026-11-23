import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   THEME DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */
export const THEMES = {
  dark: {
    id: 'dark', label: 'Dark Mode', icon: '🌑',
    vars: {
      '--bg-void':'#020c04','--bg-dark':'#050f06','--bg-panel':'#0a1a0b',
      '--bg-card':'#0e2010','--bg-button':'#1a3d1c','--bg-button-hover':'#244d26',
      '--green-dim':'#2d5a2f','--green-mid':'#3d7a40','--green-bright':'#5aad5e',
      '--green-glow':'#7dd67f','--green-accent':'#a8e6ab',
      '--amber':'#e8a000','--red':'#c0392b','--red-bright':'#e74c3c',
      '--blue-target':'#1e6b8c','--white-cream':'#e8f0e0','--white-dim':'#9ab89d',
      '--border-panel':'1px solid rgba(90,173,94,0.2)','--border-bright':'1px solid rgba(90,173,94,0.5)',
      '--accent1':'#5aad5e','--accent2':'#3d7a40',
    }
  },
  light: {
    id: 'light', label: 'Light Mode', icon: '☀️',
    vars: {
      '--bg-void':'#e8f0e0','--bg-dark':'#d4e6d6','--bg-panel':'#c2d9c4',
      '--bg-card':'#b0ccb3','--bg-button':'#4a7a4c','--bg-button-hover':'#3a6a3c',
      '--green-dim':'#2d5a2f','--green-mid':'#3d7a40','--green-bright':'#1a5c1e',
      '--green-glow':'#0d4010','--green-accent':'#0a2e0c',
      '--amber':'#8a5000','--red':'#8b1a12','--red-bright':'#b02218',
      '--blue-target':'#0e3f58','--white-cream':'#0a1a0c','--white-dim':'#1a3a1e',
      '--border-panel':'1px solid rgba(20,80,22,0.35)','--border-bright':'1px solid rgba(20,80,22,0.7)',
      '--accent1':'#1a5c1e','--accent2':'#2d5a2f',
    }
  },
  neon: {
    id: 'neon', label: 'Neon Battle', icon: '🔥',
    vars: {
      '--bg-void':'#0a0015','--bg-dark':'#10002a','--bg-panel':'#150030',
      '--bg-card':'#1a0040','--bg-button':'#4a0080','--bg-button-hover':'#6000a0',
      '--green-dim':'#8800ff','--green-mid':'#aa00ff','--green-bright':'#cc44ff',
      '--green-glow':'#ff88ff','--green-accent':'#ffccff',
      '--amber':'#ff6600','--red':'#ff0066','--red-bright':'#ff3388',
      '--blue-target':'#0066ff','--white-cream':'#f0e0ff','--white-dim':'#c0a0e0',
      '--border-panel':'1px solid rgba(180,0,255,0.3)','--border-bright':'1px solid rgba(200,50,255,0.7)',
      '--accent1':'#cc44ff','--accent2':'#aa00ff',
    }
  },
  ocean: {
    id: 'ocean', label: 'Ocean Ops', icon: '🌊',
    vars: {
      '--bg-void':'#000d1a','--bg-dark':'#001428','--bg-panel':'#001e38',
      '--bg-card':'#002848','--bg-button':'#004080','--bg-button-hover':'#0055a0',
      '--green-dim':'#006a8a','--green-mid':'#0088aa','--green-bright':'#00aacc',
      '--green-glow':'#44ccee','--green-accent':'#88eeff',
      '--amber':'#e8a000','--red':'#cc2200','--red-bright':'#ff4422',
      '--blue-target':'#0044aa','--white-cream':'#d0f0ff','--white-dim':'#80b0cc',
      '--border-panel':'1px solid rgba(0,170,204,0.25)','--border-bright':'1px solid rgba(0,200,240,0.6)',
      '--accent1':'#00aacc','--accent2':'#006a8a',
    }
  },
  cyber: {
    id: 'cyber', label: 'Cyber Ops', icon: '⚡',
    vars: {
      '--bg-void':'#000a0a','--bg-dark':'#001010','--bg-panel':'#001818',
      '--bg-card':'#002020','--bg-button':'#003838','--bg-button-hover':'#005050',
      '--green-dim':'#007a7a','--green-mid':'#00aaaa','--green-bright':'#00dddd',
      '--green-glow':'#44ffff','--green-accent':'#aaffff',
      '--amber':'#ffcc00','--red':'#ff4400','--red-bright':'#ff6600',
      '--blue-target':'#0066cc','--white-cream':'#ccffff','--white-dim':'#88cccc',
      '--border-panel':'1px solid rgba(0,200,200,0.25)','--border-bright':'1px solid rgba(0,255,255,0.6)',
      '--accent1':'#00dddd','--accent2':'#007a7a',
    }
  },
  desert: {
    id: 'desert', label: 'Desert Storm', icon: '🏜️',
    vars: {
      '--bg-void':'#120b04','--bg-dark':'#1a1006','--bg-panel':'#241708',
      '--bg-card':'#2e1d0b','--bg-button':'#5a3a12','--bg-button-hover':'#7a4e18',
      '--green-dim':'#7a5a24','--green-mid':'#a87c2e','--green-bright':'#e0a83c',
      '--green-glow':'#ffd070','--green-accent':'#ffe6b0',
      '--amber':'#ffb020','--red':'#b83a1e','--red-bright':'#e85a2a',
      '--blue-target':'#3a7a8c','--white-cream':'#fff2d8','--white-dim':'#c8a878',
      '--border-panel':'1px solid rgba(224,168,60,0.25)','--border-bright':'1px solid rgba(255,200,90,0.6)',
      '--accent1':'#e0a83c','--accent2':'#a87c2e',
    }
  },
  space: {
    id: 'space', label: 'Deep Space', icon: '🪐',
    vars: {
      '--bg-void':'#04030c','--bg-dark':'#080614','--bg-panel':'#0e0a20',
      '--bg-card':'#151030','--bg-button':'#2a1e60','--bg-button-hover':'#3a2a80',
      '--green-dim':'#5a4a9a','--green-mid':'#7666c0','--green-bright':'#9a88ff',
      '--green-glow':'#c8b8ff','--green-accent':'#e6ddff',
      '--amber':'#ffb020','--red':'#d03060','--red-bright':'#ff4a78',
      '--blue-target':'#3a6ad0','--white-cream':'#f0ecff','--white-dim':'#a89cd0',
      '--border-panel':'1px solid rgba(154,136,255,0.25)','--border-bright':'1px solid rgba(180,160,255,0.65)',
      '--accent1':'#9a88ff','--accent2':'#7666c0',
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   AUDIO ENGINE (Procedural — no external files)
   + MP3 support when files are placed in /public/sounds/
   ═══════════════════════════════════════════════════════════════ */
function createAudioEngine() {
  let ctx = null;
  let bgGain = null, sfxGain = null, musicGain = null;
  let bgOscs = [];
  let bgPlaying = false;
  let masterVol = 0.7, musicVol = 0.5, sfxVol = 1.0;
  let muted = false;
  let currentMusic = null; // HTMLAudioElement
  let currentMusicSrc = '';
  let currentRequest = ''; // requested track key — survives MP3 failure → procedural fallback
  let procTimer = null;
  let procMode = null;
  let gestureCleanup = null; // removes pending autoplay-retry listeners

  const getCtx = () => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        bgGain    = ctx.createGain(); bgGain.gain.value    = 0.12; bgGain.connect(ctx.destination);
        sfxGain   = ctx.createGain(); sfxGain.gain.value   = 0.7;  sfxGain.connect(ctx.destination);
        musicGain = ctx.createGain(); musicGain.gain.value = 0.5;  musicGain.connect(ctx.destination);
        console.log('[Audio] AudioContext created successfully');
      } catch(e){ 
        console.error('[Audio] Failed to create AudioContext:', e);
        return null; 
      }
    }
    return ctx;
  };

  const resume = () => { 
    const c = getCtx(); 
    if (!c) {
      console.warn('[Audio] Cannot resume: AudioContext not available');
      return;
    }
    if (c.state === 'suspended') {
      c.resume().catch(e => console.warn('[Audio] Resume failed:', e));
      console.log('[Audio] Context resumed from suspended state');
    }
  };

  const applyVols = () => {
    if (sfxGain)   sfxGain.gain.value   = muted ? 0 : masterVol * sfxVol;
    if (bgGain)    bgGain.gain.value     = muted ? 0 : masterVol * 0.15;
    if (musicGain) musicGain.gain.value  = muted ? 0 : masterVol * musicVol;
    if (currentMusic) currentMusic.volume = muted ? 0 : masterVol * musicVol;
  };

  const setMasterVol = (v) => { masterVol = v / 100; applyVols(); };
  const setMusicVol  = (v) => { musicVol  = v / 100; applyVols(); };
  const setSfxVol    = (v) => { sfxVol    = v / 100; applyVols(); };
  const setMuted     = (m) => { muted = m; applyVols(); };

  /* ── Music: MP3 with procedural fallback ── */
  const musicNote = (freq, dur, gain = 0.12, type = 'sine', delay = 0) => {
    const c = getCtx();
    if (!c || muted || c.state !== 'running') return;
    try {
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const gn = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.04);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* audio can be unavailable */ }
  };

  const MENU_SEQ = [220.00, 261.63, 329.63, 392.00, 329.63, 261.63, 246.94, 196.00];
  const GAME_SEQ = [110.00, 146.83, 164.81, 146.83, 110.00, 130.81, 146.83, 98.00];

  const stopProcMusic = () => {
    procMode = null;
    if (procTimer) { clearTimeout(procTimer); procTimer = null; }
  };

  const startProcMusic = (mode = 'menu') => {
    const c = getCtx();
    if (!c) return;
    stopProcMusic();
    procMode = mode;
    const seq = mode === 'menu' ? MENU_SEQ : GAME_SEQ;
    const interval = mode === 'menu' ? 620 : 280;
    let i = 0;
    const tick = () => {
      if (!procMode) return;
      const note = seq[i % seq.length];
      if (mode === 'menu') {
        musicNote(note, 1.7, 0.11, 'sine');
        if (i % 4 === 0) musicNote(note / 2, 2.4, 0.07, 'triangle');
      } else {
        musicNote(note, 0.34, 0.10, 'square');
        musicNote(note * 2, 0.18, 0.035, 'triangle', 0.02);
        if (i % 4 === 0) musicNote(note / 2, 0.5, 0.08, 'sawtooth');
      }
      i++;
      procTimer = setTimeout(tick, interval);
    };
    tick();
  };

  const playMusic = (src, fade = true, fallbackMode = null) => {
    if (currentRequest === src) return;
    stopMusic(fade ? 0.5 : 0);
    currentRequest = src;

    let audio;
    try {
      audio = new Audio(src);
    } catch (e) {
      if (fallbackMode) startProcMusic(fallbackMode);
      return;
    }

    audio.loop = true;
    audio.volume = 0;
    currentMusic = audio;
    currentMusicSrc = src;

    let failed = false;
    let retryArmed = false;

    const removeGestureRetry = () => {
      retryArmed = false;
      window.removeEventListener('pointerdown', retryPlay);
      window.removeEventListener('keydown', retryPlay);
      window.removeEventListener('touchstart', retryPlay);
      window.removeEventListener('click', retryPlay);
      if (gestureCleanup === removeGestureRetry) gestureCleanup = null;
    };

    const useFallback = () => {
      if (failed) return;
      failed = true;
      removeGestureRetry();
      if (currentMusic === audio) { currentMusic = null; currentMusicSrc = ''; }
      try { audio.pause(); } catch (e) { /* noop */ }
      if (currentRequest !== src) return;
      if (fallbackMode) {
        console.info(`[Audio] ${src} unavailable — using procedural ${fallbackMode} music`);
        startProcMusic(fallbackMode);
      }
    };

    const handlePlayError = (err) => {
      if (err && err.name === 'NotAllowedError') {
        // Autoplay policy blocked playback. Keep the track and retry after
        // the first real user gesture instead of switching to fallback music.
        if (retryArmed) return;
        retryArmed = true;
        window.addEventListener('pointerdown', retryPlay, { once: true });
        window.addEventListener('keydown', retryPlay, { once: true });
        window.addEventListener('touchstart', retryPlay, { once: true });
        window.addEventListener('click', retryPlay, { once: true });
        gestureCleanup = removeGestureRetry;
        return;
      }
      useFallback();
    };

    const retryPlay = () => {
      removeGestureRetry();
      if (currentRequest !== src || currentMusic !== audio) return;
      try {
        const p = audio.play();
        if (p) p.catch(handlePlayError);
      } catch (e) {
        handlePlayError(e);
      }
    };

    audio.addEventListener('error', useFallback, { once: true });

    try {
      const promise = audio.play();
      if (promise) promise.catch(handlePlayError);
    } catch (e) {
      handlePlayError(e);
    }

    if (fade) {
      let v = 0;
      const target = () => (muted ? 0 : masterVol * musicVol);
      const step = () => {
        if (currentMusic !== audio) return;
        v = Math.min(v + 0.05, target());
        audio.volume = v;
        if (v < target() && !muted) setTimeout(step, 80);
      };
      setTimeout(step, 80);
    } else {
      audio.volume = muted ? 0 : masterVol * musicVol;
    }
  };

  const stopMusic = (fadeSecs = 0.8) => {
    if (gestureCleanup) gestureCleanup();
    stopProcMusic();
    currentRequest = '';
    if (!currentMusic) return;
    const audio = currentMusic;
    currentMusic = null;
    currentMusicSrc = '';
    if (fadeSecs <= 0) { try { audio.pause(); } catch (e) { /* noop */ } return; }
    let v = audio.volume;
    const step = () => {
      v = Math.max(0, v - 0.05);
      audio.volume = v;
      if (v > 0) setTimeout(step, 80);
      else { try { audio.pause(); } catch (e) { /* noop */ } }
    };
    step();
  };

  /* ── Procedural ambient bg ── */
  const startBg = () => {
    const c = getCtx(); if (!c || bgPlaying) return;
    bgPlaying = true;
    const rumble = c.createOscillator();
    const rg = c.createGain(); rumble.type='sawtooth'; rumble.frequency.value=55; rg.gain.value=0.06;
    rumble.connect(rg); rg.connect(bgGain); rumble.start();
    const pulse = c.createOscillator();
    const pg = c.createGain(); pulse.type='square'; pulse.frequency.value=110; pg.gain.value=0;
    pulse.connect(pg); pg.connect(bgGain); pulse.start();
    const ping = () => {
      if (!bgPlaying) return;
      const t = c.currentTime;
      pg.gain.setValueAtTime(0.04, t);
      pg.gain.exponentialRampToValueAtTime(0.0001, t+0.6);
      setTimeout(ping, 3200);
    };
    setTimeout(ping, 600);
    bgOscs = [rumble, pulse];
  };

  const stopBg = () => {
    bgPlaying = false;
    bgOscs.forEach(o => { try { o.stop(); } catch(e){} });
    bgOscs = [];
  };

  /* ── SFX (procedural) ── */
  const tone = (freq, type, dur, g) => {
    const c = getCtx();
    if (!c) {
      console.warn('[Audio] Cannot play tone: AudioContext not available');
      return;
    }
    if (muted) return;
    try {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.value = freq;
      gn.gain.setValueAtTime(g * masterVol * sfxVol, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(gn); gn.connect(sfxGain); o.start(); o.stop(c.currentTime + dur);
    } catch(e) {
      console.error('[Audio] Error playing tone:', e);
    }
  };
  
  const noise = (dur, g) => {
    const c = getCtx();
    if (!c) {
      console.warn('[Audio] Cannot play noise: AudioContext not available');
      return;
    }
    if (muted) return;
    try {
      const n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0); for (let i=0;i<n;i++) d[i]=Math.random()*2-1;
      const src=c.createBufferSource(), gn=c.createGain(), f=c.createBiquadFilter();
      src.buffer=buf; f.type='bandpass'; f.frequency.value=800; f.Q.value=1;
      gn.gain.setValueAtTime(g*masterVol*sfxVol, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
      src.connect(f); f.connect(gn); gn.connect(sfxGain);
      src.start(); src.stop(c.currentTime+dur);
    } catch(e) {
      console.error('[Audio] Error playing noise:', e);
    }
  };

  /** Sweep a tone between two frequencies — used for launch/miss effects. */
  const sweep = (f1, f2, dur, g, type = 'sine') => {
    const c = getCtx();
    if (!c || muted) return;
    try {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f1), c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), c.currentTime + dur);
      gn.gain.setValueAtTime(g * masterVol * sfxVol, c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(gn); gn.connect(sfxGain);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) {
      console.error('[Audio] Error playing sweep:', e);
    }
  };

  /* ── Recorded WAV samples (UI click + fire whoosh) ── */
  const SAMPLE_SRC = {
    click: '/sounds/click.wav',
    fire:  '/sounds/air-whoosh.wav',
  };
  const sampleData = {};     // fetched ArrayBuffers
  const sampleBuffers = {};  // decoded AudioBuffers
  let samplesStarted = false;

  const decodeSample = (key) => {
    if (sampleBuffers[key] || !sampleData[key]) return;
    const c = getCtx();
    if (!c) return;
    const data = sampleData[key];
    sampleData[key] = null; // decodeAudioData detaches the buffer — decode once
    try {
      c.decodeAudioData(
        data,
        buf => { sampleBuffers[key] = buf; },
        err => console.warn(`[Audio] Could not decode ${SAMPLE_SRC[key]}:`, err)
      );
    } catch (e) {
      console.warn(`[Audio] Could not decode ${SAMPLE_SRC[key]}:`, e);
    }
  };

  const preloadSamples = () => {
    if (samplesStarted) return;
    samplesStarted = true;
    // Create the (suspended) context early so WAVs finish decoding before the
    // first click. It is resumed on the first user gesture as usual.
    if (!getCtx() || typeof fetch !== 'function') return;
    Object.entries(SAMPLE_SRC).forEach(([key, src]) => {
      fetch(src)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then(buf => { sampleData[key] = buf; decodeSample(key); })
        .catch(err => console.warn(`[Audio] Could not load ${src}:`, err));
    });
  };

  const playSample = (key) => {
    // Muted still counts as handled, so we never fall back to synth while muted.
    if (muted) return true;
    const c = getCtx();
    if (!c) return false;
    let buf = sampleBuffers[key];
    if (!buf) {
      decodeSample(key);
      buf = sampleBuffers[key];
    }
    if (!buf) return false;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(sfxGain);
      src.start();
      return true;
    } catch (e) {
      console.warn(`[Audio] Could not play ${SAMPLE_SRC[key]}:`, e);
      return false;
    }
  };

  const sounds = {
    click:   () => { if (!playSample('click')) tone(880,'square',0.08,0.3); },
    select:  () => { if (!playSample('click')) { tone(660,'square',0.06,0.2); tone(880,'square',0.06,0.2); } },
    fire:    () => { if (!playSample('fire')) { sweep(280,900,0.3,0.3,'sawtooth'); noise(0.22,0.4); } },
    hit:     () => { noise(0.3,0.8); tone(180,'sawtooth',0.4,0.5); },
    miss:    () => { sweep(340,110,0.32,0.28,'sine'); noise(0.16,0.22); },
    blocked: () => { tone(300,'square',0.14,0.32); tone(180,'square',0.2,0.24); },
    sunk:    () => { noise(0.5,1); tone(120,'sawtooth',0.6,0.8); tone(80,'sawtooth',0.8,0.6); },
    victory: () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,'square',0.3,0.5),i*150)); },
    defeat:  () => { [523,440,349,262].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',0.4,0.4),i*200)); },
    deploy:  () => { noise(0.15,0.4); tone(440,'square',0.2,0.3); },
    ping:    () => { tone(1200,'sine',0.15,0.4); },
    join:    () => { [440,554,659].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.2,0.35),i*80)); },
    leave:   () => { [659,554,440].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.2,0.3),i*80)); },

    // ── Targeting / weapon FX ──
    targeting:   () => { tone(520,'sine',0.07,0.16); setTimeout(()=>tone(660,'sine',0.07,0.14),110); },
    lock:        () => { tone(880,'square',0.05,0.24); setTimeout(()=>tone(1320,'square',0.09,0.28),55); },
    launchRocket:() => { sweep(280,900,0.3,0.3,'sawtooth'); noise(0.22,0.4); },
    launchBomb:  () => { sweep(900,180,0.45,0.26,'sine'); },
    launchNuke:  () => { tone(90,'sawtooth',0.75,0.55); sweep(220,55,0.9,0.4,'square'); },
  };

  return { getCtx, resume, startBg, stopBg, playMusic, stopMusic, setMasterVol, setMusicVol, setSfxVol, setMuted, preloadSamples, sounds };
}

/* ═══════════════════════════════════════════════════════════════
   APP CONTEXT
   ═══════════════════════════════════════════════════════════════ */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [themeId, setThemeId]     = useState(() => localStorage.getItem('sq_theme') || 'dark');
  const [masterVol, setMasterVol] = useState(() => Number(localStorage.getItem('sq_vol_master') ?? 70));
  const [musicVol, setMusicVol]   = useState(() => Number(localStorage.getItem('sq_vol_music')  ?? 50));
  const [sfxVol, setSfxVol]       = useState(() => Number(localStorage.getItem('sq_vol_sfx')    ?? 80));
  const [soundOn, setSoundOn]     = useState(() => localStorage.getItem('sq_sound') !== 'false');
  const [turnTime, setTurnTime]   = useState(() => Number(localStorage.getItem('sq_turn_time') ?? 30));
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudioEngine();
  const audio = audioRef.current;

  // Apply theme vars
  useEffect(() => {
    const theme = THEMES[themeId] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', themeId);
    localStorage.setItem('sq_theme', themeId);
  }, [themeId]);

  // Preload recorded UI sounds so the first click is instant
  useEffect(() => { audio.preloadSamples(); }, [audio]);

  // Sync volumes
  useEffect(() => { audio.setMasterVol(masterVol); localStorage.setItem('sq_vol_master', masterVol); }, [masterVol, audio]);
  useEffect(() => { audio.setMusicVol(musicVol);   localStorage.setItem('sq_vol_music', musicVol); }, [musicVol, audio]);
  useEffect(() => { audio.setSfxVol(sfxVol);       localStorage.setItem('sq_vol_sfx', sfxVol); }, [sfxVol, audio]);
  useEffect(() => { audio.setMuted(!soundOn);       localStorage.setItem('sq_sound', soundOn); }, [soundOn, audio]);
  useEffect(() => { localStorage.setItem('sq_turn_time', turnTime); }, [turnTime]);

  const setTheme     = useCallback((id) => setThemeId(id), []);
  const toggleSound  = useCallback(() => setSoundOn(p => !p), []);

  const play = useCallback((sfx) => {
    if (!soundOn) {
      console.log(`[Audio] Sound "${sfx}" skipped: soundOn is false`);
      return;
    }
    console.log(`[Audio] Playing sound: ${sfx}`);
    audio.resume();
    const sound = audio.sounds[sfx];
    if (!sound) {
      console.warn(`[Audio] Sound not found: ${sfx}`);
      return;
    }
    try {
      sound();
    } catch(e) {
      console.error(`[Audio] Error playing sound "${sfx}":`, e);
    }
  }, [soundOn, audio]);

  const startBg = useCallback(() => {
    if (!soundOn) return;
    audio.resume(); audio.startBg();
  }, [soundOn, audio]);
  const stopBg  = useCallback(() => audio.stopBg(), [audio]);

  // Music helpers — src should be a path under /public/sounds/
  // If file doesn't exist the browser just silently fails; procedural bg still plays
  const playMenuMusic = useCallback(() => {
    if (!soundOn) return;
    audio.resume();
    audio.playMusic('/sounds/menu.mp3', true, 'menu');
  }, [soundOn, audio]);

  const playGameMusic = useCallback(() => {
    if (!soundOn) return;
    audio.resume();
    audio.playMusic('/sounds/game.mp3', true, 'game');
  }, [soundOn, audio]);

  const stopMusic = useCallback(() => audio.stopMusic(), [audio]);

  const value = {
    theme: THEMES[themeId] || THEMES.dark,
    themeId, setTheme,
    masterVol, setMasterVol,
    musicVol, setMusicVol,
    sfxVol, setSfxVol,
    soundOn, toggleSound,
    turnTime, setTurnTime,
    play, startBg, stopBg,
    playMenuMusic, playGameMusic, stopMusic,
    audioResume: () => audio.resume(),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
