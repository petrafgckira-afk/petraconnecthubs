import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Send, Search, CheckCheck, Smile, Paperclip,
  MoreVertical, Phone, Video, ShieldAlert,
  MessageSquare, Mic, ArrowLeft, Edit3, Users2, Check,
  Play, Pause, Square, X, Eye, Trash2,
  FileText, Image as ImageIcon, Camera, Headphones,
  UserCircle2, BarChart2, CalendarDays, Download, Plus, Minus, Expand,
} from 'lucide-react';
import { fetchConversations, fetchThread, fetchNewMessages, sendMessage, sendRichMessage, uploadFile, pollVote, sendAudioMessage, uploadAudio, fetchMembers, fetchEvents, deleteMessage, fetchUserProfile, markRead } from '../services/api';

/* ── Interfaces ─────────────────────────────────────────────────── */

interface ApiPartner {
  id: string;
  full_name: string;
  profession: string;
  profile_image?: string | null;
}

interface ReplyContext {
  id: string;
  senderName: string;
  content: string;
  messageType: string;
}

interface ApiMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  audio_url: string | null;
  waveform_data: string | null;
  is_read: number;
  is_mine: boolean;
  created_at: string;
  reply_to_id: string | null;
  reply_to_content: string | null;
  reply_to_sender_id: string | null;
  reply_to_sender_name: string | null;
  reply_to_message_type: string | null;
  reply_to_is_deleted: boolean;
  file_url: string | null;
  file_meta: string | null;
  poll_data?: { votes: number[]; my_vote: number | null; total_votes: number };
  delivered_at?: string | null;
  read_at?: string | null;
  _sendState?: 'sending' | 'sent' | 'failed';
}

interface ApiConversation {
  partner: ApiPartner;
  last_message: { content: string; created_at: string; sender_id: string; message_type?: string } | null;
  unread_count: number;
}

interface ApiMember {
  id: string;
  full_name: string;
  email: string;
  profession: string;
  bio: string;
  hub_name: string;
  profile_image: string | null;
}

interface ApiEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  hub_name: string;
  is_registered: boolean;
}

interface MessagesPageProps {
  currentUserId: string;
  initialPartnerId?: string | null;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatConvoTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatRecTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function msgTypePreview(content: string, type?: string): string {
  if (!type || type === 'text') return content;
  if (type === 'audio') return '🎤 Voice message';
  if (type === 'audio_file') return '🎤 Audio';
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎬 Video';
  if (type === 'document') return '📄 ' + content;
  if (type === 'poll') { try { return '📊 ' + (JSON.parse(content).question ?? 'Poll'); } catch { return '📊 Poll'; } }
  if (type === 'contact') { try { return '👤 ' + (JSON.parse(content).name ?? 'Contact'); } catch { return '👤 Contact'; } }
  if (type === 'event') { try { return '📅 ' + (JSON.parse(content).title ?? 'Event'); } catch { return '📅 Event'; } }
  return content;
}

/* ── Inline text formatter ─────────────────────────────────────────── */

type FmtSpan = { t: string; b?: true; i?: true; s?: true; c?: true };

function parseFormatted(text: string): FmtSpan[] {
  const regex = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  const spans: FmtSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) spans.push({ t: text.slice(last, m.index) });
    if (m[1] !== undefined) spans.push({ t: m[1], c: true });
    else if (m[2] !== undefined) spans.push({ t: m[2], b: true });
    else if (m[3] !== undefined) spans.push({ t: m[3], i: true });
    else if (m[4] !== undefined) spans.push({ t: m[4], s: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ t: text.slice(last) });
  return spans;
}

function FormattedText({ text, isMe }: { text: string; isMe: boolean }) {
  const base = `text-[12px] leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere ${isMe ? 'text-white' : 'text-navy-950'}`;
  const spans = parseFormatted(text);
  return (
    <p className={base}>
      {spans.map((sp, i) => {
        const cls = [
          sp.b ? 'font-bold' : '',
          sp.i ? 'italic' : '',
          sp.s ? 'line-through' : '',
          sp.c ? `font-mono text-[11px] px-1 py-0.5 rounded ${isMe ? 'bg-white/15' : 'bg-black/8'}` : '',
        ].filter(Boolean).join(' ');
        return cls ? <span key={i} className={cls}>{sp.t}</span> : <React.Fragment key={i}>{sp.t}</React.Fragment>;
      })}
    </p>
  );
}

/* ── Audio Player ──────────────────────────────────────────────────── */
function AudioPlayer({ src, isMe, waveform }: { src: string; isMe: boolean; waveform: number[] }) {
  const audioRef             = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const [duration, setDuration] = useState(0);
  const [current, setCurrent]   = useState(0);

  // Normalise bars: min height 15%, max 100%
  const bars = waveform.length > 0
    ? waveform
    : Array.from({ length: 40 }, (_, i) => 0.3 + Math.abs(Math.sin(i * 0.6)) * 0.5);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    a.currentTime = pct * a.duration;
    setProgress(pct * 100);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setCurrent(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
      />

      {/* Play / Pause */}
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition ${
          isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-navy-900 hover:bg-navy-800 text-white'
        }`}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Waveform bars — each bar takes equal share of available width */}
        <div
          onClick={seek}
          className="flex items-center gap-[1.5px] h-8 cursor-pointer w-full overflow-hidden"
        >
          {bars.map((amp, i) => {
            const played = (i / bars.length) * 100 <= progress;
            const height = 3 + amp * 25;
            return (
              <div
                key={i}
                className={`rounded-full transition-colors duration-75 ${
                  isMe
                    ? played ? 'bg-white'    : 'bg-white/25'
                    : played ? 'bg-navy-800' : 'bg-slate-300'
                }`}
                style={{ flex: '1 1 0', minWidth: '1.5px', maxWidth: '4px', height: `${height}px` }}
              />
            );
          })}
        </div>

        {/* Timer */}
        <span className={`text-[9px] font-mono leading-none ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
          {playing ? formatRecTime(Math.floor(current)) : formatRecTime(Math.floor(duration))}
        </span>
      </div>

      <Mic size={11} className={`shrink-0 ${isMe ? 'text-white/40' : 'text-gray-300'}`} />
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export default function MessagesPage({ currentUserId, initialPartnerId }: MessagesPageProps) {
  const [tab, setTab] = useState<'chats' | 'directory'>('chats');
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [directoryMembers, setDirectoryMembers] = useState<ApiMember[]>([]);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const markFailed = (id: string) => setFailedAvatars(prev => new Set([...prev, id]));
  const [activePartnerId, setActivePartnerId] = useState<string | null>(initialPartnerId ?? null);
  const [activePartnerInfo, setActivePartnerInfo] = useState<ApiPartner | null>(null);
  const [thread, setThread] = useState<ApiMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const [isRecording, setIsRecording]   = useState(false);
  const [recSeconds, setRecSeconds]     = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [partnerMenuPos, setPartnerMenuPos]     = useState<{ top: number; left: number; url: string | null; name: string } | null>(null);
  const [viewingPartnerPhoto, setViewingPartnerPhoto] = useState<{ url: string | null; name: string } | null>(null);
  const [viewingPartnerPhotoFailed, setViewingPartnerPhotoFailed] = useState(false);

  const scrollRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const emojiRef         = useRef<HTMLDivElement>(null);
  const activePartnerRef = useRef<string | null>(initialPartnerId ?? null);
  const mediaRecRef      = useRef<MediaRecorder | null>(null);
  const audioChunks      = useRef<Blob[]>([]);
  const recTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownMsgIds     = useRef(new Set<string>());
  const lastMsgTime     = useRef<string>('');
  const isNearBottom    = useRef(true);
  const partnerMenuRef  = useRef<HTMLDivElement>(null);

  // Message delete state
  const [hoveredMsgId, setHoveredMsgId]           = useState<string | null>(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [retractPopupPos, setRetractPopupPos]       = useState<{ top: number; left: number } | null>(null);
  const [deletingMsgId, setDeletingMsgId]           = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyContext | null>(null);
  const replyingToRef               = useRef<ReplyContext | null>(null);

  // Attachment menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachMenuPos, setAttachMenuPos]   = useState<{ bottom: number; left: number } | null>(null);
  const attachMenuRef  = useRef<HTMLDivElement>(null);
  const attachBtnRef   = useRef<HTMLButtonElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const audioInputRef  = useRef<HTMLInputElement>(null);

  // File upload progress
  const [uploadingFile, setUploadingFile] = useState(false);

  // Camera
  const [showCamera, setShowCamera]   = useState(false);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Contact picker
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch]         = useState('');

  // Poll creator
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion]       = useState('');
  const [pollOptions, setPollOptions]         = useState(['', '']);
  const [sendingPoll, setSendingPoll]         = useState(false);

  // Event picker
  const [showEventPicker, setShowEventPicker]       = useState(false);
  const [pickerEvents, setPickerEvents]             = useState<ApiEvent[]>([]);
  const [loadingPickerEvents, setLoadingPickerEvents] = useState(false);
  const [eventSearch, setEventSearch]               = useState('');
  const [viewingProfile, setViewingProfile]         = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile]         = useState(false);
  const [viewingProfileImgFailed, setViewingProfileImgFailed] = useState(false);

  /* ── Sync active partner ref ───────── */
  useEffect(() => {
    activePartnerRef.current = activePartnerId;
  }, [activePartnerId]);

  /* ── Sync replyingTo ref (used inside async recorder.onstop) ── */
  useEffect(() => {
    replyingToRef.current = replyingTo;
  }, [replyingTo]);

  /* ── Close partner photo menu on outside click ── */
  useEffect(() => {
    if (!partnerMenuPos) return;
    const handler = (e: MouseEvent) => {
      if (partnerMenuRef.current && !partnerMenuRef.current.contains(e.target as Node))
        setPartnerMenuPos(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [partnerMenuPos]);

  /* ── Open partner avatar menu ── */
  const handlePartnerAvatarClick = (e: React.MouseEvent, url: string | null | undefined, name: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPartnerMenuPos({ top: rect.bottom + 6, left: rect.left, url: url ?? null, name });
  };

  /* ── Initial data load ─────────────── */
  useEffect(() => {
    fetchConversations().then(d => setConversations(d.conversations || [])).catch(() => {});
    fetchMembers().then(d => setDirectoryMembers(d.members || [])).catch(() => {});
  }, []);


  /* ── Load full thread on partner switch ── */
  const loadThread = useCallback((partnerId: string) => {
    knownMsgIds.current = new Set();
    lastMsgTime.current = '';
    setLoadingThread(true);
    fetchThread(partnerId)
      .then(data => {
        const msgs: ApiMessage[] = data.messages || [];
        setThread(msgs);
        msgs.forEach(m => knownMsgIds.current.add(m.id));
        lastMsgTime.current = msgs.length > 0
          ? msgs[msgs.length - 1].created_at
          : new Date().toISOString().replace('T', ' ').slice(0, 19);
        if (data.partner) setActivePartnerInfo(data.partner);
        // Mark all messages in this thread as read
        markRead(partnerId);
      })
      .catch(() => {
        setThread([]);
        lastMsgTime.current = new Date().toISOString().replace('T', ' ').slice(0, 19);
      })
      .finally(() => setLoadingThread(false));
  }, []);

  useEffect(() => {
    if (!activePartnerId) return;
    loadThread(activePartnerId);
    setConversations(prev =>
      prev.map(c => c.partner.id === activePartnerId ? { ...c, unread_count: 0 } : c)
    );
  }, [activePartnerId, loadThread]);

  /* ── Poll active thread every 2 s ──── */
  useEffect(() => {
    const interval = setInterval(async () => {
      const partnerId = activePartnerRef.current;
      const since     = lastMsgTime.current;
      if (!partnerId || !since) return;
      try {
        const data = await fetchNewMessages(partnerId, since);
        const allFetched: ApiMessage[] = data.messages || [];
        const incoming = allFetched.filter(m => !knownMsgIds.current.has(m.id));

        // Refresh delivered_at/read_at on existing sent messages.
        // Skip only messages actively sending or failed (not 'sent').
        setThread(prev => {
          const updatedMap = new Map(allFetched.map(m => [m.id, m]));
          const refreshed = prev.map(m =>
            updatedMap.has(m.id) && m._sendState !== 'sending' && m._sendState !== 'failed'
              ? { ...m, delivered_at: updatedMap.get(m.id)!.delivered_at, read_at: updatedMap.get(m.id)!.read_at }
              : m
          );
          if (incoming.length === 0) return refreshed;
          incoming.forEach(m => knownMsgIds.current.add(m.id));
          lastMsgTime.current = incoming[incoming.length - 1].created_at;
          return [...refreshed, ...incoming];
        });

        if (incoming.length > 0) {
          const last = incoming[incoming.length - 1];
          setConversations(prev => prev.map(c =>
            c.partner.id === partnerId
              ? { ...c, last_message: { content: last.content, created_at: last.created_at, sender_id: last.sender_id } }
              : c
          ));
          // Mark incoming messages as read (tab is active)
          if (document.visibilityState === 'visible') markRead(partnerId);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []); // mount-once — reads refs, not state

  /* ── Poll conversation list every 5 s ─ */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetchConversations();
        setConversations((data.conversations || []).map((c: ApiConversation) => ({
          ...c,
          unread_count: c.partner.id === activePartnerRef.current ? 0 : c.unread_count,
        })));
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []); // mount-once

  /* ── Auto-scroll (only when near bottom) ── */
  const handleChatScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottom.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  useEffect(() => {
    if (isNearBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [thread]);

  /* ── Close emoji picker on outside click ── */
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node))
        setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  /* ── Close attach menu on outside click ── */
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node) &&
          attachBtnRef.current && !attachBtnRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAttachMenu]);

  /* ── Assign camera stream to video element once modal mounts ── */
  useEffect(() => {
    if (showCamera && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [showCamera]);

  /* ── Stop camera stream on unmount ── */
  useEffect(() => {
    return () => { cameraStreamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  /* ── Fetch events when event picker opens ── */
  useEffect(() => {
    if (!showEventPicker) return;
    setLoadingPickerEvents(true);
    fetchEvents()
      .then(d => setPickerEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoadingPickerEvents(false));
  }, [showEventPicker]);

  /* ── Handlers ────────────────────── */

  /* ── Voice recording ─────────────────── */
  const startRecording = async () => {
    if (!activePartnerId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });

        // Extract real amplitude waveform from the recorded blob
        let waveformData: number[] = [];
        try {
          const audioCtx   = new AudioContext();
          const arrayBuf   = await blob.arrayBuffer();
          const audioBuf   = await audioCtx.decodeAudioData(arrayBuf);
          audioCtx.close();
          const channel    = audioBuf.getChannelData(0);
          const numBars    = 50;
          const blockSize  = Math.floor(channel.length / numBars);
          const raw: number[] = [];
          for (let i = 0; i < numBars; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) sum += Math.abs(channel[i * blockSize + j] || 0);
            raw.push(sum / blockSize);
          }
          const maxVal = Math.max(...raw, 0.001);
          waveformData = raw.map(v => Math.round((v / maxVal) * 100) / 100);
        } catch { /* keep empty — AudioPlayer will use a fallback */ }

        const replyId = replyingToRef.current?.id ?? undefined;
        setUploadingAudio(true);
        try {
          const url  = await uploadAudio(blob);
          const data = await sendAudioMessage(activePartnerRef.current!, url, waveformData, replyId);
          if (data.message) {
            knownMsgIds.current.add(data.message.id);
            lastMsgTime.current = data.message.created_at;
            setThread(prev => [...prev, data.message]);
            setConversations(prev => {
              const payload = { content: '🎤 Voice message', created_at: data.message.created_at, sender_id: data.message.sender_id };
              return prev.map(c => c.partner.id === activePartnerRef.current ? { ...c, last_message: payload } : c);
            });
            setReplyingTo(null);
          }
        } catch { /* silent fail */ }
        finally { setUploadingAudio(false); }
      };
      mediaRecRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access in your browser.');
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setIsRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecRef.current) {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stop();
    }
    audioChunks.current = [];
    setIsRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const doSendText = useCallback(async (text: string, replyId: string | undefined, tempId: string, partnerId: string) => {
    try {
      const data = await sendMessage(partnerId, text, replyId);
      if (data.message) {
        knownMsgIds.current.delete(tempId);
        knownMsgIds.current.add(data.message.id);
        lastMsgTime.current = data.message.created_at;
        setThread(prev => prev.map(m =>
          m.id === tempId ? { ...data.message, _sendState: 'sent' } : m
        ));
        setConversations(prev => {
          const payload = { content: text, created_at: data.message.created_at, sender_id: currentUserId };
          const exists = prev.some(c => c.partner.id === partnerId);
          const updated = prev.map(c => c.partner.id === partnerId ? { ...c, last_message: payload } : c);
          if (!exists && activePartnerInfo)
            return [{ partner: activePartnerInfo, last_message: payload, unread_count: 0 }, ...updated];
          return updated;
        });
      }
    } catch {
      setThread(prev => prev.map(m => m.id === tempId ? { ...m, _sendState: 'failed' } : m));
    }
  }, [currentUserId, activePartnerInfo]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !activePartnerId) return;
    const replyId = replyingTo?.id ?? undefined;
    setMessageText('');
    setShowEmojiPicker(false);
    setReplyingTo(null);

    const tempId = `temp_${Date.now()}`;
    const tempMsg: ApiMessage = {
      id: tempId, sender_id: currentUserId, receiver_id: activePartnerId,
      content: text, message_type: 'text', audio_url: null, waveform_data: null,
      is_read: 0, is_mine: true, _sendState: 'sending',
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      reply_to_id: replyId ?? null, reply_to_content: null, reply_to_sender_id: null,
      reply_to_sender_name: null, reply_to_message_type: null, reply_to_is_deleted: false,
      file_url: null, file_meta: null, delivered_at: null, read_at: null,
    };
    knownMsgIds.current.add(tempId);
    setThread(prev => [...prev, tempMsg]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    doSendText(text, replyId, tempId, activePartnerId);
  };

  const handleRetry = useCallback((failedMsg: ApiMessage) => {
    const partnerId = activePartnerRef.current;
    if (!partnerId) return;
    setThread(prev => prev.map(m => m.id === failedMsg.id ? { ...m, _sendState: 'sending' as const } : m));
    doSendText(failedMsg.content, failedMsg.reply_to_id ?? undefined, failedMsg.id, partnerId);
  }, [doSendText]);

  const handleSelectPartner = (partnerId: string, partnerInfo?: ApiPartner) => {
    if (partnerInfo) setActivePartnerInfo(partnerInfo);
    setActivePartnerId(partnerId);
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    setDeletingMsgId(msgId);
    try {
      await deleteMessage(msgId);
      setThread(prev => {
        const updated = prev.filter(m => m.id !== msgId);
        // Update sidebar last-message preview optimistically
        const last = updated.slice(-1)[0];
        setConversations(convs => convs.map(c => {
          if (c.partner.id !== activePartnerId) return c;
          return {
            ...c,
            last_message: last
              ? { content: last.content, created_at: last.created_at, sender_id: last.sender_id }
              : null,
          };
        }));
        return updated;
      });
      setConfirmDeleteMsgId(null);
      setRetractPopupPos(null);
      setHoveredMsgId(null);
    } catch {
      // Leave confirm popup open so the user knows the retract failed
    } finally {
      setDeletingMsgId(null);
    }
  };

  /* ── Attachment menu ─────────────────────────────── */
  const handleAttachClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAttachMenuPos({ bottom: window.innerHeight - rect.top + 10, left: rect.left });
    setShowAttachMenu(prev => !prev);
  };

  /* ── Upload + send a file ─────────────────────────── */
  const uploadAndSend = async (file: File | Blob, type: 'document' | 'image' | 'video' | 'audio', name?: string) => {
    if (!activePartnerId) return;
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    setUploadingFile(true);
    try {
      const result  = await uploadFile(file, type, name ?? (file instanceof File ? file.name : 'upload'));
      const msgType = type === 'audio' ? 'audio_file' : type;
      const data    = await sendRichMessage(activePartnerId, {
        message_type: msgType,
        file_url: result.url,
        file_meta: JSON.stringify({ name: result.name, size: result.size, mime: result.mime }),
        content: result.name,
        ...(replyId ? { reply_to_id: replyId } : {}),
      });
      if (data.message) {
        knownMsgIds.current.add(data.message.id);
        lastMsgTime.current = data.message.created_at;
        setThread(prev => [...prev, data.message]);
        const preview = msgTypePreview(result.name, msgType);
        setConversations(prev => {
          const payload = { content: preview, created_at: data.message.created_at, sender_id: currentUserId, message_type: msgType };
          const exists  = prev.some(c => c.partner.id === activePartnerId);
          const updated = prev.map(c => c.partner.id === activePartnerId ? { ...c, last_message: payload } : c);
          if (!exists && activePartnerInfo) return [{ partner: activePartnerInfo, last_message: payload, unread_count: 0 }, ...updated];
          return updated;
        });
      }
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Server error'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const actualType = type === 'image' && file.type.startsWith('video/') ? 'video' : type;
    uploadAndSend(file, actualType as any);
  };

  /* ── Camera ────────────────────────────────────────── */
  const openCamera = async () => {
    setShowAttachMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      cameraStreamRef.current = stream;
      setShowCamera(true);
    } catch {
      alert('Camera access denied. Please allow camera access in your browser settings.');
    }
  };
  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
  };
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stopCamera();
      setShowCamera(false);
      uploadAndSend(blob, 'image', 'camera-photo.jpg');
    }, 'image/jpeg', 0.92);
  };

  /* ── Contact ───────────────────────────────────────── */
  const handleSendContact = async (member: ApiMember) => {
    if (!activePartnerId) return;
    setShowContactPicker(false);
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    const contactJson = JSON.stringify({ id: member.id, name: member.full_name, profession: member.profession, hub: member.hub_name, profile_image: member.profile_image ?? null });
    try {
      const data = await sendRichMessage(activePartnerId, { message_type: 'contact', content: contactJson, ...(replyId ? { reply_to_id: replyId } : {}) });
      if (data.message) {
        knownMsgIds.current.add(data.message.id);
        lastMsgTime.current = data.message.created_at;
        setThread(prev => [...prev, data.message]);
        const preview = '👤 ' + member.full_name;
        setConversations(prev => prev.map(c => c.partner.id === activePartnerId ? { ...c, last_message: { content: preview, created_at: data.message.created_at, sender_id: currentUserId, message_type: 'contact' } } : c));
      }
    } catch {}
  };

  const openContactProfile = async (userId: string) => {
    setLoadingProfile(true);
    setViewingProfileImgFailed(false);
    setViewingProfile({ _loading: true });
    try {
      const data = await fetchUserProfile(userId);
      setViewingProfile(data.user ?? data);
    } catch {
      setViewingProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  /* ── Poll ──────────────────────────────────────────── */
  const handlePollSubmit = async () => {
    const question = pollQuestion.trim();
    const options  = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!question || options.length < 2 || !activePartnerId) return;
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    setSendingPoll(true);
    try {
      const data = await sendRichMessage(activePartnerId, { message_type: 'poll', question, options, ...(replyId ? { reply_to_id: replyId } : {}) });
      if (data.message) {
        knownMsgIds.current.add(data.message.id);
        lastMsgTime.current = data.message.created_at;
        setThread(prev => [...prev, data.message]);
        setConversations(prev => prev.map(c => c.partner.id === activePartnerId ? { ...c, last_message: { content: '📊 ' + question, created_at: data.message.created_at, sender_id: currentUserId, message_type: 'poll' } } : c));
      }
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch { alert('Failed to create poll. Please try again.'); }
    finally { setSendingPoll(false); }
  };

  const handlePollVote = async (messageId: string, optionIndex: number) => {
    try {
      const data = await pollVote(messageId, optionIndex);
      setThread(prev => prev.map(m => m.id !== messageId ? m : { ...m, poll_data: { votes: data.votes, my_vote: data.my_vote, total_votes: data.total_votes } }));
    } catch {}
  };

  /* ── Event ─────────────────────────────────────────── */
  const handleSendEvent = async (evt: ApiEvent) => {
    if (!activePartnerId) return;
    setShowEventPicker(false);
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    const eventJson = JSON.stringify({ id: evt.id, title: evt.title, date: evt.date, time: evt.time, location: evt.location });
    try {
      const data = await sendRichMessage(activePartnerId, { message_type: 'event', content: eventJson, ...(replyId ? { reply_to_id: replyId } : {}) });
      if (data.message) {
        knownMsgIds.current.add(data.message.id);
        lastMsgTime.current = data.message.created_at;
        setThread(prev => [...prev, data.message]);
        setConversations(prev => prev.map(c => c.partner.id === activePartnerId ? { ...c, last_message: { content: '📅 ' + evt.title, created_at: data.message.created_at, sender_id: currentUserId, message_type: 'event' } } : c));
      }
    } catch {}
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.backgroundColor = 'rgba(251,191,36,0.22)';
    setTimeout(() => { el.style.backgroundColor = ''; }, 1300);
  };

  const handleMessageDoubleClick = (msg: ApiMessage) => {
    const senderName = msg.is_mine ? 'You' : (displayPartner?.full_name ?? 'Unknown');
    const content    = msgTypePreview(msg.content, msg.message_type);
    setReplyingTo({ id: msg.id, senderName, content, messageType: msg.message_type });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* ── Computed values ─────────────── */

  const displayPartner = conversations.find(c => c.partner.id === activePartnerId)?.partner ?? activePartnerInfo;

  const filteredConvos = conversations.filter(c =>
    c.partner.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMembers = directoryMembers.filter(m =>
    m.id !== currentUserId &&
    (m.full_name.toLowerCase().includes(search.toLowerCase()) ||
     m.profession.toLowerCase().includes(search.toLowerCase()) ||
     m.hub_name.toLowerCase().includes(search.toLowerCase()))
  );

  // Insert date dividers into the message thread
  const groupedThread: Array<{ type: 'divider'; label: string } | { type: 'message'; msg: ApiMessage }> = [];
  let lastDateLabel = '';
  for (const msg of thread) {
    const label = getDateLabel(msg.created_at);
    if (label !== lastDateLabel) {
      groupedThread.push({ type: 'divider', label });
      lastDateLabel = label;
    }
    groupedThread.push({ type: 'message', msg });
  }

  /* ── Render ──────────────────────── */

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex animate-fade-in font-sans">

      {/* ────────── LEFT PANEL ────────── */}
      <aside className={`w-full md:w-[320px] flex flex-col border-r border-slate-100 shrink-0 ${activePartnerId ? 'hidden md:flex' : 'flex'}`}>

        {/* Panel header */}
        <div className="bg-navy-950 px-4 py-3.5 flex justify-between items-center shrink-0">
          <h2 className="font-serif font-bold text-white text-sm tracking-tight">Messages</h2>
          <button className="text-gray-400 hover:text-brand-gold transition p-1 rounded-lg" title="New chat">
            <Edit3 size={15} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2 bg-navy-950/95 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chats or people..."
              className="w-full bg-navy-900/70 border border-navy-800 rounded-lg py-2 pl-8 pr-3 text-[11.5px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border-b border-slate-100 shrink-0">
          <button
            onClick={() => setTab('chats')}
            className={`flex-1 py-2.5 text-[11px] font-bold tracking-wider uppercase transition ${
              tab === 'chats'
                ? 'text-brand-gold border-b-2 border-brand-gold'
                : 'text-gray-400 hover:text-navy-900'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setTab('directory')}
            className={`flex-1 py-2.5 text-[11px] font-bold tracking-wider uppercase transition flex items-center justify-center gap-1 ${
              tab === 'directory'
                ? 'text-brand-gold border-b-2 border-brand-gold'
                : 'text-gray-400 hover:text-navy-900'
            }`}
          >
            <Users2 size={12} /> Directory
          </button>
        </div>

        {/* Tab content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">

          {tab === 'chats' ? (
            filteredConvos.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare size={24} className="mx-auto text-gray-300" />
                <p className="text-gray-400 text-xs italic">
                  No conversations yet.<br />Switch to Directory to start chatting.
                </p>
              </div>
            ) : (
              filteredConvos.map(convo => {
                const isActive = convo.partner.id === activePartnerId;
                return (
                  <button
                    key={convo.partner.id}
                    onClick={() => handleSelectPartner(convo.partner.id, convo.partner)}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition duration-100 ${
                      isActive ? 'bg-brand-gold/10 border-l-[3px] border-brand-gold' : 'hover:bg-gray-50 border-l-[3px] border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {convo.partner.profile_image && !failedAvatars.has(convo.partner.id) ? (
                        <img
                          src={convo.partner.profile_image}
                          alt={convo.partner.full_name}
                          onClick={e => handlePartnerAvatarClick(e, convo.partner.profile_image, convo.partner.full_name)}
                          className="w-11 h-11 rounded-full border-2 border-brand-gold object-cover shadow-sm cursor-pointer"
                          onError={() => markFailed(convo.partner.id)}
                        />
                      ) : (
                        <div
                          onClick={e => handlePartnerAvatarClick(e, null, convo.partner.full_name)}
                          className="w-11 h-11 rounded-full bg-navy-950 border-2 border-brand-gold text-white font-bold font-serif text-xs flex items-center justify-center shadow-sm cursor-pointer"
                        >
                          {getInitials(convo.partner.full_name)}
                        </div>
                      )}
                      {/* Online dot (decorative) */}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1">
                        <span className="font-bold text-xs text-navy-950 truncate">{convo.partner.full_name}</span>
                        <span className="text-[9px] text-gray-400 font-mono shrink-0">
                          {convo.last_message ? formatConvoTime(convo.last_message.created_at) : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{convo.partner.profession} Hub</p>
                      {convo.last_message && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {convo.last_message.sender_id !== convo.partner.id && (
                            <CheckCheck size={10} className="inline mr-0.5 text-brand-gold" />
                          )}
                          {msgTypePreview(convo.last_message.content, convo.last_message.message_type)}
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {convo.unread_count > 0 && (
                      <span className="bg-brand-gold text-navy-950 text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-sm shrink-0">
                        {convo.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )
          ) : (
            /* Directory tab */
            filteredMembers.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Users2 size={24} className="mx-auto text-gray-300" />
                <p className="text-gray-400 text-xs italic">No members found.</p>
              </div>
            ) : (
              filteredMembers.map(member => {
                const isActive = member.id === activePartnerId;
                const partnerInfo: ApiPartner = { id: member.id, full_name: member.full_name, profession: member.profession };
                return (
                  <button
                    key={member.id}
                    onClick={() => handleSelectPartner(member.id, partnerInfo)}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition duration-100 ${
                      isActive ? 'bg-brand-gold/10 border-l-[3px] border-brand-gold' : 'hover:bg-gray-50 border-l-[3px] border-transparent'
                    }`}
                  >
                    {member.profile_image && !failedAvatars.has(member.id) ? (
                      <img
                        src={member.profile_image}
                        alt={member.full_name}
                        onClick={e => handlePartnerAvatarClick(e, member.profile_image, member.full_name)}
                        className="w-11 h-11 rounded-full border border-brand-gold/50 object-cover shrink-0 cursor-pointer"
                        onError={() => markFailed(member.id)}
                      />
                    ) : (
                      <div
                        onClick={e => handlePartnerAvatarClick(e, null, member.full_name)}
                        className="w-11 h-11 rounded-full bg-navy-950 border border-brand-gold/50 text-white font-bold font-serif text-xs flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        {getInitials(member.full_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-xs text-navy-950 block truncate">{member.full_name}</span>
                      <span className="text-[10px] text-gray-400">{member.profession} • {member.hub_name}</span>
                    </div>
                    <span className="text-[9px] text-brand-gold font-bold border border-brand-gold/40 rounded-full px-2 py-0.5 shrink-0">Chat</span>
                  </button>
                );
              })
            )
          )}
        </div>
      </aside>

      {/* ────────── RIGHT PANEL (CHAT) ────────── */}
      <section className={`flex-1 flex flex-col min-w-0 ${activePartnerId ? 'flex' : 'hidden md:flex'}`}>
        {activePartnerId && displayPartner ? (
          <>
            {/* Chat header */}
            <div className="bg-navy-950 px-4 py-3 flex justify-between items-center shrink-0 border-b border-navy-900">
              <div className="flex items-center gap-3">
                {/* Mobile back */}
                <button
                  onClick={() => setActivePartnerId(null)}
                  className="md:hidden text-gray-400 hover:text-white transition p-1 -ml-1"
                >
                  <ArrowLeft size={18} />
                </button>
                {/* Avatar */}
                <div className="relative">
                  {displayPartner.profile_image && !failedAvatars.has(displayPartner.id) ? (
                    <img
                      src={displayPartner.profile_image}
                      alt={displayPartner.full_name}
                      onClick={e => handlePartnerAvatarClick(e, displayPartner.profile_image, displayPartner.full_name)}
                      className="w-9 h-9 rounded-full border border-brand-gold object-cover cursor-pointer"
                      onError={() => markFailed(displayPartner.id)}
                    />
                  ) : (
                    <div
                      onClick={e => handlePartnerAvatarClick(e, null, displayPartner.full_name)}
                      className="w-9 h-9 rounded-full bg-brand-gold/20 border border-brand-gold text-brand-gold font-bold font-serif text-xs flex items-center justify-center cursor-pointer"
                    >
                      {getInitials(displayPartner.full_name)}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-950" />
                </div>
                {/* Name & status */}
                <div>
                  <h4 className="font-bold text-sm text-white leading-tight">{displayPartner.full_name}</h4>
                  <span className="text-[9px] text-emerald-400 leading-none font-medium">
                    Online • {displayPartner.profession} Hub
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 text-gray-400">
                <button className="p-2 hover:text-brand-gold transition rounded-lg" title="Voice call">
                  <Phone size={15} />
                </button>
                <button className="p-2 hover:text-brand-gold transition rounded-lg" title="Video call">
                  <Video size={15} />
                </button>
                <button className="p-2 hover:text-brand-gold transition rounded-lg" title="More options">
                  <MoreVertical size={15} />
                </button>
              </div>
            </div>

            {/* Message thread */}
            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#f8fafc',
              }}
            >
              {loadingThread ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 text-xs animate-pulse">Loading messages...</span>
                </div>
              ) : thread.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm">
                    <MessageSquare size={24} className="text-gray-300" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold text-navy-950 text-sm">{displayPartner.full_name}</p>
                    <p className="text-gray-400 text-xs">
                      No messages yet. Send a greeting to start the conversation!
                    </p>
                  </div>
                </div>
              ) : (
                groupedThread.map((item, idx) => {
                  if (item.type === 'divider') {
                    return (
                      <div key={`div-${idx}`} className="flex items-center justify-center my-4">
                        <span className="bg-white/80 border border-slate-200 text-gray-500 text-[10px] font-medium px-3 py-1 rounded-full shadow-xs backdrop-blur-sm">
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  const { msg } = item;
                  const isMe = msg.is_mine;

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex flex-col mb-1 ${isMe ? 'items-end' : 'items-start'}`}
                      style={{ transition: 'background-color 0.4s ease' }}
                    >
                      {/* Message row */}
                      <div
                        className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                        onMouseEnter={() => { if (isMe) setHoveredMsgId(msg.id); }}
                        onMouseLeave={() => { if (isMe) setHoveredMsgId(null); }}
                      >
                        {/* Retract button — floats to the left of sent bubbles on hover */}
                        {isMe && (
                          <button
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setRetractPopupPos({ top: rect.top, left: rect.left });
                              setConfirmDeleteMsgId(msg.id);
                            }}
                            title="Retract message"
                            className={`p-1 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shrink-0 self-center ${
                              hoveredMsgId === msg.id && confirmDeleteMsgId !== msg.id
                                ? 'opacity-100'
                                : 'opacity-0 pointer-events-none'
                            }`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {/* Partner avatar — only for received messages */}
                        {!isMe && (
                          displayPartner.profile_image ? (
                            <img
                              src={displayPartner.profile_image}
                              alt={displayPartner.full_name}
                              onClick={e => handlePartnerAvatarClick(e, displayPartner.profile_image, displayPartner.full_name)}
                              className="w-7 h-7 rounded-full border border-brand-gold/40 object-cover shrink-0 mb-0.5 cursor-pointer"
                            />
                          ) : (
                            <div
                              onClick={e => handlePartnerAvatarClick(e, null, displayPartner.full_name)}
                              className="w-7 h-7 rounded-full bg-navy-950 border border-brand-gold/40 text-white font-bold font-serif text-[9px] flex items-center justify-center shrink-0 mb-0.5 cursor-pointer"
                            >
                              {getInitials(displayPartner.full_name)}
                            </div>
                          )
                        )}

                        {/* Bubble */}
                        <div
                          onDoubleClick={() => handleMessageDoubleClick(msg)}
                          className={`relative px-3.5 py-2.5 shadow-sm select-none ${
                            ['text'].includes(msg.message_type) ? 'max-w-[72%]' :
                            ['image','video'].includes(msg.message_type) ? 'max-w-[78%]' :
                            'max-w-[82%]'
                          } ${
                            msg.message_type === 'audio' ? 'min-w-[200px]' : ''
                          } ${
                            isMe
                              ? 'bg-navy-900 text-white rounded-2xl rounded-br-[4px]'
                              : 'bg-white text-navy-950 border border-slate-150 rounded-2xl rounded-bl-[4px]'
                          }`}
                        >
                          {/* Quoted reply block — shown when this is a reply */}
                          {msg.reply_to_id && (
                            <div
                              onClick={e => { e.stopPropagation(); scrollToMessage(msg.reply_to_id!); }}
                              className={`mb-2 border-l-[3px] rounded-r-lg px-2.5 py-1.5 cursor-pointer ${
                                isMe ? 'border-white/35 bg-white/10' : 'border-amber-500 bg-amber-50/80'
                              }`}
                            >
                              <span className={`text-[9px] font-bold block leading-tight ${isMe ? 'text-amber-300' : 'text-amber-700'}`}>
                                {msg.reply_to_sender_id === currentUserId ? 'You' : (msg.reply_to_sender_name ?? 'Unknown')}
                              </span>
                              <span className={`text-[10px] block leading-snug mt-0.5 ${isMe ? 'text-white/55' : 'text-gray-500'} ${msg.reply_to_is_deleted ? 'italic' : 'truncate'}`}>
                                {msg.reply_to_is_deleted
                                  ? 'Message retracted'
                                  : msgTypePreview(msg.reply_to_content ?? '', msg.reply_to_message_type ?? 'text')}
                              </span>
                            </div>
                          )}

                          {msg.message_type === 'audio' && msg.audio_url ? (
                            <AudioPlayer src={msg.audio_url} isMe={isMe} waveform={msg.waveform_data ? JSON.parse(msg.waveform_data) : []} />
                          ) : msg.message_type === 'audio_file' && msg.file_url ? (
                            <div>
                              <p className={`text-[9px] font-medium truncate mb-1.5 ${isMe ? 'text-white/55' : 'text-gray-400'}`}>
                                {msg.file_meta ? (JSON.parse(msg.file_meta).name ?? 'Audio') : 'Audio'}
                              </p>
                              <AudioPlayer src={msg.file_url} isMe={isMe} waveform={[]} />
                            </div>
                          ) : msg.message_type === 'image' && msg.file_url ? (
                            <div className="relative -mx-0.5 -mt-0.5">
                              <img src={msg.file_url} alt="Photo" className="max-w-full rounded-xl max-h-[270px] object-contain w-full block" />
                              <a href={msg.file_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                 className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
                                <Download size={12} />
                              </a>
                            </div>
                          ) : msg.message_type === 'video' && msg.file_url ? (
                            <div className="relative -mx-0.5 -mt-0.5">
                              <video src={msg.file_url} controls className="max-w-full rounded-xl max-h-[220px] w-full object-contain block" />
                              <a href={msg.file_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                 className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
                                <Download size={12} />
                              </a>
                            </div>
                          ) : msg.message_type === 'document' && msg.file_url ? (() => {
                            const meta = msg.file_meta ? JSON.parse(msg.file_meta) : {};
                            const ext  = (meta.name?.split('.').pop() ?? 'FILE').toUpperCase();
                            return (
                              <div className="flex items-start gap-3 min-w-[200px] max-w-full">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isMe ? 'bg-white/20' : 'bg-navy-900/10'}`}>
                                  <FileText size={20} className={isMe ? 'text-white' : 'text-navy-900'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold leading-snug break-all">{meta.name ?? 'Document'}</p>
                                  <p className={`text-[9px] mt-0.5 ${isMe ? 'text-white/50' : 'text-gray-400'}`}>{formatFileSize(meta.size ?? 0)} · {ext}</p>
                                </div>
                                <a href={msg.file_url} download={meta.name} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                   className={`p-1.5 rounded-full shrink-0 transition ${isMe ? 'text-white/65 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-navy-900 hover:bg-slate-100'}`}>
                                  <Download size={15} />
                                </a>
                              </div>
                            );
                          })() : msg.message_type === 'contact' ? (() => {
                            let c: any = {};
                            try { c = JSON.parse(msg.content); } catch {}
                            return (
                              <div className="min-w-[200px] max-w-full">
                                <div className="flex items-center gap-2.5 mb-2.5">
                                  {c.profile_image && !failedAvatars.has(c.id)
                                    ? <img src={c.profile_image} alt={c.name} className="w-10 h-10 rounded-full object-cover border border-brand-gold/40 shrink-0" onError={() => c.id && markFailed(c.id)} />
                                    : <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold font-serif text-xs ${isMe ? 'bg-white/20 text-white' : 'bg-navy-900 text-white'}`}>{getInitials(c.name ?? '?')}</div>
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold leading-snug break-words">{c.name ?? 'Contact'}</p>
                                    <p className={`text-[9.5px] leading-snug mt-0.5 break-words ${isMe ? 'text-white/55' : 'text-gray-400'}`}>{c.profession}{c.hub ? ` · ${c.hub}` : ''}</p>
                                  </div>
                                </div>
                                <div className={`pt-2 border-t ${isMe ? 'border-white/15' : 'border-slate-100'}`}>
                                  <button onClick={e => { e.stopPropagation(); if (c.id) openContactProfile(c.id); }}
                                    className="text-[9.5px] font-bold text-brand-gold hover:text-amber-500 transition">
                                    View Profile →
                                  </button>
                                </div>
                              </div>
                            );
                          })() : msg.message_type === 'poll' ? (() => {
                            let pc: { question: string; options: string[] } = { question: '', options: [] };
                            try { pc = JSON.parse(msg.content); } catch {}
                            const pd = msg.poll_data ?? { votes: pc.options.map(() => 0), my_vote: null, total_votes: 0 };
                            return (
                              <div className="min-w-[220px] max-w-full w-full">
                                <p className="text-[12px] font-bold mb-2.5 leading-snug break-words">{pc.question}</p>
                                {pc.options.map((opt, i) => {
                                  const cnt   = pd.votes[i] ?? 0;
                                  const pct   = pd.total_votes > 0 ? Math.round((cnt / pd.total_votes) * 100) : 0;
                                  const voted = pd.my_vote === i;
                                  return (
                                    <button key={i} onClick={e => { e.stopPropagation(); handlePollVote(msg.id, i); }}
                                      className={`w-full text-left rounded-lg px-3 py-2 mb-1.5 relative overflow-hidden transition-all ${voted ? (isMe ? 'ring-1 ring-white/40 bg-white/25' : 'ring-1 ring-amber-400 bg-amber-50') : (isMe ? 'bg-white/10 hover:bg-white/18' : 'bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200')}`}>
                                      <div className="absolute inset-y-0 left-0 rounded-l-lg transition-all duration-500"
                                           style={{ width: `${pct}%`, background: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(251,191,36,0.18)' }} />
                                      <span className="relative flex justify-between items-start gap-2">
                                        <span className={`text-[11px] leading-snug break-words flex-1 ${voted ? 'font-bold' : ''}`}>{opt}</span>
                                        <span className={`text-[9px] shrink-0 font-mono pt-px ${isMe ? 'text-white/50' : 'text-gray-400'}`}>{pct}%</span>
                                      </span>
                                    </button>
                                  );
                                })}
                                <p className={`text-[9px] mt-1 ${isMe ? 'text-white/40' : 'text-gray-400'}`}>{pd.total_votes} vote{pd.total_votes !== 1 ? 's' : ''}</p>
                              </div>
                            );
                          })() : msg.message_type === 'event' ? (() => {
                            let ev: any = {};
                            try { ev = JSON.parse(msg.content); } catch {}
                            return (
                              <div className="min-w-[220px] max-w-full">
                                <div className="flex items-start gap-2.5 mb-2">
                                  <div className="w-9 h-9 rounded-xl bg-brand-gold flex items-center justify-center shrink-0 mt-0.5">
                                    <CalendarDays size={16} className="text-navy-950" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11.5px] font-bold leading-snug break-words">{ev.title ?? 'Event'}</p>
                                    <p className={`text-[9px] ${isMe ? 'text-white/45' : 'text-gray-400'}`}>Petra Event</p>
                                  </div>
                                </div>
                                {ev.date && <p className={`text-[10px] leading-snug break-words ${isMe ? 'text-white/65' : 'text-gray-500'}`}>📅 {ev.date}{ev.time ? ` at ${ev.time}` : ''}</p>}
                                {ev.location && <p className={`text-[10px] leading-snug break-words mt-0.5 ${isMe ? 'text-white/65' : 'text-gray-500'}`}>📍 {ev.location}</p>}
                                <div className={`mt-2.5 pt-2 border-t ${isMe ? 'border-white/15' : 'border-slate-100'}`}>
                                  <span className="text-[9.5px] font-bold text-brand-gold">View Event →</span>
                                </div>
                              </div>
                            );
                          })() : (
                            <FormattedText text={msg.content} isMe={isMe} />
                          )}

                          {/* Time + delivery receipt */}
                          <div className={`flex items-center gap-1 mt-1 justify-end ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                            <span className="text-[9px] font-mono">{formatMsgTime(msg.created_at)}</span>
                            {isMe && (() => {
                              if (msg._sendState === 'sending') {
                                return <span className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin ml-0.5" />;
                              }
                              if (msg._sendState === 'failed') {
                                return (
                                  <button onClick={() => handleRetry(msg)} title="Tap to retry" className="ml-0.5 text-rose-400 hover:text-rose-300 transition">
                                    <span className="text-[10px]">!</span>
                                  </button>
                                );
                              }
                              if (msg.read_at) return <CheckCheck size={12} className="text-brand-gold" />;
                              if (msg.delivered_at) return <CheckCheck size={12} className="text-white/45" />;
                              return <Check size={12} className="text-white/45" />;
                            })()}
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Input bar */}
            <div className="bg-white border-t border-slate-100 px-3 py-2.5 shrink-0">

              {/* Reply preview bar — visible when replying to a message */}
              {replyingTo && (
                <div className="flex items-start gap-2 mb-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0 border-l-[3px] border-amber-500 pl-2.5">
                    <span className="text-[10px] font-bold text-amber-600 block leading-tight">{replyingTo.senderName}</span>
                    <span className="text-[11px] text-gray-500 block truncate leading-tight mt-0.5">
                      {replyingTo.messageType === 'audio' ? '🎤 Voice message' : replyingTo.content}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition p-0.5 mt-0.5"
                    title="Cancel reply"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {isRecording ? (
                /* ── Recording UI ── */
                <div className="flex items-center gap-3">
                  <button
                    onClick={cancelRecording}
                    className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition shrink-0"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>

                  <div className="flex-1 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-full px-4 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                    <span className="text-rose-600 font-mono text-sm font-bold flex-1">
                      {formatRecTime(recSeconds)}
                    </span>
                    <span className="text-rose-400 text-[10px] font-medium">Recording...</span>
                  </div>

                  <button
                    onClick={stopRecording}
                    className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shrink-0 shadow-sm"
                    title="Stop and send"
                  >
                    <Square size={17} fill="currentColor" />
                  </button>
                </div>
              ) : (
                /* ── Normal input UI ── */
                <form onSubmit={handleSend} className="flex items-end gap-2">

                  {/* Emoji button + picker */}
                  <div ref={emojiRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(prev => !prev)}
                      className={`p-2 rounded-full transition ${showEmojiPicker ? 'text-brand-gold bg-brand-gold/10' : 'text-gray-400 hover:text-navy-900 hover:bg-gray-100'}`}
                      title="Emoji"
                    >
                      <Smile size={20} />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50 shadow-xl rounded-2xl overflow-hidden border border-slate-200">
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          width={300}
                          height={380}
                          searchPlaceHolder="Search emoji..."
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Attachment button */}
                  <button
                    ref={attachBtnRef}
                    type="button"
                    onClick={handleAttachClick}
                    className={`p-2 rounded-full transition shrink-0 ${showAttachMenu ? 'text-brand-gold bg-brand-gold/10' : 'text-gray-400 hover:text-navy-900 hover:bg-gray-100'}`}
                    title="Attach"
                  >
                    <Paperclip size={20} />
                  </button>

                  {/* Hidden file inputs */}
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/*,text/*" onChange={e => handleFileInputChange(e, 'document')} />
                  <input ref={photoInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={e => handleFileInputChange(e, 'image')} />
                  <input ref={audioInputRef} type="file" className="hidden" accept="audio/*" onChange={e => handleFileInputChange(e, 'audio')} />

                  {/* Text input */}
                  <input
                    ref={inputRef}
                    type="text"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e as any); }}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full py-2.5 px-4 text-[12.5px] text-navy-950 placeholder-gray-400 focus:outline-none focus:border-brand-gold focus:bg-white transition"
                  />

                  {/* Send / Mic toggle */}
                  {messageText.trim() ? (
                    <button
                      type="submit"
                      className="p-2.5 bg-navy-950 text-brand-gold hover:bg-navy-800 rounded-full transition shrink-0 shadow-sm cursor-pointer"
                      title="Send"
                    >
                      <Send size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={uploadingAudio || uploadingFile}
                      className="p-2.5 bg-navy-950 text-brand-gold hover:bg-navy-800 disabled:opacity-50 rounded-full transition shrink-0 shadow-sm cursor-pointer"
                      title={uploadingFile ? 'Uploading…' : 'Record voice message'}
                    >
                      {(uploadingAudio || uploadingFile) ? (
                        <span className="w-[17px] h-[17px] border-2 border-brand-gold border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <Mic size={17} />
                      )}
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          /* Empty state when no chat is selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-5 bg-slate-50">
            <div className="w-20 h-20 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center shadow-sm">
              <MessageSquare size={32} className="text-navy-900" />
            </div>
            <div className="space-y-2 max-w-xs">
              <h3 className="font-serif font-black text-navy-950 text-base">Petra Connect Chats</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Send messages to fellow professionals across all Petra hubs. Select a chat on the left, or open the Directory tab to start a new conversation.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2 max-w-xs text-left">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>All messages are securely stored. Please communicate in accordance with Petra Full Gospel Church guidelines.</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Retract confirmation popup portal ── */}
      {confirmDeleteMsgId && retractPopupPos && ReactDOM.createPortal(
        <>
          {/* Invisible backdrop to dismiss on outside click */}
          <div className="fixed inset-0 z-[9990]" onClick={() => { setConfirmDeleteMsgId(null); setRetractPopupPos(null); }} />
          <div
            style={{
              position: 'fixed',
              top: retractPopupPos.top - 8,
              left: retractPopupPos.left - 8,
              transform: 'translate(-100%, -100%)',
              zIndex: 9991,
            }}
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl px-3.5 py-3 flex flex-col gap-2.5 min-w-[170px]"
          >
            {/* Arrow pointer */}
            <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />

            <p className="text-[11px] font-semibold text-gray-700 leading-tight">Retract this message?</p>
            <p className="text-[9.5px] text-gray-400 leading-snug -mt-1">This cannot be undone.</p>

            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => { setConfirmDeleteMsgId(null); setRetractPopupPos(null); }}
                disabled={deletingMsgId === confirmDeleteMsgId}
                className="flex-1 text-[10.5px] font-semibold text-gray-600 border border-slate-200 rounded-xl py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMessage(confirmDeleteMsgId)}
                disabled={deletingMsgId === confirmDeleteMsgId}
                className="flex-1 text-[10.5px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl py-1.5 transition flex items-center justify-center gap-1 disabled:opacity-60"
              >
                <Trash2 size={10} />
                {deletingMsgId === confirmDeleteMsgId ? 'Retracting…' : 'Retract'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Attachment menu portal ── */}
      {showAttachMenu && attachMenuPos && ReactDOM.createPortal(
        <div
          ref={attachMenuRef}
          style={{ position: 'fixed', bottom: attachMenuPos.bottom, left: attachMenuPos.left, zIndex: 9999 }}
          className="bg-[#1f2c34] border border-[#2a3942] rounded-2xl shadow-2xl overflow-hidden py-1.5 min-w-[196px]"
        >
          {([
            { label: 'Document',       icon: <FileText size={17} />,     color: 'bg-purple-600',  action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
            { label: 'Photos & videos', icon: <ImageIcon size={17} />,    color: 'bg-blue-500',    action: () => { setShowAttachMenu(false); photoInputRef.current?.click(); } },
            { label: 'Camera',         icon: <Camera size={17} />,        color: 'bg-rose-500',    action: openCamera },
            { label: 'Audio',          icon: <Headphones size={17} />,    color: 'bg-orange-500',  action: () => { setShowAttachMenu(false); audioInputRef.current?.click(); } },
            { label: 'Contact',        icon: <UserCircle2 size={17} />,   color: 'bg-teal-600',    action: () => { setShowAttachMenu(false); setContactSearch(''); setShowContactPicker(true); } },
            { label: 'Poll',           icon: <BarChart2 size={17} />,     color: 'bg-amber-500',   action: () => { setShowAttachMenu(false); setShowPollCreator(true); } },
            { label: 'Event',          icon: <CalendarDays size={17} />,  color: 'bg-red-500',     action: () => { setShowAttachMenu(false); setEventSearch(''); setShowEventPicker(true); } },
          ] as { label: string; icon: React.ReactNode; color: string; action: () => void }[]).map(({ label, icon, color, action }) => (
            <button key={label} onClick={action}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 text-[13px] text-gray-200 hover:bg-white/5 transition">
              <span className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white shrink-0 shadow-sm`}>{icon}</span>
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* ── Camera modal portal ── */}
      {showCamera && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="relative bg-navy-950 rounded-2xl overflow-hidden shadow-2xl border border-navy-800">
            <video ref={videoRef} autoPlay playsInline className="block w-[480px] max-w-[90vw] h-auto object-cover" />
            <div className="absolute bottom-0 inset-x-0 flex justify-center items-center gap-5 p-5 bg-gradient-to-t from-black/70 to-transparent">
              <button onClick={() => { stopCamera(); setShowCamera(false); }}
                className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition" title="Cancel">
                <X size={20} />
              </button>
              <button onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform" title="Take photo">
                <Camera size={26} className="text-navy-950" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Contact picker portal ── */}
      {showContactPicker && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[75vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-navy-950 text-sm">Share Contact</h3>
              <button onClick={() => setShowContactPicker(false)} className="text-gray-400 hover:text-navy-900 transition p-1"><X size={18} /></button>
            </div>
            <div className="px-3 py-2 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search members…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8 pr-3 text-[12px] focus:outline-none focus:border-brand-gold transition" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {directoryMembers
                .filter(m => m.id !== currentUserId && (m.full_name.toLowerCase().includes(contactSearch.toLowerCase()) || m.profession.toLowerCase().includes(contactSearch.toLowerCase())))
                .map(m => (
                  <button key={m.id} onClick={() => handleSendContact(m)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                    {m.profile_image && !failedAvatars.has(m.id)
                      ? <img src={m.profile_image} alt={m.full_name} className="w-9 h-9 rounded-full object-cover border border-brand-gold/30 shrink-0" onError={() => markFailed(m.id)} />
                      : <div className="w-9 h-9 rounded-full bg-navy-950 text-white font-bold font-serif text-xs flex items-center justify-center shrink-0">{getInitials(m.full_name)}</div>
                    }
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-navy-950 truncate">{m.full_name}</p>
                      <p className="text-[10px] text-gray-400">{m.profession} · {m.hub_name}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Poll creator portal ── */}
      {showPollCreator && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden max-h-[85vh]">
            <div className="px-4 py-3.5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-navy-950 text-sm">Create Poll</h3>
              <button onClick={() => setShowPollCreator(false)} className="text-gray-400 hover:text-navy-900 transition p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Question</label>
                <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question…"
                  className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-brand-gold transition" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Options</label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o); }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 border border-slate-200 rounded-xl py-2 px-3 text-[12.5px] focus:outline-none focus:border-brand-gold transition" />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                          className="p-1.5 text-gray-400 hover:text-rose-500 transition rounded-full hover:bg-rose-50">
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions([...pollOptions, ''])}
                    className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-brand-gold hover:text-amber-600 transition">
                    <Plus size={13} /> Add option
                  </button>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
              <button onClick={handlePollSubmit} disabled={sendingPoll || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                className="w-full py-2.5 bg-navy-950 text-brand-gold font-bold text-sm rounded-xl hover:bg-navy-800 transition disabled:opacity-40">
                {sendingPoll ? 'Sending…' : 'Send Poll'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Event picker portal ── */}
      {showEventPicker && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[75vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-navy-950 text-sm">Share Event</h3>
              <button onClick={() => setShowEventPicker(false)} className="text-gray-400 hover:text-navy-900 transition p-1"><X size={18} /></button>
            </div>
            <div className="px-3 py-2 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Search events…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-8 pr-3 text-[12px] focus:outline-none focus:border-brand-gold transition" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {loadingPickerEvents ? (
                <div className="p-6 text-center text-gray-400 text-xs animate-pulse">Loading events…</div>
              ) : pickerEvents.filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()) || (e.location ?? '').toLowerCase().includes(eventSearch.toLowerCase())).length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs">No events found.</div>
              ) : pickerEvents
                .filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()) || (e.location ?? '').toLowerCase().includes(eventSearch.toLowerCase()))
                .map(evt => (
                  <button key={evt.id} onClick={() => handleSendEvent(evt)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center shrink-0">
                      <CalendarDays size={18} className="text-navy-950" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-navy-950 truncate">{evt.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">📅 {evt.date} · 📍 {evt.location}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Contact profile viewer portal ── */}
      {viewingProfile && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
             onClick={() => setViewingProfile(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[360px]"
               onClick={e => e.stopPropagation()}>

            {/* Banner — overflow-hidden scoped here so avatar is NOT clipped */}
            <div className="h-32 bg-gradient-to-br from-[#0a1628] via-[#0f2347] to-[#1a3a6e] relative shrink-0 rounded-t-3xl overflow-hidden">
              <button onClick={() => setViewingProfile(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition">
                <X size={16} />
              </button>
            </div>

            {/* Avatar centred, half overlapping banner */}
            <div className="flex flex-col items-center -mt-12 px-6 pb-5">
              {/* Avatar with expand button */}
              <div className="relative shrink-0">
                {viewingProfile.profile_image && !viewingProfileImgFailed
                  ? <img src={viewingProfile.profile_image} alt={viewingProfile.full_name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl"
                      onError={() => setViewingProfileImgFailed(true)} />
                  : <div className="w-24 h-24 rounded-full bg-navy-950 border-4 border-white shadow-xl flex items-center justify-center text-white font-bold font-serif text-2xl">
                      {loadingProfile ? '…' : getInitials(viewingProfile.full_name ?? '?')}
                    </div>
                }
                <button
                  onClick={() => { setViewingPartnerPhotoFailed(false); setViewingPartnerPhoto({ url: viewingProfile.profile_image ?? null, name: viewingProfile.full_name }); }}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-navy-950 border-2 border-white flex items-center justify-center text-white hover:bg-navy-700 transition shadow-md"
                  title="View full photo">
                  <Expand size={12} />
                </button>
              </div>

              {loadingProfile ? (
                <p className="mt-4 text-sm text-gray-400 animate-pulse">Loading profile…</p>
              ) : (
                <>
                  {/* Name + profession */}
                  <h2 className="mt-3 text-[18px] font-black text-navy-950 text-center leading-tight">{viewingProfile.full_name}</h2>
                  <span className="mt-1 inline-block bg-brand-gold/15 text-brand-gold text-[10.5px] font-bold px-3 py-0.5 rounded-full">
                    {viewingProfile.profession}
                  </span>

                  {/* Meta row */}
                  <div className="mt-2.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {viewingProfile.hub_name && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-gold inline-block" />
                        {viewingProfile.hub_name} Hub
                      </span>
                    )}
                    {viewingProfile.location && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span>📍</span>{viewingProfile.location}
                      </span>
                    )}
                  </div>

                  {/* Bio */}
                  {viewingProfile.bio && (
                    <p className="mt-4 text-[12px] text-gray-600 leading-relaxed text-center w-full border-t border-slate-100 pt-4">
                      {viewingProfile.bio}
                    </p>
                  )}

                  {/* Member since */}

                  {/* Action buttons */}
                  <div className="mt-5 w-full border-t border-slate-100 pt-4 grid grid-cols-3 gap-2">
                    {/* Message — functional */}
                    <button
                      onClick={() => { setViewingProfile(null); handleSelectPartner(viewingProfile.id); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-navy-950 text-white hover:bg-navy-800 transition active:scale-95">
                      <MessageSquare size={18} />
                      <span className="text-[9px] font-bold">Message</span>
                    </button>
                    {/* Call — placeholder */}
                    <button
                      title="Coming soon"
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-slate-50 text-gray-400 border border-slate-200 cursor-not-allowed opacity-60">
                      <Phone size={18} />
                      <span className="text-[9px] font-bold">Call</span>
                    </button>
                    {/* Video call — placeholder */}
                    <button
                      title="Coming soon"
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-slate-50 text-gray-400 border border-slate-200 cursor-not-allowed opacity-60">
                      <Video size={18} />
                      <span className="text-[9px] font-bold">Video</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Partner photo menu portal ── */}
      {partnerMenuPos && ReactDOM.createPortal(
        <div
          ref={partnerMenuRef}
          style={{ position: 'fixed', top: partnerMenuPos.top, left: partnerMenuPos.left, zIndex: 9999 }}
          className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl overflow-hidden min-w-[148px]"
        >
          <button
            onClick={() => { setViewingPartnerPhotoFailed(false); setViewingPartnerPhoto({ url: partnerMenuPos.url, name: partnerMenuPos.name }); setPartnerMenuPos(null); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-gray-200 hover:bg-navy-800 hover:text-white transition"
          >
            <Eye size={13} className="text-brand-gold shrink-0" />
            View photo
          </button>
        </div>,
        document.body
      )}

      {/* ── Partner full-size photo viewer portal ── */}
      {viewingPartnerPhoto && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setViewingPartnerPhoto(null)}
          />
          <div className="relative flex flex-col items-center gap-5">
            <button
              onClick={() => setViewingPartnerPhoto(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-navy-900 border border-navy-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition z-10 shadow-lg"
            >
              <X size={16} />
            </button>
            {viewingPartnerPhoto.url && !viewingPartnerPhotoFailed ? (
              <img
                src={viewingPartnerPhoto.url}
                alt={viewingPartnerPhoto.name}
                className="rounded-full object-cover border-4 border-brand-gold shadow-2xl"
                style={{ width: 'min(72vmin, 520px)', height: 'min(72vmin, 520px)' }}
                onError={() => setViewingPartnerPhotoFailed(true)}
              />
            ) : (
              <div
                className="rounded-full bg-navy-950 border-4 border-brand-gold flex items-center justify-center shadow-2xl"
                style={{ width: 'min(72vmin, 520px)', height: 'min(72vmin, 520px)' }}
              >
                <span className="font-serif font-bold text-brand-gold" style={{ fontSize: 'min(18vmin, 130px)' }}>
                  {getInitials(viewingPartnerPhoto.name)}
                </span>
              </div>
            )}
            <p className="text-white font-bold text-base tracking-wide">{viewingPartnerPhoto.name}</p>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
