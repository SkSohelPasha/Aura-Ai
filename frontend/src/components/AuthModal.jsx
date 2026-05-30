import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

export default function AuthModal() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  const GOOGLE_CLIENT_ID = '367360529143-k51vbrq8atks45hul68c3qaldkv2jkaj.apps.googleusercontent.com';

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setError('');
  }

  useEffect(() => {
    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response?.credential) {
            setError('Google sign-in failed.');
            return;
          }

          setLoading(true);
          setError('');
          try {
            await loginWithGoogle(response.credential);
          } catch (err) {
            setError(err.message || 'Google sign-in failed.');
          } finally {
            setLoading(false);
          }
        },
      });
      setGoogleReady(true);
    };

    const interval = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        window.clearInterval(interval);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [loginWithGoogle]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        await signup(form.email, form.username, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleButton() {
    setError('');
    if (!window.google?.accounts?.id) {
      setError('Google sign-in is not ready yet.');
      return;
    }

    try {
      window.google.accounts.id.prompt();
    } catch (err) {
      setError(
        'Google sign-in failed. Please check your Google client configuration and authorized origin.'
      );
      console.error('Google prompt error:', err);
    }
  }


  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(124,111,224,0.08) 0%, transparent 70%)',
        }}
      />

      <div
        className="relative w-full max-w-md animate-slide-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '40px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,111,224,0.3)' }}
          >
            <Sparkles size={22} style={{ color: 'var(--accent-light)' }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif', color: '#fff' }}
          >
            Aura
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            AI conversations, beautifully simple
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          className="flex mb-6 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {['login', 'signup'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-all duration-200"
              style={{
                borderRadius: 10,
                background: tab === t ? 'var(--surface-2, #191A24)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                fontFamily: 'Syne, sans-serif',
                cursor: 'pointer',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 text-sm transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Username (signup only) */}
          {tab === 'signup' && (
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="your_name"
                required
                autoComplete="username"
                className="w-full px-4 py-3 text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-4 py-3 pr-12 text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm animate-fade-in"
              style={{ background: 'rgba(248,114,114,0.1)', color: 'var(--error)', border: '1px solid rgba(248,114,114,0.2)' }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 font-semibold text-sm transition-all duration-200"
            style={{
              background: loading ? 'rgba(124,111,224,0.5)' : 'var(--accent)',
              color: '#fff',
              borderRadius: 10,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Syne, sans-serif',
              letterSpacing: '0.02em',
              boxShadow: loading ? 'none' : '0 0 24px rgba(124,111,224,0.3)',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = 'var(--accent-light)';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.background = 'var(--accent)';
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                {tab === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              tab === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>

          <button
            type="button"
            onClick={handleGoogleButton}
            disabled={loading || !googleReady}
            className="w-full py-3 mb-4 font-semibold text-sm transition-all duration-200"
            style={{
              background: loading ? 'rgba(66,133,244,0.5)' : '#4285F4',
              color: '#fff',
              borderRadius: 10,
              border: 'none',
              cursor: loading || !googleReady ? 'not-allowed' : 'pointer',
              fontFamily: 'Syne, sans-serif',
              letterSpacing: '0.02em',
              boxShadow: loading ? 'none' : '0 0 24px rgba(66,133,244,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
            onMouseEnter={(e) => {
              if (!loading && googleReady) e.target.style.background = '#357ae8';
            }}
            onMouseLeave={(e) => {
              if (!loading && googleReady) e.target.style.background = '#4285F4';
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              <img
                src="/image.png"
                alt="Aura logo"
                width="20"
                height="20"
                style={{ display: 'block' }}
              />
            </span>
            {googleReady ? 'Continue with Google' : 'Loading Google...'}
          </button>
        </form>
      </div>
    </div>
  );
}
