import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { INITIAL_HUBS } from '../data/mockData';
import LucideIcon from './LucideIcon';
import LoopingImageCarousel from './LoopingImageCarousel';
import ScriptureCarousel from './ScriptureCarousel';
import FloatingLogoFragments from './FloatingLogoFragments';
import FlagStrip from './FlagStrip';
import petraImg1 from '../assets/images/petraChurch/DSC_5922.JPG';
import petraImg2 from '../assets/images/petraChurch/DSC_6063.JPG';
import petraImg3 from '../assets/images/petraChurch/DSC_0963.JPG';
import petraLogo from '../assets/images/petra-logo.svg';
import cyberSecurityVideo from '../assets/images/cybersecurity.mp4';
import personalInfoVideo from '../assets/images/personal_info.mp4';

const PETRA_BG_IMAGES = [petraImg1, petraImg2, petraImg3];
import { 
  ArrowRight, 
  Sparkles, 
  Building2, 
  Users2, 
  ShieldAlert, 
  Compass, 
  Cpu, 
  ShieldCheck, 
  Terminal, 
  Download, 
  MessageSquare,
  Network,
  Lock,
  Globe,
  Award,
  BookOpen
} from 'lucide-react';

interface LandingPageProps {
  onRegister: () => void;
  onLogin: () => void;
  onExploreDemo: () => void;
}

export default function LandingPage({ onRegister, onLogin, onExploreDemo }: LandingPageProps) {
  // Splash Screen preloader state - only play once per tab session
  const [splashVisible, setSplashVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      const alreadyPlayed = sessionStorage.getItem('petra_splash_played');
      return !alreadyPlayed;
    }
    return true;
  });

  // Active hub selector simulation state
  const [selectedHubId, setSelectedHubId] = useState<string>('Technology');

  // Petra church background slideshow state
  const [petraBgIndex, setPetraBgIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPetraBgIndex(i => (i + 1) % PETRA_BG_IMAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Trigger splash auto-fadeout on mount after the luxurious letters complete their entrance
  useEffect(() => {
    if (splashVisible) {
      const timer = setTimeout(() => {
        setSplashVisible(false);
        try {
          sessionStorage.setItem('petra_splash_played', 'true');
        } catch (e) {
          // Fallback if writing fails
        }
      }, 5800);

      return () => clearTimeout(timer);
    }
  }, [splashVisible]);

  // Selected Hub object
  const activeHubDetails = INITIAL_HUBS.find(h => h.id === selectedHubId) || INITIAL_HUBS[0];

  return (
    <div className="bg-[#0b0c10] text-[#f4efe6] min-h-screen font-sans selection:bg-[#c5a880] selection:text-[#0b0c10] overflow-x-hidden relative landing-page-root">

      {/* Full-page floating logo fragments across all sections */}
      <FloatingLogoFragments />

      {/* 1. BEAUTIFULLY ANIMATED SPLASH SCREEN PRELOADER */}
      <AnimatePresence>
        {splashVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 bg-[#07080a] z-[9999] flex flex-col justify-center items-center overflow-hidden select-none"
          >
            {/* Static ambient glow — no animation, no cost */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c5a880]/8 rounded-full blur-[180px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] bg-[#F37021]/5 rounded-full blur-[90px] pointer-events-none" />

            {/* Outer orbit — rotate only, GPU-composited */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 32, ease: "linear" }}
              className="absolute w-[420px] h-[420px] border border-dashed border-[#c5a880]/10 rounded-full pointer-events-none"
            />
            {/* Inner counter-orbit */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
              className="absolute w-[300px] h-[300px] border border-dotted border-neutral-800/50 rounded-full pointer-events-none"
            />

            {/* Content stack — opacity + translateY only, no blur anywhere */}
            <div className="flex flex-col items-center justify-center relative z-10 gap-5">

              {/* Logo — appears last, after all text elements */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden shrink-0"
              >
                <img
                  src={petraLogo}
                  alt="Petra Full Gospel Church"
                  className="w-full h-full object-contain"
                />
              </motion.div>

              {/* PETRA — opacity + translateY only (no blur, no scale) */}
              <div className="flex items-end gap-2 md:gap-4">
                {['P', 'E', 'T', 'R', 'A'].map((char, i) => (
                  <motion.span
                    key={char}
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.55 + i * 0.16,
                      duration: 0.9,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="font-serif text-6xl md:text-8xl font-black tracking-[0.18em] text-[#1D2D5F] select-none"
                  >
                    {char}
                  </motion.span>
                ))}
              </div>

              {/* Gold divider — scaleX only */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 2.0, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ originX: 0.5 }}
                className="w-20 h-px bg-gradient-to-r from-transparent via-[#c5a880] to-transparent"
              />

              {/* FULL GOSPEL CHURCH — opacity + translateY only */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono text-[11px] md:text-[13px] tracking-[0.5em] uppercase text-[#c5a880] font-medium select-none"
              >
                Full Gospel Church
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. PREMIUM DESKTOP GLASSMORPHIC HEADER */}
      <header id="landing-fixed-header" className="fixed top-4 inset-x-4 max-w-[1100px] mx-auto py-3 py-6 md:py-3.5 px-6 md:px-10 flex justify-between items-center landing-header-floating z-50">
        <div className="flex items-center gap-3">
          <img src={petraLogo} alt="Petra Connect Hubs" className="w-10 h-10 object-contain rounded-xl" />
          <div>
            <span className="font-sans font-bold header-logo-title text-[15px] tracking-tight block leading-tight">PETRA CONNECT HUB</span>
            <span className="header-logo-subtitle font-sans font-semibold text-[8.5px] tracking-[0.14em] uppercase block">Professional Fellowships</span>
          </div>
        </div>

        {/* Minimalist Center Navigation */}
        <nav className="hidden lg:flex items-center gap-10 text-[11px] font-mono uppercase tracking-widest">
          <a href="#hubs-selector-deck" className="transition-colors">THE PETRA HUBS</a>
          <a href="#features-bento" className="transition-colors">SYSTEM ARCHITECTURE</a>
          <a href="#ethical-framework" className="transition-colors">ETHICS</a>
        </nav>

        {/* Authentication triggers */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onLogin}
            className="signin-btn font-mono text-xs uppercase tracking-wider transition duration-200 cursor-pointer pr-1"
          >
            Sign In
          </button>
          <button 
            onClick={onRegister}
            className="register-btn-modern text-xs uppercase tracking-wider cursor-pointer font-sans"
          >
            Register Profile
          </button>
        </div>
      </header>

      {/* 3. HERO AREA (Ascone Finance inspired layout) */}
      <section className="relative overflow-hidden pt-28 pb-4 md:pt-36 md:pb-6 px-6 md:px-12 max-w-7xl mx-auto">

        {/* Subtle decorative mesh background and elegant ambient circles */}
        <div className="absolute top-10 right-20 w-80 h-80 bg-[#c5a880]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-10 bottom-20 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="grid lg:grid-cols-12 gap-12 items-center relative z-10">
          
          {/* Hero Left: Big pristine editorial copy and CTAs */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Status indicator badge */}
            <div className="inline-flex items-center gap-2 bg-[#121318] border border-neutral-800 text-[#c5a880] py-1.5 px-3 rounded-full text-[10.5px] font-mono uppercase tracking-wider shadow-sm">
              <Sparkles size={11} className="text-yellow-400" />
              Check Out For Your Domain 😉
            </div>
            
            <div style={{ position: 'relative' }}>
              {/* Base layer: always-visible navy blue text */}
              <h1
                className="font-serif text-4xl md:text-[54px] font-black tracking-tight leading-[1.08]"
                style={{ color: '#1D2D5F' }}
              >
                Prepare to be Equiped for your Ministry.
              </h1>
              {/* Shimmer layer: cream/gold/orange stripe sweeps left→right over the letters */}
              <h1
                className="font-serif text-4xl md:text-[54px] font-black tracking-tight leading-[1.08] absolute inset-0"
                aria-hidden="true"
                style={{
                  background: 'linear-gradient(105deg, transparent 30%, rgba(244,239,230,0.55) 40%, rgba(250,166,26,0.85) 47%, rgba(243,112,33,0.95) 50%, rgba(250,166,26,0.85) 53%, rgba(244,239,230,0.55) 60%, transparent 70%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  backgroundSize: '200% 100%',
                  backgroundRepeat: 'no-repeat',
                  animation: 'heroShimmer 6s linear infinite',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                Prepare to be Equiped for your Ministry.
              </h1>
            </div>
            
            <ScriptureCarousel />

            {/* Quick action buttons split */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center pt-2">
              <button
                onClick={onRegister}
                className="w-full text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-[1.01] cursor-pointer"
                style={{ backgroundColor: '#1D2D5F' }}
              >
                Join Assigned Hub
                <ArrowRight size={14} />
              </button>
              
            </div>


          </div>

          {/* Hero Right: A gorgeously designed Ascone style layout with looping beautiful images slideshow and interactive drag & drop */}
          <div className="lg:col-span-5 relative" id="landing-looping-carousel-container">
            {/* Background glowing frame */}
            <div className="absolute inset-x-4 inset-y-8 bg-gradient-to-tr from-[#c5a880]/10 to-yellow-500/5 rounded-3xl blur-xl animate-pulse" style={{ animationDuration: '6s' }} />
            
            <LoopingImageCarousel />
          </div>

        </div>
      </section>

      {/* 4. ASCONE FINANCE STYLE BENTO-GRID ARCHITECTURE */}
      <section id="features-bento" className="pt-8 pb-20 px-6 md:px-12 max-w-7xl mx-auto border-b border-neutral-900">

        {/* FLAG MARQUEE STRIP */}
        <div className="mb-12">
          <FlagStrip />
        </div>
        
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="font-mono text-[#c5a880] text-[10px] tracking-[0.3em] uppercase block">SYSTEM STANDARDS</span>
          <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Petra Connect Hubs Architecture
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Beautifully integrated modules matching secular workflow with kingdom-driven values. Explored features are robust, authenticated and real-time.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid md:grid-cols-12 gap-6">
          
          {/* Bento Item 1: Global profiles directory (Large span 7) */}
          <div className="md:col-span-7 bg-[#121319]/30 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group hover:border-[#c5a880]/40 transition duration-300 flex gap-4 items-stretch">
            {/* Left: text content */}
            <div className="flex flex-col justify-between flex-1 min-w-0">
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-[#c5a880] border border-neutral-800 flex items-center justify-center mb-6">
                  <Users2 size={18} />
                </div>
                <h3 className="font-serif text-xl font-bold text-white mb-2">Verified Professional Card Directory</h3>
                <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                  Access peer profiles compiled clearly under vocational hubs. Track specific bio skills, company handles, and direct fellowship outreach channels.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2 text-[10px] font-mono text-[#c5a880] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Direct real-time peer searching, filter by skills
              </div>
            </div>
            {/* Right: personal info video */}
            <div className="relative w-[38%] shrink-0 rounded-xl overflow-hidden border border-neutral-700/50 shadow-lg self-stretch min-h-[160px]">
              <video
                src={personalInfoVideo}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Bento Item 2: Secure Access Gate (Span 5) */}
          <div className="md:col-span-5 bg-[#121319]/30 border border-neutral-800 rounded-2xl p-6 hover:border-[#c5a880]/40 transition duration-300 flex flex-col justify-between relative overflow-hidden">
            {/* Looping cybersecurity video background */}
            <video
              src={cyberSecurityVideo}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.25, pointerEvents: 'none' }}
            />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-emerald-500 border border-neutral-800 flex items-center justify-center mb-6">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Role Clearance Gate</h3>
              <p className="text-neutral-200 text-xs leading-relaxed mb-4">
                Structured layers separate standard members, organizers, and church system administrators. Admin audit logs track all modifications.
              </p>
            </div>
            <span className="relative z-10 font-mono text-[9px] text-neutral-300 tracking-wider font-extrabold uppercase bg-neutral-950 p-2 rounded border border-neutral-900 block w-fit">
              SECURE ENGAGEMENT WIHTIN THE HUBS.
            </span>
          </div>

          {/* Bento Item 3: Mentorship resources (Span 4) */}
          <div className="md:col-span-4 bg-[#121319]/30 border border-neutral-800 rounded-2xl p-6 hover:border-[#c5a880]/40 transition duration-300 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-yellow-500 border border-neutral-800 flex items-center justify-center">
              <Download size={18} />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white mb-1.5">Mentorship Section.</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Download verified handouts, stewardship checklists, sermons, and business templates prepared by Petra leaders.
              </p>
            </div>
          </div>

          {/* Bento Item 4: Realtime chat dialogue mock (Span 8) */}
          <div className="md:col-span-8 bg-[#121319]/30 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group hover:border-[#c5a880]/40 transition duration-300">
            <div className="grid sm:grid-cols-12 gap-6 items-center">
              <div className="sm:col-span-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-[#c5a880] border border-neutral-800 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <h3 className="font-serif text-xl font-bold text-white">Inbuilt Chat Portal</h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Engage direct messages inside vetted connections. Receive automatic, elegant assistant suggestions and immediate notifications.
                </p>
              </div>
              
              <div className="sm:col-span-6 bg-neutral-950 p-3.5 rounded-xl border border-neutral-850 text-[10px] space-y-2" style={{ fontFamily: "'Raleway', sans-serif" }}>
                <div className="flex justify-between text-[8px] text-neutral-500">
                  <span>Chat Session active</span>
                  <span className="text-emerald-500">Live</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-[#121318] p-2 rounded border border-neutral-800">
                    <span className="text-[8px] text-[#c5a880] block">Medical Hub Lead</span>
                    "Welcome, Dr. Leticia! The medical outreach resource pack has been uploaded."
                  </div>
                  <div className="bg-neutral-900 p-2 rounded text-right">
                    <span className="text-[8px] text-neutral-400 block">Dr. Leticia</span>
                    "Amen! Just what we needed for our clinical outreach prep."
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. INTERACTIVE HUB DECK SELECTOR SECTION */}
      <section id="hubs-selector-deck" className="relative py-20 px-6 md:px-12 border-b border-neutral-900 overflow-hidden">

        {/* Looping church background images */}
        {PETRA_BG_IMAGES.map((src, idx) => (
          <div
            key={idx}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${src})`,
              opacity: idx === petraBgIndex ? 1 : 0,
            }}
          />
        ))}
        {/* Dark overlay to keep text readable */}
        <div className="absolute inset-0 bg-[#0e0f14]/85" />

        <div className="relative z-10 max-w-7xl mx-auto space-y-12">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-neutral-900">
            <div className="space-y-1.5 animate-fade-in">
              <span className="font-mono text-[#c5a880] text-[10.5px] tracking-[0.25em] uppercase block">CHOOSE YOUR GUILD</span>
              <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                The Seven Vocational Pillars
              </h2>
              <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                We operate based on specialized industry divisions. Explore each guild below and find your immediate match.
              </p>
            </div>
            <button 
              onClick={onRegister}
              className="bg-[#c5a880] text-neutral-950 font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-lg hover:bg-white transition shrink-0 cursor-pointer"
            >
              Interactive Joining Flow →
            </button>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side column: Pill selectors of the 7 Hubs */}
            <div className="lg:col-span-5 space-y-2 h-[410px] overflow-y-auto pr-1 pad-custom-scroll">
              {INITIAL_HUBS.map((hub) => {
                const isSelected = hub.id === selectedHubId;
                return (
                  <button
                    key={hub.id}
                    onClick={() => setSelectedHubId(hub.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-r from-[#121319] to-neutral-950 border-[#c5a880] text-white shadow-md' 
                        : 'bg-transparent border-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border font-bold bg-neutral-950 border-neutral-800 ${isSelected ? 'text-[#c5a880]' : 'text-neutral-500'}`}>
                        <LucideIcon name={hub.icon} size={15} />
                      </div>
                      <span className="text-xs font-bold font-serif tracking-wider uppercase">{hub.name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] text-[#c5a880] uppercase tracking-wider font-mono bg-neutral-900 px-2 py-0.5 rounded">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right side column: Big luxurious Showcase of the selected hub */}
            <div className="lg:col-span-7 bg-gradient-to-b from-[#121319] to-[#0a0b0e] border border-[#c5a880]/15 p-8 rounded-2xl relative overflow-hidden shadow-xl min-h-[410px] flex flex-col justify-between">
              
              {/* Background gradient decorative glow */}
              <div className="absolute right-0 top-0 w-48 h-48 bg-[#c5a880]/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="space-y-6">
                
                {/* Hub title & Head info */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="font-mono text-[#c5a880] text-[10px] tracking-widest uppercase">GUILD SPECIFICATIONS</span>
                    <h3 className="font-serif text-2xl font-black text-white">{activeHubDetails.name}</h3>
                  </div>
                  <div className="w-12 h-12 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-center text-[#c5a880]">
                    <LucideIcon name={activeHubDetails.icon} size={20} />
                  </div>
                </div>

                <p className="text-neutral-300 text-sm leading-relaxed font-normal">
                  {activeHubDetails.description}
                </p>

                {/* Organizer card info */}
                <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#121318] border border-[#c5a880]/30 flex items-center justify-center font-bold font-serif text-xs text-[#c5a880]">
                      {activeHubDetails.leadAvatar}
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase tracking-wider font-mono">Assigned Guild Marshal</span>
                      <span className="text-xs font-bold text-white block leading-tight">{activeHubDetails.leadName}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-[#121318] border border-neutral-800 rounded text-[9px] uppercase tracking-wider font-mono text-neutral-300">
                    Leader Profile Vetted
                  </span>
                </div>

              </div>

              {/* Bot stats summary line */}
              <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex gap-6 text-xs text-neutral-400">
                  <div>
                    <span className="text-white font-mono font-bold block">{activeHubDetails.memberCount}</span>
                    <span className="text-[9.5px]">Approved Peers</span>
                  </div>
                </div>

                <button 
                  onClick={onRegister}
                  className="w-full sm:w-auto bg-[#c5a880] text-neutral-950 hover:bg-white font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-xl transition duration-200 cursor-pointer"
                >
                  Register Inside this Hub
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 6. ETHICAL CODE OF CONDUCT AREA */}
      <section id="ethical-framework" className="py-20 px-6 md:px-12 max-w-7xl mx-auto border-b border-neutral-900 bg-neutral-950/20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <span className="font-mono text-[#c5a880] text-[10px] tracking-[0.3em] uppercase block">SACRED STEWARDSHIP</span>
            <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              A Network Bound by Biblical Integrity
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed font-normal">
              Unlike generic professional networks driven purely by ambition, Petra Connect participants submit details under our community's covenant code of ethics. This enforces reliable interactions, verified bios, and mutual vocational accountability.
            </p>
            
            <div className="space-y-4 pt-2">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 text-emerald-500 shrink-0 flex items-center justify-center font-mono text-[10px]">✔</div>
                <p className="text-neutral-300 text-xs">Vetted applicants approved only by designated guild leaders.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 text-emerald-500 shrink-0 flex items-center justify-center font-mono text-[10px]">✔</div>
                <p className="text-neutral-300 text-xs">Zero cold-outreach spam - messages permitted only inside connected peer connections.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded bg-neutral-900 border border-neutral-800 text-emerald-500 shrink-0 flex items-center justify-center font-mono text-[10px]">✔</div>
                <p className="text-neutral-300 text-xs">Sovereign loggers register all security modifications to safeguard safety.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-[#121319] p-6 rounded-xl border border-neutral-850 text-center space-y-2">
              <Compass className="text-[#c5a880] mx-auto mb-2" size={24} />
              <h4 className="font-serif text-xs font-bold uppercase text-white tracking-wider">Honor & Respect</h4>
              <p className="text-[10.5px] text-neutral-400">Mutual encouragement over personal vanity.</p>
            </div>

            <div className="bg-[#121319] p-6 rounded-xl border border-neutral-850 text-center space-y-2">
              <Award className="text-emerald-500 mx-auto mb-2" size={24} />
              <h4 className="font-serif text-xs font-bold uppercase text-white tracking-wider">Expertise Excellence</h4>
              <p className="text-[10.5px] text-neutral-400">Pursuing top tier craft standards to glorify God.</p>
            </div>

            <div className="bg-[#121319] p-6 rounded-xl border border-neutral-850 text-center space-y-2">
              <BookOpen className="text-yellow-500 mx-auto mb-2" size={24} />
              <h4 className="font-serif text-xs font-bold uppercase text-white tracking-wider">Generous Mentorship</h4>
              <p className="text-[10.5px] text-neutral-400">Guiding university graduates and junior builders.</p>
            </div>

            <div className="bg-[#121319] p-6 rounded-xl border border-neutral-850 text-center space-y-2">
              <Lock className="text-[#cbd1db] mx-auto mb-2" size={24} />
              <h4 className="font-serif text-xs font-bold uppercase text-white tracking-wider">Confidentiality</h4>
              <p className="text-[10.5px] text-neutral-400">Safeguarding shared strategies and database files.</p>
            </div>

          </div>

        </div>
      </section>

      {/* 7. HIGH END ACTION BOARD (CTA section) */}
      <section className="py-20 px-6 md:px-12 bg-[#0b0c10] text-center">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#121319] to-black border border-[#c5a880]/30 p-10 md:p-16 rounded-3xl text-white relative overflow-hidden shadow-2xl">
          {/* Subtle gold center spotlight */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#c5a880]/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 space-y-8 max-w-2xl mx-auto">
            <span className="font-mono text-[#c5a880] text-[10.5px] tracking-[0.3em] uppercase block">CLAIM ACCESS LEVEL</span>
            <h2 className="font-serif text-3xl md:text-5xl font-extrabold tracking-tight">
              Ready to Activate Your Profile?
            </h2>
            <p className="text-neutral-400 text-sm md:text-base leading-relaxed font-normal">
              Applying takes less than 3 minutes. Specify your vocation, provide membership details, and instantly access verified community bulletins.
            </p>
            
            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onRegister}
                className="w-full sm:w-auto bg-[#c5a880] text-neutral-950 hover:bg-white font-bold uppercase tracking-widest py-4 px-10 rounded-xl transition-all duration-350 shadow-lg shadow-[#c5a880]/5 cursor-pointer"
              >
                Register as Member ➔
              </button>
              <button
                onClick={onExploreDemo}
                className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-white font-medium uppercase tracking-widest py-4 px-8 rounded-xl transition duration-200 cursor-pointer"
              >
                Launch Live Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. DETAILED LUXURIOUS FOOTER */}
      <footer className="bg-[#07080a] text-neutral-500 py-16 px-6 md:px-12 border-t border-neutral-900 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={petraLogo} alt="Petra Connect Hubs" className="w-8 h-8 object-contain rounded-lg" />
              <span className="font-sans font-bold text-white tracking-tight uppercase">Petra Connect Hubs</span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: '#1D2D5F' }}>
              Petra Full Gospel Church <br />
              An Apostolic Church, Redeeming a generation, Revealing Christ From Uganda To The World.
            </p>
          </div>
          
        </div>
      </footer>

    </div>
  );
}
