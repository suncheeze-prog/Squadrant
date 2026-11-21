import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOrientation } from '../hooks/useOrientation';
import { signIn } from '../firebase.config';
import { getUserProfile } from '../utils/userProfile';

export default function LoginScreen({ onLogin, onSignup, onForgot }) {
  const { play } = useApp();
  const { isPortrait } = useOrientation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);

  const handleSubmit = async () => {
    if (!email.trim()) { play('miss'); setError('Email required'); return; }
    if (!password.trim()) { play('miss'); setError('Password required'); return; }
    play('select'); setLoading(true); setError('');
    try {
      const u = await signIn({ email: email.trim(), password });
      const profile = await getUserProfile(u.uid);
      onLogin({
        uid: u.uid,
        email: u.email,
        username: profile?.username || u.displayName || u.email.split('@')[0],
        wins: profile?.wins || 0,
        losses: profile?.losses || 0,
      });
    } catch (e) {
      const msg = (e?.code === 'auth/invalid-credential' || e?.code === 'auth/wrong-password' || e?.code === 'auth/user-not-found')
        ? 'Invalid email or password'
        : (e?.message || 'Login failed');
      setError(msg);
      play('miss');
    } finally {
      setLoading(false);
    }
  };

  const Styles = () => (
    <style>{`
      @keyframes gridDrift  { 0%{background-position:0 0} 100%{background-position:40px 40px} }
      @keyframes logoPulse  { 0%,100%{opacity:0.82} 50%{opacity:1} }
      @keyframes scanBar    { 0%{top:-2px} 100%{top:calc(100% + 2px)} }
      @keyframes topAccent  { 0%,100%{opacity:0.35} 50%{opacity:1} }
    `}</style>
  );

  const Bg = () => (
    <>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:'linear-gradient(var(--green-dim) 1px,transparent 1px),linear-gradient(90deg,var(--green-dim) 1px,transparent 1px)',
        backgroundSize:'40px 40px', opacity:0.06,
        animation:'gridDrift 20s linear infinite', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(40,80,42,0.28) 0%, transparent 70%)',
        pointerEvents:'none' }}/>
      {[15,50,82].map(y => (
        <div key={y} style={{ position:'absolute', left:0, right:0, top:`${y}%`, height:1,
          background:'linear-gradient(90deg,transparent,rgba(90,173,94,0.07),transparent)',
          pointerEvents:'none' }}/>
      ))}
    </>
  );

  const CenteredSpaced = ({ children, spacing, style = {} }) => (
    <span style={{ display:'inline-block', letterSpacing:spacing, marginRight:`-${spacing}`, ...style }}>
      {children}
    </span>
  );

  const emailField = (compact) => (
    <div>
      <div className="label-xs" style={{ marginBottom:'0.35rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
        <span style={{ color:'var(--green-bright)' }}>▸</span> EMAIL
      </div>
      <div style={{ position:'relative' }}>
        <input className="game-input" type="email" placeholder="commander@example.com" value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
          autoComplete="email"
          style={{ paddingLeft:'2.8rem', borderColor:focused==='email'?'var(--green-bright)':undefined, ...(compact&&{ minHeight:44 }) }}
        />
        <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)',
          fontSize:'1rem', pointerEvents:'none', opacity:focused==='email'?1:0.4, transition:'opacity 0.2s' }}>✉</span>
      </div>
    </div>
  );

  const passwordField = (compact) => (
    <div>
      <div className="label-xs" style={{ marginBottom:'0.35rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
        <span style={{ color:'var(--green-bright)' }}>▸</span> PASSWORD
      </div>
      <div style={{ position:'relative' }}>
        <input className="game-input" type="password" placeholder="Enter your password" value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
          autoComplete="current-password"
          style={{ paddingLeft:'2.8rem', borderColor:focused==='pw'?'var(--green-bright)':undefined, ...(compact&&{ minHeight:44 }) }}
        />
        <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)',
          fontSize:'1rem', pointerEvents:'none', opacity:focused==='pw'?1:0.4, transition:'opacity 0.2s' }}>🔒</span>
      </div>
    </div>
  );

  const errorMsg = () => error ? (
    <div style={{ color:'#ff8a80', fontSize:'clamp(0.65rem,2.2vw,0.75rem)',
      fontFamily:'Share Tech Mono', padding:'0.5rem 0.7rem',
      background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.3)',
      animation:'slideUp 0.2s ease', display:'flex', alignItems:'center', gap:'0.4rem' }}>
      ⚠ {error}
    </div>
  ) : null;

  const deployBtn = (compact) => (
    <button className="btn btn-primary btn-cta" onClick={handleSubmit} disabled={loading}
      style={{ width:'100%', letterSpacing:'0.35em',
        boxShadow:loading?'none':'0 0 20px rgba(90,173,94,0.2)',
        ...(compact&&{ minHeight:48 }) }}>
      {loading
        ? <span style={{ animation:'blink 0.8s infinite' }}>▶ AUTHENTICATING...</span>
        : <CenteredSpaced spacing="0.35em">▶ DEPLOY</CenteredSpaced>
      }
    </button>
  );

  const links = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', alignItems:'center', marginTop:'0.4rem' }}>
      <button onClick={() => { play('click'); onForgot(); }} disabled={loading}
        style={{ background:'transparent', border:'none', color:'var(--amber)',
          fontFamily:'Share Tech Mono', fontSize:'clamp(0.55rem,1.9vw,0.68rem)',
          cursor:'pointer', textDecoration:'underline', letterSpacing:'0.1em', padding:'0.2rem 0.5rem' }}>
        🔑 Forgot password?
      </button>
      <div style={{ fontSize:'clamp(0.55rem,1.9vw,0.68rem)', fontFamily:'Share Tech Mono', color:'var(--white-dim)' }}>
        No account?{' '}
        <button onClick={() => { play('click'); onSignup(); }} disabled={loading}
          style={{ background:'transparent', border:'none', color:'var(--green-bright)',
            fontFamily:'Share Tech Mono', fontSize:'inherit',
            cursor:'pointer', textDecoration:'underline', fontWeight:700, padding:0 }}>
          ▸ ENLIST NOW
        </button>
      </div>
    </div>
  );

  /* ═══════════════ LANDSCAPE ═══════════════ */
  if (!isPortrait) {
    return (
      <div className="screen" style={{
        background: 'var(--bg-void)',
        alignItems: 'center', justifyContent: 'center',
        padding:`max(0.6rem,var(--safe-top)) max(0.8rem,var(--safe-right)) max(0.6rem,var(--safe-bottom)) max(0.8rem,var(--safe-left))`,
      }}>
        <Styles/><Bg/>
        <div style={{
          display:'flex', gap:'clamp(0.5rem,1.5vw,0.9rem)',
          width:'100%', maxWidth:'min(880px,96vw)',
          alignItems:'stretch', position:'relative', zIndex:10,
        }}>
          {/* Logo */}
          <div style={{
            flex:'0 0 40%',
            background:'rgba(10,26,11,0.93)',
            border:'1px solid rgba(90,173,94,0.25)',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            padding:'clamp(1rem,3vw,1.8rem)',
            backdropFilter:'blur(12px)',
            position:'relative', overflow:'hidden',
          }}>
            <div className="corner-deco tl"/><div className="corner-deco tr"/>
            <div className="corner-deco bl"/><div className="corner-deco br"/>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
              background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
              animation:'topAccent 2.5s ease-in-out infinite' }}/>
            <div style={{ textAlign:'center' }}>
              <div className="label-xs" style={{ marginBottom:'0.4rem', opacity:0.65 }}>
                <CenteredSpaced spacing="0.45em">▶ NAVAL COMMAND ◀</CenteredSpaced>
              </div>
              <h1 className="title-font" style={{
                fontSize:'clamp(1.3rem,4.2vw,2.2rem)',
                color:'var(--green-bright)',
                textShadow:'0 0 26px rgba(90,173,94,0.55)',
                animation:'logoPulse 3s ease-in-out infinite',
                lineHeight:1, textAlign:'center', display:'block',
                whiteSpace:'nowrap', margin:0,
              }}>
                <CenteredSpaced spacing="0.04em">SQUADRANT</CenteredSpaced>
              </h1>
              <div style={{ width:36, height:1,
                background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
                margin:'0.5rem auto' }}/>
              <div className="label-xs" style={{ opacity:0.4 }}>
                <CenteredSpaced spacing="0.18em">COORDINATE WARFARE SYSTEM v2</CenteredSpaced>
              </div>
            </div>
          </div>

          {/* Form */}
          <div style={{
            flex:1,
            background:'rgba(10,26,11,0.93)',
            border:'1px solid rgba(90,173,94,0.25)',
            padding:'clamp(0.85rem,2.5vw,1.4rem) clamp(0.9rem,3vw,1.7rem)',
            display:'flex', flexDirection:'column',
            justifyContent:'center',
            gap:'clamp(0.45rem,1.5vh,0.7rem)',
            backdropFilter:'blur(12px)',
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', left:0, right:0, height:1, top:0,
              background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
              animation:'scanBar 3.5s linear infinite', pointerEvents:'none', opacity:0.5 }}/>
            <div className="corner-deco tl"/><div className="corner-deco tr"/>
            <div className="corner-deco bl"/><div className="corner-deco br"/>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
              background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
              animation:'topAccent 2.5s ease-in-out infinite' }}/>
            {emailField(true)}
            {passwordField(true)}
            {errorMsg()}
            {deployBtn(true)}
            {links()}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════ PORTRAIT ═══════════════ */
  return (
    <div className="screen" style={{
      background:'var(--bg-void)',
      alignItems:'center', justifyContent:'center',
      padding:`max(1rem,var(--safe-top)) 1rem max(1rem,var(--safe-bottom))`,
    }}>
      <Styles/><Bg/>
      <div style={{
        position:'relative', zIndex:10,
        background:'rgba(10,26,11,0.92)',
        border:'1px solid rgba(90,173,94,0.25)',
        padding:'clamp(1.3rem,5vw,2.4rem) clamp(1.1rem,4.5vw,2.2rem)',
        width:'100%', maxWidth:'min(440px,94vw)',
        boxShadow:'0 0 60px rgba(0,0,0,0.8), 0 0 40px rgba(90,173,94,0.06)',
        overflow:'hidden', backdropFilter:'blur(12px)',
      }}>
        <div style={{ position:'absolute', left:0, right:0, height:1, top:0,
          background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
          animation:'scanBar 3.5s linear infinite', pointerEvents:'none', opacity:0.5 }}/>
        <div className="corner-deco tl"/><div className="corner-deco tr"/>
        <div className="corner-deco bl"/><div className="corner-deco br"/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
          background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
          animation:'topAccent 2.5s ease-in-out infinite' }}/>

        <div style={{ textAlign:'center', marginBottom:'clamp(1.2rem,4vw,1.8rem)' }}>
          <div className="label-xs" style={{ marginBottom:'0.4rem', opacity:0.7 }}>
            <CenteredSpaced spacing="0.5em">▶ NAVAL COMMAND ◀</CenteredSpaced>
          </div>
          <h1 className="title-font" style={{
            fontSize:'clamp(1.8rem,8vw,3rem)',
            color:'var(--green-bright)',
            textShadow:'0 0 28px rgba(90,173,94,0.55)',
            animation:'logoPulse 3s ease-in-out infinite',
            lineHeight:1, textAlign:'center', display:'block',
            whiteSpace:'nowrap', margin:0,
          }}>
            <CenteredSpaced spacing="0.04em">SQUADRANT</CenteredSpaced>
          </h1>
          <div style={{ width:60, height:1,
            background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
            margin:'0.55rem auto' }}/>
          <div className="label-xs" style={{ opacity:0.5 }}>
            <CenteredSpaced spacing="0.3em">COORDINATE WARFARE SYSTEM v2</CenteredSpaced>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'clamp(0.6rem,2vw,0.95rem)' }}>
          {emailField(false)}
          {passwordField(false)}
          {errorMsg()}
          {deployBtn(false)}
          {links()}
        </div>
      </div>
    </div>
  );
}
