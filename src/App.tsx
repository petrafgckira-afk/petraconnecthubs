import React, { useState, useEffect } from 'react';
import {
  clearSession, getSavedUser, isSessionActive,
  fetchDashboardStats, fetchAnnouncements, fetchEvents, fetchHubs, fetchOwnProfile,
  createAnnouncement, createEvent, toggleEventRegistration,
  fetchConnections, sendConnectionRequest, removeConnection,
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
  updateAnnouncement, deleteAnnouncement,
  updateEvent, deleteEvent,
  markAllDelivered,
} from './services/api';
import {
  User,
  HubType,
  UserRole,
  HubAnnouncement,
  HubEvent,
  HubResource,
  PetraNotification,
} from './types';

// Component imports
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MyHubPage from './components/MyHubPage';
import MembersPage from './components/MembersPage';
import MessagesPage from './components/MessagesPage';
import NotificationsPage from './components/NotificationsPage';
import HubLeaderPanel from './components/HubLeaderPanel';
import AdminPanel from './components/AdminPanel';
import ProfilePage from './components/ProfilePage';

export default function App() {

  // Log-in flow states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<string>('landing'); // 'landing' | 'register' | 'login' | dashboard...

  // Auth User state
  const [currentUser, setCurrentUser] = useState<User>({
    id: '',
    name: '',
    email: '',
    role: 'member',
    profession: 'Technology',
    initials: '',
    skills: [],
    connectionsCount: 0,
    hubsCount: 0,
    joinedAt: '',
    status: 'pending',
  });

  // Dashboard stats from API
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // All hubs (fetched once for admin scope selector)
  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([]);

  // Admin hub scope: null hubId = "All Hubs", specific hubId = scoped to one hub
  const [adminHubScope, setAdminHubScope] = useState<{ hubId: string | null; hubName: string | null }>(() => {
    try {
      const saved = localStorage.getItem('petra_admin_hub_scope');
      return saved ? JSON.parse(saved) : { hubId: null, hubName: null };
    } catch { return { hubId: null, hubName: null }; }
  });

  // Global Dynamic States — populated from real API
  const [announcements, setAnnouncements] = useState<HubAnnouncement[]>([]);
  const [events, setEvents] = useState<HubEvent[]>([]);
  const [resources, setResources] = useState<HubResource[]>([]);
  const [notifications, setNotifications] = useState<PetraNotification[]>([]);
  
  // ID of the user whose chat thread to open when navigating to Messages
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  // Quick state dictionary for active connect actions: ID -> state
  const [connections, setConnections] = useState<{ [key: string]: 'connected' | 'pending_sent' | 'not_connected' }>({});

  // Restore session from localStorage on page load
  useEffect(() => {
    if (isSessionActive()) {
      const saved = getSavedUser();
      if (saved) {
        setCurrentUser(mapApiUser(saved));
        setIsLoggedIn(true);
        setCurrentView('dashboard');
        // Silently refresh own profile so the avatar is always up to date after a page reload
        fetchOwnProfile().then(data => {
          if (!data?.user) return;
          setCurrentUser(mapApiUser(data.user));
          const latest = getSavedUser();
          if (latest) {
            localStorage.setItem('petra_user', JSON.stringify({ ...latest, ...data.user }));
          }
        }).catch(() => {});
      }
    }
  }, []);

  // B — when any API call returns 401, the api layer fires this event; we force logout
  useEffect(() => {
    const handleExpiry = () => {
      setIsLoggedIn(false);
      setCurrentView('landing');
    };
    window.addEventListener('petra:session-expired', handleExpiry);
    return () => window.removeEventListener('petra:session-expired', handleExpiry);
  }, []);

  // Inactivity timeout — log out after 30 minutes of no user interaction
  useEffect(() => {
    if (!isLoggedIn) return;

    const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

    const stampActivity = () =>
      localStorage.setItem('petra_last_active', String(Date.now()));

    const forceLogout = () => {
      clearSession();
      setIsLoggedIn(false);
      setCurrentView('landing');
    };

    const checkInactivity = () => {
      const last = Number(localStorage.getItem('petra_last_active') || 0);
      if (last && Date.now() - last > INACTIVITY_MS) forceLogout();
    };

    // Stamp now so a fresh login doesn't immediately time out
    stampActivity();

    // Update timestamp on any user interaction
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    activityEvents.forEach(e => window.addEventListener(e, stampActivity, { passive: true }));

    // Check every minute while the tab is open
    const interval = setInterval(checkInactivity, 60_000);

    // Also check the moment the user returns to the tab (covers long absences)
    window.addEventListener('focus', checkInactivity);

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, stampActivity));
      window.removeEventListener('focus', checkInactivity);
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  // Fetch all live data whenever the user logs in
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchDashboardStats().then(setDashboardStats).catch(console.error);
    fetchAnnouncements().then(d => setAnnouncements(d.announcements || [])).catch(console.error);
    fetchEvents().then(d => setEvents(d.events || [])).catch(console.error);
    fetchConnections().then(d => {
      if (d.connections) setConnections(d.connections);
    }).catch(console.error);
    fetchNotifications().then(d => setNotifications(d.notifications || [])).catch(console.error);
    fetchHubs().then(d => setHubs((d.hubs || []).map((h: any) => ({ id: h.id, name: h.name })))).catch(console.error);
  }, [isLoggedIn]);

  // Re-fetch announcements and events every time the dashboard is opened so
  // posts created in other sessions appear without needing to log out
  useEffect(() => {
    if (!isLoggedIn || currentView !== 'dashboard') return;
    fetchAnnouncements().then(d => setAnnouncements(d.announcements || [])).catch(console.error);
    fetchEvents().then(d => setEvents(d.events || [])).catch(console.error);
  }, [isLoggedIn, currentView]);

  // Poll announcements and events every 5s while dashboard is open
  useEffect(() => {
    if (!isLoggedIn || currentView !== 'dashboard') return;
    const interval = setInterval(() => {
      fetchAnnouncements().then(d => setAnnouncements(d.announcements || [])).catch(console.error);
      fetchEvents().then(d => setEvents(d.events || [])).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, currentView]);

  // Poll notifications every 5s while logged in so message/connection alerts appear promptly
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      fetchNotifications().then(d => setNotifications(d.notifications || [])).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Mark ALL incoming messages as delivered the moment the user is logged in anywhere in the app.
  // Fires immediately on login, then every 3s — so senders see double-gray ticks within 2s.
  useEffect(() => {
    if (!isLoggedIn) return;
    markAllDelivered();
    const interval = setInterval(markAllDelivered, 3_000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Poll own profile every 5s so sidebar avatar updates when user changes their photo
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      fetchOwnProfile().then(data => {
        if (!data?.user) return;
        setCurrentUser(prev => {
          const newUrl = data.user.profile_image || undefined;
          if (prev.avatarUrl === newUrl) return prev;
          return { ...prev, avatarUrl: newUrl };
        });
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleAdminHubScopeChange = (scope: { hubId: string | null; hubName: string | null }) => {
    setAdminHubScope(scope);
    localStorage.setItem('petra_admin_hub_scope', JSON.stringify(scope));
  };

  // Map API user object → frontend User shape
  function mapApiUser(apiUser: any): User {
    const nameParts = (apiUser.full_name || apiUser.name || 'User').split(' ');
    const initials = nameParts.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name,
      email: apiUser.email,
      role: apiUser.role === 'hub_leader' ? 'leader' : (apiUser.role as UserRole) || 'member',
      profession: (apiUser.profession as HubType) || 'Technology',
      initials,
      avatarUrl: apiUser.profile_image || undefined,
      bio: apiUser.bio || '',
      skills: [],
      connectionsCount: 0,
      hubsCount: 0,
      joinedAt: (apiUser.created_at || new Date().toISOString()).substring(0, 10),
      status: 'approved',
    };
  }

  // Called by ProfilePage when the user saves edits or changes their photo
  const handleProfileUpdated = ({ name, profileImage }: { name: string; profileImage: string | null }) => {
    setCurrentUser(prev => {
      const nameParts = name.split(' ');
      const initials  = nameParts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
      return { ...prev, name, initials, avatarUrl: profileImage || undefined };
    });
    // Keep localStorage in sync so a page refresh shows the latest avatar immediately
    const saved = getSavedUser();
    if (saved) {
      localStorage.setItem('petra_user', JSON.stringify({ ...saved, full_name: name, profile_image: profileImage }));
    }
  };

  // Real login success handler (called by LoginPage after API success)
  const handleRealLoginSuccess = (apiUser: any) => {
    setCurrentUser(mapApiUser(apiUser));
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  // Fast level-clear trigger helper
  const handleStartRegister = () => {
    setCurrentView('register');
  };

  const handleStartLogin = () => {
    setCurrentView('login');
  };

  const handleLoggedOut = () => {
    clearSession();
    setIsLoggedIn(false);
    setCurrentView('landing');
  };


  // Register success — called by RegisterPage after real API success
  const handleRegisterSubmitInApp = (apiUser: any) => {
    setCurrentUser(mapApiUser(apiUser));
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  // --- INTERACTION HANDLERS ---
  
  // Like an Announcement
  const handleLikeAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.map(ann => {
      if (ann.id === id) {
        const liked = !ann.likedByUser;
        return {
          ...ann,
          likedByUser: liked,
          likesCount: liked ? ann.likesCount + 1 : ann.likesCount - 1
        };
      }
      return ann;
    }));
  };

  // Register / unregister for Event via real API
  const handleRegisterEvent = (id: string) => {
    toggleEventRegistration(id)
      .then(data => {
        setEvents(prev => prev.map(evt =>
          evt.id === id
            ? { ...evt, isRegistered: data.registered, attendeesCount: data.attendees_count }
            : evt
        ));
      })
      .catch(console.error);
  };

  const handleEditEvent = (
    id: string,
    data: { title: string; description: string; date: string; time: string; location: string }
  ): Promise<void> => {
    return updateEvent(id, data).then(res => {
      setEvents(prev => prev.map(evt =>
        evt.id === id
          ? { ...evt, title: res.title, description: res.description,
              date: res.date, time: res.time, timeRaw: res.timeRaw, location: res.location }
          : evt
      ));
    });
  };

  const handleDeleteEvent = (id: string): Promise<void> => {
    return deleteEvent(id).then(() =>
      setEvents(prev => prev.filter(evt => evt.id !== id))
    );
  };

  // Download Resource
  const handleDownloadResource = (id: string) => {
    setResources(prev => prev.map(res => {
      if (res.id === id) {
        return {
          ...res,
          downloadCount: res.downloadCount + 1
        };
      }
      return res;
    }));

    // Raise custom log alert
    const newAlert: PetraNotification = {
      id: `down_${Date.now()}`,
      type: 'event',
      title: 'Resource File Download Triggered',
      description: `The compilation file starts copying onto local directories.`,
      time: 'Just now',
      read: false
    };
    setNotifications(prev => [newAlert, ...prev]);
  };

  const handleConnectMember = (mId: string) => {
    const currentStatus = connections[mId] || 'not_connected';
    if (currentStatus !== 'not_connected') return;

    setConnections(prev => ({ ...prev, [mId]: 'pending_sent' }));
    sendConnectionRequest(mId)
      .then(() => {
        const alert: PetraNotification = {
          id: `con_${Date.now()}`,
          type: 'connection',
          title: 'Connection Request Sent',
          description: 'Your fellowship invitation has been dispatched.',
          time: 'Just now',
          read: false,
        };
        setNotifications(prev => [alert, ...prev]);
      })
      .catch(() => {
        setConnections(prev => ({ ...prev, [mId]: 'not_connected' }));
      });
  };

  const handleRemoveConnection = (mId: string) => {
    const prevStatus = connections[mId] || 'not_connected';
    setConnections(c => ({ ...c, [mId]: 'not_connected' }));
    removeConnection(mId).catch(() => {
      setConnections(c => ({ ...c, [mId]: prevStatus }));
    });
  };

  // Navigate to Messages and pre-open a conversation with the given user ID
  const handleSendMessageToMember = (userId: string) => {
    setActivePartnerId(userId);
    setCurrentView('messages');
  };

  // Dismiss notification
  const handleClearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {});
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const handleEditAnnouncement = (id: string, title: string, content: string): Promise<void> => {
    return updateAnnouncement(id, title, content)
      .then(() => {
        setAnnouncements(prev =>
          prev.map(ann => ann.id === id ? { ...ann, title, content } : ann)
        );
      });
  };

  const handleDeleteAnnouncement = (id: string): Promise<void> => {
    return deleteAnnouncement(id)
      .then(() => setAnnouncements(prev => prev.filter(ann => ann.id !== id)));
  };

  const handleCreateAnnouncement = (annData: Partial<HubAnnouncement>): Promise<void> => {
    const hubId = currentUser.role === 'admin' ? adminHubScope.hubId : undefined;
    return createAnnouncement(annData.title || '', annData.content || '', hubId)
      .then(data => {
        if (data.announcement) {
          setAnnouncements(prev => [data.announcement, ...prev]);
        }
        setCurrentView('dashboard');
      });
  };

  const handleCreateEvent = (evtData: Partial<HubEvent>) => {
    createEvent({
      title:       evtData.title || '',
      description: evtData.description || '',
      date:        evtData.date || '',
      time:        evtData.time || '00:00',
      location:    evtData.location || 'Petra Full Gospel Church',
    })
      .then(data => {
        if (data.event) {
          setEvents(prev => [...prev, data.event]);
        }
      })
      .catch(() => {});
  };

  const handleCreateResource = (resData: Partial<HubResource>) => {
    const fullRes: HubResource = {
      id: `res_created_${Date.now()}`,
      hubId: resData.hubId || 'Technology',
      title: resData.title || 'Mentorship Handout',
      description: resData.description || '',
      fileType: resData.fileType || 'pdf',
      fileSize: resData.fileSize,
      downloadUrl: '#',
      uploadedBy: resData.uploadedBy || currentUser.name,
      downloadCount: 0,
      date: new Date().toISOString().substring(0, 10)
    };

    setResources(prev => [fullRes, ...prev]);
  };

  // --- CONDITIONAL PAGES RENDERER ---
  
  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            userRole={currentUser.role}
            userHub={currentUser.profession}
            userName={currentUser.name}
            announcements={announcements}
            events={events}
            stats={dashboardStats}
            onLikeAnnouncement={handleLikeAnnouncement}
            onRegisterEvent={handleRegisterEvent}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
            onEditAnnouncement={handleEditAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            currentUserRole={currentUser.role}
            setView={setCurrentView}
            adminHubScope={adminHubScope}
            notifications={notifications}
            onMarkNotificationRead={handleMarkRead}
            onClearAllNotifications={handleMarkAllRead}
            onSendMessage={handleSendMessageToMember}
          />
        );
      case 'hub': {
        const isAdminAllHubs = currentUser.role === 'admin' && !adminHubScope.hubId;
        const adminEffectiveHub =
          currentUser.role === 'admin' && adminHubScope.hubId
            ? ((adminHubScope.hubName?.replace(' Hub', '') ?? currentUser.profession) as import('./types').HubType)
            : currentUser.profession;
        return (
          <MyHubPage
            userHub={adminEffectiveHub}
            resources={resources}
            announcements={announcements}
            connections={connections}
            onDownloadResource={handleDownloadResource}
            onSendMessage={handleSendMessageToMember}
            onConnectMember={handleConnectMember}
            onRemoveConnection={handleRemoveConnection}
            userRole={currentUser.role}
            setView={setCurrentView}
            hubDisplayName={currentUser.role === 'admin' ? (adminHubScope.hubName ?? 'All Hubs') : undefined}
            isAllHubs={isAdminAllHubs}
          />
        );
      }
      case 'members':
        return (
          <MembersPage
            onConnectMember={handleConnectMember}
            onRemoveConnection={handleRemoveConnection}
            onSendMessage={handleSendMessageToMember}
            connections={connections}
          />
        );
      case 'messages':
        return (
          <MessagesPage
            currentUserId={currentUser.id}
            initialPartnerId={activePartnerId}
          />
        );
      case 'notifications':
        return (
          <NotificationsPage
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onClearNotification={handleClearNotification}
            onMarkAllRead={handleMarkAllRead}
          />
        );
      case 'leader-panel':
        return (
          <HubLeaderPanel
            userHub={currentUser.profession}
            userRole={currentUser.role}
            adminHubScope={adminHubScope}
            onCreateAnnouncement={handleCreateAnnouncement}
            onCreateEvent={handleCreateEvent}
            onCreateResource={handleCreateResource}
            userName={currentUser.name}
          />
        );
      case 'admin-panel':
        return (
          <AdminPanel />
        );
      case 'profile':
        return (
          <ProfilePage onProfileUpdated={handleProfileUpdated} />
        );
      default:
        return (
          <Dashboard
            userRole={currentUser.role}
            userHub={currentUser.profession}
            userName={currentUser.name}
            announcements={announcements}
            events={events}
            stats={dashboardStats}
            onLikeAnnouncement={handleLikeAnnouncement}
            onRegisterEvent={handleRegisterEvent}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
            onEditAnnouncement={handleEditAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            currentUserRole={currentUser.role}
            setView={setCurrentView}
            adminHubScope={adminHubScope}
            notifications={notifications}
            onMarkNotificationRead={handleMarkRead}
            onClearAllNotifications={handleMarkAllRead}
            onSendMessage={handleSendMessageToMember}
          />
        );
    }
  };

  // Calculate badges counts
  const unreadMessagesCount = 0; // fetched live inside MessagesPage
  const activeNotificationsCount = notifications.filter(n => !n.read).length;

  // 1. Unified Fixed Blurry Background + Layout rendering:
  return (
    <>
      {/* Dynamic Viewport-Fixed Atmospheric Background containing beautiful blurry orbs of the Petra brand */}
      <div className="fixed inset-0 bg-[#0f132e] overflow-hidden pointer-events-none z-0">
        {/* Glowing vibrant Petra Orange sphere (Uganda flame core) */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[380px] h-[380px] md:w-[680px] md:h-[680px] bg-[#F37021]/15 rounded-full blur-[110px] md:blur-[160px] animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        {/* Glowing warm Golden Wheat sphere */}
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] md:w-[720px] md:h-[720px] bg-[#FAA61A]/12 rounded-full blur-[130px] md:blur-[180px] animate-pulse"
          style={{ animationDuration: '10s' }}
        />
        {/* Deep Royal Petra Navy accents in the center and layout regions */}
        <div className="absolute top-[35%] left-[20%] w-[300px] h-[300px] md:w-[550px] md:h-[550px] bg-[#394c8e]/40 rounded-full blur-[100px] md:blur-[150px]" />
        <div className="absolute top-[70%] right-[15%] w-[320px] h-[320px] md:w-[480px] md:h-[480px] bg-[#1D2D5F]/35 rounded-full blur-[90px] md:blur-[140px]" />
      </div>

      <div className="relative z-10 w-full min-h-screen">
        {!isLoggedIn ? (
          <>
            {currentView === 'register' && (
              <RegisterPage 
                onRegisterSubmit={handleRegisterSubmitInApp}
                onCancel={handleLoggedOut}
              />
            )}
            {currentView === 'login' && (
              <LoginPage
                onLoginSuccess={handleRealLoginSuccess}
                onRegister={handleStartRegister}
              />
            )}
            {currentView !== 'register' && currentView !== 'login' && (
              <LandingPage
                onRegister={handleStartRegister}
                onLogin={handleStartLogin}
                onExploreDemo={handleStartLogin}
              />
            )}
          </>
        ) : (
          <div className="flex h-screen overflow-hidden bg-transparent text-[#f4f6fc] font-sans">
            
            {/* Sidebar navigation on Desktop, standard floating bottom bar on mobile */}
            <Navigation
              currentView={currentView}
              setView={setCurrentView}
              userRole={currentUser.role}
              userHub={currentUser.profession}
              userName={currentUser.name}
              userInitials={currentUser.initials}
              userAvatarUrl={currentUser.avatarUrl}
              onLogout={handleLoggedOut}
              unreadMessagesCount={unreadMessagesCount}
              activeNotificationsCount={activeNotificationsCount}
              hubs={hubs}
              adminHubScope={adminHubScope}
              onAdminHubScopeChange={handleAdminHubScopeChange}
              notifications={notifications}
              onMarkNotificationRead={handleMarkRead}
              onClearAllNotifications={handleMarkAllRead}
              onSendMessage={handleSendMessageToMember}
            />

            {/* Main viewport Container space */}
            <main className="flex-1 p-4 md:p-8 md:max-w-[calc(100%-256px)] h-screen overflow-y-auto relative z-10">
              
              {/* Quick Header dashboard navigation pathing (Only visible on logged-in desktops) */}
              <header className="hidden md:flex justify-between items-center mb-6 py-2 border-b border-navy-800 bg-[#0f132e]/60 backdrop-blur-md px-4 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold font-sans">
                  <span>Petra Connect Hubs</span>
                  <span>/</span>
                  <span className="text-brand-gold uppercase font-mono tracking-widest">{currentView}</span>
                </div>
                
                <div className="flex gap-2.5 items-center">
                  {/* Status alerts indicators */}
                  <span className="h-2 w-2 rounded-full bg-emerald-500 block inline shrink-0 animate-pulse" />
                  <span className="text-[10px] text-gray-400 font-mono tracking-wider font-semibold">SECURE GATEWAY APPLICANT SESSION • STATUS ONLINE</span>
                </div>
              </header>

              {/* Dynamic page content layout viewport */}
              {renderCurrentView()}
              
            </main>
          </div>
        )}
      </div>
    </>
  );
}
