import React, { useState } from 'react';
import { INITIAL_HUBS } from '../data/mockData';
import petraLogo from '../assets/images/petra-logo.svg';
import { HubType } from '../types';
import LucideIcon from './LucideIcon';
import { ChevronLeft, ArrowRight, Check, Sparkles, Eye, EyeOff, Clock } from 'lucide-react';
import { registerUser } from '../services/api';

interface RegisterPageProps {
  onRegisterSubmit: (apiUser: any) => void;
  onCancel: () => void;
}

const ORANGE     = '#F37021';
const NAVY       = '#0f132e';
const NAVY_MID   = '#374151';
const GRAY_SUB   = '#6b7280';
const GRAY_LABEL = '#4b5563';

const HUBS_DISPLAY = ['Business', 'Technology', 'Medical', 'Finance', 'Education', 'Media & Creative', 'Leadership'];
const STEP_LABELS  = ['Personal & Professional', 'Choose Your Hub', 'Stewardship Pledge'];

// ── Left brand panel (dark) ──────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden md:flex flex-col justify-between w-[42%] min-h-screen bg-navy-950 relative overflow-hidden px-10 py-12 shrink-0">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(ellipse at 25% 18%, rgba(243,112,33,0.14) 0%, transparent 52%)' }} />
        <div className="absolute bottom-0 right-0 w-3/4 h-2/3" style={{ background: 'radial-gradient(ellipse at 80% 90%, rgba(250,166,26,0.07) 0%, transparent 50%)' }} />
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: 'linear-gradient(to right, transparent, #F37021, transparent)', opacity: 0.45 }} />
        <div className="absolute -bottom-28 -left-28 w-80 h-80 border border-brand-gold/5 rounded-full" />
        <div className="absolute -bottom-14 -left-14 w-56 h-56 border border-brand-gold/9 rounded-full" />
        <div className="absolute top-[35%] right-0 w-[2px] h-36" style={{ background: 'linear-gradient(to bottom, transparent, rgba(243,112,33,0.28), transparent)' }} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(243,112,33,0.1)', border: '1.5px solid rgba(243,112,33,0.32)' }}>
            <img src={petraLogo} alt="Petra" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-tight leading-none">Petra Connect Hubs</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] mt-0.5" style={{ color: ORANGE }}>Professional Fellowship</p>
          </div>
        </div>

        <h1 className="text-[2rem] font-black text-white leading-[1.15] tracking-tight mb-3">
          Join a community<br />
          <span style={{ color: ORANGE }}>built on calling.</span>
        </h1>
        <p className="text-gray-400 text-[13px] leading-relaxed mb-8" style={{ maxWidth: 272 }}>
          Connect with verified professionals from Petra Full Gospel Church across 7 vocational hubs.
        </p>

        <div className="mb-9">
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.18em] mb-3">7 Vocational Hubs</p>
          <div className="flex flex-wrap gap-2">
            {HUBS_DISPLAY.map(h => (
              <span key={h} className="text-[10px] font-semibold px-2.5 py-[5px] rounded-full" style={{ color: ORANGE, backgroundColor: 'rgba(243,112,33,0.08)', border: '1px solid rgba(243,112,33,0.2)' }}>
                {h}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          {[
            { icon: '🛡️', text: 'Verified professional directory' },
            { icon: '💬', text: 'Peer messaging & collaboration' },
            { icon: '📅', text: 'Hub events, meets & announcements' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="text-sm">{f.icon}</span>
              <span className="text-[12px] text-gray-400">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <div className="pl-4" style={{ borderLeft: '2px solid rgba(243,112,33,0.38)' }}>
          <p className="text-gray-400 text-[11px] italic leading-relaxed">
            "Whatever you do, work at it with all your heart, as working for the Lord."
          </p>
          <p className="text-[9px] font-bold mt-1.5 uppercase tracking-widest" style={{ color: ORANGE }}>— Colossians 3:23</p>
        </div>
        <p className="text-gray-600 text-[9px] mt-5 uppercase tracking-widest">© 2026 Petra Full Gospel Church · Kira, Uganda</p>
      </div>
    </div>
  );
}

export default function RegisterPage({ onRegisterSubmit, onCancel }: RegisterPageProps) {
  const [step, setStep] = useState<number>(1);

  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone,      setPhone]      = useState('');
  const [profession, setProfession] = useState('');
  const [bio,        setBio]        = useState('');
  const [selectedHub, setSelectedHub] = useState<HubType | null>(null);
  const [contribution, setContribution] = useState('');

  const [errors,   setErrors]   = useState<{ [key: string]: string }>({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');
  const [registered, setRegistered] = useState(false);

  const validateStep1 = () => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please provide a valid email';
    }
    if (!password || password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    if (!profession.trim()) errs.profession = 'Please enter your job title or profession';
    if (!bio.trim()) errs.bio = 'Please add a small professional summary';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (!selectedHub) {
        setErrors({ hub: 'Please select one Hub matching your professional career' });
      } else {
        setErrors({});
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribution.trim()) {
      setErrors({ contribution: 'Please write a brief statement on how you wish to support your Hub members' });
      return;
    }
    setApiError('');
    setLoading(true);
    try {
      await registerUser({
        full_name:             name,
        email,
        password,
        phone_number:          phone,
        bio,
        profession,
        hub_name:              selectedHub,
        contribution_interest: contribution,
      });
      setRegistered(true);
    } catch (err: any) {
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Shared input className
  const inputCls = (hasError?: boolean) =>
    `w-full border rounded-xl p-3 text-sm transition-all duration-200 ${hasError ? 'border-rose-400' : ''}`;

  // ── Pending screen ────────────────────────────────────────────
  if (registered) {
    return (
      <div className="min-h-screen flex font-sans">
        <LeftPanel />
        <div className="theme-light flex-1 flex items-center justify-center px-6 py-12" style={{ backgroundColor: '#f5f7fc' }}>
          <div className="max-w-md w-full space-y-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: '#fffbeb', border: '2px solid #fcd34d' }}>
              <Clock size={36} style={{ color: '#d97706' }} />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: NAVY }}>Registration Submitted</h2>
              <p className="text-sm leading-relaxed" style={{ color: GRAY_SUB }}>
                Your account is now <span className="font-semibold" style={{ color: '#d97706' }}>pending admin approval</span>.
                An administrator will review your profile and activate your account.
              </p>
            </div>
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: '#9ca3af' }}>Registered as</p>
              <p className="font-semibold" style={{ color: NAVY }}>{name}</p>
              <p className="text-xs font-mono" style={{ color: GRAY_SUB }}>{email}</p>
              <p className="text-[11px] mt-1" style={{ color: GRAY_SUB }}>Hub applied: <span className="font-semibold" style={{ color: ORANGE }}>{selectedHub} Hub</span></p>
            </div>
            <button
              onClick={onCancel}
              className="w-full font-bold py-3 rounded-xl transition text-sm text-white"
              style={{ backgroundColor: ORANGE }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAA61A')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = ORANGE)}
            >
              Back to Sign In
            </button>
            <p className="text-[10px] text-center" style={{ color: '#9ca3af' }}>Petra Full Gospel Church · Professional Connect Hubs</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex font-sans">
      <LeftPanel />

      {/* Right panel — light theme */}
      <div className="theme-light flex-1 flex flex-col min-h-screen" style={{ backgroundColor: '#f5f7fc' }}>

        {/* Top navigation bar */}
        <div className="flex items-center px-6 md:px-10 py-4 shrink-0 bg-white" style={{ borderBottom: '1px solid #e5e7eb' }}>
          {/* Back / Cancel */}
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 font-semibold text-sm transition w-32"
            style={{ color: ORANGE }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FAA61A')}
            onMouseLeave={e => (e.currentTarget.style.color = ORANGE)}
          >
            <ChevronLeft size={16} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {/* Step indicator — centre */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center">
              {[1, 2, 3].map((n, i) => (
                <React.Fragment key={n}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all duration-300"
                    style={{
                      backgroundColor: step > n ? ORANGE : step === n ? 'rgba(243,112,33,0.1)' : '#f3f4f6',
                      borderColor: step > n ? ORANGE : step === n ? ORANGE : '#d1d5db',
                      color: step > n ? '#ffffff' : step === n ? ORANGE : '#9ca3af',
                    }}
                  >
                    {step > n ? <Check size={13} /> : n}
                  </div>
                  {i < 2 && (
                    <div className="w-10 h-px mx-1 transition-all duration-300" style={{ backgroundColor: step > n ? ORANGE : '#d1d5db' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(243,112,33,0.9)' }}>
              {STEP_LABELS[step - 1]}
            </p>
          </div>

          {/* Mobile logo (hidden on md+) */}
          <div className="w-32 flex justify-end">
            <div className="flex items-center gap-2 md:hidden">
              <img src={petraLogo} alt="Petra" className="w-6 h-6 object-contain" />
              <span className="text-sm font-bold" style={{ color: NAVY }}>Petra Hubs</span>
            </div>
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 md:px-10 py-8">

            {/* ── STEP 1: Personal Info ── */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: NAVY }}>Professional Profile</h2>
                  <p className="text-xs mt-1" style={{ color: GRAY_SUB }}>Let peers know who you are. This information forms your local directory profile.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Full Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ndyamuhaki Abraham" className={inputCls(!!errors.name)} />
                      {errors.name && <p className="text-rose-500 text-[11px] font-medium">{errors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Phone Number</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +256701234567" className={inputCls(!!errors.phone)} />
                      {errors.phone && <p className="text-rose-500 text-[11px] font-medium">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. ndyamuhaki.abraham@company.com" className={inputCls(!!errors.email)} />
                    {errors.email && <p className="text-rose-500 text-[11px] font-medium">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Profession / Job Title</label>
                    <input type="text" value={profession} onChange={e => setProfession(e.target.value)} placeholder="e.g. Software Engineer, Accountant, Graphic Designer" className={inputCls(!!errors.profession)} />
                    {errors.profession && <p className="text-rose-500 text-[11px] font-medium">{errors.profession}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" className={inputCls(!!errors.password) + ' pr-10'} />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 transition" style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = ORANGE)}
                        onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-rose-500 text-[11px] font-medium">{errors.password}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Professional Bio</label>
                    <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Describe your current role, experience, and theological alignment..." className={inputCls(!!errors.bio) + ' resize-none'} />
                    {errors.bio && <p className="text-rose-500 text-[11px] font-medium">{errors.bio}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Choose Hub ── */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: NAVY }}>Select Your Professional Hub</h2>
                  <p className="text-xs mt-1" style={{ color: GRAY_SUB }}>Members join one primary Hub. Choose the one that matches your daily vocation.</p>
                </div>

                {errors.hub && (
                  <div className="rounded-lg p-3 text-xs font-medium" style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c' }}>
                    {errors.hub}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 max-h-[420px] overflow-y-auto pr-1 pad-custom-scroll">
                  {INITIAL_HUBS.map(hub => {
                    const isSelected = selectedHub === hub.id;
                    return (
                      <div
                        key={hub.id}
                        onClick={() => { setSelectedHub(hub.id); setErrors({}); }}
                        className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 flex items-start gap-3"
                        style={{
                          borderColor: isSelected ? ORANGE : '#e5e7eb',
                          backgroundColor: isSelected ? 'rgba(243,112,33,0.04)' : '#ffffff',
                          boxShadow: isSelected ? `0 0 0 1px rgba(243,112,33,0.2)` : '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; }}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${hub.colorClass}`}>
                          <LucideIcon name={hub.icon} size={18} />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="font-bold text-sm flex items-center gap-1.5" style={{ color: isSelected ? ORANGE : NAVY }}>
                            {hub.name}
                            {isSelected && <Check size={13} className="shrink-0" style={{ color: ORANGE }} />}
                          </h4>
                          <p className="text-[11px] leading-tight line-clamp-2" style={{ color: GRAY_SUB }}>{hub.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STEP 3: Contribution ── */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: NAVY }}>How Can You Support Peers?</h2>
                  <p className="text-xs mt-1 text-justify" style={{ color: GRAY_SUB }}>
                    Petra Connect is a collaborative steward workspace. Leadership requires us to assist or empower each other through mentorship, reviews, or counseling.
                  </p>
                </div>

                <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: '#fffbf2', border: '1px solid #fde68a' }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase" style={{ color: '#d97706' }}>
                    <Sparkles size={14} /> Guided Suggestions
                  </div>
                  <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: '#92400e' }}>
                    <li>Can you offer 1-on-1 portfolio feedback for junior designers?</li>
                    <li>Are you open to advising startup founders on tax/budget layouts?</li>
                    <li>Can you help code portals or support physical church media desks?</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reg-contribution" className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: GRAY_LABEL }}>Stewardship Proposal</label>
                  <textarea
                    id="reg-contribution" rows={4} value={contribution}
                    onChange={e => setContribution(e.target.value)}
                    placeholder="e.g. I can offer 1 hour of website architectural advice every fortnight, and review portfolios for junior front-end graduates..."
                    className={inputCls(!!errors.contribution) + ' resize-none'}
                  />
                  {errors.contribution && <p className="text-rose-500 text-[11px] font-medium">{errors.contribution}</p>}
                  <p className="text-[10px]" style={{ color: '#9ca3af' }}>Note: Your proposal is reviewed by the appropriate leaders and approved inside the Lead Portal.</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Bottom button row */}
        <div className="px-6 md:px-10 py-5 shrink-0 bg-white" style={{ borderTop: '1px solid #e5e7eb' }}>
          {apiError && (
            <div className="mb-3 rounded-lg p-3 text-xs font-medium" style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c' }}>
              {apiError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={handleBack}
              className="font-medium text-sm px-4 py-2.5 rounded-xl transition"
              style={{ color: GRAY_SUB }}
              onMouseEnter={e => (e.currentTarget.style.color = NAVY)}
              onMouseLeave={e => (e.currentTarget.style.color = GRAY_SUB)}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                type="button" onClick={handleNext}
                className="font-bold text-sm py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-white"
                style={{ backgroundColor: ORANGE }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAA61A')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ORANGE)}
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button" onClick={handleSubmit} disabled={loading}
                className="font-bold text-sm py-2.5 px-6 rounded-xl transition flex items-center gap-2 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: ORANGE }}
                onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#FAA61A'); }}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = ORANGE)}
              >
                {loading ? 'Submitting...' : 'Submit Registration'}
                {!loading && <Check size={14} />}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
