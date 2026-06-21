import React, { useState, useEffect } from 'react';

export default function LoginScreen({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isVerificationMode, setIsVerificationMode] = useState(false);
  const [checking, setChecking] = useState(true);

  // Input fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setIsLoginMode(data.registered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setErrorMsg('You must use a @gmail.com email address to register.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.requiresVerification) {
          setIsVerificationMode(true);
          setErrorMsg('');
        } else {
          setIsLoginMode(true);
          setErrorMsg('');
          setUsername('');
          setEmail('');
          setPassword('');
          setSuccessMsg('Account created successfully! Please sign in.');
        }
      } else {
        setErrorMsg(data.error || 'Failed to create account.');
      }
    } catch (err) {
      setErrorMsg('Network error. Ensure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsVerificationMode(false);
        setIsLoginMode(true);
        setErrorMsg('');
        setUsername('');
        setEmail('');
        setPassword('');
        setVerificationCode('');
        setSuccessMsg('Email verified successfully! You can now log in.');
      } else {
        setErrorMsg(data.error || 'Verification failed.');
      }
    } catch (err) {
      setErrorMsg('Network error while verifying.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for cold starts
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        // Save simple token to localStorage
        localStorage.setItem('cloud_lib_session', data.token);
        localStorage.setItem('cloud_lib_user', data.username || username);
        localStorage.setItem('cloud_lib_role', data.role);
        onLoginSuccess();
      } else if (res.status === 503) {
        setErrorMsg('Server is starting up. Please wait a few seconds and try again.');
      } else {
        setErrorMsg(data.error || 'Invalid username/email or password.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorMsg('Server is waking up (free tier). Please wait a moment and try again.');
      } else {
        setErrorMsg('Connection error. The server may be starting up — please try again in a few seconds.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0c0c0e', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent-color)' }}></div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at center, #111115 0%, #060608 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 999,
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden'
    }}>
      {/* Drifting Colorful background shapes */}
      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: '#ff2d55',
        filter: 'blur(100px)',
        opacity: 0.18,
        top: '10%',
        left: '20%',
        animation: 'drift-bubble-1 20s ease-in-out infinite alternate'
      }}></div>
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: '#5856d6',
        filter: 'blur(110px)',
        opacity: 0.15,
        bottom: '10%',
        right: '25%',
        animation: 'drift-bubble-2 25s ease-in-out infinite alternate'
      }}></div>

      <div style={{
        background: 'rgba(20, 20, 25, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(40px) saturate(180%)',
        '-webkit-backdrop-filter': 'blur(40px) saturate(180%)',
        borderRadius: '24px',
        width: '90%',
        maxWidth: '400px',
        padding: '40px 32px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)',
        zIndex: 10,
        position: 'relative'
      }}>
        {/* Custom Header Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', color: '#fff' }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '46px',
              fontWeight: '300',
              letterSpacing: '1px',
            }}>
              MYHIF
            </span>
            <svg width="28" height="46" viewBox="0 0 28 46" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-2px' }}>
              {/* Main stem of the i */}
              <line x1="8" y1="16" x2="8" y2="38" />
              {/* Notehead for the i (bottom left) */}
              <circle cx="4.5" cy="38" r="3.5" stroke="none" />

              {/* Dot of the i */}
              <circle cx="8" cy="7" r="2.5" stroke="none" />

              {/* Beam going right and second smaller note */}
              <line x1="8" y1="16" x2="22" y2="16" strokeWidth="2" />
              <line x1="22" y1="16" x2="22" y2="24" strokeWidth="2" />
              <circle cx="19.5" cy="24" r="2.5" stroke="none" />
            </svg>
            <svg width="32" height="46" viewBox="0 0 32 46" style={{ marginLeft: '4px' }}>
              <defs>
                <mask id="speaker-mask">
                  <rect x="0" y="10" width="24" height="32" rx="4" ry="4" fill="white" />
                  <circle cx="12" cy="32" r="5" fill="black" />
                  <circle cx="12" cy="18" r="2.5" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="10" width="24" height="32" fill="#fff" mask="url(#speaker-mask)" />
            </svg>
          </div>
        </div>


        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: '28px',
          lineHeight: '1.4'
        }}>
          {isVerificationMode
            ? 'We sent a 6-digit code to your email. Enter it below to verify.'
            : isLoginMode
              ? 'Sign in to your account.'
              : 'Create a new account.'}
        </p>

        {isVerificationMode ? (
          /* Verification Form */
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                maxLength="6"
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px' }}
              />
            </div>

            {errorMsg && (
              <div style={{ fontSize: '12px', color: '#ff3b30', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}
            
            {successMsg && (
              <div style={{ fontSize: '13px', color: '#34c759', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', background: 'rgba(52, 199, 89, 0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="sync-button"
              style={{ width: '100%', margin: '8px 0 0' }}
              disabled={loading || verificationCode.length < 6}
            >
              {loading ? <div className="spinner"></div> : 'Verify Email'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Didn't get it?{' '}
              <span
                style={{ color: 'var(--accent-color)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setIsVerificationMode(false)}
              >
                Back to Registration
              </span>
            </div>
          </form>
        ) : isLoginMode ? (
          /* Sign In Form */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="*************"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMsg && (
              <div style={{ fontSize: '12px', color: '#ff3b30', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ fontSize: '13px', color: '#34c759', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', background: 'rgba(52, 199, 89, 0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="sync-button"
              style={{ width: '100%', margin: '8px 0 0' }}
              disabled={loading}
            >
              {loading ? <div className="spinner"></div> : 'Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <span
                style={{ color: 'var(--accent-color)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setIsLoginMode(false)}
              >
                Create one
              </span>
            </div>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Create Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Set Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {errorMsg && (
              <div style={{ fontSize: '12px', color: '#ff3b30', display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ fontSize: '13px', color: '#34c759', display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', background: 'rgba(52, 199, 89, 0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="sync-button"
              style={{ width: '100%', margin: '8px 0 0' }}
              disabled={loading}
            >
              {loading ? <div className="spinner"></div> : 'Create Account'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <span
                style={{ color: 'var(--accent-color)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setIsLoginMode(true)}
              >
                Sign in
              </span>
            </div>
          </form>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes drift-bubble-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes drift-bubble-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-50px, -60px) scale(1.15); }
        }
      `}} />
    </div>
  );
}
