import React, { useState, useEffect, lazy, Suspense, useCallback, useMemo, useTransition } from 'react';
import LoadingSpinner from './components/LoadingSpinner';
import {
  clearSession, getSavedUser, isSessionActive,
  fetchDashboardStats, fetchAnnouncements, fetchEvents, fetchHubs, fetchOwnProfile,
  createAnnouncement, createEvent, toggleEventRegistration,
  fetchConnections, sendConnectionRequest, removeConnection,
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
  updateAnnouncement, deleteAnnouncement,
  updateEvent, deleteEvent,
  markAllDelivered,
  fetchResources, createResource, incrementResourceDownload,
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

// Lazy-loaded pages — each is only downloaded when first visited
const LandingPage      = lazy(() => import('./components/LandingPage'));
const LoginPage        = lazy(() => import('./components/LoginPage'));
const RegisterPage     = lazy(() => import('./components/RegisterPage'));
const Navigation       = lazy(() => import('./components/Navigation'));
const Dashboard        = lazy(() => import('./components/Dashboard'));
const MyHubPage        = lazy(() => import('./components/MyHubPage'));
const MembersPage      = lazy(() => import('./components/MembersPage'));
const MessagesPage     = lazy(() => import('./components/MessagesPage'));
const NotificationsPage= lazy(() => import('./components/NotificationsPage'));
const HubLeaderPanel   = lazy(() => import('./components/HubLeaderPanel'));
const AdminPanel       = lazy(() => import('./components/AdminPanel'));
const ProfilePage      = lazy(() => import('./components/ProfilePage'));

export default function App() {

  // Log-in flow states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<string>('landing'); // 'landing' | 'register' | 'login' | dashboard...
  const [isPending, startTransition] = useTransition();

  // Only show the spinner if the transition takes longer than 50 ms.
  // Sub-50ms switches are already-loaded pages — spinner never appears.
  // Genuine first-visit lazy loads take 100ms+ — spinner appears after the delay.
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!isPending) { setShowSpinner(false); return; }
    const t = setTimeout(() => setShowSpinner(true), 50);
    return () => clearTimeout(t);
  }, [isPending]);

  // Wrap user-initiated navigation in a transition so the old page stays
  // rendered while the next lazy component loads.
  const navigateTo = useCallback((view: string) => {
    startTransition(() => setCurrentView(view));
  }, [startTransition]);

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

  // Dashboard stats from API, 
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

  // Which tab to open when navigating to the leader panel
  const [leaderPanelInitialTab, setLeaderPanelInitialTab] = useState<'approvals' | 'announcements' | 'events' | 'resources' | 'suspended'>('approvals');

  // Which tab to open when navigating to the hub page
  const [hubInitialTab, setHubInitialTab] = useState<'members' | 'resources'>('members');

  // Quick state dictionary for active connect actions: ID -> state
  const [connections, setConnections] = useState<{ [key: string]: 'connected' | 'pending_sent' | 'not_connected' }>({});

  // Restore session from localStorage on page load
  useEffect(() => {
    if (isSessionActive()) {
      const saved = getSavedUser();
      if (saved) {
        // Verify with server — catches pending accounts and stale tokens
        fetchOwnProfile().then(data => {
          if (!data?.user) return;
          if (data.user.status === 'pending') {
            clearSession();
            setCurrentView('pending-approval');
            return;
          }
          const mapped = mapApiUser(data.user);
          localStorage.setItem('petra_user', JSON.stringify({ ...saved, ...data.user }));
          startTransition(() => {
            setCurrentUser(mapped);
            setIsLoggedIn(true);
            setCurrentView('dashboard');
          });
        }).catch(() => {
          // Network error — fall back to cached data so the app still loads offline
          const mapped = mapApiUser(saved);
          startTransition(() => {
            setCurrentUser(mapped);
            setIsLoggedIn(true);
            setCurrentView('dashboard');
          });
        });
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
    fetchResources().then(d => setResources((d.resources || []).map(mapResource))).catch(console.error);
  }, [isLoggedIn]);

  // Re-fetch announcements and events every time the dashboard is opened so
  // posts created in other sessions appear without needing to log out
  useEffect(() => {
    if (!isLoggedIn || currentView !== 'dashboard') return;
    fetchAnnouncements().then(d => setAnnouncements(d.announcements || [])).catch(console.error);
    fetchEvents().then(d => setEvents(d.events || [])).catch(console.error);
  }, [isLoggedIn, currentView]);

  // Poll announcements and events every 30s while dashboard is open
  useEffect(() => {
    if (!isLoggedIn || currentView !== 'dashboard') return;
    const interval = setInterval(() => {
      fetchAnnouncements().then(d => setAnnouncements(d.announcements || [])).catch(console.error);
      fetchEvents().then(d => setEvents(d.events || [])).catch(console.error);
    }, 30_000);
    return () => clearInterval(interval);
  }, [isLoggedIn, currentView]);

  // Poll notifications every 30s
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      fetchNotifications().then(d => setNotifications(d.notifications || [])).catch(console.error);
    }, 30_000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Mark all messages delivered every 20s (senders see ticks within ~20s)
  useEffect(() => {
    if (!isLoggedIn) return;
    markAllDelivered();
    const interval = setInterval(markAllDelivered, 20_000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Poll own profile every 60s — picks up role changes assigned by an admin mid-session
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      fetchOwnProfile().then(data => {
        if (!data?.user) return;
        // If an admin has set this account to pending/deleted, force logout
        if (data.user.status === 'pending') {
          clearSession();
          setIsLoggedIn(false);
          setCurrentView('pending-approval');
          return;
        }
        const updated = mapApiUser(data.user);
        setCurrentUser(prev => {
          const changed =
            prev.role !== updated.role ||
            prev.avatarUrl !== updated.avatarUrl ||
            prev.name !== updated.name ||
            prev.profession !== updated.profession;
          if (!changed) return prev;
          return { ...prev, ...updated };
        });
        // Keep localStorage in sync so a page refresh carries the latest role
        const saved = getSavedUser();
        if (saved) {
          localStorage.setItem('petra_user', JSON.stringify({ ...saved, ...data.user }));
        }
      }).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleAdminHubScopeChange = useCallback((scope: { hubId: string | null; hubName: string | null }) => {
    setAdminHubScope(scope);
    localStorage.setItem('petra_admin_hub_scope', JSON.stringify(scope));
  }, []);

  // Resolve the correct HubType from whatever the API sends
  function resolveHub(apiUser: any): HubType {
    const VALID: HubType[] = ['Business', 'Technology', 'Medical', 'Finance', 'Education', 'Media & Creative', 'Leadership & Ministry'];
    // 1. hub_name from hub_members join (profile + login endpoints)
    if (apiUser.hub_name) {
      const stripped = (apiUser.hub_name as string).replace(/ Hub$/i, '').trim();
      if (VALID.includes(stripped as HubType)) return stripped as HubType;
    }
    // 2. profession already a valid HubType
    if (VALID.includes(apiUser.profession as HubType)) return apiUser.profession as HubType;
    // 3. Map free-text job title to nearest hub
    const p = (apiUser.profession || '').toLowerCase();
    if (/doctor|medic|nurs|health|pharm|dental|clinic|surgeon/.test(p)) return 'Medical';
    if (/tech|engineer|software|developer|programmer|it |ict|cyber|web|data/.test(p)) return 'Technology';
    if (/business|entrepreneur|market|sales|trade|commerce|manager/.test(p)) return 'Business';
    if (/financ|account|bank|invest|audit|tax|econom/.test(p)) return 'Finance';
    if (/teach|educat|professor|lecturer|school|tutor|instruct/.test(p)) return 'Education';
    if (/media|creat|design|journal|film|music|art|photo|content|writer/.test(p)) return 'Media & Creative';
    if (/leader|pastor|minister|church|mission|chaplain|bishop/.test(p)) return 'Leadership & Ministry';
    return 'Technology';
  }

  // Map API resource object → frontend HubResource shape
  function mapResource(r: any): HubResource {
    const hubType = (r.hub_name || '').replace(/ Hub$/i, '').trim() as HubType;
    const validTypes = ['pdf', 'video', 'link', 'doc', 'audio', 'image', 'epub'] as const;
    const ft = validTypes.includes(r.file_type) ? r.file_type : 'link';
    return {
      id: r.id,
      hubId: hubType || 'Technology',
      title: r.title,
      description: r.description || '',
      fileType: ft,
      fileSize: r.file_size || undefined,
      downloadUrl: r.download_url || '#',
      uploadedBy: r.uploaded_by_name || 'Unknown',
      uploadedById: r.uploaded_by_id || undefined,
      downloadCount: Number(r.download_count) || 0,
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
      status: r.status || 'approved',
    };
  }

  // Map API user object → frontend User shape
  function mapApiUser(apiUser: any): User {
    const nameParts = (apiUser.full_name || apiUser.name || 'User').split(' ');
    const initials = nameParts.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name,
      email: apiUser.email,
      role: (apiUser.role as UserRole) || 'member',
      profession: resolveHub(apiUser),
      initials,
      avatarUrl: apiUser.profile_image || undefined,
      bio: apiUser.bio || '',
      skills: [],
      connectionsCount: 0,
      hubsCount: 0,
      joinedAt: (apiUser.created_at || new Date().toISOString()).substring(0, 10),
      status: (apiUser.status as 'pending' | 'approved' | 'rejected') || 'approved',
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
    const mapped = mapApiUser(apiUser);
    startTransition(() => {
      setCurrentUser(mapped);
      setIsLoggedIn(true);
      setCurrentView('dashboard');
    });
  };

  // Fast level-clear trigger helper
  const handleStartRegister = () => {
    navigateTo('register');
  };

  const handleStartLogin = () => {
    navigateTo('login');
  };

  const handleLoggedOut = () => {
    clearSession();
    setIsLoggedIn(false);
    setCurrentView('landing');
  };


  // Register success — called by RegisterPage after real API success
  const handleRegisterSubmitInApp = (apiUser: any) => {
    if (apiUser.status === 'pending') {
      setCurrentView('pending-approval');
      return;
    }
    const mapped = mapApiUser(apiUser);
    startTransition(() => {
      setCurrentUser(mapped);
      setIsLoggedIn(true);
      setCurrentView('dashboard');
    });
  };

  // --- INTERACTION HANDLERS ---
  
  // Like an Announcement
  const handleLikeAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => prev.map(ann => {
      if (ann.id === id) {
        const liked = !ann.likedByUser;
        return { ...ann, likedByUser: liked, likesCount: liked ? ann.likesCount + 1 : ann.likesCount - 1 };
      }
      return ann;
    }));
  }, []);

  // Register / unregister for Event via real API
  const handleRegisterEvent = useCallback((id: string) => {
    toggleEventRegistration(id)
      .then(data => {
        setEvents(prev => prev.map(evt =>
          evt.id === id
            ? { ...evt, isRegistered: data.registered, attendeesCount: data.attendees_count }
            : evt
        ));
      })
      .catch(console.error);
  }, []);

  const handleEditEvent = useCallback((
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
  }, []);

  const handleDeleteEvent = useCallback((id: string): Promise<void> => {
    return deleteEvent(id).then(() =>
      setEvents(prev => prev.filter(evt => evt.id !== id))
    );
  }, []);

  // Download Resource — open URL in new tab + increment server count
  const handleDownloadResource = (id: string) => {
    const resource = resources.find(r => r.id === id);
    if (resource?.downloadUrl && resource.downloadUrl !== '#') {
      window.open(resource.downloadUrl, '_blank', 'noopener,noreferrer');
      incrementResourceDownload(id).catch(() => {});
    }
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

  const handleConnectMember = useCallback((mId: string) => {
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
  }, [connections]);

  const handleRemoveConnection = useCallback((mId: string) => {
    const prevStatus = connections[mId] || 'not_connected';
    setConnections(c => ({ ...c, [mId]: 'not_connected' }));
    removeConnection(mId).catch(() => {
      setConnections(c => ({ ...c, [mId]: prevStatus }));
    });
  }, [connections]);

  const handleSendMessageToMember = useCallback((userId: string) => {
    setActivePartnerId(userId);
    navigateTo('messages');
  }, [navigateTo]);

  const handleClearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleMarkRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  }, []);

  const handleEditAnnouncement = useCallback((id: string, title: string, content: string): Promise<void> => {
    return updateAnnouncement(id, title, content)
      .then(() => {
        setAnnouncements(prev =>
          prev.map(ann => ann.id === id ? { ...ann, title, content } : ann)
        );
      });
  }, []);

  const handleDeleteAnnouncement = useCallback((id: string): Promise<void> => {
    return deleteAnnouncement(id)
      .then(() => setAnnouncements(prev => prev.filter(ann => ann.id !== id)));
  }, []);

  const handleCreateAnnouncement = useCallback((annData: Partial<HubAnnouncement>): Promise<void> => {
    const hubId = currentUser.role === 'admin' ? adminHubScope.hubId : undefined;
    return createAnnouncement(annData.title || '', annData.content || '', hubId)
      .then(data => {
        if (data.announcement) {
          setAnnouncements(prev => [data.announcement, ...prev]);
        }
        setCurrentView('dashboard');
      });
  }, [currentUser.role, adminHubScope.hubId]);

  const handleCreateEvent = useCallback((evtData: Partial<HubEvent>) => {
    createEvent({
      title:       evtData.title || '',
      description: evtData.description || '',
      date:        evtData.date || '',
      time:        evtData.time || '00:00',
      location:    evtData.location || 'Petra Full Gospel Church',
    })
      .then(data => {
        if (data.event) setEvents(prev => [...prev, data.event]);
      })
      .catch(() => {});
  }, []);

  const handleCreateResource = useCallback((resData: Partial<HubResource>) => {
    createResource({
      hub_type: resData.hubId || 'Technology',
      title: resData.title || '',
      description: resData.description || '',
      file_type: resData.fileType || 'link',
      file_size: resData.fileSize,
      download_url: resData.downloadUrl || '#',
    }).then(data => {
      if (data?.id) {
        const fullRes: HubResource = {
          id: data.id,
          hubId: resData.hubId || 'Technology',
          title: resData.title || '',
          description: resData.description || '',
          fileType: resData.fileType || 'link',
          fileSize: resData.fileSize,
          downloadUrl: resData.downloadUrl || '#',
          uploadedBy: resData.uploadedBy || '',
          downloadCount: 0,
          date: new Date().toLocaleDateString('en-GB'),
        };
        setResources(prev => [fullRes, ...prev]);
      }
    }).catch(() => {});
  }, [currentUser.name]);

  const handleResourcesChanged = useCallback(() => {
    fetchResources().then(d => setResources((d.resources || []).map(mapResource))).catch(() => {});
  }, []);

  // Memoised badge count — only recomputes when notifications array changes
  const activeNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  // --- CONDITIONAL PAGES RENDERER ---
  
  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            userRole={currentUser.role}
            userHub={currentUser.profession}
            userName={currentUser.name}
            userId={currentUser.id}
            userImage={currentUser.avatarUrl ?? null}
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
            setView={navigateTo}
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
            setView={navigateTo}
            hubDisplayName={currentUser.role === 'admin' ? (adminHubScope.hubName ?? 'All Hubs') : undefined}
            isAllHubs={isAdminAllHubs}
            onShareResource={() => {
              setLeaderPanelInitialTab('resources');
              navigateTo('leader-panel');
            }}
            initialTab={hubInitialTab}
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
            onResourcesChanged={handleResourcesChanged}
            onUploadComplete={() => {
              setLeaderPanelInitialTab('approvals');
              setHubInitialTab('resources');
              navigateTo('hub');
              // Reset so the next manual hub visit opens on Members
              setTimeout(() => setHubInitialTab('members'), 500);
            }}
            initialTab={leaderPanelInitialTab}
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
            userId={currentUser.id}
            userImage={currentUser.avatarUrl ?? null}
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
            setView={navigateTo}
            adminHubScope={adminHubScope}
            notifications={notifications}
            onMarkNotificationRead={handleMarkRead}
            onClearAllNotifications={handleMarkAllRead}
            onSendMessage={handleSendMessageToMember}
          />
        );
    }
  };

  // unreadMessagesCount is fetched live inside MessagesPage
  const unreadMessagesCount = 0;

  // 1. Unified Fixed Blurry Background + Layout rendering:
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0f132e' }} />}>
      {/* Background: dark orbs for landing/auth pages, clean white for logged-in app */}
      {isLoggedIn ? (
        <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundColor: '#f9fafb' }} />
      ) : (
        <div className="fixed inset-0 bg-[#0f132e] overflow-hidden pointer-events-none z-0">
          <div
            className="absolute top-[-10%] right-[-10%] w-[380px] h-[380px] md:w-[680px] md:h-[680px] bg-[#F37021]/15 rounded-full blur-[110px] md:blur-[160px] animate-pulse"
            style={{ animationDuration: '8s' }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] md:w-[720px] md:h-[720px] bg-[#FAA61A]/12 rounded-full blur-[130px] md:blur-[180px] animate-pulse"
            style={{ animationDuration: '10s' }}
          />
          <div className="absolute top-[35%] left-[20%] w-[300px] h-[300px] md:w-[550px] md:h-[550px] bg-[#394c8e]/40 rounded-full blur-[100px] md:blur-[150px]" />
          <div className="absolute top-[70%] right-[15%] w-[320px] h-[320px] md:w-[480px] md:h-[480px] bg-[#1D2D5F]/35 rounded-full blur-[90px] md:blur-[140px]" />
        </div>
      )}

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
            {currentView === 'pending-approval' && (
              <div className="min-h-screen flex items-center justify-center p-6">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div>
                    <h2 className="text-white font-serif text-xl font-bold tracking-tight">Account Pending Approval</h2>
                    <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                      Your registration has been received. A Petra Connect administrator will review and approve your account shortly. You will be able to log in once approved.
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4">
                    <p className="text-amber-300 text-xs font-medium">If you were already approved, please log in with your credentials.</p>
                  </div>
                  <button
                    onClick={() => navigateTo('login')}
                    className="w-full py-2.5 rounded-xl bg-brand-gold text-navy-950 font-bold text-sm hover:bg-amber-400 transition"
                  >
                    Go to Login
                  </button>
                </div>
              </div>
            )}
            {currentView !== 'register' && currentView !== 'login' && currentView !== 'pending-approval' && (
              <LandingPage
                onRegister={handleStartRegister}
                onLogin={handleStartLogin}
                onExploreDemo={handleStartLogin}
              />
            )}
          </>
        ) : (
          <div className="petra-app-interior flex h-screen overflow-hidden bg-gray-50 text-navy-950 font-sans">
            
            {/* Sidebar navigation on Desktop, standard floating bottom bar on mobile */}
            <Navigation
              currentView={currentView}
              setView={navigateTo}
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
              <header className="hidden md:flex justify-between items-center mb-6 py-2.5 border border-gray-200 bg-white px-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold font-sans">
                  <span>Petra Connect Hubs</span>
                  <span>/</span>
                  <span className="text-brand-gold uppercase font-mono tracking-widest">{currentView}</span>
                </div>

                <div className="flex gap-2.5 items-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 block inline shrink-0 animate-pulse" />
                  <span className="text-[10px] text-gray-400 font-mono tracking-wider font-semibold">SECURE GATEWAY • STATUS ONLINE</span>
                </div>
              </header>

              {/* Dynamic page content layout viewport */}
              {renderCurrentView()}
              
            </main>
          </div>
        )}
      </div>

      {/* Spinner only when transition takes >50ms — instant cached-page switches never trigger it */}
      {showSpinner && <LoadingSpinner />}
    </Suspense>
  );
}
