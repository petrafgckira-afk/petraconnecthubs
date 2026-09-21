import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { UserRole, HubType, PetraNotification } from '../types';
import petraLogo from '../assets/images/petra-logo.svg';
import {
  LayoutDashboard,
  Users,
  Compass,
  MessageSquare,
  Bell,
  BellOff,
  ShieldCheck,
  LogOut,
  BookOpen,
  ChevronDown,
  Globe,
  Check,
  X,
  Calendar,
  UserPlus,
  CheckCheck,
  Megaphone,
} from 'lucide-react';

interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
  userRole: UserRole;
  userHub: HubType;
  userName: string;
  userInitials: string;
  userAvatarUrl?: string;
  onLogout: () => void;
  activeNotificationsCount: number;
  unreadMessagesCount: number;
  hubs?: { id: string; name: string }[];
  adminHubScope?: { hubId: string | null; hubName: string | null };
  onAdminHubScopeChange?: (scope: { hubId: string | null; hubName: string | null }) => void;
  notifications: PetraNotification[];
  onMarkNotificationRead: (id: string) => void;
  onClearAllNotifications: () => void;
  onSendMessage: (userId: string) => void;
}

export default function Navigation({
  currentView,
  setView,
  userRole,
  userHub,
  userName,
  userInitials,
  userAvatarUrl,
  onLogout,
  activeNotificationsCount,
  unreadMessagesCount,
  hubs = [],
  adminHubScope,
  onAdminHubScopeChange,
  notifications,
  onMarkNotificationRead,
  onClearAllNotifications,
  onSendMessage,
}: NavigationProps) {

  const [hubDropdownOpen, setHubDropdownOpen] = useState(false);
  const [showNotifPanel, setShowNotifPanel]   = useState(false);
  const [avatarFailed, setAvatarFailed]       = useState(false);

  // Reset failed state whenever the URL changes (e.g., after a photo upload)
  useEffect(() => { setAvatarFailed(false); }, [userAvatarUrl]);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const [notifPanelPos, setNotifPanelPos] = useState<{ top: number; left: number } | null>(null);
  const hubBtnRef   = useRef<HTMLButtonElement>(null);
  const hubMenuRef  = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!hubDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        hubBtnRef.current && !hubBtnRef.current.contains(e.target as Node) &&
        hubMenuRef.current && !hubMenuRef.current.contains(e.target as Node)
      ) {
        setHubDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [hubDropdownOpen]);

  // Close notif panel on outside click
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

  const toggleNotifPanel = (btn: HTMLButtonElement) => {
    if (showNotifPanel) { setShowNotifPanel(false); return; }
    const rect = btn.getBoundingClientRect();
    // For sidebar buttons (left edge of screen), open to the right; otherwise open below
    const openRight = rect.left < 260;
    const top  = openRight ? rect.top : rect.bottom + 8;
    const left = openRight ? rect.right + 8 : Math.min(rect.left, window.innerWidth - 430);
    setNotifPanelPos({ top, left });
    setShowNotifPanel(true);
  };

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
      case 'message':      if (notif.meta?.senderId) onSendMessage(notif.meta.senderId); else setView('messages'); break;
      case 'announcement': setView('dashboard'); break;
      case 'event':        setView('dashboard'); break;
      case 'connection':   setView('members');   break;
      case 'approval':     setView('hub');        break;
      default:             setView('dashboard');
    }
  };

  const openHubDropdown = () => {
    if (hubDropdownOpen) { setHubDropdownOpen(false); return; }
    if (!hubBtnRef.current) return;
    const rect = hubBtnRef.current.getBoundingClientRect();
    // Open upward so the list is never clipped by the viewport bottom
    setDropdownPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width });
    setHubDropdownOpen(true);
  };

  const selectScope = (hubId: string | null, hubName: string | null) => {
    onAdminHubScopeChange?.({ hubId, hubName });
    setHubDropdownOpen(false);
  };

  const currentScopeLabel = adminHubScope?.hubName ?? 'All Hubs';

  const getNavItems = () => {
    const hubLabel = userRole === 'admin'
      ? (adminHubScope?.hubId ? (adminHubScope.hubName ?? `${userHub} Hub`) : 'All Hubs')
      : `${userHub} Hub`;

    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'hub', label: hubLabel, icon: Compass },
      { id: 'members', label: 'Directory', icon: Users },
      { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined },
      { id: 'notifications', label: 'Notifications', icon: Bell, badge: activeNotificationsCount > 0 ? activeNotificationsCount : undefined },
    ];

    if (userRole === 'leader' || userRole === 'admin') {
      items.push({ id: 'leader-panel', label: 'Leader Panel', icon: BookOpen });
    }

    if (userRole === 'admin') {
      items.push({ id: 'admin-panel', label: 'Admin Desk', icon: ShieldCheck });
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* 1. DESKTOP SIDEBAR: Hidden on mobile (md:flex) */}
      <aside className="hidden md:flex md:flex-col justify-between w-64 bg-white text-navy-950 h-screen border-r border-gray-200 shadow-sm shrink-0">

        {/* Sidebar Header Logo */}
        <div className="p-4.5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src={petraLogo} alt="Petra Connect Hubs" className="w-10 h-10 object-contain rounded-xl" />
            <div>
              <span className="font-sans font-bold text-sm tracking-tight block leading-tight text-navy-950">Petra Connect</span>
              <span className="text-brand-gold font-serif font-medium text-[10px] tracking-wider uppercase block -mt-0.5">Professional Hubs</span>
            </div>
          </div>
        </div>

        {/* Dynamic Nav Items */}
        <div className="flex-1 py-4 px-3.5 space-y-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2.5 block">
            Navigation
          </div>
          <nav className="space-y-1 block">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isNotif  = item.id === 'notifications';
              return (
                <button
                  key={item.id}
                  onClick={(e) => isNotif ? toggleNotifPanel(e.currentTarget) : setView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isNotif && showNotifPanel
                      ? 'bg-brand-gold/15 text-brand-gold'
                      : isActive
                        ? 'bg-brand-gold text-navy-950 font-bold shadow-sm'
                        : 'text-gray-500 hover:text-navy-950 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                      isActive ? 'bg-navy-950 text-white' : 'bg-brand-gold text-navy-950'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Admin Hub Scope Selector */}
        {userRole === 'admin' && hubs.length > 0 && (
          <div className="px-3.5 pb-3 border-b border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 block">
              Hub Scope
            </div>
            <button
              ref={hubBtnRef}
              onClick={openHubDropdown}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium text-gray-500 hover:text-navy-950 hover:bg-gray-100 transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-brand-gold shrink-0" />
                <span className="truncate">{currentScopeLabel}</span>
              </div>
              <ChevronDown size={13} className={`shrink-0 transition-transform ${hubDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        {/* Hub scope portal dropdown */}
        {hubDropdownOpen && dropdownPos && ReactDOM.createPortal(
          <div
            className="petra-app-interior"
            style={{ position: 'fixed', bottom: dropdownPos.bottom, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
          >
          <div
            ref={hubMenuRef}
            className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1"
          >
            <button
              onClick={() => selectScope(null, null)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-50 transition text-gray-700 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-brand-gold" />
                <span>All Hubs</span>
              </div>
              {!adminHubScope?.hubId && <Check size={12} className="text-brand-gold" />}
            </button>
            <div className="mx-3 my-1 border-t border-gray-100" />
            {hubs.map(hub => {
              const isSelected = adminHubScope?.hubId === hub.id;
              return (
                <button
                  key={hub.id}
                  onClick={() => selectScope(hub.id, hub.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-gray-50 transition text-gray-700 cursor-pointer"
                >
                  <span className="truncate">{hub.name}</span>
                  {isSelected && <Check size={12} className="text-brand-gold shrink-0" />}
                </button>
              );
            })}
          </div>
          </div>,
          document.body
        )}

        {/* Sidebar Footer User Section — click avatar/name to open Profile */}
        <div className="p-4 pb-8 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => setView('profile')}
              className={`flex items-center gap-2.5 max-w-[150px] rounded-lg p-1 -m-1 transition hover:bg-gray-100 cursor-pointer text-left ${
                currentView === 'profile' ? 'ring-1 ring-brand-gold/40' : ''
              }`}
              title="View my profile"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-brand-gold/50 shadow-xs shrink-0">
                {userAvatarUrl && !avatarFailed ? (
                  <img
                    src={userAvatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-brand-gold text-navy-950 font-bold font-serif flex items-center justify-center text-xs">
                    {userInitials}
                  </div>
                )}
              </div>
              <div className="truncate">
                <span className="font-bold text-navy-950 block leading-tight truncate">{userName}</span>
                <span className="text-brand-gold text-[9px] leading-none font-medium block mt-0.5">
                  View Profile
                </span>
              </div>
            </button>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0 cursor-pointer"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE BOTTOM NAVIGATION: Fixed to screen bottom, visible only on touch-size devices (md:hidden) */}
      <nav className="md:hidden fixed bottom-1.5 left-2.5 right-2.5 bg-white text-navy-950 py-1 px-2.5 rounded-full z-50 flex items-center justify-between border border-gray-200 shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isNotif  = item.id === 'notifications';
          return (
            <button
              key={item.id}
              onClick={(e) => isNotif ? toggleNotifPanel(e.currentTarget) : setView(item.id)}
              className={`p-2.5 rounded-full flex flex-col items-center relative ${
                isActive || (isNotif && showNotifPanel) ? 'text-brand-gold' : 'text-gray-400 hover:text-navy-950'
              }`}
            >
              <Icon size={17} />
              {item.badge && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-gold text-navy-950 text-[8px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={onLogout}
          className="p-2.5 text-rose-500 rounded-full"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </nav>
      {/* ── Global notification panel portal ── */}
      {showNotifPanel && notifPanelPos && ReactDOM.createPortal(
        <div
          className="petra-app-interior"
          style={{ position: 'fixed', top: notifPanelPos.top, left: notifPanelPos.left, zIndex: 10001 }}
        >
        <div
          ref={notifPanelRef}
          className="w-[400px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-brand-gold" />
              <span className="text-[11px] font-black text-navy-950">Notifications</span>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  {notifications.filter(n => !n.read).length} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={() => { onClearAllNotifications(); setShowNotifPanel(false); }}
                  className="text-[9px] text-gray-400 hover:text-rose-500 font-semibold transition"
                >
                  Clear all
                </button>
              )}
              <button onClick={() => setShowNotifPanel(false)} className="text-gray-400 hover:text-navy-950 transition p-0.5">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[540px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <BellOff size={22} className="text-gray-300" />
                <p className="text-[11px] text-gray-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition hover:bg-gray-50 ${!n.read ? 'bg-brand-gold/[0.03]' : ''}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.read ? 'bg-gray-100' : 'bg-brand-gold/10'}`}>
                    {notifIcon(n.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold leading-snug ${n.read ? 'text-gray-400' : 'text-navy-950'}`}>{n.title}</p>
                    <p className="text-[9.5px] text-gray-500 leading-snug mt-0.5">{n.description}</p>
                    <p className="text-[8.5px] text-gray-400 mt-1">{n.time}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-brand-gold shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
        </div>
        </div>,
        document.body
      )}
    </>
  );
}
