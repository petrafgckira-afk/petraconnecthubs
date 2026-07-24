import React, { useState, useEffect, useRef } from 'react';
import { HubAnnouncement, HubEvent, UserRole, HubType, PetraNotification } from '../types';
import LucideIcon from './LucideIcon';
import { Calendar, Heart, MessageSquare, Plus, Check, Briefcase, Award, Users, ShieldAlert, MapPin, Clock, Edit3, Trash2, X, Save, Bell, BellOff, CheckCheck, UserPlus, Megaphone } from 'lucide-react';

interface DashboardStats {
  hub_name: string;
  hub_member_count: number;
  connections_count: number;
  membership_status: string;
  pending_approvals: number;
}

interface DashboardProps {
  userRole: UserRole;
  userHub: HubType;
  userName: string;
  announcements: HubAnnouncement[];
  events: HubEvent[];
  stats: DashboardStats | null;
  onLikeAnnouncement: (id: string) => void;
  onRegisterEvent: (id: string) => void;
  onEditAnnouncement: (id: string, title: string, content: string) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onEditEvent: (id: string, data: { title: string; description: string; date: string; time: string; location: string }) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  currentUserRole: UserRole;
  setView: (view: string) => void;
  adminHubScope?: { hubId: string | null; hubName: string | null };
  notifications: PetraNotification[];
  onMarkNotificationRead: (id: string) => void;
  onClearAllNotifications: () => void;
  onSendMessage: (userId: string) => void;
}

export default function Dashboard({
  userRole,
  userHub,
  userName,
  announcements,
  events,
  stats,
  onLikeAnnouncement,
  onRegisterEvent,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onEditEvent,
  onDeleteEvent,
  currentUserRole,
  setView,
  adminHubScope,
  notifications,
  onMarkNotificationRead,
  onClearAllNotifications,
  onSendMessage,
}: DashboardProps) {

  const [failedPostAvatars, setFailedPostAvatars] = useState<Set<string>>(new Set());
  const markPostAvatarFailed = (id: string) => setFailedPostAvatars(prev => new Set([...prev, id]));

  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editTitle, setEditTitle]             = useState('');
  const [editContent, setEditContent]         = useState('');
  const [editError, setEditError]             = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError]         = useState('');
  const [saving, setSaving]                   = useState(false);
  const [deleting, setDeleting]               = useState(false);

  // ── Event edit / delete state ──────────────────────────────────────────────
  const [editingEventId, setEditingEventId]               = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle]               = useState('');
  const [editEventDesc, setEditEventDesc]                 = useState('');
  const [editEventDate, setEditEventDate]                 = useState('');
  const [editEventTime, setEditEventTime]                 = useState('');
  const [editEventLocation, setEditEventLocation]         = useState('');
  const [editEventError, setEditEventError]               = useState('');
  const [confirmDeleteEventId, setConfirmDeleteEventId]   = useState<string | null>(null);
  const [eventDeleteError, setEventDeleteError]           = useState('');
  const [savingEvent, setSavingEvent]                     = useState(false);
  const [deletingEvent, setDeletingEvent]                 = useState(false);

  // ── Notification widget state ──────────────────────────────────────────────
  const [tickerIndex, setTickerIndex]   = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const unreadNotifs = notifications.filter(n => !n.read);
  const tickerNotifs = notifications.slice(0, 10); // show up to 10 in ticker

  // Auto-advance ticker every 3 seconds
  useEffect(() => {
    if (tickerNotifs.length <= 1) return;
    const timer = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIndex(i => (i + 1) % tickerNotifs.length);
        setTickerVisible(true);
      }, 300);
    }, 3500);
    return () => clearInterval(timer);
  }, [tickerNotifs.length]);

  // Close panel on outside click
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  const notifIcon = (type: PetraNotification['type']) => {
    switch (type) {
      case 'message':      return <MessageSquare size={13} className="text-blue-400" />;
      case 'announcement': return <Megaphone size={13} className="text-brand-gold" />;
      case 'event':        return <Calendar size={13} className="text-green-400" />;
      case 'connection':   return <UserPlus size={13} className="text-purple-400" />;
      case 'approval':     return <CheckCheck size={13} className="text-emerald-400" />;
      default:             return <Bell size={13} className="text-gray-400" />;
    }
  };

  const handleNotifClick = (notif: PetraNotification) => {
    onMarkNotificationRead(notif.id);
    setShowNotifPanel(false);
    switch (notif.type) {
      case 'message':
        if (notif.meta?.senderId) onSendMessage(notif.meta.senderId);
        else setView('messages');
        break;
      case 'announcement': setView('dashboard'); break;
      case 'event':        setView('dashboard'); break;
      case 'connection':   setView('members');   break;
      case 'approval':     setView('hub');        break;
      default:             setView('dashboard');
    }
  };

  const startEditEvent = (evt: HubEvent) => {
    setEditingEventId(evt.id);
    setEditEventTitle(evt.title);
    setEditEventDesc(evt.description);
    setEditEventDate(evt.date);
    setEditEventTime(evt.timeRaw ?? '');
    setEditEventLocation(evt.location);
    setEditEventError('');
    setConfirmDeleteEventId(null);
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditEventError('');
  };

  const saveEditEvent = async (id: string) => {
    if (!editEventTitle.trim() || !editEventDate.trim()) return;
    setSavingEvent(true);
    setEditEventError('');
    try {
      await onEditEvent(id, {
        title: editEventTitle.trim(),
        description: editEventDesc.trim(),
        date: editEventDate,
        time: editEventTime,
        location: editEventLocation.trim(),
      });
      setEditingEventId(null);
    } catch {
      setEditEventError('Failed to save changes. Please try again.');
    } finally {
      setSavingEvent(false);
    }
  };

  const confirmDeleteEvent = (id: string) => {
    setConfirmDeleteEventId(id);
    setEventDeleteError('');
    setEditingEventId(null);
  };

  const executeDeleteEvent = async (id: string) => {
    setDeletingEvent(true);
    setEventDeleteError('');
    try {
      await onDeleteEvent(id);
      setConfirmDeleteEventId(null);
    } catch {
      setEventDeleteError('Failed to delete. Please try again.');
      setDeletingEvent(false);
    }
  };

  const startEdit = (post: HubAnnouncement) => {
    setEditingId(post.id);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditError('');
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditError('');
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    setEditError('');
    try {
      await onEditAnnouncement(id, editTitle.trim(), editContent.trim());
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
    } catch {
      setEditError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setConfirmDeleteId(id);
    setDeleteError('');
    setEditingId(null);
  };

  const executeDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAnnouncement(id);
      setConfirmDeleteId(null);
    } catch {
      setDeleteError('Failed to delete. Please try again.');
      setDeleting(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12)  return 'Good Morning 👋';
    if (hour >= 12 && hour < 17) return 'Good Afternoon 👋';
    if (hour >= 17 && hour < 21) return 'Good Evening 👋';
    return 'Good Night 😴';
  };

  const visibleAnnouncements = announcements.filter(a => {
    if (userRole === 'admin') {
      if (!adminHubScope?.hubId) return true; // All Hubs — show everything
      const scopeHub = adminHubScope.hubName?.replace(' Hub', '') ?? '';
      return a.hubId === 'All' || a.hubId === scopeHub;
    }
    return a.hubId === 'All' || a.hubId === userHub;
  });

  const myHubMembersCount     = stats?.hub_member_count  ?? 0;
  const pendingApprovalsCount = stats?.pending_approvals ?? 0;
  const connectedCount        = stats?.connections_count ?? 0;
  const membershipStatus      = stats?.membership_status ?? 'pending';

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    approved: { label: 'Active Member',    color: 'text-emerald-600', dot: 'bg-emerald-500' },
    pending:  { label: 'Pending Approval', color: 'text-amber-600',   dot: 'bg-amber-400'   },
    rejected: { label: 'Not Approved',     color: 'text-rose-600',    dot: 'bg-rose-500'     },
    none:     { label: 'No Hub Applied',   color: 'text-gray-400',    dot: 'bg-gray-300'     },
  };
  const statusDisplay = statusConfig[membershipStatus] ?? statusConfig['none'];

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in">
      
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-navy-950 p-6 md:p-8 rounded-2xl border-l-4 border-brand-gold text-white relative overflow-hidden shadow-md">
        <div className="absolute right-0 bottom-0 top-0 w-1/4 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-brand-gold/10 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="inline-block text-[9px] font-bold uppercase tracking-widest bg-brand-gold/15 text-brand-gold border border-brand-gold/30 px-2.5 py-1 rounded-full mb-1">
            {userRole === 'admin' ? 'Admin Panel' : userRole === 'leader' ? 'Leader Panel' : 'Member Panel'}
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight">
            {getGreeting()}, <span className="text-brand-gold font-normal italic">{userName}</span>
          </h1>
          <p className="text-gray-300 text-sm max-w-2xl leading-normal">
            {userRole === 'member' && `Welcome to your vocation community. You belong to the Petra ${userHub} Hub. Connect with fellow members and support church outreaches today.`}
            {userRole === 'leader' && `Under your lead stewardship, there are ${myHubMembersCount} verified professionals and ${pendingApprovalsCount} pending applicants in the ${userHub} Hub.`}
            {userRole === 'admin' && 'You have global administrator clearance. You can manage system-wide activities, register announcements, alter user roles, and monitor logs.'}
          </p>
        </div>
      </div>

      {/* 2. Professional Stats Panel */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-section">
        
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">My Hub</span>
            <span className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center shrink-0">
              <Briefcase size={15} />
            </span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-navy-950">{myHubMembersCount}</div>
            <p className="text-[10px] text-gray-500 font-mono">Verified Vocation Peers</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Connections</span>
            <span className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center shrink-0">
              <Users size={15} />
            </span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-navy-950">{connectedCount}</div>
            <p className="text-[10px] text-gray-400">Network Circle Size</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-1 col-span-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-wider">My Guild Status</span>
            <span className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center shrink-0">
              <Award size={15} />
            </span>
          </div>
          <div>
            <div className={`text-sm md:text-base font-bold mt-1 capitalize leading-none flex items-center gap-1 ${statusDisplay.color}`}>
              <span className={`w-2 h-2 rounded-full block ${statusDisplay.dot}`}></span> {statusDisplay.label}
            </div>
            <p className="text-[10px] text-gray-500 font-mono mt-2 uppercase">
              {userRole === 'admin'
                ? (adminHubScope?.hubId
                    ? adminHubScope.hubName?.replace(' Hub', '')
                    : 'All Hubs')
                : userHub}
            </p>
          </div>
        </div>

        {userRole === 'leader' || userRole === 'admin' ? (
          <div 
            onClick={() => setView('leader-panel')}
            className="bg-brand-gold-light p-5 rounded-xl border-2 border-brand-gold/25 shadow-xs shrink-0 flex flex-col justify-between cursor-pointer hover:border-brand-gold transition duration-200"
          >
            <div className="flex justify-between items-center text-brand-gold-dark">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Task Actions</span>
              <span className="w-8 h-8 rounded-lg bg-white text-brand-gold flex items-center justify-center shadow-xs">
                <ShieldAlert size={15} className="text-amber-700" />
              </span>
            </div>
            <div>
              <div className="text-lg font-black text-navy-950 flex items-center gap-1.5 leading-none">
                {pendingApprovalsCount} <span className="text-xs font-semibold font-sans text-gray-500">Wait Approvals</span>
              </div>
              <p className="text-[10px] text-amber-800 font-bold hover:underline mt-1.5 flex items-center gap-0.5">
                Go to Leadership Panel →
              </p>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setView('members')}
            className="bg-navy-50/50 p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between cursor-pointer hover:bg-navy-50 duration-200 transition"
          >
            <div className="flex justify-between items-center text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Outreach</span>
              <span className="w-8 h-8 rounded-lg bg-white text-navy-900 flex items-center justify-center border border-gray-150 shadow-xs">
                <Plus size={15} />
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-navy-900 leading-tight">Find more peers?</div>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">Inspect Church Directory</p>
            </div>
          </div>
        )}

      </section>

      {/* 3. Main Dashboard Double Column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER: Feed Section */}
        <section className="lg:col-span-2 space-y-5">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <h2 className="font-serif text-lg font-semibold text-navy-950">Recent Platform Bulletins</h2>
              <p className="text-[11px] text-gray-500">Official updates from the lead coordinators and ministries.</p>
            </div>
            {userRole === 'leader' && (
              <button 
                onClick={() => setView('leader-panel')}
                className="inline-flex items-center gap-1 bg-navy-900 hover:bg-navy-800 text-white font-medium text-xs py-1.5 px-3 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus size={12} /> Post Bulletin
              </button>
            )}
          </div>

          <div className="space-y-4">
            {visibleAnnouncements.length === 0 ? (
              <div className="bg-white border rounded-xl p-8 text-center text-gray-400 italic">
                No active announcements for your specific Hub.
              </div>
            ) : (
              visibleAnnouncements.map((post) => {
                const isEditing       = editingId === post.id;
                const isConfirmDelete = confirmDeleteId === post.id;
                const canManage       = post.isOwner || currentUserRole === 'admin';

                return (
                  <article
                    key={post.id}
                    className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs hover:border-navy-200 transition duration-150 space-y-4"
                  >
                    {/* Header — author info + meta + manage buttons */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-gold/30 shrink-0">
                          {post.authorImage && !failedPostAvatars.has(post.id) ? (
                            <img
                              src={post.authorImage}
                              alt={post.authorName}
                              className="w-full h-full object-cover"
                              onError={() => markPostAvatarFailed(post.id)}
                            />
                          ) : (
                            <div className="w-full h-full bg-navy-900 text-brand-gold font-bold flex items-center justify-center text-xs">
                              {post.authorAvatar}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-navy-950 block truncate">{post.authorName}</span>
                          <span className="text-[10px] text-amber-800 font-medium block leading-none">{post.authorRole}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-navy-50 text-navy-900 rounded border border-navy-100 uppercase hidden sm:block">
                          {post.hubId === 'All' ? 'Platform' : `${post.hubId} Hub`}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{post.date}</span>

                        {/* Edit / Delete buttons — only visible to owner or admin */}
                        {canManage && !isEditing && !isConfirmDelete && (
                          <>
                            <button
                              onClick={() => startEdit(post)}
                              title="Edit announcement"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-navy-900 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => confirmDelete(post.id)}
                              title="Delete announcement"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}

                        {/* Cancel when editing */}
                        {isEditing && (
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Cancel edit"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Confirm delete banner */}
                    {isConfirmDelete && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-rose-700 font-medium">Delete this announcement permanently?</p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => { setConfirmDeleteId(null); setDeleteError(''); }}
                              disabled={deleting}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-gray-600 text-xs font-medium hover:bg-white transition cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => executeDelete(post.id)}
                              disabled={deleting}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-60"
                            >
                              <Trash2 size={11} /> {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                        {deleteError && (
                          <p className="text-[11px] text-rose-600 font-medium">{deleteError}</p>
                        )}
                      </div>
                    )}

                    {/* Body — inline edit form OR read view */}
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Title</label>
                          <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy-950 focus:outline-none focus:border-brand-gold transition"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Content</label>
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={4}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy-950 leading-relaxed focus:outline-none focus:border-brand-gold transition resize-none"
                          />
                        </div>
                        {editError && (
                          <p className="text-[11px] text-rose-600 font-medium">{editError}</p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-gray-600 text-xs font-medium hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(post.id)}
                            disabled={saving || !editTitle.trim() || !editContent.trim()}
                            className="px-4 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Save size={11} /> {saving ? 'Saving…' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <h3 className="font-sans font-bold text-navy-950 text-sm leading-snug">{post.title}</h3>
                        <p className="text-gray-600 text-xs leading-relaxed max-w-full text-justify whitespace-pre-wrap">{post.content}</p>
                      </div>
                    )}

                    {/* Actions Bar — hidden while editing */}
                    {!isEditing && (
                      <div className="pt-3 border-t border-slate-100 flex gap-4 items-center text-xs text-gray-500 font-medium select-none">
                        <button
                          onClick={() => onLikeAnnouncement(post.id)}
                          className={`flex items-center gap-1 hover:text-rose-500 transition cursor-pointer ${
                            post.likedByUser ? 'text-rose-600 font-bold' : ''
                          }`}
                        >
                          <Heart size={14} fill={post.likedByUser ? 'currentColor' : 'none'} />
                          <span>{post.likesCount} {post.likesCount === 1 ? 'Like' : 'Likes'}</span>
                        </button>
                        <button
                          onClick={() => setView('messages')}
                          className="flex items-center gap-1 hover:text-navy-900 transition cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          <span>{post.commentsCount} Comments</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT: Events list / Quick Actions */}
        <section className="space-y-6">
          
          {/* Upcoming Events Section */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="font-serif text-lg font-semibold text-navy-950">Upcoming Formations</h2>
              <p className="text-[11px] text-gray-500">Register or join scheduled fellowships.</p>
            </div>

            <div className="space-y-3">
              {events.map((evt) => {
                const isEditingEvt       = editingEventId === evt.id;
                const isConfirmDeleteEvt = confirmDeleteEventId === evt.id;
                const canManageEvt       = evt.isOwner || currentUserRole === 'admin';

                return (
                  <div
                    key={evt.id}
                    className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs space-y-3 hover:border-brand-gold transition duration-150"
                  >
                    {/* Header: hub badge + title + manage buttons */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-gold-light text-amber-800 uppercase tracking-wide block w-fit mb-1 border border-brand-gold/10">
                          {evt.hubId === 'All' ? 'All Hubs' : `${evt.hubId}`}
                        </span>
                        {!isEditingEvt && (
                          <h4 className="font-bold text-xs text-navy-950 leading-tight">{evt.title}</h4>
                        )}
                      </div>

                      {canManageEvt && !isEditingEvt && !isConfirmDeleteEvt && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditEvent(evt)}
                            title="Edit event"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-navy-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => confirmDeleteEvent(evt.id)}
                            title="Delete event"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {isEditingEvt && (
                        <button
                          onClick={cancelEditEvent}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer shrink-0"
                          title="Cancel edit"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Delete confirmation banner */}
                    {isConfirmDeleteEvt && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-rose-700 font-medium">Delete this event permanently?</p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => { setConfirmDeleteEventId(null); setEventDeleteError(''); }}
                              disabled={deletingEvent}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-gray-600 text-xs font-medium hover:bg-white transition cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => executeDeleteEvent(evt.id)}
                              disabled={deletingEvent}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-60"
                            >
                              <Trash2 size={11} /> {deletingEvent ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                        {eventDeleteError && (
                          <p className="text-[11px] text-rose-600 font-medium">{eventDeleteError}</p>
                        )}
                      </div>
                    )}

                    {/* Inline edit form */}
                    {isEditingEvt ? (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Title</label>
                          <input
                            value={editEventTitle}
                            onChange={e => setEditEventTitle(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy-950 focus:outline-none focus:border-brand-gold transition"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Description</label>
                          <textarea
                            value={editEventDesc}
                            onChange={e => setEditEventDesc(e.target.value)}
                            rows={3}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy-950 leading-relaxed focus:outline-none focus:border-brand-gold transition resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Date</label>
                            <input
                              type="date"
                              value={editEventDate}
                              onChange={e => setEditEventDate(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy-950 focus:outline-none focus:border-brand-gold transition"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Time</label>
                            <input
                              type="time"
                              value={editEventTime}
                              onChange={e => setEditEventTime(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy-950 focus:outline-none focus:border-brand-gold transition"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-navy-900 uppercase tracking-wider block">Location</label>
                          <input
                            value={editEventLocation}
                            onChange={e => setEditEventLocation(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-navy-950 focus:outline-none focus:border-brand-gold transition"
                          />
                        </div>
                        {editEventError && (
                          <p className="text-[11px] text-rose-600 font-medium">{editEventError}</p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={cancelEditEvent}
                            disabled={savingEvent}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-gray-600 text-xs font-medium hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditEvent(evt.id)}
                            disabled={savingEvent || !editEventTitle.trim() || !editEventDate.trim()}
                            className="px-4 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Save size={11} /> {savingEvent ? 'Saving…' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2">{evt.description}</p>

                        {evt.speakerName && (
                          <div className="text-[10px] text-navy-800 font-medium">
                            Keynote: <span className="font-bold">{evt.speakerName}</span> ({evt.speakerTitle})
                          </div>
                        )}

                        {/* Time / Place Details */}
                        <div className="text-[10px] text-gray-400 font-mono space-y-1 pt-1.5 border-t border-slate-50 flex flex-col justify-center">
                          <div className="flex items-center gap-1">
                            <Clock size={11} className="text-gray-500" />
                            <span>{evt.date} • {evt.time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin size={11} className="text-gray-500" />
                            <span className="truncate">{evt.location}</span>
                          </div>
                        </div>

                        {/* Register / Join button */}
                        {!isConfirmDeleteEvt && (
                          <button
                            onClick={() => onRegisterEvent(evt.id)}
                            className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              evt.isRegistered
                                ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-100'
                                : 'bg-navy-900 hover:bg-navy-800 text-white border-0'
                            }`}
                          >
                            {evt.isRegistered ? (
                              <><Check size={12} /> Registered ({evt.attendeesCount} attendees)</>
                            ) : (
                              <>Join Meeting ({evt.attendeesCount})</>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Notification ticker card ── */}
          <div className="bg-navy-900 border-2 border-brand-gold rounded-xl text-white relative overflow-visible flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-brand-gold" />
                <span className="text-[10px] font-black text-brand-gold uppercase tracking-wider">Notifications</span>
              </div>
              {unreadNotifs.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadNotifs.length}
                </span>
              )}
            </div>

            {/* Ticker body */}
            <div className="flex-1 px-4 py-3 min-h-[72px] flex items-center">
              {tickerNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center w-full gap-1.5 py-2">
                  <BellOff size={18} className="text-gray-600" />
                  <p className="text-[10px] text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <div
                  className="w-full transition-all duration-300"
                  style={{ opacity: tickerVisible ? 1 : 0, transform: tickerVisible ? 'translateY(0)' : 'translateY(6px)' }}
                >
                  {(() => {
                    const n = tickerNotifs[tickerIndex % tickerNotifs.length];
                    if (!n) return null;
                    return (
                      <button
                        onClick={() => handleNotifClick(n)}
                        className="w-full text-left flex items-start gap-2.5 group"
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.read ? 'bg-white/5' : 'bg-white/10'}`}>
                          {notifIcon(n.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold leading-snug truncate group-hover:text-brand-gold transition ${n.read ? 'text-gray-400' : 'text-white'}`}>
                            {n.title}
                          </p>
                          <p className="text-[9.5px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{n.description}</p>
                          <p className="text-[8.5px] text-gray-600 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0 mt-1.5" />}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Dots + See more */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-white/10">
              {/* Progress dots */}
              <div className="flex gap-1">
                {tickerNotifs.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setTickerIndex(i); setTickerVisible(true); }}
                    className={`rounded-full transition-all duration-300 ${i === tickerIndex % tickerNotifs.length ? 'w-3 h-1.5 bg-brand-gold' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setShowNotifPanel(true)}
                className="text-[9.5px] font-bold text-brand-gold hover:text-amber-400 transition"
              >
                See more →
              </button>
            </div>

            {/* ── Expanded notification panel ── */}
            {showNotifPanel && (
              <div
                ref={notifPanelRef}
                className="absolute bottom-full right-0 mb-2 w-[400px] bg-[#0f1d2e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ maxHeight: '560px' }}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-brand-gold" />
                    <span className="text-[11px] font-black text-white">Notifications</span>
                    {unreadNotifs.length > 0 && (
                      <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{unreadNotifs.length} new</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button
                        onClick={() => { onClearAllNotifications(); setShowNotifPanel(false); }}
                        className="text-[9px] text-gray-400 hover:text-rose-400 font-semibold transition"
                      >
                        Clear all
                      </button>
                    )}
                    <button onClick={() => setShowNotifPanel(false)} className="text-gray-500 hover:text-white transition p-0.5">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Panel list */}
                <div className="overflow-y-auto" style={{ maxHeight: '495px' }}>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <BellOff size={22} className="text-gray-600" />
                      <p className="text-[11px] text-gray-500">You're all caught up!</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-white/5 transition hover:bg-white/5 ${!n.read ? 'bg-white/[0.03]' : ''}`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.read ? 'bg-white/5' : 'bg-white/10'}`}>
                          {notifIcon(n.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold leading-snug ${n.read ? 'text-gray-400' : 'text-white'}`}>{n.title}</p>
                          <p className="text-[9.5px] text-gray-500 leading-snug mt-0.5">{n.description}</p>
                          <p className="text-[8.5px] text-gray-600 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-gold shrink-0 mt-2" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </section>

      </div>

    </div>
  );
}
