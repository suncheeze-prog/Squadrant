import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { sendResetEmail } from '../firebase.config';

/**
 * Forgot Password — uses Firebase's secure reset email.
 * Firebase sends an email with a reset link. User clicks → sets new password
 * on Firebase-hosted page. This is the standard secure pattern.
 *
 * (Note: True 6-digit OTP would require a paid email service. The reset link
 * is functionally equivalent and works out of the box for free.)
 */
export default function ForgotPasswordScreen({ onBack }) {
  const { play } = useApp();
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [sent,  setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email'); play('miss'); return;
    }
    setError(''); setLoading(true); play('select');
    try {
      await sendResetEmail(email.trim());
      setSent(true);
    } catch (e) {
      const msg = e?.code === 'auth/user-not-found'
        ? 'No account found with that email'
        : (e?.message || 'Failed to send reset email');
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
      padding:`max(1rem,var(--safe-top)) 1rem max(1rem,var(--safe-bottom))`,
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
        border:'1px solid var(--amber)',
        padding:'clamp(1.2rem,5vw,2rem) clamp(1rem,4vw,2rem)',
        width:'100%', maxWidth:'min(440px,94vw)',
        boxShadow:'0 0 60px rgba(0,0,0,0.85), 0 0 28px rgba(232,160,0,0.15)',
        overflow:'hidden', backdropFilter:'blur(12px)',
      }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
          background:'linear-gradient(90deg,transparent,var(--amber),transparent)',
          animation:'topAccent 2.5s ease-in-out infinite' }}/>

        <div style={{ textAlign:'center', marginBottom:'clamp(1rem,3vw,1.4rem)' }}>
          <div style={{ fontSize:'clamp(1.8rem,6vw,2.5rem)', marginBottom:'0.4rem' }}>🔑</div>
          <div className="label-xs" style={{ letterSpacing:'0.4em', opacity:0.65, marginBottom:'0.4rem' }}>
            ── PASSWORD RECOVERY ──
          </div>
          <h2 className="title-font" style={{
            fontSize:'clamp(1.05rem,4.5vw,1.5rem)',
            color:'var(--amber)',
            letterSpacing:'0.05em', margin:0,
            textShadow:'0 0 16px rgba(232,160,0,0.55)',
          }}>
            RESET ACCESS CODE
          </h2>
        </div>

        {!sent ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
            <div style={{ fontSize:'clamp(0.65rem,2.2vw,0.75rem)', color:'var(--white-dim)',
              fontFamily:'Share Tech Mono', lineHeight:1.5, textAlign:'center' }}>
              Enter your registered email. A secure reset link will be sent —
              click it to set a new password.
            </div>

            <div>
              <div className="label-xs" style={{ marginBottom:'0.3rem' }}>▸ REGISTERED EMAIL</div>
              <input className="game-input" type="email" placeholder="name@gmail.com"
                value={email} onChange={e=>{setEmail(e.target.value);setError('');}}
                onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
                autoComplete="email" autoFocus style={{ minHeight:44 }}/>
            </div>

            {error && (
              <div style={{ color:'#ff8a80', fontSize:'clamp(0.65rem,2.2vw,0.75rem)',
                fontFamily:'Share Tech Mono', padding:'0.5rem 0.7rem',
                background:'rgba(192,57,43,0.1)', border:'1px solid rgba(192,57,43,0.3)' }}>
                ⚠ {error}
              </div>
            )}

            <button className="btn btn-primary btn-cta" onClick={handleSubmit} disabled={loading}
              style={{ width:'100%', letterSpacing:'0.18em',
                background:'rgba(232,160,0,0.2)', borderColor:'var(--amber)', color:'var(--amber)',
                boxShadow:loading?'none':'0 0 16px rgba(232,160,0,0.3)', minHeight:48 }}>
              {loading ? '⟳ SENDING...' : '▶ SEND RESET LINK'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem' }}>✉</div>
            <div className="title-font" style={{ fontSize:'clamp(0.9rem,3.5vw,1.15rem)', color:'var(--green-bright)' }}>
              EMAIL SENT
            </div>
            <div style={{ fontSize:'clamp(0.65rem,2.2vw,0.78rem)', color:'var(--white-dim)',
              fontFamily:'Share Tech Mono', lineHeight:1.6 }}>
              A password reset link has been sent to:<br/>
              <span style={{ color:'var(--amber)', fontWeight:700 }}>{email.trim()}</span><br/><br/>
              Check your inbox (and spam folder).<br/>
              Click the link to set a new password.<br/>
              Once done, return here and login with new password.
            </div>
            <button className="btn btn-primary" onClick={() => { play('click'); onBack(); }}
              style={{ minHeight:42, marginTop:'0.5rem', letterSpacing:'0.15em' }}>
              ▶ BACK TO LOGIN
            </button>
          </div>
        )}

        {!sent && (
          <div style={{ textAlign:'center', marginTop:'0.7rem' }}>
            <button onClick={() => { play('click'); onBack(); }} disabled={loading}
              style={{ background:'transparent', border:'none', color:'var(--white-dim)',
                fontFamily:'Share Tech Mono', fontSize:'clamp(0.6rem,2vw,0.7rem)',
                cursor:'pointer', textDecoration:'underline', letterSpacing:'0.12em' }}>
              ← Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
