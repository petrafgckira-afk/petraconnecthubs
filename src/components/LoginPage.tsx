import React, { useState } from 'react';
import { ArrowRight, KeyRound, Clock, Eye, EyeOff } from 'lucide-react';
import petraLogo from '../assets/images/petra-logo.svg';
import { loginUser, saveSession } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onRegister: () => void;
}

const ORANGE = '#F37021';
const NAVY   = '#0f132e';

export default function LoginPage({ onLoginSuccess, onRegister }: LoginPageProps) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [isPending,    setIsPending]    = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    setError(''); setIsPending(false); setLoading(true);
    try {
      const data = await loginUser(email, password);
      saveSession(data.token, data.user);
      onLoginSuccess(data.user);
    } catch (err: any) {
      if (err.pending) setIsPending(true);
      else setError(err.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="theme-light min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f5f7fc' }}>

      {/* Orange brand top-bar */}
      <div style={{ height: 3, background: `linear-gradient(to right, ${ORANGE}, #FAA61A, ${ORANGE})` }} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: NAVY, boxShadow: '0 8px 28px rgba(15,19,46,0.22), 0 2px 6px rgba(15,19,46,0.12)' }}
          >
            <img src={petraLogo} alt="Petra Connect Hubs" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="font-bold text-xl tracking-tight" style={{ color: NAVY }}>Petra Connect Hubs</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] mt-1" style={{ color: ORANGE }}>Professional Fellowship · Kira, Uganda</p>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-md rounded-2xl px-7 py-8"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 32px rgba(15,19,46,0.07), 0 1px 4px rgba(15,19,46,0.04)' }}
        >
          <div className="text-center mb-7">
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Secure Access Portal</h2>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Enter your credentials to sign in to your account.</p>
          </div>

          {/* Pending */}
          {isPending && (
            <div
              className="rounded-xl p-3.5 mb-5 flex items-start gap-3"
              style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}
            >
              <Clock size={18} className="shrink-0 mt-0.5" style={{ color: '#d97706' }} />
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold" style={{ color: '#92400e' }}>Account Pending Approval</p>
                <p className="text-[10.5px] leading-relaxed" style={{ color: '#b45309' }}>
                  Your account has been registered but is awaiting administrator review. You will be able to sign in once an admin activates your account.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="rounded-lg p-2.5 text-xs text-center font-medium mb-5"
              style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-[10px] font-bold uppercase tracking-wider block"
                style={{ color: '#374151' }}
              >
                Authorized Email
              </label>
              <input
                id="login-email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ndyamuhaki.abraham@techhub.petra"
                className="w-full border rounded-lg p-2.5 text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="login-password"
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: '#374151' }}
                >
                  Credential PIN / Password
                </label>
                <a href="#" className="text-[10px] font-medium hover:underline" style={{ color: ORANGE }}>
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border rounded-lg p-2.5 pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 transition"
                  style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = ORANGE)}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-2.5 px-4 rounded-xl transition duration-200 text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: ORANGE }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#FAA61A'); }}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = ORANGE)}
            >
              {loading ? 'Signing in...' : 'Sign In with Credentials'}
              {!loading && <ArrowRight size={13} />}
            </button>
          </form>

          <div className="text-center mt-5 text-[11px]" style={{ color: '#6b7280' }}>
            Not registered yet?{' '}
            <button
              type="button"
              onClick={onRegister}
              className="font-bold hover:underline bg-transparent border-0 cursor-pointer"
              style={{ color: ORANGE }}
            >
              Join Petra Hubs today
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <KeyRound size={12} style={{ color: ORANGE }} />
          <span className="uppercase tracking-widest font-mono" style={{ color: '#9ca3af', fontSize: 9 }}>
            Secure Gateway · Client-side Tokenized (Testmode)
          </span>
        </div>

      </div>
    </div>
  );
}
