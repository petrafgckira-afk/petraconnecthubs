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

export default function RegisterPage({ onRegisterSubmit, onCancel }: RegisterPageProps) {
  const [step, setStep] = useState<number>(1);

  // Step 1 fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');

  // Step 2 fields
  const [selectedHub, setSelectedHub] = useState<HubType | null>(null);

  // Step 3 fields
  const [contribution, setContribution] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
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
    if (step > 1) {
      setStep(step - 1);
    } else {
      onCancel();
    }
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
      // Account is pending — show waiting screen, do NOT start a session
      setRegistered(true);
    } catch (err: any) {
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pending approval screen ────────────────────────────────────
  if (registered) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4 font-sans text-white">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center mx-auto">
            <Clock size={36} className="text-amber-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Registration Submitted</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your account is now <span className="text-amber-400 font-semibold">pending admin approval</span>.
              An administrator will review your profile and activate your account.
              You will be able to log in once it has been approved.
            </p>
          </div>
          <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 text-left space-y-2">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Registered as</p>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-gray-400 text-xs font-mono">{email}</p>
            <p className="text-[11px] text-gray-500 mt-1">Hub applied: <span className="text-brand-gold font-medium">{selectedHub} Hub</span></p>
          </div>
          <button
            onClick={onCancel}
            className="w-full bg-brand-gold text-navy-950 font-bold py-3 rounded-xl hover:bg-amber-400 transition text-sm"
          >
            Back to Sign In
          </button>
          <p className="text-[10px] text-gray-600">Petra Full Gospel Church · Professional Connect Hubs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50 flex flex-col justify-between py-8 px-4 font-sans">
      {/* Header logo / back */}
      <div className="max-w-3xl mx-auto w-full mb-6 flex justify-between items-center">
        <button 
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-navy-800 hover:text-brand-gold font-medium text-sm transition"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <img src={petraLogo} alt="Petra Connect Hubs" className="w-8 h-8 object-contain rounded-lg" />
          <span className="font-bold text-navy-950 text-sm tracking-tight">Petra Connect Hubs</span>
        </div>
      </div>

      {/* Main card form container */}
      <div className="max-w-2xl mx-auto w-full bg-white border border-navy-100 shadow-md rounded-2xl p-6 md:p-8 flex-1 flex flex-col justify-between">
        
        <div>
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span>Step {step} of 3</span>
              <span className="text-navy-900 font-bold">
                {step === 1 && 'Personal & Professional'}
                {step === 2 && 'Choose Guild / Hub'}
                {step === 3 && 'Stewardship Contribution'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-gold rounded-full transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-black text-navy-900 tracking-tight">Professional Profile</h2>
                <p className="text-gray-500 text-xs">Let peers know who you are. This information forms your local directory profile.</p>
              </div>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ndyamuhaki Abraham"
                      className={`w-full bg-navy-50/50 border ${errors.name ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                    />
                    {errors.name && <p className="text-rose-500 text-[11px] font-medium">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +256701234567"
                      className={`w-full bg-navy-50/50 border ${errors.phone ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                    />
                    {errors.phone && <p className="text-rose-500 text-[11px] font-medium">{errors.phone}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ndyamuhaki.abraham@company.com"
                    className={`w-full bg-navy-50/50 border ${errors.email ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                  />
                  {errors.email && <p className="text-rose-500 text-[11px] font-medium">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Profession / Job Title</label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Software Engineer, Accountant, Graphic Designer"
                    className={`w-full bg-navy-50/50 border ${errors.profession ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                  />
                  {errors.profession && <p className="text-rose-500 text-[11px] font-medium">{errors.profession}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={`w-full bg-navy-50/50 border ${errors.password ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 pr-10 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy-800 transition"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-rose-500 text-[11px] font-medium">{errors.password}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your current role, experience, and theological alignment..."
                    className={`w-full bg-navy-50/50 border ${errors.bio ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-2.5 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                  />
                  {errors.bio && <p className="text-rose-500 text-[11px] font-medium">{errors.bio}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Hub */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-black text-navy-900 tracking-tight">Select Your Professional Hub</h2>
                <p className="text-gray-500 text-xs">Members join one primary Hub. Choose the one that matches your daily vocation.</p>
              </div>

              {errors.hub && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs font-medium">
                  {errors.hub}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 max-h-[340px] overflow-y-auto pr-1 pad-custom-scroll">
                {INITIAL_HUBS.map((hub) => {
                  const isSelected = selectedHub === hub.id;
                  return (
                    <div
                      key={hub.id}
                      onClick={() => {
                        setSelectedHub(hub.id);
                        setErrors({});
                      }}
                      className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-all duration-150 flex items-start gap-3 relative ${
                        isSelected 
                          ? 'border-brand-gold bg-brand-gold-light/40 shadow-sm' 
                          : 'border-slate-100 bg-navy-50/30 hover:border-navy-200'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${hub.colorClass}`}>
                        <LucideIcon name={hub.icon} size={18} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-navy-950 flex items-center gap-1.5">
                          {hub.name}
                          {isSelected && <Check size={14} className="text-amber-600 block shrink-0" />}
                        </h4>
                        <p className="text-gray-500 text-[11px] leading-tight line-clamp-2">{hub.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Contribution Details */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-black text-navy-900 tracking-tight">How Can You Support Peers?</h2>
                <p className="text-gray-500 text-xs text-justify">Petra Connect is a collaborative steward workspace. Leadership requires us to assist or empower each other through mentorship, reviews, or counseling.</p>
              </div>

              <div className="p-4 bg-amber-50/50 border border-amber-200/50 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold tracking-wider uppercase">
                  <Sparkles size={14} /> Guided Suggestions
                </div>
                <ul className="text-amber-900 text-xs space-y-1 block list-disc pl-4">
                  <li>Can you offer 1-on-1 portfolio feedback for junior designers?</li>
                  <li>Are you open to advising startup founders on tax/budget layouts?</li>
                  <li>Can you help code portals or support physical church media desks?</li>
                </ul>
              </div>

              <div className="space-y-2" id="reg-contribution-group">
                <label htmlFor="reg-contribution" className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Stewardship Proposal</label>
                <textarea
                  id="reg-contribution"
                  rows={4}
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  placeholder="e.g. I can offer 1 hour of website architectural advice every fortnight, and review portfolios for junior front-end graduates..."
                  className={`w-full bg-navy-50/50 border ${errors.contribution ? 'border-rose-500' : 'border-gray-200'} rounded-lg p-3 text-sm text-navy-950 focus:outline-hidden focus:border-brand-gold transition`}
                />
                {errors.contribution && <p className="text-rose-500 text-[11px] font-medium">{errors.contribution}</p>}
                <p className="text-[10px] text-gray-400">Note: Your proposal is reviewed by the appropriate leaders and approved inside the Lead Portal.</p>
              </div>
            </div>
          )}

        </div>

        {/* Buttons / Controls footer */}
        {apiError && (
          <div className="mx-0 mb-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-medium">
            {apiError}
          </div>
        )}

        <div className="pt-6 border-t border-gray-100 flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={handleBack}
            className="text-gray-500 font-medium text-sm hover:text-navy-950 px-3 py-2 rounded-lg transition"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="bg-navy-900 text-white font-medium text-sm py-2.5 px-5 rounded-lg hover:bg-navy-800 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-brand-gold text-navy-950 font-bold text-sm py-2.5 px-6 rounded-lg hover:bg-amber-400 shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Registration'}
              {!loading && <Check size={14} />}
            </button>
          )}
        </div>

      </div>

      <div className="text-center text-gray-400 text-[10px] uppercase tracking-widest font-mono mt-8">
        Petra Full Gospel Church • Professional Connect Hubs
      </div>
    </div>
  );
}
