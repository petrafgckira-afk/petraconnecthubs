import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageCircle, Share2, MoreHorizontal, Trash2, Pin, UserX, UserCheck,
  Globe, Users, Image as ImageIcon, Video, Link2, BarChart2, Send, X, Plus,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Loader2,
  Music, Play, Pause,
} from 'lucide-react';
import {
  fetchFeedPosts, createFeedPost, deleteFeedPost, fetchLinkPreview,
  fetchFeedComments, addFeedComment, deleteFeedComment,
  voteFeedPoll, pinFeedPost, freezeFeedUser, unfreezeFeedUser,
  uploadFeedMedia, uploadFeedAudio,
} from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedMedia {
  url: string;
  thumb_url: string | null;
  media_type: 'image' | 'video';
  mime: string | null;
}

interface PollOption {
  id: string;
  label: string;
  sort_order: number;
  vote_count: number | string;
}

interface FeedPost {
  id: string;
  post_type: 'text' | 'image' | 'video' | 'link' | 'poll' | 'audio';
  visibility: 'hub' | 'global';
  content: string | null;
  link_url: string | null;
  link_title: string | null;
  link_desc: string | null;
  link_image: string | null;
  link_domain: string | null;
  is_pinned: boolean;
  created_at: string;
  hub_id: string | null;
  hub_name: string | null;
  author_id: string;
  author_name: string;
  author_role: string;
  author_image: string | null;
  media: FeedMedia[];
  poll_options: PollOption[];
  my_poll_vote: string | null;
  comments_total: number;
  is_owner: boolean;
  can_delete: boolean;
  can_pin: boolean;
  can_freeze_author: boolean;
  is_frozen: boolean;
  audio_url: string | null;
  audio_duration: number | null;
  audio_waveform: number[] | null;
  preview_comments: Array<{ author_name: string; content: string }>;
}

interface FeedComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string;
  author_image: string | null;
  author_role: string;
  is_owner: boolean;
  can_delete: boolean;
}

interface SocialFeedProps {
  currentUserId: string;
  currentUserRole: 'member' | 'hub_leader' | 'admin';
  currentUserName: string;
  currentUserImage: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1_000_000) { const v = n / 1_000_000; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'm'; }
  if (n >= 1_000)     { const v = n / 1_000;     return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'k'; }
  return String(n);
}

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400)return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function initials(name: string) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P';
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, image, size = 10 }: { name: string; image: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cls = `w-${size} h-${size} rounded-full object-cover shrink-0`;
  if (image && !failed) {
    return <img src={image} alt={name} className={cls} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-navy-900 text-brand-gold font-bold flex items-center justify-center text-xs shrink-0 border border-brand-gold/30`}>
      {initials(name)}
    </div>
  );
}

// ── Image Grid ───────────────────────────────────────────────────────────────

function ImageCarousel({ media }: { media: FeedMedia[] }) {
  const imgs = media.filter(m => m.media_type === 'image');
  if (imgs.length === 0) return null;

  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Restart the 4-second auto-advance whenever the active slide or hover state changes
  useEffect(() => {
    if (imgs.length <= 1 || hovered) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % imgs.length), 4000);
    return () => clearInterval(id);
  }, [current, imgs.length, hovered]);

  const goTo = (idx: number) => setCurrent((idx + imgs.length) % imgs.length);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ aspectRatio: '4/3' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Sliding track */}
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{ width: `${imgs.length * 100}%`, transform: `translateX(-${(current / imgs.length) * 100}%)` }}
        >
          {imgs.map((m, i) => (
            <div
              key={i}
              className="h-full cursor-zoom-in select-none"
              style={{ width: `${100 / imgs.length}%` }}
              onClick={() => setLightbox(m.url)}
            >
              <img src={m.thumb_url ?? m.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
          ))}
        </div>

        {/* Prev arrow — visible on hover, hidden at first image */}
        {imgs.length > 1 && current > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); goTo(current - 1); }}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Next arrow — visible on hover, hidden at last image */}
        {imgs.length > 1 && current < imgs.length - 1 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); goTo(current + 1); }}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Dot indicators — pill style, active dot widens */}
        {imgs.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
            {imgs.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={e => { e.stopPropagation(); goTo(i); }}
                className={`rounded-full transition-all duration-300 ${i === current ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/55 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}

        {/* n / total counter */}
        {imgs.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full select-none pointer-events-none">
            {current + 1} / {imgs.length}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="absolute top-4 right-4 text-white hover:text-brand-gold transition" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </>
  );
}

// ── Poll Card ─────────────────────────────────────────────────────────────────

function PollContent({ post, onVote }: { post: FeedPost; onVote: (optionId: string) => void }) {
  const opts  = post.poll_options ?? [];
  const total = opts.reduce((s, o) => s + Number(o.vote_count), 0);
  return (
    <div className="space-y-2 mt-3">
      {opts.map(opt => {
        const count   = Number(opt.vote_count);
        const pct     = total > 0 ? Math.round((count / total) * 100) : 0;
        const isVoted = post.my_poll_vote === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onVote(opt.id)}
            className={`w-full text-left rounded-lg border-2 px-3 py-2 relative overflow-hidden transition duration-150 ${
              isVoted
                ? 'border-brand-gold bg-brand-gold/5'
                : 'border-slate-200 hover:border-navy-300 bg-white'
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-brand-gold/10 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex justify-between items-center">
              <span className={`text-xs font-semibold ${isVoted ? 'text-navy-950' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              <span className="text-[10px] font-bold text-gray-500 ml-2">{pct}% ({count})</span>
            </div>
          </button>
        );
      })}
      <p className="text-[10px] text-gray-400 text-right">{total} vote{total !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Link Card ─────────────────────────────────────────────────────────────────

// ── Audio Waveform Player ─────────────────────────────────────────────────────

const BAR_COUNT = 80;

function barColor(i: number, active: boolean): string {
  const hue = Math.round((i / BAR_COUNT) * 300);
  return active ? `hsl(${hue},100%,62%)` : `hsl(${hue},35%,22%)`;
}

// Only one audio plays at a time — this holds the active player's stop function
let activePlayerStop: (() => void) | null = null;

function AudioWaveformPlayer({ src, waveform, duration: initDur }: {
  src: string; waveform: number[]; duration: number;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioRef     = useRef<HTMLAudioElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const rafRef       = useRef<number>(0);
  const phaseRef     = useRef<number>(0);
  const playingRef   = useRef<boolean>(false);

  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(initDur || 0);
  const [speed,    setSpeed]    = useState(1);

  const seekBarRef     = useRef<HTMLDivElement>(null);
  const isDragging     = useRef(false);

  const normBars = useCallback((): number[] => {
    if (waveform.length >= BAR_COUNT) return waveform.slice(0, BAR_COUNT);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const idx = Math.floor(i * waveform.length / BAR_COUNT);
      return waveform[Math.min(idx, waveform.length - 1)] ?? 0.3;
    });
  }, [waveform]);

  const drawFrame = useCallback((bars: number[], active: boolean, progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const barW = W / BAR_COUNT;
    const gap  = Math.max(1, barW * 0.18);
    const cy   = H / 2;
    bars.forEach((val, i) => {
      const halfH = Math.max(3, val * cy * 0.88);
      const x     = i * barW + gap / 2;
      const w     = Math.max(1, barW - gap);
      ctx.fillStyle = barColor(i, active ? true : i / BAR_COUNT <= progress);
      ctx.beginPath(); ctx.roundRect(x, cy - halfH, w, halfH, 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x, cy + 1,     w, halfH, 2); ctx.fill();
    });
  }, []);

  const drawStatic = useCallback((progress: number) => {
    drawFrame(normBars(), false, progress);
  }, [drawFrame, normBars]);

  // Fallback: animate stored bars with sine-wave perturbation (no Web Audio)
  const drawAnimated = useCallback(() => {
    if (!playingRef.current) return;
    phaseRef.current += 0.15;
    const stored = normBars();
    const bars = stored.map((v, i) => Math.max(0.05, Math.min(1, v + 0.13 * Math.sin(phaseRef.current + i * 0.4))));
    drawFrame(bars, true, 0);
    rafRef.current = requestAnimationFrame(drawAnimated);
  }, [drawFrame, normBars]);

  // Real-time FFT (when Web Audio API is available)
  const drawRealtime = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser || !playingRef.current) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const W = canvas.width, H = canvas.height;
    ctx2d.fillStyle = '#000';
    ctx2d.fillRect(0, 0, W, H);
    const data   = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const barW   = W / BAR_COUNT;
    const gap    = Math.max(1, barW * 0.18);
    const cy     = H / 2;
    const step   = data.length / BAR_COUNT;
    const stored = normBars();
    for (let i = 0; i < BAR_COUNT; i++) {
      const fft   = data[Math.floor(i * step)] / 255;
      const base  = stored[i] ?? 0.3;
      const val   = Math.max(fft, base * 0.12);
      const halfH = Math.max(3, val * cy * 0.95);
      const x     = i * barW + gap / 2;
      const w     = Math.max(1, barW - gap);
      ctx2d.fillStyle = barColor(i, true);
      ctx2d.beginPath(); ctx2d.roundRect(x, cy - halfH, w, halfH, 2); ctx2d.fill();
      ctx2d.beginPath(); ctx2d.roundRect(x, cy + 1,     w, halfH, 2); ctx2d.fill();
    }
    rafRef.current = requestAnimationFrame(drawRealtime);
  }, [normBars]);

  const tryInitWebAudio = () => {
    if (audioCtxRef.current || !audioRef.current) return;
    try {
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const an   = actx.createAnalyser();
      an.fftSize = 256; an.smoothingTimeConstant = 0.78;
      const source = actx.createMediaElementSource(audioRef.current);
      source.connect(an); an.connect(actx.destination);
      audioCtxRef.current = actx; analyserRef.current = an;
    } catch {
      // CORS or policy issue — fall back to sine-wave animation
    }
  };

  const startAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) {
      rafRef.current = requestAnimationFrame(drawRealtime);
    } else {
      rafRef.current = requestAnimationFrame(drawAnimated);
    }
  }, [drawRealtime, drawAnimated]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      drawStatic(audio.currentTime / (audio.duration || 1));
      activePlayerStop = null;
      return;
    }

    // Stop whatever is currently playing (audio or video) before starting this one
    if (activePlayerStop) {
      activePlayerStop();
    }
    if (activeVideoEl.current) {
      activeVideoEl.current.pause();
      activeVideoEl.current = null;
    }

    // Register this player's stop function so another player can interrupt it later
    activePlayerStop = () => {
      if (!audio.paused) audio.pause();
      playingRef.current = false;
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      drawStatic(audio.currentTime / (audio.duration || 1));
      activePlayerStop = null;
    };

    // Try Web Audio API first
    tryInitWebAudio();
    await audioCtxRef.current?.resume().catch(() => {});

    try {
      await audio.play();
    } catch {
      // Likely CORS cache issue — strip crossOrigin, reload, retry
      audio.removeAttribute('crossorigin');
      audio.load();
      await new Promise<void>(res => {
        const onReady = () => { audio.removeEventListener('canplay', onReady); res(); };
        audio.addEventListener('canplay', onReady);
        setTimeout(res, 4000);
      });
      // After stripping crossOrigin, Web Audio won't work — clear analyser
      analyserRef.current = null;
      try { await audio.play(); } catch { activePlayerStop = null; return; }
    }

    playingRef.current = true;
    setPlaying(true);
    startAnimation();
  };

  const doSeek = useCallback((clientX: number) => {
    const el    = seekBarRef.current;
    const audio = audioRef.current;
    if (!el || !audio?.duration) return;
    const rect = el.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setCurrent(pct * audio.duration);
    if (!playingRef.current) drawStatic(pct);
  }, [drawStatic]);

  // Canvas click also seeks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const audio  = audioRef.current;
    if (!audio?.duration) return;
    const rect = canvas.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setCurrent(pct * audio.duration);
    if (!playingRef.current) drawStatic(pct);
  };

  const handleSpeedChange = (s: number) => {
    const audio = audioRef.current;
    setSpeed(s);
    if (audio) audio.playbackRate = s;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd  = () => {
      playingRef.current = false;
      setPlaying(false); cancelAnimationFrame(rafRef.current);
      audio.currentTime = 0; setCurrent(0); drawStatic(0);
      activePlayerStop = null;
    };
    audio.addEventListener('timeupdate',    onTime);
    audio.addEventListener('loadedmetadata',onMeta);
    audio.addEventListener('ended',         onEnd);
    return () => {
      audio.removeEventListener('timeupdate',    onTime);
      audio.removeEventListener('loadedmetadata',onMeta);
      audio.removeEventListener('ended',         onEnd);
    };
  }, [drawStatic]);

  useEffect(() => {
    drawStatic(0);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [drawStatic]);

  const fmt = (s: number) => {
    if (!s || isNaN(s) || s < 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className="mt-3 rounded-2xl overflow-hidden bg-black select-none">

      {/* ── Waveform canvas (click to seek) ── */}
      <canvas
        ref={canvasRef}
        width={800}
        height={160}
        className="w-full block cursor-pointer"
        style={{ height: 88 }}
        onClick={handleCanvasClick}
      />

      {/* ── Drag-seek bar ── */}
      <div className="px-3 pt-2">
        <div
          ref={seekBarRef}
          className="relative h-5 flex items-center cursor-pointer group"
          onPointerDown={e => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            isDragging.current = true;
            doSeek(e.clientX);
          }}
          onPointerMove={e => { if (isDragging.current) doSeek(e.clientX); }}
          onPointerUp={() => { isDragging.current = false; }}
          onPointerLeave={() => { isDragging.current = false; }}
        >
          {/* Track */}
          <div className="absolute inset-x-0 h-[3px] bg-white/12 rounded-full">
            {/* Fill */}
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg,
                  hsl(0,100%,60%) 0%,
                  hsl(60,100%,60%) 20%,
                  hsl(120,100%,60%) 40%,
                  hsl(180,100%,60%) 60%,
                  hsl(240,100%,60%) 80%,
                  hsl(300,100%,60%) 100%)`,
                backgroundSize: `${100 / Math.max(0.01, progress)}% 100%`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute w-3 h-3 rounded-full bg-white shadow-md -translate-x-1/2 transition-opacity"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* ── Controls row ── */}
      <div className="flex items-center gap-2.5 px-3 pb-3 pt-1">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/20 flex items-center justify-center text-white transition shrink-0"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>

        {/* Time */}
        <span className="text-[10px] text-white/40 font-mono tabular-nums shrink-0">
          {fmt(current)}&thinsp;/&thinsp;{fmt(duration)}
        </span>

        <div className="flex-1" />

        {/* Speed buttons */}
        {([0.75, 1, 1.25, 1.5, 2] as const).map(s => (
          <button
            key={s}
            onClick={() => handleSpeedChange(s)}
            className={`text-[9px] font-bold px-1.5 py-[3px] rounded transition ${
              speed === s
                ? 'bg-white/20 text-white'
                : 'text-white/30 hover:text-white/60 hover:bg-white/10'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />
    </div>
  );
}

function LinkCard({ post }: { post: FeedPost }) {
  if (!post.link_url) return null;
  return (
    <a
      href={post.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-3 rounded-2xl border border-slate-200 overflow-hidden hover:border-brand-gold/50 hover:shadow-md transition-all duration-200 group bg-white"
    >
      {post.link_image && (
        <div className="relative overflow-hidden">
          <img
            src={post.link_image}
            alt=""
            className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            style={{ maxHeight: 240 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <img
            src={`https://www.google.com/s2/favicons?domain=${post.link_domain}&sz=16`}
            alt=""
            className="w-3.5 h-3.5 rounded-sm"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          {post.link_domain && (
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{post.link_domain}</p>
          )}
        </div>
        {post.link_title && (
          <p className="text-sm font-bold text-navy-950 leading-snug line-clamp-2">{post.link_title}</p>
        )}
        {post.link_desc && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{post.link_desc}</p>
        )}
        <div className="flex items-center gap-1 mt-2.5 text-brand-gold text-[11px] font-semibold">
          <ExternalLink size={11} /> Open link
        </div>
      </div>
    </a>
  );
}

// ── Comment Ticker ────────────────────────────────────────────────────────────

function CommentTicker({
  comments, onOpen,
}: {
  comments: Array<{ author_name: string; content: string }>;
  onOpen: () => void;
}) {
  const [idx,      setIdx]      = useState(0);
  const [animKey,  setAnimKey]  = useState(0);

  useEffect(() => {
    if (comments.length <= 1) return;
    const id = setInterval(() => {
      setIdx(i  => (i + 1) % comments.length);
      setAnimKey(k => k + 1);
    }, 3500);
    return () => clearInterval(id);
  }, [comments.length]);

  if (!comments.length) return null;

  return (
    <>
      <style>{`
        @keyframes pgTickerIn {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .pg-ticker-in { animation: pgTickerIn 0.28s ease-out both; }
      `}</style>
      <div
        className="px-5 py-2.5 border-t border-slate-50 cursor-pointer hover:bg-slate-50/60 transition-colors overflow-hidden"
        onClick={onOpen}
      >
        <div key={animKey} className="pg-ticker-in flex items-baseline gap-1.5 text-xs min-w-0">
          <span className="font-bold text-navy-950 shrink-0">{comments[idx].author_name}</span>
          <span className="text-gray-500 truncate">{comments[idx].content}</span>
        </div>
      </div>
    </>
  );
}

// ── Comment Section ───────────────────────────────────────────────────────────

function CommentSection({
  postId, currentUserId, currentUserName, currentUserImage, onCommentAdded,
}: {
  postId: string; currentUserId: string; currentUserName: string; currentUserImage: string | null;
  onCommentAdded?: (c: { author_name: string; content: string }) => void;
}) {
  const [comments,  setComments]  = useState<FeedComment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);

  useEffect(() => {
    fetchFeedComments(postId)
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const d = await addFeedComment(postId, t);
      setComments(prev => [...prev, d.comment]);
      setText('');
      onCommentAdded?.({ author_name: currentUserName, content: t });
    } catch {} finally { setSending(false); }
  };

  const remove = async (cid: string) => {
    try {
      await deleteFeedComment(cid);
      setComments(prev => prev.filter(c => c.id !== cid));
    } catch {}
  };

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      {loading ? (
        <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-1">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 group">
              <Avatar name={c.author_name} image={c.author_image} size={7} />
              <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-navy-950">{c.author_name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                    {c.can_delete && (
                      <button
                        onClick={() => remove(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-rose-500 transition"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <Avatar name={currentUserName} image={currentUserImage} size={7} />
        <div className="flex-1 flex items-end gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-brand-gold transition">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Write a comment…"
            rows={1}
            className="flex-1 bg-transparent text-xs text-navy-950 resize-none outline-none placeholder-gray-400 leading-relaxed"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="text-brand-gold hover:text-amber-600 disabled:opacity-30 transition shrink-0"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Caption with TikTok-style read-more ──────────────────────────────────────

function CaptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const newlines = (text.match(/\n/g) ?? []).length;
  const isLong   = text.length > 300 || newlines >= 4;

  const preview = newlines >= 4
    ? text.split('\n').slice(0, 3).join('\n')           // first 3 paragraphs
    : text.slice(0, 300).replace(/\s\S*$/, '');         // 300 chars to last word

  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words mb-3">
      {isLong && !expanded ? preview : text}
      {isLong && !expanded && (
        <>{'… '}<button type="button" onClick={() => setExpanded(true)} className="font-bold text-navy-950 hover:underline">more</button></>
      )}
      {isLong && expanded && (
        <>{' '}<button type="button" onClick={() => setExpanded(false)} className="font-bold text-navy-950 hover:underline">less</button></>
      )}
    </p>
  );
}

// ── Video Player ──────────────────────────────────────────────────────────────

// Only one video plays at a time across all VideoPlayer instances on the page.
const activeVideoEl: { current: HTMLVideoElement | null } = { current: null };

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // ── End of video: seek to start but stay paused ──────────────────────────
    const onEnded = () => { video.currentTime = 0; };
    video.addEventListener('ended', onEnded);

    // ── Pause when browser tab is hidden ─────────────────────────────────────
    const onVisibility = () => {
      if (document.hidden && activeVideoEl.current === video) {
        video.pause();
        activeVideoEl.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ── IntersectionObserver: auto-play when ≥ 60 % visible ─────────────────
    // Mute state is remembered on the element itself so toggling survives
    // scroll-away / scroll-back without any extra state management.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (activeVideoEl.current && activeVideoEl.current !== video) {
            activeVideoEl.current.pause();
          }
          activeVideoEl.current = video;
          // Stop any playing audio when a video auto-plays
          if (activePlayerStop) {
            activePlayerStop();
            activePlayerStop = null;
          }
          video.play().catch(() => {});
        } else if (activeVideoEl.current === video) {
          video.pause();
          activeVideoEl.current = null;
        }
      },
      { threshold: [0.6] }
    );
    observer.observe(video);

    return () => {
      video.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      if (activeVideoEl.current === video) {
        video.pause();
        activeVideoEl.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full rounded-xl mt-1 overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        muted
        playsInline
        className="w-full block"
        style={{ maxHeight: 400 }}
      />
    </div>
  );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────

function FeedCard({
  post: initialPost,
  currentUserId,
  currentUserName,
  currentUserImage,
  currentUserRole,
  onDelete,
}: {
  post: FeedPost;
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string | null;
  currentUserRole: 'member' | 'hub_leader' | 'admin';
  onDelete: (id: string) => void;
}) {
  const [post,           setPost]           = useState(initialPost);
  const [showComments,   setShowComments]   = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);
  const [menuLoading,    setMenuLoading]    = useState(false);
  const [tickerComments, setTickerComments] = useState<Array<{author_name: string; content: string}>>(
    () => initialPost.preview_comments ?? []
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleCommentAdded = useCallback((c: { author_name: string; content: string }) => {
    setTickerComments(prev => [c, ...prev].slice(0, 4));
    setPost(p => ({ ...p, comments_total: p.comments_total + 1 }));
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handlePollVote = async (optionId: string) => {
    try {
      const d = await voteFeedPoll(post.id, optionId);
      setPost(p => ({ ...p, poll_options: d.poll_options, my_poll_vote: d.my_poll_vote }));
    } catch {}
  };

  const handleDelete = async () => {
    setMenuLoading(true);
    try { await deleteFeedPost(post.id); onDelete(post.id); } catch {} finally { setMenuLoading(false); setShowMenu(false); }
  };

  const handlePin = async () => {
    setMenuLoading(true);
    try {
      const d = await pinFeedPost(post.id);
      setPost(p => ({ ...p, is_pinned: d.is_pinned }));
    } catch {} finally { setMenuLoading(false); setShowMenu(false); }
  };

  const handleFreeze = async () => {
    setMenuLoading(true);
    try {
      await freezeFeedUser(post.author_id);
      setPost(p => ({ ...p, is_frozen: true }));
      setShowMenu(false);
      alert(`${post.author_name}'s posting ability has been suspended.`);
    } catch (e: any) { alert(e.message); } finally { setMenuLoading(false); }
  };

  const handleUnfreeze = async () => {
    setMenuLoading(true);
    try {
      await unfreezeFeedUser(post.author_id);
      setPost(p => ({ ...p, is_frozen: false }));
      setShowMenu(false);
      alert(`${post.author_name}'s posting ability has been restored.`);
    } catch (e: any) { alert(e.message); } finally { setMenuLoading(false); }
  };

  return (
    <article className={`bg-white rounded-2xl border shadow-sm transition duration-150 hover:shadow-md ${
      post.is_pinned ? 'border-brand-gold/40 shadow-amber-50' : 'border-slate-100'
    }`}>
      <div className="p-5">
        {/* Pinned indicator */}
        {post.is_pinned && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1 w-fit mb-3">
            <Pin size={10} /> Pinned
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={post.author_name} image={post.author_image} size={10} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm text-navy-950 truncate">{post.author_name}</span>
                <span className="text-[10px] text-amber-700 font-semibold">{post.author_role}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-gray-400">{timeAgo(post.created_at)}</span>
                {post.hub_name && (
                  <span className="px-1.5 py-0.5 rounded bg-navy-50 text-[9px] font-bold text-navy-700 border border-navy-100">
                    {post.hub_name} Hub
                  </span>
                )}
                <span
                  title={post.visibility === 'global' ? 'Visible to everyone' : 'Hub members only'}
                  className="flex items-center gap-0.5 text-[9px] text-gray-400"
                >
                  {post.visibility === 'global' ? <Globe size={9} /> : <Users size={9} />}
                  {post.visibility === 'global' ? 'Everyone' : 'Hub'}
                </span>
              </div>
            </div>
          </div>

          {/* ••• menu */}
          {(post.can_delete || post.can_pin || post.can_freeze_author) && (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowMenu(v => !v)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-slate-100 hover:text-navy-900 transition"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
                  {/* Visibility indicator — read-only */}
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
                    {post.visibility === 'global'
                      ? <Globe size={11} className="text-brand-gold shrink-0" />
                      : <Users size={11} className="text-navy-400 shrink-0" />
                    }
                    <span className="text-[10px] font-semibold text-gray-400 leading-none">
                      {post.visibility === 'global'
                        ? 'All hubs'
                        : post.hub_name ? `${post.hub_name} Hub` : 'Hub'}
                    </span>
                  </div>
                  {post.can_pin && (
                    <button
                      onClick={handlePin}
                      disabled={menuLoading}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-slate-50 transition"
                    >
                      <Pin size={13} /> {post.is_pinned ? 'Unpin post' : 'Pin post'}
                    </button>
                  )}
                  {post.can_freeze_author && (
                    <button
                      onClick={post.is_frozen ? handleUnfreeze : handleFreeze}
                      disabled={menuLoading}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition ${
                        post.is_frozen
                          ? 'text-emerald-700 hover:bg-emerald-50'
                          : 'text-gray-700 hover:bg-slate-50'
                      }`}
                    >
                      {post.is_frozen
                        ? <><UserCheck size={13} /> Unsuspend posting</>
                        : <><UserX size={13} /> Suspend posting</>
                      }
                    </button>
                  )}
                  {(post.can_pin || post.can_freeze_author) && post.can_delete && (
                    <div className="border-t border-slate-100" />
                  )}
                  {post.can_delete && (
                    <button
                      onClick={handleDelete}
                      disabled={menuLoading}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} /> Delete post
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {post.content && <CaptionText text={post.content} />}

        {post.post_type === 'image' && <ImageCarousel media={post.media ?? []} />}

        {post.post_type === 'video' && (post.media ?? [])[0] && (
          <VideoPlayer src={(post.media ?? [])[0]!.url} />
        )}

        {post.post_type === 'link' && <LinkCard post={post} />}

        {post.post_type === 'audio' && post.audio_url && (
          <AudioWaveformPlayer
            src={post.audio_url}
            waveform={post.audio_waveform ?? []}
            duration={post.audio_duration ?? 0}
          />
        )}

        {post.post_type === 'poll' && (post.poll_options ?? []).length > 0 && (
          <PollContent post={post} onVote={handlePollVote} />
        )}
      </div>

      {/* Actions Bar */}
      <div className="px-5 pb-0 flex items-center gap-4 border-t border-slate-50 pt-3">
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-navy-900 transition"
        >
          <MessageCircle size={14} />
          {post.comments_total > 0 ? post.comments_total : ''} Comment{post.comments_total !== 1 ? 's' : ''}
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Comment ticker — rotates through newest 4 comments */}
      <CommentTicker comments={tickerComments} onOpen={() => setShowComments(true)} />

      {/* Comment section */}
      {showComments && (
        <div className="px-5 pb-5">
          <CommentSection
            postId={post.id}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserImage={currentUserImage}
            onCommentAdded={handleCommentAdded}
          />
        </div>
      )}
    </article>
  );
}

// ── Post Composer ─────────────────────────────────────────────────────────────

type PostType = 'text' | 'image' | 'video' | 'link' | 'poll' | 'audio';

const TYPE_OPTIONS: Array<{ type: PostType; icon: React.ReactNode; label: string }> = [
  { type: 'image', icon: <ImageIcon size={14} />,  label: 'Photo'  },
  { type: 'video', icon: <Video size={14} />,       label: 'Video'  },
  { type: 'link',  icon: <Link2 size={14} />,       label: 'Link'   },
  { type: 'poll',  icon: <BarChart2 size={14} />,   label: 'Poll'   },
  { type: 'audio', icon: <Music size={14} />,        label: 'Audio'  },
];

interface UploadItem { _id: string; url: string; thumb_url: string | null; media_type: 'image' | 'video'; mime: string; progress: number | null; error?: string; }

function PostComposer({
  currentUserName, currentUserImage, onPosted,
}: {
  currentUserName: string; currentUserImage: string | null; onPosted: (post: FeedPost) => void;
}) {
  const [expanded,           setExpanded]           = useState(false);
  const [postType,           setPostType]           = useState<PostType>('text');
  const [visibility,         setVisibility]         = useState<'hub' | 'global'>('global');
  const [text,               setText]               = useState('');
  const [uploads,            setUploads]            = useState<UploadItem[]>([]);
  const [linkUrl,            setLinkUrl]            = useState('');
  const [linkTitle,          setLinkTitle]          = useState('');
  const [linkDesc,           setLinkDesc]           = useState('');
  const [linkImage,          setLinkImage]          = useState('');
  const [linkDomain,         setLinkDomain]         = useState('');
  const [linkFetching,       setLinkFetching]       = useState(false);
  const [linkFetched,        setLinkFetched]        = useState(false);
  const [linkFetchError,     setLinkFetchError]     = useState('');
  const [pollOptions,        setPollOptions]        = useState(['', '']);
  const [audioFile,          setAudioFile]          = useState<File | null>(null);
  const [audioUrl,           setAudioUrl]           = useState('');
  const [audioDuration,      setAudioDuration]      = useState(0);
  const [audioWaveform,      setAudioWaveform]      = useState<number[]>([]);
  const [audioProgress,      setAudioProgress]      = useState<number | null>(null);
  const [audioUploading,     setAudioUploading]     = useState(false);
  const [submitting,         setSubmitting]         = useState(false);
  const [error,              setError]              = useState('');
  const fileRef        = useRef<HTMLInputElement>(null);
  const audioFileRef   = useRef<HTMLInputElement>(null);
  const textRef        = useRef<HTMLTextAreaElement>(null);
  const linkDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock page scroll while modal is open
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [expanded]);

  const resetLinkPreview = () => {
    setLinkTitle(''); setLinkDesc(''); setLinkImage(''); setLinkDomain('');
    setLinkFetched(false); setLinkFetchError('');
  };

  const reset = () => {
    setExpanded(false); setPostType('text'); setVisibility('global');
    setText(''); setUploads([]); setLinkUrl('');
    resetLinkPreview();
    setPollOptions(['', '']);
    setAudioFile(null); setAudioUrl(''); setAudioDuration(0);
    setAudioWaveform([]); setAudioProgress(null); setAudioUploading(false);
    setError('');
  };

  // Auto-fetch link preview with 800 ms debounce
  useEffect(() => {
    if (postType !== 'link') return;
    if (linkDebounce.current) clearTimeout(linkDebounce.current);
    const url = linkUrl.trim();
    if (!url || !/^https?:\/\/.{3,}/.test(url)) { resetLinkPreview(); return; }
    linkDebounce.current = setTimeout(async () => {
      setLinkFetching(true); setLinkFetchError('');
      try {
        const p = await fetchLinkPreview(url);
        setLinkTitle(p.title || '');
        setLinkDesc(p.description || '');
        setLinkImage(p.image || '');
        setLinkDomain(p.domain || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })());
        setLinkFetched(true);
      } catch {
        setLinkFetchError('Preview unavailable — the link will still be shared.');
        setLinkDomain((() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })());
        setLinkFetched(false);
      } finally { setLinkFetching(false); }
    }, 800);
    return () => { if (linkDebounce.current) clearTimeout(linkDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkUrl, postType]);

  const addPollOption = () => { if (pollOptions.length < 6) setPollOptions(p => [...p, '']); };
  const removePollOption = (i: number) => setPollOptions(p => p.filter((_, idx) => idx !== i));
  const setPollOption = (i: number, v: string) => setPollOptions(p => p.map((o, idx) => idx === i ? v : o));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const mediaType: 'image' | 'video' = postType === 'video' ? 'video' : 'image';

    for (const file of files.slice(0, 9 - uploads.length)) {
      const uid = `${Date.now()}-${Math.random()}`;
      const placeholder: UploadItem = { _id: uid, url: '', thumb_url: null, media_type: mediaType, mime: file.type, progress: 0 };
      setUploads(prev => [...prev, placeholder]);

      try {
        const result = await uploadFeedMedia(file, mediaType, pct => {
          setUploads(prev => {
            const idx = prev.findIndex(u => u._id === uid);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], progress: pct };
            return next;
          });
        });
        setUploads(prev => {
          const idx = prev.findIndex(u => u._id === uid);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], ...result, progress: null };
          return next;
        });
      } catch (err: any) {
        setUploads(prev => {
          const idx = prev.findIndex(u => u._id === uid);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], progress: null, error: err.message };
          return next;
        });
        setError(`Upload failed: ${err.message}`);
      }
    }
    e.target.value = '';
  };

  const submit = async () => {
    setError('');
    if (postType === 'text' && !text.trim()) { setError('Please write something.'); return; }
    if (postType === 'link' && !linkUrl.trim()) { setError('Please enter a URL.'); return; }
    if (postType === 'poll' && pollOptions.filter(o => o.trim()).length < 2) {
      setError('Add at least 2 poll options.'); return;
    }
    if (postType === 'poll' && pollOptions.some(o => !o.trim())) {
      setError('Please fill in all poll options or remove empty ones.'); return;
    }
    if ((postType === 'image' || postType === 'video') && uploads.filter(u => u.url).length === 0) {
      setError('Please upload at least one file.'); return;
    }
    if (postType === 'audio' && !audioUrl) { setError('Please upload an audio file.'); return; }

    setSubmitting(true);
    try {
      const payload: Parameters<typeof createFeedPost>[0] = {
        post_type:      postType,
        visibility,
        content:        text.trim() || undefined,
        media:          uploads.filter(u => u.url).map(u => ({ url: u.url, thumb_url: u.thumb_url, media_type: u.media_type, mime: u.mime })),
        poll_options:   pollOptions.filter(o => o.trim()),
        link_url:       linkUrl.trim()   || undefined,
        link_title:     linkTitle.trim() || undefined,
        link_desc:      linkDesc.trim()  || undefined,
        link_image:     linkImage.trim() || undefined,
        link_domain:    linkDomain.trim()|| undefined,
        audio_url:      audioUrl         || undefined,
        audio_duration: audioDuration    || undefined,
        audio_waveform: audioWaveform.length ? audioWaveform : undefined,
      };
      const d = await createFeedPost(payload);
      if (!d?.post) {
        setError(d?.error || 'Post failed — please try again.');
        return;
      }
      reset();
      onPosted(d.post);
    } catch (e: any) {
      setError(e.message || 'Failed to post. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <>
      {/* Trigger bar — always visible */}
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:border-navy-200 transition"
        onClick={() => { setExpanded(true); setTimeout(() => textRef.current?.focus(), 50); }}
      >
        <Avatar name={currentUserName} image={currentUserImage} size={10} />
        <span className="text-sm text-gray-400 flex-1">What's on your mind, {currentUserName.split(' ')[0]}?</span>
        <ImageIcon size={16} className="text-gray-300 shrink-0" />
      </div>

      {/* Modal overlay — portalled to body so fixed positioning is always viewport-relative */}
      {expanded && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={reset}
        >
          {/* petra-app-interior wrapper: rounded + overflow-hidden so corners clip cleanly;
               shadow-2xl lives here since box-shadow is not clipped by overflow-hidden */}
          <div
            className="petra-app-interior w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
          <div className="bg-white w-full max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Avatar name={currentUserName} image={currentUserImage} size={10} />
                <div>
                  <p className="text-sm font-bold text-navy-950">{currentUserName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      onClick={() => setVisibility('hub')}
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        visibility === 'hub'
                          ? 'bg-navy-700 text-white border-navy-700'
                          : 'border-gray-200 text-gray-500 hover:border-navy-300'
                      }`}
                    >
                      <Users size={9} /> My Hub
                    </button>
                    <button
                      onClick={() => setVisibility('global')}
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        visibility === 'global'
                          ? 'bg-navy-700 text-white border-navy-700'
                          : 'border-gray-200 text-gray-500 hover:border-navy-300'
                      }`}
                    >
                      <Globe size={9} /> Everyone
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={reset} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Type switcher */}
              <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
                <button
                  onClick={() => setPostType('text')}
                  className={`flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg transition ${
                    postType === 'text' ? 'bg-white text-navy-950 shadow-sm' : 'text-gray-500 hover:text-navy-900'
                  }`}
                >
                  Text
                </button>
                {TYPE_OPTIONS.map(t => (
                  <button
                    key={t.type}
                    onClick={() => { setPostType(t.type); setUploads([]); }}
                    className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 px-2 rounded-lg transition ${
                      postType === t.type ? 'bg-white text-navy-950 shadow-sm' : 'text-gray-500 hover:text-navy-900'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Text area */}
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={
                  postType === 'text'  ? "What's on your mind?" :
                  postType === 'image' ? 'Add a caption…'       :
                  postType === 'video' ? 'Add a description…'   :
                  postType === 'link'  ? 'Say something about this link…' :
                  postType === 'audio' ? 'Describe this audio…' :
                  'Ask a question…'
                }
                rows={postType === 'text' ? 3 : 2}
                className="w-full text-sm text-navy-950 placeholder-gray-400 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition resize-none"
              />

              {/* Image / Video */}
              {(postType === 'image' || postType === 'video') && (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={postType === 'image' ? 'image/*' : 'video/*'}
                    multiple={postType === 'image'}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {uploads.length === 0 ? (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition"
                    >
                      {postType === 'image' ? <ImageIcon size={28} /> : <Video size={28} />}
                      <span className="text-sm font-semibold">
                        {postType === 'image' ? 'Click to upload photos (up to 9)' : 'Click to upload video'}
                      </span>
                      <span className="text-xs">{postType === 'image' ? 'JPG, PNG, GIF, WebP — up to 25 MB each' : 'MP4, WebM — up to 200 MB'}</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {uploads.map((u, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative">
                          {u.url ? (
                            postType === 'image'
                              ? <img src={u.thumb_url ?? u.url} alt="" className="w-full h-full object-cover" />
                              : <video src={u.url} className="w-full h-full object-cover" />
                          ) : u.error ? (
                            <div className="w-full h-full flex items-center justify-center text-rose-500 text-xs p-1 text-center">{u.error}</div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-center">
                                <Loader2 size={16} className="animate-spin text-brand-gold mx-auto mb-1" />
                                <span className="text-[10px] text-gray-400">{u.progress}%</span>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => setUploads(p => p.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {postType === 'image' && uploads.length < 9 && (
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition"
                        >
                          <Plus size={20} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Link */}
              {postType === 'link' && (
                <div className="space-y-3">
                  {/* URL input */}
                  <div className="relative">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => { setLinkUrl(e.target.value); setLinkFetched(false); }}
                      placeholder="Paste a link — e.g. https://example.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:border-brand-gold transition pr-10"
                    />
                    {linkFetching && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-gold" />
                    )}
                  </div>

                  {/* Preview error */}
                  {linkFetchError && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{linkFetchError}</p>
                  )}

                  {/* Live preview card */}
                  {linkFetched && !linkFetching && (
                    <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                      {linkImage && (
                        <img
                          src={linkImage}
                          alt=""
                          className="w-full object-cover"
                          style={{ maxHeight: 200 }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="p-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${linkDomain}&sz=16`}
                            alt=""
                            className="w-3.5 h-3.5 rounded-sm"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{linkDomain}</p>
                        </div>
                        <input
                          type="text"
                          value={linkTitle}
                          onChange={e => setLinkTitle(e.target.value)}
                          placeholder="Title"
                          className="w-full text-sm font-bold text-navy-950 bg-transparent border-0 outline-none p-0 placeholder-gray-300"
                        />
                        <input
                          type="text"
                          value={linkDesc}
                          onChange={e => setLinkDesc(e.target.value)}
                          placeholder="Description"
                          className="w-full text-xs text-gray-500 bg-transparent border-0 outline-none p-0 mt-1 placeholder-gray-300"
                        />
                      </div>
                      {/* Dismiss preview */}
                      <button
                        onClick={() => resetLinkPreview()}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                        title="Remove preview"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Audio */}
              {postType === 'audio' && (
                <div className="space-y-3">
                  <input
                    ref={audioFileRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setAudioFile(f);
                      setAudioUrl(''); setAudioWaveform([]); setAudioDuration(0);
                      setAudioProgress(0); setAudioUploading(true); setError('');
                      try {
                        const res = await uploadFeedAudio(f, pct => setAudioProgress(pct));
                        setAudioUrl(res.url);
                        setAudioDuration(res.duration);
                        setAudioWaveform(res.waveform);
                      } catch (err: any) {
                        setError(`Audio upload failed: ${err.message}`);
                        setAudioFile(null);
                      } finally { setAudioUploading(false); setAudioProgress(null); }
                      e.target.value = '';
                    }}
                  />
                  {!audioFile ? (
                    <button
                      onClick={() => audioFileRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400 hover:border-brand-gold hover:text-brand-gold transition"
                    >
                      <Music size={30} />
                      <span className="text-sm font-semibold">Click to upload audio</span>
                      <span className="text-xs">MP3, WAV, AAC, OGG, FLAC — up to 50 MB</span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      {/* File name row */}
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50">
                        <Music size={15} className="text-brand-gold shrink-0" />
                        <span className="text-xs font-semibold text-navy-950 flex-1 truncate">{audioFile.name}</span>
                        <button
                          onClick={() => { setAudioFile(null); setAudioUrl(''); setAudioWaveform([]); setAudioDuration(0); setAudioProgress(null); setAudioUploading(false); }}
                          className="text-gray-400 hover:text-rose-500 transition shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      {/* Upload progress */}
                      {audioUploading && (
                        <div className="px-4 pb-3 pt-2 space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>Uploading…</span>
                            <span>{audioProgress ?? 0}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-gold transition-[width]"
                              style={{ width: `${audioProgress ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Waveform preview */}
                      {audioUrl && audioWaveform.length > 0 && (
                        <div className="px-0">
                          <AudioWaveformPlayer src={audioUrl} waveform={audioWaveform} duration={audioDuration} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Poll */}
              {postType === 'poll' && (
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => setPollOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        maxLength={120}
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy-950 focus:outline-none focus:border-brand-gold transition"
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removePollOption(i)} className="text-gray-300 hover:text-rose-500 transition shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <button onClick={addPollOption} className="flex items-center gap-1.5 text-xs font-semibold text-brand-gold hover:text-amber-600 transition">
                      <Plus size={13} /> Add option
                    </button>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 pb-5 border-t border-gray-100 pt-4">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || uploads.some(u => u.progress !== null) || audioUploading}
                className="px-6 py-2 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-white text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}

// ── Main SocialFeed ───────────────────────────────────────────────────────────

export default function SocialFeed({
  currentUserId, currentUserRole, currentUserName, currentUserImage,
}: SocialFeedProps) {
  const [posts,       setPosts]       = useState<FeedPost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(true);

  const LIMIT = 15;

  const load = useCallback(async (reset = false) => {
    const off = reset ? 0 : offset;
    if (!reset) setLoadingMore(true);
    try {
      const d = await fetchFeedPosts(off, LIMIT);
      const fetched: FeedPost[] = d.posts ?? [];
      setPosts(prev => reset ? fetched : [...prev, ...fetched]);
      setOffset(off + fetched.length);
      setHasMore(fetched.length === LIMIT);
    } catch (e: any) {
      setError(e.message || 'Could not load feed');
    } finally { setLoading(false); setLoadingMore(false); }
  }, [offset]);

  useEffect(() => { load(true); }, []);

  // Infinite scroll sentinel
  const sentinelRef   = useRef<HTMLDivElement>(null);
  const hasMoreRef    = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadRef       = useRef(load);
  useEffect(() => { hasMoreRef.current    = hasMore;    }, [hasMore]);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { loadRef.current       = load;       }, [load]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        loadRef.current();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const handlePosted = (post: FeedPost) => {
    setPosts(prev => [post, ...prev]);
  };

  const handleDeleted = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-brand-gold" />
    </div>
  );

  return (
    <div className="space-y-4">
      <PostComposer
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
        onPosted={handlePosted}
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-600 font-medium">
          {error}
        </div>
      )}

      {posts.length === 0 && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-2">
          <div className="text-4xl">🌱</div>
          <p className="font-bold text-navy-950">Nothing posted yet</p>
          <p className="text-sm text-gray-400">Be the first to share something with your hub!</p>
        </div>
      )}

      {posts.map(post => (
        <FeedCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserImage={currentUserImage}
          currentUserRole={currentUserRole}
          onDelete={handleDeleted}
        />
      ))}

      {/* Infinite scroll sentinel + end-of-feed indicator */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Loader2 size={20} className="animate-spin text-brand-gold" />}
        {!hasMore && posts.length > 0 && (
          <p className="text-[11px] text-gray-400 font-medium tracking-wide">— You're all caught up —</p>
        )}
      </div>
    </div>
  );
}
