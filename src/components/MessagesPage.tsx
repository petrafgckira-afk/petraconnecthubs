import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Pusher from 'pusher-js';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Send, Search, CheckCheck, Smile, Paperclip,
  MoreVertical, Phone, Video, ShieldAlert,
  MessageSquare, Mic, ArrowLeft, Edit3, Users2, Check,
  Play, Pause, Square, X, Eye, EyeOff, Trash2,
  FileText, Image as ImageIcon, Camera, Headphones,
  UserCircle2, BarChart2, CalendarDays, Download, Plus, Minus, Expand,
  Star, Pencil, CornerUpLeft, Ban, Timer, Lock, LockOpen, KeyRound, ChevronDown, Upload, Info,
} from 'lucide-react';
import { API_BASE, PUSHER_KEY, PUSHER_CLUSTER, triggerTyping, fetchConversations, fetchThread, fetchNewMessages, sendMessage, sendRichMessage, uploadFileXHR, pollVote, sendAudioMessage, uploadAudio, fetchMembers, fetchEvents, deleteMessage, fetchUserProfile, markRead, reactToMessage, editMessage, starMessage, markViewed, setDisappear, setLock, verifyLock } from '../services/api';

/* ── Interfaces ─────────────────────────────────────────────────── */

interface ApiPartner {
  id: string;
  full_name: string;
  profession: string;
  profile_image?: string | null;
  username?: string | null;
}

interface ReplyContext {
  id: string;
  senderName: string;
  content: string;
  messageType: string;
}

interface MsgReaction { emoji: string; count: number; mine: boolean; }

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
  is_deleted?: boolean;
  edited_at?: string | null;
  reactions?: MsgReaction[];
  is_starred?: boolean;
  view_once?: boolean;
  viewed_at?: string | null;
}

interface ApiConversation {
  partner: ApiPartner;
  last_message: { content: string; created_at: string; sender_id: string; message_type?: string } | null;
  unread_count: number;
}

interface ApiMember {
  id: string;
  full_name: string;
  username?: string | null;
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

  // Real-time state
  const [pusherConnected,    setPusherConnected]    = useState(false);
  const [partnerTyping,      setPartnerTyping]      = useState(false);
  const pusherConnectedRef     = useRef(false);
  const partnerTypingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef      = useRef<number>(0);
  const lastPollRef            = useRef<number>(0);

  // Message delete state
  const [hoveredMsgId, setHoveredMsgId]           = useState<string | null>(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [retractPopupPos, setRetractPopupPos]       = useState<{ top: number; left: number } | null>(null);
  const [deletingMsgId, setDeletingMsgId]           = useState<string | null>(null);

  // Context menu (right-click)
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; exiting: boolean; x: number; y: number; msg: ApiMessage | null; origin: string }>({ visible: false, exiting: false, x: 0, y: 0, msg: null, origin: 'top left' });
  const ctxCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline edit
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText,     setEditText]     = useState('');

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyContext | null>(null);
  const replyingToRef               = useRef<ReplyContext | null>(null);

  // Right info pane (Ctrl+I / header button)
  const [showInfoPane, setShowInfoPane] = useState(false);

  // Command palette (Ctrl+K)
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery]             = useState('');
  const [cmdIdx, setCmdIdx]                 = useState(0);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  // Shortcuts cheat sheet (Ctrl+/)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Stable refs for use inside the keyboard handler (avoids stale closures)
  const filteredConvosRef       = useRef<ApiConversation[]>([]);
  const handleSelectPartnerRef  = useRef<((id: string, info?: ApiPartner) => void) | null>(null);

  // Attachment menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachMenuPos, setAttachMenuPos]   = useState<{ bottom: number; left: number } | null>(null);
  const attachMenuRef  = useRef<HTMLDivElement>(null);
  const attachBtnRef   = useRef<HTMLButtonElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const audioInputRef  = useRef<HTMLInputElement>(null);

  // File upload progress (null = idle, 0-100 = uploading)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragOver,     setIsDragOver]     = useState(false);

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

  /* ── Browser notification permission (request once on mount) ── */
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /* ── document.title unread badge ── */
  useEffect(() => {
    const total = conversations.reduce((n, c) => n + (c.unread_count || 0), 0);
    document.title = total > 0 ? `(${total}) Petra | Messages` : 'Petra | Messages';
    return () => { document.title = 'Petra'; };
  }, [conversations]);

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

  /* ── Pusher real-time connection ─── */
  useEffect(() => {
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      channelAuthorization: {
        customHandler: ({ channelName, socketId }: { channelName: string; socketId: string }, callback: (err: any, data: any) => void) => {
          const token = localStorage.getItem('petra_token') || '';
          const body  = `channel_name=${encodeURIComponent(channelName)}&socket_id=${encodeURIComponent(socketId)}`;
          fetch(`${API_BASE}/pusher/auth.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${token}` },
            body,
          })
            .then(r => r.json())
            .then(data => callback(null, data))
            .catch(err => callback(err, null));
        },
      },
    });

    const setOnline  = () => { setPusherConnected(true);  pusherConnectedRef.current = true;
      // Catch up on messages missed during any prior disconnect
      const pid   = activePartnerRef.current;
      const since = lastMsgTime.current;
      if (pid && since) {
        fetchNewMessages(pid, since).then(data => {
          const all = (data.messages || []) as ApiMessage[];
          const incoming = all.filter(m => !knownMsgIds.current.has(m.id));
          setThread(prev => {
            const map = new Map(all.map(m => [m.id, m]));
            const refreshed = prev.map(m =>
              map.has(m.id) && m._sendState !== 'sending' && m._sendState !== 'failed'
                ? { ...m, delivered_at: map.get(m.id)!.delivered_at, read_at: map.get(m.id)!.read_at }
                : m
            );
            if (!incoming.length) return refreshed;
            incoming.forEach(m => knownMsgIds.current.add(m.id));
            lastMsgTime.current = incoming[incoming.length - 1].created_at;
            return [...refreshed, ...incoming];
          });
        }).catch(() => {});
      }
    };
    const setOffline = () => { setPusherConnected(false); pusherConnectedRef.current = false; };

    pusher.connection.bind('connected',    setOnline);
    pusher.connection.bind('disconnected', setOffline);
    pusher.connection.bind('failed',       setOffline);

    const channel = pusher.subscribe(`private-chat-${currentUserId}`);

    channel.bind('message.new', (data: Omit<ApiMessage, 'is_mine'> & { is_mine?: boolean; sender_name?: string }) => {
      const pid   = activePartnerRef.current;
      const title = data.sender_name ?? 'New message';
      const body  = msgTypePreview(data.content, data.message_type);

      if (data.sender_id !== pid) {
        // Background conversation — increment badge and notify
        setConversations(prev => prev.map(c =>
          c.partner.id === data.sender_id
            ? { ...c, unread_count: c.unread_count + 1, last_message: { content: data.content, created_at: data.created_at, sender_id: data.sender_id, message_type: data.message_type } }
            : c
        ));
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icon.png' });
        }
        return;
      }

      const msg: ApiMessage = { ...data, is_mine: data.sender_id === currentUserId };
      if (knownMsgIds.current.has(msg.id)) return;
      knownMsgIds.current.add(msg.id);
      lastMsgTime.current = msg.created_at;
      setPartnerTyping(false);
      setThread(prev => [...prev, msg]);
      setConversations(prev => prev.map(c =>
        c.partner.id === data.sender_id
          ? { ...c, unread_count: 0, last_message: { content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id, message_type: msg.message_type } }
          : c
      ));
      if (document.visibilityState === 'visible') {
        markRead(data.sender_id);
      } else {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icon.png' });
        }
      }
    });

    channel.bind('message.delivered', (data: { receiver_id: string }) => {
      if (data.receiver_id !== activePartnerRef.current) return;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      setThread(prev => prev.map(m =>
        !m.delivered_at && m._sendState !== 'sending' && m._sendState !== 'failed'
          ? { ...m, delivered_at: now }
          : m
      ));
    });

    channel.bind('message.read', (data: { reader_id: string }) => {
      if (data.reader_id !== activePartnerRef.current) return;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      setThread(prev => prev.map(m =>
        m._sendState !== 'sending' && m._sendState !== 'failed'
          ? { ...m, read_at: m.read_at || now, delivered_at: m.delivered_at || now }
          : m
      ));
    });

    channel.bind('message.deleted', (data: { message_id: string }) => {
      setThread(prev => prev.map(m =>
        m.id === data.message_id
          ? { ...m, is_deleted: true, content: '', audio_url: null, file_url: null }
          : m
      ));
    });

    channel.bind('reaction.changed', (data: { message_id: string; reactions: MsgReaction[] }) => {
      setThread(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, reactions: data.reactions } : m
      ));
    });

    channel.bind('message.edited', (data: { message_id: string; content: string; edited_at: string }) => {
      setThread(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, content: data.content, edited_at: data.edited_at } : m
      ));
    });

    channel.bind('media.viewed', (data: { message_id: string }) => {
      setThread(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, viewed_at: new Date().toISOString(), file_url: null } : m
      ));
    });

    channel.bind('disappear.changed', (data: { partner_id: string; disappear_after: number | null }) => {
      if (data.partner_id === activePartnerRef.current) {
        setDisappearAfter(data.disappear_after ?? null);
      }
    });

    channel.bind('typing', (data: { sender_id: string }) => {
      if (data.sender_id !== activePartnerRef.current) return;
      setPartnerTyping(true);
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      partnerTypingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000);
    });

    return () => {
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      pusher.disconnect();
    };
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Apply conversation settings
        if (data.settings) {
          setDisappearAfter(data.settings.disappear_after ?? null);
          const isLocked = !!data.settings.is_locked;
          setChatLocked(isLocked);
          if (isLocked && !sessionUnlocked.has(partnerId)) setShowPinGate(true);
        }
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

  /* ── Catchup on tab-focus / wake from sleep ── */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const pid   = activePartnerRef.current;
      const since = lastMsgTime.current;
      if (!pid || !since) return;
      fetchNewMessages(pid, since).then(data => {
        const all      = (data.messages || []) as ApiMessage[];
        const incoming = all.filter(m => !knownMsgIds.current.has(m.id));
        setThread(prev => {
          const map       = new Map(all.map(m => [m.id, m]));
          const refreshed = prev.map(m =>
            map.has(m.id) && m._sendState !== 'sending' && m._sendState !== 'failed'
              ? { ...m, delivered_at: map.get(m.id)!.delivered_at, read_at: map.get(m.id)!.read_at }
              : m
          );
          if (!incoming.length) return refreshed;
          incoming.forEach(m => knownMsgIds.current.add(m.id));
          lastMsgTime.current = incoming[incoming.length - 1].created_at;
          return [...refreshed, ...incoming];
        });
        if (incoming.length > 0) markRead(pid);
      }).catch(() => {});
      lastPollRef.current = Date.now(); // reset so next scheduled poll waits a full interval
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []); // mount-once — reads refs only

  /* ── Poll active thread (fallback: 2 s normally, 30 s when Pusher live) ── */
  useEffect(() => {
    const interval = setInterval(async () => {
      const partnerId = activePartnerRef.current;
      const since     = lastMsgTime.current;
      if (!partnerId || !since) return;
      const minGap = pusherConnectedRef.current ? 30_000 : 2_000;
      const now    = Date.now();
      if (now - lastPollRef.current < minGap) return;
      lastPollRef.current = now;
      try {
        const data = await fetchNewMessages(partnerId, since);
        const allFetched: ApiMessage[] = data.messages || [];
        const incoming = allFetched.filter(m => !knownMsgIds.current.has(m.id));

        setThread(prev => {
          const updatedMap = new Map(allFetched.map(m => [m.id, m]));
          const refreshed  = prev.map(m =>
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
          if (document.visibilityState === 'visible') markRead(partnerId);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []); // mount-once — reads refs only

  /* ── Poll conversation list every 15 s ─ */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetchConversations();
        setConversations((data.conversations || []).map((c: ApiConversation) => ({
          ...c,
          unread_count: c.partner.id === activePartnerRef.current ? 0 : c.unread_count,
        })));
      } catch {}
    }, 15_000);
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
      setThread(prev => prev.map(m =>
        m.id === msgId ? { ...m, is_deleted: true, content: '', audio_url: null, file_url: null } : m
      ));
      setConfirmDeleteMsgId(null);
      setRetractPopupPos(null);
      setHoveredMsgId(null);
    } catch {
      // Leave confirm popup open so the user knows the retract failed
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try {
      const data = await reactToMessage(msgId, emoji);
      setThread(prev => prev.map(m => m.id === msgId ? { ...m, reactions: data.reactions } : m));
    } catch {}
  };

  const handleSaveEdit = async () => {
    if (!editingMsgId || !editText.trim()) return;
    const msgId   = editingMsgId;
    const newText = editText.trim();
    const prevText = thread.find(m => m.id === msgId)?.content ?? '';
    setEditingMsgId(null);
    setThread(prev => prev.map(m => m.id === msgId ? { ...m, content: newText } : m));
    try {
      const data = await editMessage(msgId, newText);
      if (data.edited_at) {
        setThread(prev => prev.map(m => m.id === msgId ? { ...m, edited_at: data.edited_at } : m));
      }
    } catch {
      setThread(prev => prev.map(m => m.id === msgId ? { ...m, content: prevText } : m));
    }
  };

  const handleStar = async (msgId: string) => {
    try {
      const data = await starMessage(msgId);
      setThread(prev => prev.map(m => m.id === msgId ? { ...m, is_starred: data.starred } : m));
    } catch {}
  };

  const canEditMsg = (msg: ApiMessage) => {
    if (!msg.is_mine || msg.message_type !== 'text' || msg.is_deleted) return false;
    return Date.now() - new Date(msg.created_at).getTime() < 15 * 60 * 1000;
  };

  // View-once state
  const [viewOnceModal, setViewOnceModal] = useState<{ msg: ApiMessage } | null>(null);
  const [sendViewOnce, setSendViewOnce]   = useState(false);

  // Disappearing messages
  const [disappearAfter, setDisappearAfter] = useState<number | null>(null);
  const [showMoreMenu,   setShowMoreMenu]   = useState(false);
  const [showDisappearPicker, setShowDisappearPicker] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Chat lock
  const [chatLocked,      setChatLocked]      = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState<Set<string>>(new Set());
  const [showPinGate,     setShowPinGate]     = useState(false);
  const [pinInput,        setPinInput]        = useState('');
  const [pinError,        setPinError]        = useState('');
  const [pinLoading,      setPinLoading]      = useState(false);
  const [showSetLock,     setShowSetLock]     = useState(false);
  const [newLockPin,      setNewLockPin]      = useState('');
  const [confirmLockPin,  setConfirmLockPin]  = useState('');
  const [lockSetError,    setLockSetError]    = useState('');

  const DISAPPEAR_OPTIONS: { label: string; value: number | null }[] = [
    { label: 'Off',     value: null   },
    { label: '5 min',   value: 300    },
    { label: '1 hour',  value: 3600   },
    { label: '1 day',   value: 86400  },
    { label: '7 days',  value: 604800 },
    { label: '30 days', value: 2592000 },
  ];

  function formatDisappearLabel(secs: number | null): string {
    if (!secs) return '';
    if (secs < 3600)  return `${secs / 60}m`;
    if (secs < 86400) return `${secs / 3600}h`;
    if (secs < 604800) return `${secs / 86400}d`;
    return `${secs / 604800}w`;
  }

  // Close more-menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
        setShowDisappearPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  // Reset disappear/lock state when conversation changes
  useEffect(() => {
    setDisappearAfter(null);
    setChatLocked(false);
    setShowMoreMenu(false);
    setShowDisappearPicker(false);
    setShowPinGate(false);
    setPinInput('');
    setPinError('');
  }, [activePartnerId]);

  /* ── Global keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const inInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;

      // Ctrl+K — command palette (always intercept)
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setShowCmdPalette(v => {
          if (!v) setTimeout(() => cmdInputRef.current?.focus(), 30);
          return !v;
        });
        setCmdQuery('');
        setCmdIdx(0);
        return;
      }

      // Ctrl+/ — keyboard shortcuts reference
      if (ctrl && e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(v => !v);
        return;
      }

      // Ctrl+I — toggle contact info pane (only when a conversation is open)
      if (ctrl && e.key === 'i') {
        if (activePartnerRef.current) {
          e.preventDefault();
          setShowInfoPane(v => !v);
        }
        return;
      }

      // Escape — close palette / shortcuts help
      if (e.key === 'Escape') {
        setShowCmdPalette(false);
        setShowShortcutsHelp(false);
        return;
      }

      // Alt+↓ / Alt+↑ — cycle through conversations (not when typing)
      if (!inInput && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const convos = filteredConvosRef.current;
        if (convos.length === 0) return;
        const curr = convos.findIndex(c => c.partner.id === activePartnerRef.current);
        const next = e.key === 'ArrowDown'
          ? Math.min(Math.max(curr, 0) + 1, convos.length - 1)
          : Math.max(curr - 1, 0);
        const target = convos[next];
        if (target && target.partner.id !== activePartnerRef.current) {
          handleSelectPartnerRef.current?.(target.partner.id, target.partner);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSetDisappear = async (value: number | null) => {
    if (!activePartnerId) return;
    setDisappearAfter(value);
    setShowDisappearPicker(false);
    setShowMoreMenu(false);
    try { await setDisappear(activePartnerId, value); } catch {}
  };

  const handleVerifyPin = async () => {
    if (!activePartnerId || !pinInput) return;
    setPinLoading(true);
    setPinError('');
    try {
      await verifyLock(activePartnerId, pinInput);
      setSessionUnlocked(prev => new Set(prev).add(activePartnerId));
      setShowPinGate(false);
      setPinInput('');
    } catch {
      setPinError('Incorrect PIN. Try again.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleSetLockSave = async () => {
    if (!activePartnerId) return;
    if (newLockPin.length < 4 || !/^\d+$/.test(newLockPin)) {
      setLockSetError('PIN must be 4–8 digits.');
      return;
    }
    if (newLockPin !== confirmLockPin) {
      setLockSetError('PINs do not match.');
      return;
    }
    setLockSetError('');
    try {
      await setLock(activePartnerId, newLockPin);
      setChatLocked(true);
      setSessionUnlocked(prev => { const s = new Set(prev); s.add(activePartnerId); return s; });
      setShowSetLock(false);
      setNewLockPin('');
      setConfirmLockPin('');
    } catch (e: any) { setLockSetError(e.message); }
  };

  const handleRemoveLock = async () => {
    if (!activePartnerId) return;
    try {
      await setLock(activePartnerId, null);
      setChatLocked(false);
      setSessionUnlocked(prev => { const s = new Set(prev); s.delete(activePartnerId); return s; });
    } catch {}
    setShowMoreMenu(false);
  };

  const handleMarkViewed = async (msg: ApiMessage) => {
    // Optimistically mark viewed so sender sees "Opened" immediately
    setThread(prev => prev.map(m => m.id === msg.id ? { ...m, viewed_at: new Date().toISOString(), file_url: null } : m));
    try { await markViewed(msg.id); } catch {}
  };

  const closeCtxMenu = () => {
    setCtxMenu(p => ({ ...p, exiting: true }));
    if (ctxCloseTimer.current) clearTimeout(ctxCloseTimer.current);
    ctxCloseTimer.current = setTimeout(() => {
      setCtxMenu(p => ({ ...p, visible: false, exiting: false }));
    }, 130);
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
    const replyId    = replyingTo?.id;
    const isViewOnce = sendViewOnce && (type === 'image' || type === 'video');
    setReplyingTo(null);
    if (isViewOnce) setSendViewOnce(false);
    setUploadProgress(0);
    try {
      const result  = await uploadFileXHR(file, type, pct => setUploadProgress(pct), name ?? (file instanceof File ? file.name : 'upload'));
      setUploadProgress(100);
      const msgType = type === 'audio' ? 'audio_file' : type;
      const data    = await sendRichMessage(activePartnerId, {
        message_type: msgType,
        file_url:  result.url,
        file_meta: JSON.stringify({ name: result.name, size: result.size, mime: result.mime, ...(result.thumbnail_url ? { thumbnail_url: result.thumbnail_url } : {}) }),
        content:   result.name,
        ...(replyId ? { reply_to_id: replyId } : {}),
        ...(isViewOnce ? { view_once: true } : {}),
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
      // Brief green flash then clear
      setTimeout(() => setUploadProgress(null), 600);
    } catch (err: any) {
      setUploadProgress(null);
      alert('Upload failed: ' + (err.message || 'Server error'));
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
    c.partner.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.partner.username && ('@' + c.partner.username).toLowerCase().includes(search.toLowerCase()))
  );

  const filteredMembers = directoryMembers.filter(m =>
    m.id !== currentUserId &&
    (m.full_name.toLowerCase().includes(search.toLowerCase()) ||
     m.profession.toLowerCase().includes(search.toLowerCase()) ||
     m.hub_name.toLowerCase().includes(search.toLowerCase()) ||
     (m.username && ('@' + m.username).toLowerCase().includes(search.toLowerCase())))
  );

  // Sync stable refs so keyboard handler always sees latest values
  filteredConvosRef.current      = filteredConvos;
  handleSelectPartnerRef.current = handleSelectPartner;

  // Command palette — union of conversations + members not yet chatted with, filtered by query
  const qLow = cmdQuery.toLowerCase();
  const cmdResults: { id: string; name: string; subtitle: string; image: string | null; partnerInfo: ApiPartner }[] = [
    ...conversations
      .filter(c => !qLow || c.partner.full_name.toLowerCase().includes(qLow) || c.partner.profession.toLowerCase().includes(qLow) || (c.partner.username && ('@' + c.partner.username).toLowerCase().includes(qLow)))
      .map(c => ({ id: c.partner.id, name: c.partner.full_name, subtitle: (c.partner.username ? '@' + c.partner.username + ' · ' : '') + c.partner.profession + ' Hub', image: c.partner.profile_image ?? null, partnerInfo: c.partner })),
    ...directoryMembers
      .filter(m => m.id !== currentUserId && !conversations.some(c => c.partner.id === m.id) && (!qLow || m.full_name.toLowerCase().includes(qLow) || m.profession.toLowerCase().includes(qLow) || (m.username && ('@' + m.username).toLowerCase().includes(qLow))))
      .map(m => ({ id: m.id, name: m.full_name, subtitle: (m.username ? '@' + m.username + ' · ' : '') + m.profession + ' · ' + m.hub_name, image: m.profile_image ?? null, partnerInfo: { id: m.id, full_name: m.full_name, profession: m.profession, profile_image: m.profile_image, username: m.username } as ApiPartner })),
  ].slice(0, 8);

  // Shared media for info pane (images from current thread)
  const sharedMedia = thread
    .filter(m => m.message_type === 'image' && m.file_url && !m.is_deleted)
    .map(m => {
      let thumbUrl = m.file_url!;
      try { const meta = m.file_meta ? JSON.parse(m.file_meta) : null; if (meta?.thumbnail_url) thumbUrl = meta.thumbnail_url; } catch {}
      return { id: m.id, fileUrl: m.file_url!, thumbUrl };
    });

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
        <div className="bg-brand-gold/10 px-4 py-3.5 flex justify-between items-center shrink-0">
          <h2 className="font-serif font-bold text-navy-950 text-sm tracking-tight">Messages</h2>
          <button className="text-navy-400 hover:text-brand-gold transition p-1 rounded-lg" title="New chat">
            <Edit3 size={15} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2 bg-brand-gold/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chats or people..."
              className="w-full bg-white/80 border border-orange-200 rounded-lg py-2 pl-8 pr-3 text-[11.5px] text-navy-950 placeholder-gray-400 focus:outline-none focus:border-brand-gold transition"
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
                      <p className="text-[10px] text-gray-400 truncate">
                        {convo.partner.username && <span className="text-brand-gold/80">@{convo.partner.username} · </span>}
                        {convo.partner.profession} Hub
                      </p>
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
                const partnerInfo: ApiPartner = { id: member.id, full_name: member.full_name, profession: member.profession, username: member.username };
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
                      {member.username && <span className="text-[9px] text-brand-gold/80 font-mono block">@{member.username}</span>}
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
      <section
        className={`relative flex-1 flex flex-col min-w-0 ${activePartnerId ? 'flex' : 'hidden md:flex'}`}
        onDragOver={e => { e.preventDefault(); if (activePartnerId) setIsDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          if (!activePartnerId) return;
          const file = e.dataTransfer.files[0];
          if (!file) return;
          const t = file.type;
          const type: 'image' | 'video' | 'document' | 'audio' =
            t.startsWith('image/') ? 'image' :
            t.startsWith('video/') ? 'video' :
            t.startsWith('audio/') ? 'audio' : 'document';
          uploadAndSend(file, type, file.name);
        }}
      >
        {/* Drag-and-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-navy-950/80 backdrop-blur-sm pointer-events-none">
            <div className="w-20 h-20 rounded-2xl bg-brand-gold/15 border-2 border-brand-gold/50 border-dashed flex items-center justify-center mb-4">
              <Upload size={32} className="text-brand-gold" />
            </div>
            <p className="text-white font-bold text-base">Drop to send</p>
            <p className="text-white/50 text-sm mt-1">Images · Videos · Documents · Audio</p>
          </div>
        )}
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
                  {displayPartner.username && (
                    <p className="text-[9px] text-brand-gold/80 font-mono leading-none mb-0.5">@{displayPartner.username}</p>
                  )}
                  <span className="text-[9px] text-emerald-400 leading-none font-medium">
                    Online • {displayPartner.profession} Hub
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 text-gray-400">
                {/* Disappearing-messages badge */}
                {disappearAfter && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] font-semibold mr-1">
                    <Timer size={10} />
                    {formatDisappearLabel(disappearAfter)}
                  </span>
                )}
                {/* Lock badge */}
                {chatLocked && (
                  <span className="flex items-center px-2 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-[10px] font-semibold mr-1">
                    <Lock size={10} />
                  </span>
                )}
                <button className="p-2 hover:text-brand-gold transition rounded-lg" title="Voice call">
                  <Phone size={15} />
                </button>
                <button className="p-2 hover:text-brand-gold transition rounded-lg" title="Video call">
                  <Video size={15} />
                </button>
                <button
                  onClick={() => setShowInfoPane(v => !v)}
                  className={`p-2 hover:text-brand-gold transition rounded-lg ${showInfoPane ? 'text-brand-gold' : ''}`}
                  title="Contact info  Ctrl+I"
                >
                  <Info size={15} />
                </button>
                {/* More-options dropdown */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => { setShowMoreMenu(v => !v); setShowDisappearPicker(false); }}
                    className={`p-2 hover:text-brand-gold transition rounded-lg ${showMoreMenu ? 'text-brand-gold' : ''}`}
                    title="More options"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {showMoreMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#1b2432] border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
                      {/* Disappearing messages */}
                      <div>
                        <button
                          onClick={() => setShowDisappearPicker(v => !v)}
                          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[12.5px] text-gray-200 hover:bg-white/5 transition"
                        >
                          <span className="flex items-center gap-2.5">
                            <Timer size={13} className="text-amber-400" />
                            Disappearing messages
                          </span>
                          <span className="flex items-center gap-1 text-amber-300 text-[11px]">
                            {disappearAfter ? formatDisappearLabel(disappearAfter) : 'Off'}
                            <ChevronDown size={11} className={`transition-transform ${showDisappearPicker ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        {showDisappearPicker && (
                          <div className="bg-white/5 mx-2 mb-1 rounded-lg overflow-hidden">
                            {DISAPPEAR_OPTIONS.map(opt => (
                              <button
                                key={String(opt.value)}
                                onClick={() => handleSetDisappear(opt.value)}
                                className={`w-full text-left px-4 py-2 text-[12px] transition flex items-center justify-between ${
                                  disappearAfter === opt.value
                                    ? 'text-amber-300 bg-amber-500/10'
                                    : 'text-gray-300 hover:bg-white/5'
                                }`}
                              >
                                {opt.label}
                                {disappearAfter === opt.value && <Check size={11} className="text-amber-400" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-white/8 mx-3 my-0.5" />
                      {/* Lock / Unlock */}
                      {chatLocked ? (
                        <button
                          onClick={handleRemoveLock}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-200 hover:bg-white/5 transition"
                        >
                          <LockOpen size={13} className="text-brand-gold" />
                          Remove chat lock
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowSetLock(true); setShowMoreMenu(false); setNewLockPin(''); setConfirmLockPin(''); setLockSetError(''); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-200 hover:bg-white/5 transition"
                        >
                          <Lock size={13} className="text-brand-gold" />
                          Lock conversation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reconnecting banner — only shows when Pusher socket is down */}
            {!pusherConnected && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-[10.5px] text-amber-800 font-medium">Reconnecting to Petra…</span>
              </div>
            )}

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
                      className={`flex flex-col mb-1 w-full ${isMe ? 'items-end' : 'items-start'}`}
                      style={{ transition: 'background-color 0.4s ease' }}
                      onDoubleClick={() => { if (!msg.is_deleted) handleMessageDoubleClick(msg); }}
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
                          onContextMenu={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const MENU_W = 228, MENU_H = 310, GAP = 10;
                            const vw = window.innerWidth, vh = window.innerHeight;

                            // Horizontal: my bubbles → menu left of bubble; theirs → menu right
                            let x: number, originX: string;
                            if (msg.is_mine) {
                              x = rect.left - MENU_W - GAP;
                              originX = 'right';
                              if (x < 8) { x = rect.right + GAP; originX = 'left'; }
                            } else {
                              x = rect.right + GAP;
                              originX = 'left';
                              if (x + MENU_W > vw - 8) { x = Math.max(8, rect.left - MENU_W - GAP); originX = 'right'; }
                            }

                            // Vertical: align with bubble top, flip up if near bottom
                            let y = rect.top, originY = 'top';
                            if (y + MENU_H > vh - 8) { y = Math.max(8, rect.bottom - MENU_H); originY = 'bottom'; }

                            setCtxMenu({ visible: true, exiting: false, x, y, origin: `${originY} ${originX}`, msg });
                          }}
                          className={`relative px-3.5 py-2.5 shadow-sm select-none ${
                            msg.is_deleted ? 'max-w-[72%]' :
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
                          {/* Tombstone — deleted message */}
                          {msg.is_deleted ? (
                            <span className={`flex items-center gap-1.5 italic text-[11px] ${isMe ? 'text-white/40' : 'text-gray-400'}`}>
                              <Ban size={12} />
                              {isMe ? 'You deleted this message' : 'This message was deleted'}
                            </span>
                          ) : editingMsgId === msg.id ? (
                            /* ── Inline edit mode ── */
                            <form onSubmit={e => { e.preventDefault(); handleSaveEdit(); }} className="min-w-[160px]">
                              <input
                                autoFocus
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Escape') setEditingMsgId(null); }}
                                className={`w-full bg-transparent border-b text-[12px] outline-none py-0.5 ${isMe ? 'border-white/40 text-white placeholder-white/40' : 'border-navy-300 text-navy-950'}`}
                                maxLength={2000}
                              />
                              <div className="flex gap-2 mt-1.5 justify-end">
                                <button type="button" onClick={() => setEditingMsgId(null)} className={`text-[9px] ${isMe ? 'text-white/50 hover:text-white/80' : 'text-gray-400 hover:text-gray-600'}`}>Cancel</button>
                                <button type="submit" className="text-[9px] text-brand-gold font-bold hover:text-amber-400">Save</button>
                              </div>
                            </form>
                          ) : (
                          <>
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
                          ) : msg.message_type === 'image' ? (
                            msg.view_once ? (
                              msg.viewed_at ? (
                                <div className={`flex items-center gap-2 px-1 py-0.5 ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                                  <EyeOff size={14} />
                                  <span className="text-[12px] italic">Opened</span>
                                </div>
                              ) : isMe ? (
                                <div className={`flex items-center gap-2 px-1 py-0.5 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                  <Eye size={14} />
                                  <span className="text-[12px] italic">Waiting to be opened</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setViewOnceModal({ msg })}
                                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-black/10 hover:bg-black/20 transition w-full"
                                >
                                  <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                    <Eye size={16} className={isMe ? 'text-white' : 'text-navy-900'} />
                                  </span>
                                  <div className="text-left">
                                    <p className={`text-[12px] font-semibold leading-tight ${isMe ? 'text-white' : 'text-navy-900'}`}>View once</p>
                                    <p className={`text-[10px] ${isMe ? 'text-white/55' : 'text-gray-400'}`}>Photo · disappears after viewing</p>
                                  </div>
                                </button>
                              )
                            ) : msg.file_url ? (
                              <div className="relative -mx-0.5 -mt-0.5">
                                <img src={msg.file_url} alt="Photo" className="max-w-full rounded-xl max-h-[270px] object-contain w-full block" />
                                <a href={msg.file_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                   className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
                                  <Download size={12} />
                                </a>
                              </div>
                            ) : null
                          ) : msg.message_type === 'video' ? (
                            msg.view_once ? (
                              msg.viewed_at ? (
                                <div className={`flex items-center gap-2 px-1 py-0.5 ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                                  <EyeOff size={14} />
                                  <span className="text-[12px] italic">Opened</span>
                                </div>
                              ) : isMe ? (
                                <div className={`flex items-center gap-2 px-1 py-0.5 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                  <Eye size={14} />
                                  <span className="text-[12px] italic">Waiting to be opened</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setViewOnceModal({ msg })}
                                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-black/10 hover:bg-black/20 transition w-full"
                                >
                                  <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                    <Eye size={16} className={isMe ? 'text-white' : 'text-navy-900'} />
                                  </span>
                                  <div className="text-left">
                                    <p className={`text-[12px] font-semibold leading-tight ${isMe ? 'text-white' : 'text-navy-900'}`}>View once</p>
                                    <p className={`text-[10px] ${isMe ? 'text-white/55' : 'text-gray-400'}`}>Video · disappears after viewing</p>
                                  </div>
                                </button>
                              )
                            ) : msg.file_url ? (
                              <div className="relative -mx-0.5 -mt-0.5">
                                <video src={msg.file_url} controls className="max-w-full rounded-xl max-h-[220px] w-full object-contain block" />
                                <a href={msg.file_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                   className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
                                  <Download size={12} />
                                </a>
                              </div>
                            ) : null
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

                          {/* Time + delivery receipt + edited label + star */}
                          <div className={`flex items-center gap-1 mt-1 justify-end ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                            {msg.is_starred && <Star size={9} className="text-brand-gold fill-brand-gold shrink-0" />}
                            {msg.edited_at && !msg.is_deleted && (
                              <span className="text-[8.5px] italic shrink-0">edited</span>
                            )}
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
                          </>
                          )}
                        </div>
                      </div>

                      {/* Reactions row — below the bubble */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {msg.reactions.map(r => (
                            <button
                              key={r.emoji}
                              onClick={() => handleReact(msg.id, r.emoji)}
                              className={`text-[11px] px-2 py-0.5 rounded-full border transition ${r.mine ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-amber-50'}`}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            {/* Typing indicator */}
            {partnerTyping && displayPartner && (
              <div className="px-4 pb-1 shrink-0">
                <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-2xl rounded-bl-[4px] px-3 py-2 shadow-sm">
                  <div className="flex gap-0.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{displayPartner.full_name} is typing…</span>
                </div>
              </div>
            )}

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

              {/* Upload progress bar */}
              {uploadProgress !== null && (
                <div className="mb-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${uploadProgress === 100 ? 'bg-emerald-500' : 'bg-brand-gold'}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
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
                    onChange={e => {
                      setMessageText(e.target.value);
                      if (activePartnerId) {
                        const ts = Date.now();
                        if (ts - lastTypingSentRef.current > 2000) {
                          lastTypingSentRef.current = ts;
                          triggerTyping(activePartnerId);
                        }
                      }
                    }}
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
                      disabled={uploadingAudio || uploadProgress !== null}
                      className="p-2.5 bg-navy-950 text-brand-gold hover:bg-navy-800 disabled:opacity-50 rounded-full transition shrink-0 shadow-sm cursor-pointer"
                      title={uploadProgress !== null ? 'Uploading…' : 'Record voice message'}
                    >
                      {(uploadingAudio || uploadProgress !== null) ? (
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

      {/* ────────── INFO PANE (third pane, right) ────────── */}
      {showInfoPane && activePartnerId && displayPartner && (
        <aside className="w-64 flex flex-col border-l border-slate-100 shrink-0 bg-white overflow-y-auto">

          {/* Header */}
          <div className="bg-navy-950 px-4 py-3.5 flex justify-between items-center shrink-0">
            <h3 className="text-white font-bold text-sm tracking-tight">Contact Info</h3>
            <button onClick={() => setShowInfoPane(false)} className="text-gray-400 hover:text-white transition p-1 rounded-lg">
              <X size={14} />
            </button>
          </div>

          {/* Avatar + name */}
          <div className="flex flex-col items-center pt-6 pb-5 px-4 border-b border-slate-100">
            {displayPartner.profile_image && !failedAvatars.has(displayPartner.id) ? (
              <img
                src={displayPartner.profile_image}
                alt={displayPartner.full_name}
                className="w-20 h-20 rounded-full border-2 border-brand-gold object-cover shadow-lg cursor-pointer"
                onClick={e => handlePartnerAvatarClick(e, displayPartner.profile_image, displayPartner.full_name)}
                onError={() => markFailed(displayPartner.id)}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-navy-950 border-2 border-brand-gold text-white font-bold font-serif text-2xl flex items-center justify-center shadow-lg cursor-pointer"
                onClick={e => handlePartnerAvatarClick(e, null, displayPartner.full_name)}
              >
                {getInitials(displayPartner.full_name)}
              </div>
            )}
            <h4 className="font-bold text-navy-950 text-sm mt-3 text-center leading-tight">{displayPartner.full_name}</h4>
            {displayPartner.username && (
              <p className="text-[10px] text-brand-gold font-mono mt-0.5">@{displayPartner.username}</p>
            )}
            <p className="text-gray-400 text-[11px] mt-0.5">{displayPartner.profession} Hub</p>
            <button
              onClick={() => openContactProfile(displayPartner.id)}
              className="mt-3 text-[11px] font-semibold text-brand-gold hover:text-brand-gold/80 transition border border-brand-gold/30 hover:border-brand-gold/60 rounded-full px-3 py-1"
            >
              View Profile
            </button>
          </div>

          {/* Stats row */}
          <div className="px-4 pt-4 pb-3">
            <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
              <div className="text-center">
                <p className="text-sm font-black text-navy-950">{thread.filter(m => !m.is_deleted).length}</p>
                <p className="text-[10px] text-gray-400">Messages</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-sm font-black text-navy-950">{sharedMedia.length}</p>
                <p className="text-[10px] text-gray-400">Photos</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-sm font-black text-navy-950">{thread.filter(m => m.is_starred).length}</p>
                <p className="text-[10px] text-gray-400">Starred</p>
              </div>
            </div>
          </div>

          {/* Shared media grid */}
          <div className="px-4 pb-4">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Shared Media</h5>
            {sharedMedia.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic">No media shared yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {sharedMedia.slice(0, 9).map(m => (
                    <a key={m.id} href={m.fileUrl} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-80 transition">
                      <img src={m.thumbUrl} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
                {sharedMedia.length > 9 && (
                  <p className="text-[11px] text-gray-400 mt-2 text-center">+{sharedMedia.length - 9} more photos</p>
                )}
              </>
            )}
          </div>

        </aside>
      )}

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
          {/* View-once toggle */}
          <button
            onClick={() => setSendViewOnce(v => !v)}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-[13px] transition ${sendViewOnce ? 'text-amber-400' : 'text-gray-200 hover:bg-white/5'}`}
          >
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition ${sendViewOnce ? 'bg-amber-500' : 'bg-slate-600'}`}>
              <Eye size={17} />
            </span>
            View once {sendViewOnce ? '· ON' : ''}
          </button>
          <div className="h-px bg-white/10 mx-3 my-1" />
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
                .filter(m => m.id !== currentUserId && (
                  m.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                  m.profession.toLowerCase().includes(contactSearch.toLowerCase()) ||
                  (m.username && ('@' + m.username).toLowerCase().includes(contactSearch.toLowerCase()))
                ))
                .map(m => (
                  <button key={m.id} onClick={() => handleSendContact(m)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                    {m.profile_image && !failedAvatars.has(m.id)
                      ? <img src={m.profile_image} alt={m.full_name} className="w-9 h-9 rounded-full object-cover border border-brand-gold/30 shrink-0" onError={() => markFailed(m.id)} />
                      : <div className="w-9 h-9 rounded-full bg-navy-950 text-white font-bold font-serif text-xs flex items-center justify-center shrink-0">{getInitials(m.full_name)}</div>
                    }
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-navy-950 truncate">{m.full_name}</p>
                      {m.username && <p className="text-[9px] text-brand-gold/80 font-mono">@{m.username}</p>}
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

      {/* ── Right-click context menu portal ── */}
      {ctxMenu.visible && ctxMenu.msg && ReactDOM.createPortal(
        <>
          <style>{`
            @keyframes ctx-in {
              0%   { opacity: 0; transform: scale(0.84); filter: blur(4px);  }
              60%  { opacity: 1; filter: blur(0);                             }
              100% { opacity: 1; transform: scale(1);    filter: blur(0);    }
            }
            @keyframes ctx-out {
              0%   { opacity: 1; transform: scale(1);    filter: blur(0);    }
              100% { opacity: 0; transform: scale(0.84); filter: blur(4px);  }
            }
            .ctx-enter {
              animation: ctx-in 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
              transform-origin: var(--ctx-origin, top left);
            }
            .ctx-exit {
              animation: ctx-out 130ms cubic-bezier(0.55, 0, 1, 0.45) forwards;
              transform-origin: var(--ctx-origin, top left);
              pointer-events: none;
            }
            .ctx-emoji-btn {
              transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1),
                          background 110ms ease,
                          box-shadow 110ms ease;
            }
            .ctx-emoji-btn:hover { transform: scale(1.35); }
            .ctx-emoji-btn:active { transform: scale(1.15); transition-duration: 60ms; }
            .ctx-row {
              transition: background 80ms ease;
              position: relative;
            }
            .ctx-row:hover { background: rgba(0,0,0,0.038); }
            .ctx-row:active { background: rgba(0,0,0,0.07); transition-duration: 40ms; }
            .ctx-row-danger:hover  { background: rgba(244,63,94,0.07); }
            .ctx-row-danger:active { background: rgba(244,63,94,0.12); }
          `}</style>

          {/* Backdrop dismiss */}
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={closeCtxMenu}
          />

          {/* Menu */}
          <div
            className={`${ctxMenu.exiting ? 'ctx-exit' : 'ctx-enter'} fixed z-[9999] select-none`}
            style={{ top: ctxMenu.y, left: ctxMenu.x, '--ctx-origin': ctxMenu.origin } as React.CSSProperties}
            onMouseDown={e => e.stopPropagation()}
          >
            <div
              className="w-[228px] rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(28px) saturate(200%)',
                WebkitBackdropFilter: 'blur(28px) saturate(200%)',
                border: '1px solid rgba(0,0,0,0.075)',
                boxShadow:
                  '0 0 0 0.5px rgba(0,0,0,0.06), ' +
                  '0 2px 4px rgba(0,0,0,0.04), ' +
                  '0 8px 20px rgba(0,0,0,0.10), ' +
                  '0 20px 44px rgba(0,0,0,0.12)',
              }}
            >
              {/* ── Emoji reaction bar ── */}
              <div
                className="flex items-center justify-between px-3 pt-3 pb-2.5"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}
              >
                {(['👍','❤️','😂','😮','😢','😡'] as const).map(emoji => {
                  const active = ctxMenu.msg!.reactions?.some(r => r.emoji === emoji && r.mine);
                  return (
                    <button
                      key={emoji}
                      onClick={() => { handleReact(ctxMenu.msg!.id, emoji); closeCtxMenu(); }}
                      className={`ctx-emoji-btn w-[36px] h-[36px] text-[22px] rounded-full flex items-center justify-center ${
                        active
                          ? 'bg-amber-50 shadow-[0_0_0_2.5px_#fbbf24,0_2px_6px_rgba(251,191,36,0.3)]'
                          : 'hover:bg-black/5'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>

              {/* ── Action items ── */}
              <div className="py-1.5">

                {/* Reply */}
                {!ctxMenu.msg!.is_deleted && (
                  <button
                    onClick={() => { handleMessageDoubleClick(ctxMenu.msg!); closeCtxMenu(); }}
                    className="ctx-row w-full flex items-center gap-3 px-3.5 py-[10px]"
                  >
                    <span className="w-[30px] h-[30px] rounded-[9px] bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <CornerUpLeft size={14} className="text-blue-500" />
                    </span>
                    <span className="text-[13px] font-[500] text-slate-700 tracking-[-0.01em]">Reply</span>
                  </button>
                )}

                {/* Edit */}
                {canEditMsg(ctxMenu.msg!) && (
                  <button
                    onClick={() => {
                      setEditText(ctxMenu.msg!.content);
                      setEditingMsgId(ctxMenu.msg!.id);
                      closeCtxMenu();
                    }}
                    className="ctx-row w-full flex items-center gap-3 px-3.5 py-[10px]"
                  >
                    <span className="w-[30px] h-[30px] rounded-[9px] bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Pencil size={14} className="text-violet-500" />
                    </span>
                    <span className="text-[13px] font-[500] text-slate-700 tracking-[-0.01em]">Edit</span>
                  </button>
                )}

                {/* Star */}
                <button
                  onClick={() => { handleStar(ctxMenu.msg!.id); closeCtxMenu(); }}
                  className="ctx-row w-full flex items-center gap-3 px-3.5 py-[10px]"
                >
                  <span className="w-[30px] h-[30px] rounded-[9px] bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Star size={14} className={ctxMenu.msg!.is_starred ? 'text-amber-400 fill-amber-400' : 'text-amber-400'} />
                  </span>
                  <span className="text-[13px] font-[500] text-slate-700 tracking-[-0.01em]">
                    {ctxMenu.msg!.is_starred ? 'Unstar' : 'Star'}
                  </span>
                </button>
              </div>

              {/* ── Delete (separated) ── */}
              {ctxMenu.msg!.is_mine && !ctxMenu.msg!.is_deleted && (
                <>
                  <div style={{ height: '1px', background: 'rgba(0,0,0,0.055)', margin: '0 12px' }} />
                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        setRetractPopupPos({ top: ctxMenu.y, left: ctxMenu.x });
                        setConfirmDeleteMsgId(ctxMenu.msg!.id);
                        closeCtxMenu();
                      }}
                      className="ctx-row ctx-row-danger w-full flex items-center gap-3 px-3.5 py-[10px]"
                    >
                      <span className="w-[30px] h-[30px] rounded-[9px] bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={14} className="text-rose-500" />
                      </span>
                      <span className="text-[13px] font-[500] text-rose-500 tracking-[-0.01em]">Delete for everyone</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── View-once media lightbox ── */}
      {viewOnceModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
          {/* Header */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <Eye size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-white text-[13px] font-semibold leading-tight">View once</p>
                <p className="text-white/45 text-[10px]">Disappears after closing</p>
              </div>
            </div>
            <button
              onClick={() => {
                handleMarkViewed(viewOnceModal.msg);
                setViewOnceModal(null);
              }}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Media */}
          <div className="max-w-3xl w-full px-4">
            {viewOnceModal.msg.message_type === 'image' && viewOnceModal.msg.file_url ? (
              <img
                src={viewOnceModal.msg.file_url}
                alt="View once"
                className="max-h-[75vh] max-w-full mx-auto rounded-2xl object-contain block shadow-2xl"
              />
            ) : viewOnceModal.msg.message_type === 'video' && viewOnceModal.msg.file_url ? (
              <video
                src={viewOnceModal.msg.file_url}
                autoPlay
                controls
                className="max-h-[75vh] max-w-full mx-auto rounded-2xl object-contain block shadow-2xl"
              />
            ) : null}
          </div>

          {/* Footer CTA */}
          <div className="absolute bottom-0 inset-x-0 flex justify-center pb-8">
            <button
              onClick={() => {
                handleMarkViewed(viewOnceModal.msg);
                setViewOnceModal(null);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[13px] font-medium transition"
            >
              <EyeOff size={14} />
              Close &amp; mark as opened
            </button>
          </div>
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

      {/* ── PIN gate overlay (chat lock) ── */}
      {showPinGate && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-navy-950/95 backdrop-blur-xl">
          <div className="w-full max-w-[320px] mx-4 flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center shadow-lg">
              <Lock size={28} className="text-brand-gold" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Locked conversation</p>
              <p className="text-gray-400 text-sm mt-1">
                Enter your PIN to open chat with{' '}
                <span className="text-white font-medium">{displayPartner?.full_name}</span>
              </p>
            </div>
            <div className="w-full flex flex-col gap-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="Enter PIN"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                autoFocus
                className="w-full text-center text-2xl tracking-[0.5em] font-bold bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-brand-gold/60 transition"
              />
              {pinError && <p className="text-rose-400 text-xs text-center">{pinError}</p>}
              <button
                onClick={handleVerifyPin}
                disabled={pinInput.length < 4 || pinLoading}
                className="w-full py-3 rounded-xl bg-brand-gold text-navy-950 font-bold text-sm hover:bg-brand-gold/90 transition disabled:opacity-40"
              >
                {pinLoading ? 'Verifying…' : 'Unlock'}
              </button>
              <button
                onClick={() => { setShowPinGate(false); setActivePartnerId(null); setPinInput(''); }}
                className="text-gray-500 text-xs hover:text-gray-300 transition text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Set lock PIN modal ── */}
      {showSetLock && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[340px] mx-4 bg-[#1b2432] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center">
                  <KeyRound size={15} className="text-brand-gold" />
                </div>
                <span className="text-white font-bold text-[14px]">Lock conversation</span>
              </div>
              <button onClick={() => setShowSetLock(false)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <p className="text-gray-400 text-[12.5px] leading-relaxed">
                Set a PIN to lock this conversation. You'll need to enter it every time you open this chat.
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-1.5 block">New PIN (4–8 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="••••"
                    value={newLockPin}
                    onChange={e => { setNewLockPin(e.target.value.replace(/\D/g, '')); setLockSetError(''); }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand-gold/50 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-1.5 block">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="••••"
                    value={confirmLockPin}
                    onChange={e => { setConfirmLockPin(e.target.value.replace(/\D/g, '')); setLockSetError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSetLockSave()}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-brand-gold/50 transition"
                  />
                </div>
                {lockSetError && <p className="text-rose-400 text-xs">{lockSetError}</p>}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowSetLock(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition">Cancel</button>
              <button onClick={handleSetLockSave} disabled={newLockPin.length < 4} className="flex-1 py-2.5 rounded-xl bg-brand-gold text-navy-950 font-bold text-sm hover:bg-brand-gold/90 transition disabled:opacity-40">Set PIN</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Command palette (Ctrl+K) ── */}
      {showCmdPalette && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[10020] flex items-start justify-center pt-[14vh]"
          onMouseDown={() => setShowCmdPalette(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[500px] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                ref={cmdInputRef}
                type="text"
                value={cmdQuery}
                onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, cmdResults.length - 1)); }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)); }
                  if (e.key === 'Enter' && cmdResults[cmdIdx]) {
                    handleSelectPartner(cmdResults[cmdIdx].id, cmdResults[cmdIdx].partnerInfo);
                    setShowCmdPalette(false);
                  }
                  if (e.key === 'Escape') setShowCmdPalette(false);
                }}
                placeholder="Search conversations or people..."
                className="flex-1 text-sm text-navy-950 placeholder-gray-400 focus:outline-none bg-transparent"
                autoFocus
              />
              <kbd className="text-[10px] text-gray-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono shrink-0">ESC</kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto py-1.5">
              {cmdResults.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">No conversations found</p>
              ) : (
                cmdResults.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => { handleSelectPartner(r.id, r.partnerInfo); setShowCmdPalette(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition text-left ${i === cmdIdx ? 'bg-brand-gold/8 border-l-2 border-brand-gold' : 'hover:bg-slate-50 border-l-2 border-transparent'}`}
                  >
                    {r.image && !failedAvatars.has(r.id) ? (
                      <img src={r.image} alt={r.name} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" onError={() => markFailed(r.id)} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-navy-950 text-white font-bold font-serif text-xs flex items-center justify-center shrink-0">{getInitials(r.name)}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-navy-950 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>
                    </div>
                    {i === cmdIdx && <span className="text-brand-gold text-xs shrink-0 font-mono">↵</span>}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-4 text-[10px] text-gray-400 bg-slate-50/60">
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono">↵</kbd> open</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono">Esc</kbd> close</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Keyboard shortcuts help (Ctrl+/) ── */}
      {showShortcutsHelp && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[10020] flex items-center justify-center"
          onMouseDown={() => setShowShortcutsHelp(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[360px] mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-navy-950">
              <h3 className="font-bold text-white text-sm tracking-tight">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcutsHelp(false)} className="text-gray-400 hover:text-white transition">
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {([
                { keys: ['Ctrl', 'K'], desc: 'Open command palette' },
                { keys: ['Ctrl', 'I'], desc: 'Toggle contact info pane' },
                { keys: ['Ctrl', '/'], desc: 'Show keyboard shortcuts' },
                { keys: ['Alt', '↓'],  desc: 'Next conversation' },
                { keys: ['Alt', '↑'],  desc: 'Previous conversation' },
                { keys: ['Esc'],       desc: 'Close overlay' },
              ] as { keys: string[]; desc: string }[]).map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{desc}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k, ki) => (
                      <React.Fragment key={k}>
                        {ki > 0 && <span className="text-gray-300 text-[10px]">+</span>}
                        <kbd className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-gray-700">{k}</kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-center">
              <p className="text-[10px] text-gray-400">Press <kbd className="bg-white border border-slate-200 px-1 rounded font-mono">Ctrl+/</kbd> to toggle this panel</p>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
