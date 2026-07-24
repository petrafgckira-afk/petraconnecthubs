import React, { useState } from 'react';
import { ArrowRight, KeyRound, Clock, Eye, EyeOff } from 'lucide-react';
import petraLogo from '../assets/images/petra-logo.svg';
import { loginUser, saveSession } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onRegister: () => void;
}

export default function LoginPage({ onLoginSuccess, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    setError('');
    setIsPending(false);
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      saveSession(data.token, data.user);
      onLoginSuccess(data.user);
    } catch (err: any) {
      if (err.pending) {
        setIsPending(true);
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col justify-between py-12 px-4 relative font-sans">
      {/* Background radial atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-900 via-slate-950 to-navy-950 pointer-events-none" />
      <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-brand-gold/5 rounded-l-full pointer-events-none" />

      {/* Header logo */}
      <div className="max-w-md mx-auto w-full flex flex-col items-center relative z-10 text-center">
        <img src={petraLogo} alt="Petra Connect Hubs" className="w-16 h-16 object-contain rounded-xl shadow-md mb-3" />
        <h1 className="font-sans font-bold text-xl tracking-tight">Petra Connect Hubs</h1>
        <p className="text-brand-gold font-serif font-medium text-xs tracking-wider uppercase">Professional fellowship</p>
      </div>

      {/* Main Container */}
      <div className="max-w-md mx-auto w-full bg-navy-900 border border-navy-800 rounded-2xl p-6 md:p-8 shrink-0 relative z-10 shadow-xl mt-6">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold">Secure Access Portal</h2>
          <p className="text-gray-400 text-xs mt-1">Enter your credentials or use dynamic fast-track profile selectors below.</p>
        </div>

        {isPending && (
          <div className="bg-amber-950/50 border border-amber-700/50 rounded-xl p-3.5 mb-4 flex items-start gap-3">
            <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-amber-300 text-[11px] font-bold">Account Pending Approval</p>
              <p className="text-amber-200/70 text-[10.5px] leading-relaxed">
                Your account has been registered but is awaiting administrator review. You will be able to sign in once an admin activates your account.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/60 border border-rose-850 text-rose-350 rounded-lg p-2.5 text-xs text-center font-medium mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5" id="login-email-group">
            <label htmlFor="login-email" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Authorized Email</label>
            <input
              id="login-email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ndyamuhaki.abraham@techhub.petra"
              className="w-full bg-navy-950/80 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-brand-gold transition"
            />
          </div>

          <div className="space-y-1.5" id="login-password-group">
            <div className="flex justify-between items-center">
              <label htmlFor="login-password" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Credential PIN / Password</label>
              <a href="#" className="text-brand-gold text-[10px] hover:underline">Forgot password?</a>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-navy-950/80 border border-slate-800 rounded-lg p-2.5 pr-9 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-brand-gold transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-gold transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold text-navy-950 hover:bg-amber-400 font-bold py-2.5 px-4 rounded-lg transition duration-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In with Credentials'}
            {!loading && <ArrowRight size={13} />}
          </button>
        </form>


        <div className="text-center mt-5 text-[11px] text-gray-400">
          Not registered yet?{' '}
          <button 
            type="button"
            onClick={onRegister}
            className="text-brand-gold font-bold hover:underline bg-transparent border-0 cursor-pointer"
          >
            Join Petra Hubs today
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 text-[10px] py-4 relative z-10 flex justify-center items-center gap-2">
        <KeyRound size={12} className="text-brand-gold" />
        SECURE GATEWAY ENCRYPTED VIA CLIENT-SIDE TOKENIZATION (TESTMODE)
      </div>
    </div>
  );
}
