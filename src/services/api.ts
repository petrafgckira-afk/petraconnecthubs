const API_BASE = 'http://localhost/petra-api';

function getToken(): string | null {
  return localStorage.getItem('petra_token');
}

export function saveSession(token: string, user: object) {
  localStorage.setItem('petra_token', token);
  localStorage.setItem('petra_user', JSON.stringify(user));
  // A — store expiry extracted from token payload so we can check it client-side
  try {
    const payload = JSON.parse(atob(token.split('.')[0]));
    if (payload.exp) localStorage.setItem('petra_token_exp', String(payload.exp));
  } catch {}
}

export function clearSession() {
  localStorage.removeItem('petra_token');
  localStorage.removeItem('petra_user');
  localStorage.removeItem('petra_token_exp');
}

export function getSavedUser() {
  const raw = localStorage.getItem('petra_user');
  return raw ? JSON.parse(raw) : null;
}

export function isSessionActive(): boolean {
  const token = getToken();
  if (!token) return false;
  // A — reject the session immediately if the stored expiry has already passed
  const exp = localStorage.getItem('petra_token_exp');
  if (exp && Math.floor(Date.now() / 1000) > Number(exp)) {
    clearSession();
    return false;
  }
  return true;
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  // B — server said the token is invalid/expired; wipe the session and notify the app
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('petra:session-expired'));
    throw new Error(data.error || 'Session expired');
  }

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ──────────────────────────────────────────────
export async function loginUser(email: string, password: string) {
  const res  = await fetch(`${API_BASE}/auth/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Login failed');
    if (data.pending) err.pending = true;
    throw err;
  }
  return data;
}

export async function registerUser(formData: object) {
  return request('/auth/register.php', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
}

// ── Hubs ──────────────────────────────────────────────
export async function fetchHubs() {
  return request('/hubs/index.php');
}

// ── Dashboard ─────────────────────────────────────────
export async function fetchDashboardStats() {
  return request('/dashboard/stats.php');
}

// ── Hub Members ───────────────────────────────────────
export async function fetchMyHubStatus() {
  return request('/hub-members/my-status.php');
}

// ── Members ───────────────────────────────────────────
export async function fetchMembers() {
  return request('/members/index.php');
}

// ── Hub Leader ────────────────────────────────────────
export async function fetchPendingMembers() {
  return request('/hub-members/pending.php');
}

export async function approveMember(membershipId: string) {
  return request('/hub-members/approve.php', {
    method: 'POST',
    body: JSON.stringify({ membership_id: membershipId }),
  });
}

export async function rejectMember(membershipId: string) {
  return request('/hub-members/reject.php', {
    method: 'POST',
    body: JSON.stringify({ membership_id: membershipId }),
  });
}

// ── Announcements ─────────────────────────────────────
export async function fetchAnnouncements() {
  return request('/announcements/index.php');
}

export async function createAnnouncement(title: string, content: string, hubId?: string | null) {
  return request('/announcements/create.php', {
    method: 'POST',
    body: JSON.stringify({ title, content, ...(hubId ? { hub_id: hubId } : {}) }),
  });
}

export async function updateAnnouncement(id: string, title: string, content: string) {
  return request('/announcements/update.php', {
    method: 'POST',
    body: JSON.stringify({ id, title, content }),
  });
}

export async function deleteAnnouncement(id: string) {
  return request('/announcements/delete.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ── Events ────────────────────────────────────────────
export async function fetchEvents() {
  return request('/events/index.php');
}

export async function createEvent(data: {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
}) {
  return request('/events/create.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function toggleEventRegistration(eventId: string) {
  return request('/events/register.php', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  });
}

export async function updateEvent(id: string, data: {
  title: string; description: string; date: string; time: string; location: string;
}) {
  return request('/events/update.php', { method: 'POST', body: JSON.stringify({ id, ...data }) });
}

export async function deleteEvent(id: string) {
  return request('/events/delete.php', { method: 'POST', body: JSON.stringify({ id }) });
}

export async function fetchEventAttendees(id: string) {
  return request(`/events/view.php?id=${encodeURIComponent(id)}`);
}

// ── Notifications ─────────────────────────────────────────
export async function fetchNotifications() {
  return request('/notifications/index.php');
}

export async function markNotificationRead(notificationId: string) {
  return request('/notifications/mark-read.php', {
    method: 'POST',
    body: JSON.stringify({ notification_id: notificationId }),
  });
}

export async function markAllNotificationsRead() {
  return request('/notifications/mark-all-read.php', { method: 'POST' });
}

// ── Connections ───────────────────────────────────────────
export async function fetchConnections() {
  return request('/connections/list.php');
}

export async function sendConnectionRequest(receiverId: string) {
  return request('/connections/send.php', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId }),
  });
}

export async function respondToConnection(requestId: string, action: 'accept' | 'decline') {
  return request('/connections/respond.php', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, action }),
  });
}

export async function removeConnection(otherUserId: string) {
  return request('/connections/remove.php', {
    method: 'POST',
    body: JSON.stringify({ other_user_id: otherUserId }),
  });
}

// ── User Profile ──────────────────────────────────────────
export async function fetchOwnProfile() {
  return request('/users/profile.php');
}

export async function updateProfile(data: {
  full_name: string;
  profession: string;
  bio: string;
  location: string;
}) {
  return request('/users/update.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchUserProfile(userId: string) {
  return request(`/users/view.php?id=${userId}`);
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  const token = localStorage.getItem('petra_token');
  const form  = new FormData();
  form.append('photo', file);
  const res  = await fetch(`${API_BASE}/users/photo.php`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

// ── Admin ─────────────────────────────────────────────────
export async function fetchAllUsers() {
  return request('/admin/users.php');
}

export async function updateUserRole(userId: string, role: string) {
  return request('/admin/update-role.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function approveUserAccount(userId: string, role?: string) {
  return request('/admin/approve-account.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function deleteUser(userId: string) {
  return request('/admin/delete-user.php', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function fetchAuditLogs() {
  return request('/admin/audit-logs.php');
}

export async function writeAuditLog(entry: {
  action: string;
  detail: string;
  target_id?: string;
  status: 'success' | 'warning' | 'danger';
}) {
  return request('/admin/audit-logs.php', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

// ── Messages ──────────────────────────────────────────
export async function fetchConversations() {
  return request('/messages/conversations.php');
}

export async function fetchThread(withUserId: string) {
  return request(`/messages/thread.php?with=${withUserId}`);
}

export async function fetchNewMessages(withUserId: string, since: string) {
  return request(`/messages/thread.php?with=${withUserId}&since=${encodeURIComponent(since)}`);
}

export async function sendRichMessage(receiverId: string, payload: {
  message_type: string;
  content?: string;
  file_url?: string;
  file_meta?: string;
  question?: string;
  options?: string[];
  reply_to_id?: string | null;
}) {
  return request('/messages/send.php', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, ...payload }),
  });
}

export async function uploadFile(
  file: File | Blob,
  type: 'document' | 'image' | 'video' | 'audio',
  filename?: string,
): Promise<{ url: string; name: string; size: number; mime: string }> {
  const token = localStorage.getItem('petra_token');
  const form  = new FormData();
  form.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'));
  form.append('type', type);
  const res  = await fetch(`${API_BASE}/messages/upload-file.php`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

export async function pollVote(messageId: string, optionIndex: number) {
  return request('/messages/poll-vote.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, option_index: optionIndex }),
  });
}

export async function sendMessage(receiverId: string, content: string, replyToId?: string) {
  return request('/messages/send.php', {
    method: 'POST',
    body: JSON.stringify({
      receiver_id: receiverId,
      content,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    }),
  });
}

export async function deleteMessage(messageId: string) {
  return request('/messages/delete.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
}

export async function markDelivered(partnerId: string) {
  return request('/messages/mark-delivered.php', {
    method: 'POST',
    body: JSON.stringify({ with_user_id: partnerId }),
  }).catch(() => {});
}

export async function markRead(partnerId: string) {
  return request('/messages/mark-read.php', {
    method: 'POST',
    body: JSON.stringify({ with_user_id: partnerId }),
  }).catch(() => {});
}

export async function markAllDelivered() {
  return request('/messages/mark-all-delivered.php', {
    method: 'POST',
    body: '{}',
  }).catch(() => {});
}

export async function sendAudioMessage(receiverId: string, audioUrl: string, waveformData: number[], replyToId?: string) {
  return request('/messages/send.php', {
    method: 'POST',
    body: JSON.stringify({
      receiver_id:   receiverId,
      message_type:  'audio',
      audio_url:     audioUrl,
      waveform_data: JSON.stringify(waveformData),
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    }),
  });
}

export async function uploadAudio(blob: Blob): Promise<string> {
  const token = localStorage.getItem('petra_token');
  const form  = new FormData();
  form.append('audio', blob, 'voice.webm');
  const res  = await fetch(`${API_BASE}/messages/upload-audio.php`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token || ''}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}
