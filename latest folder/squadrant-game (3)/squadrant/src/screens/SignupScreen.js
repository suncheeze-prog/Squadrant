import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { signUp, signOut } from '../firebase.config';
import { isUsernameAvailable, createUserProfile } from '../utils/userProfile';

export default function SignupScreen({ onComplete, onBack }) {
  const { play } = useApp();
  const [email,    setEmail]    = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Valid email required (e.g., name@gmail.com)';
    const u = username.trim();
    if (!u || u.length < 3 || u.length > 20) return 'Username must be 3-20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(u))            return 'Username: letters, numbers, _ only';
    if (password.length < 6)                    return 'Password must be at least 6 characters';
    if (password !== confirm)                   return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { setError(v); play('miss'); return; }
    setError(''); setLoading(true); play('select');
    try {
      // First, check username availability (fast pre-check)
      const ok = await isUsernameAvailable(username.trim());
      if (!ok) { setError('Username already taken'); setLoading(false); play('miss'); return; }

      // Create the Firebase auth user
      const user = await signUp({ email: email.trim(), password, username: username.trim() });

      // Reserve username + create profile in Firestore (atomic)
      try {
        await createUserProfile({ uid: user.uid, email: email.trim(), username: username.trim() });
      } catch (e) {
        // If username got taken in the race, sign out + show error
        await signOut().catch(() => {});
        throw new Error(e.message || 'Username conflict — try a different one');
      }

      onComplete({
        uid: user.uid,
        email: user.email,
        username: username.trim(),
        wins: 0, losses: 0,
      });
    } catch (e) {
      const msg = e?.code === 'auth/email-already-in-use'
        ? 'Email already registered — try logging in'
        : (e?.message || 'Signup failed');
      setError(msg);
      play('miss');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" style={{
      background:'var(--bg-void)',
      alignItems:'center', justifyContent:'center',
      padding:`max(0.8rem,var(--safe-top)) 1rem max(0.8rem,var(--safe-bottom))`,
      overflowY:'auto',
    }}>
      <style>{`
        @keyframes gridDrift  { 0%{background-position:0 0} 100%{background-position:40px 40px} }
        @keyframes topAccent  { 0%,100%{opacity:0.35} 50%{opacity:1} }
      `}</style>

      <div style={{ position:'absolute', inset:0,
        backgroundImage:'linear-gradient(var(--green-dim) 1px,transparent 1px),linear-gradient(90deg,var(--green-dim) 1px,transparent 1px)',
        backgroundSize:'40px 40px', opacity:0.06,
        animation:'gridDrift 20s linear infinite', pointerEvents:'none' }}/>

      <div style={{
        position:'relative', zIndex:10,
        background:'rgba(10,26,11,0.93)',
        border:'1px solid rgba(90,173,94,0.3)',
        padding:'clamp(1.2rem,4vw,2rem) clamp(1rem,4vw,2rem)',
        width:'100%', maxWidth:'min(460px,95vw)',
        boxShadow:'0 0 60px rgba(0,0,0,0.85), 0 0 32px rgba(90,173,94,0.1)',
        overflow:'hidden', backdropFilter:'blur(12px)',
      }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
          background:'linear-gradient(90deg,transparent,var(--green-bright),transparent)',
          animation:'topAccent 2.5s ease-in-out infinite' }}/>
        <div className="corner-deco tl"/><div className="corner-deco tr"/>
        <div className="corner-deco bl"/><div className="corner-deco br"/>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'clamp(1rem,3vw,1.4rem)' }}>
          <div className="label-xs" style={{ letterSpacing:'0.4em', opacity:0.65, marginBottom:'0.4rem' }}>
            ▶ ENLIST ◀
          </div>
          <h2 className="title-font" style={{
            fontSize:'clamp(1.2rem,5vw,1.8rem)',
            color:'var(--green-bright)',
            letterSpacing:'0.06em',
            textShadow:'0 0 18px rgba(90,173,94,0.55)',
            margin:0,
          }}>
            CREATE COMMANDER
          </h2>
          <div className="label-xs" style={{ opacity:0.55, marginTop:'0.35rem' }}>
            Register your callsign in the fleet
          </div>
        </div>

        {/* Fields */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>

          <div>
            <div className="label-xs" style={{ marginBottom:'0.3rem' }}>▸ EMAIL (GMAIL)</div>
            <input className="game-input" type="email" placeholder="name@gmail.com"
              value={email} onChange={e=>{setEmail(e.target.value);setError('');}}
              autoComplete="email" style={{ minHeight:42 }}/>
          </div>

          <div>
            <div className="label-xs" style={{ marginBottom:'0.3rem' }}>▸ USERNAME (CALLSIGN)</div>
            <input className="game-input" type="text" placeholder="3-20 chars, letters/numbers/_"
              value={username} maxLength={20}
              onChange={e=>{setUsername(e.target.value);setError('');}}
              autoComplete="username" style={{ minHeight:42 }}/>
            <div style={{ fontSize:'clamp(0.5rem,1.7vw,0.6rem)', color:'var(--white-dim)', fontFamily:'Share Tech Mono', marginTop:'0.2rem', opacity:0.7 }}>
              This is your in-game name visible to opponents
            </div>
          </div>

          <div>
            <div className="label-xs" style={{ marginBottom:'0.3rem' }}>▸ PASSWORD</div>
            <input className="game-input" type="password" placeholder="At least 6 characters"
              value={password} onChange={e=>{setPassword(e.target.value);setError('');}}
              autoComplete="new-password" style={{ minHeight:42 }}/>
          </div>

          <div>
            <div className="label-xs" style={{ marginBottom:'0.3rem' }}>▸ CONFIRM PASSWORD</div>
            <input className="game-input" type="password" placeholder="Repeat password"
              value={confirm} onChange={e=>{setConfirm(e.target.value);setError('');}}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
              autoComplete="new-password" style={{ minHeight:42 }}/>
          </div>

          {error && (
            <div style={{ color:'#ff8a80', fontSize:'clamp(0.65rem,2.2vw,0.75rem)',
              fontFamily:'Share Tech Mono', padding:'0.5rem 0.7rem',
              background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.3)' }}>
              ⚠ {error}
            </div>
          )}

          <button className="btn btn-primary btn-cta" onClick={handleSubmit} disabled={loading}
            style={{ width:'100%', letterSpacing:'0.2em', marginTop:'0.3rem',
              boxShadow:loading?'none':'0 0 18px rgba(90,173,94,0.25)', minHeight:48 }}>
            {loading ? '▶ CREATING...' : '▶ ENLIST'}
          </button>

          <button onClick={() => { play('click'); onBack(); }} disabled={loading}
            style={{ background:'transparent', border:'none', color:'var(--white-dim)',
              fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2vw,0.7rem)',
              cursor:'pointer', textDecoration:'underline', letterSpacing:'0.12em',
              marginTop:'0.2rem', padding:'0.3rem' }}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
