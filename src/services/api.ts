export const API_BASE     = 'https://api.petrafgc.org/petra-api/'; // the local -- http://localhost/petra-api
export const PUSHER_KEY     = 'e8ad8fc8c6f7a13297ba';
export const PUSHER_CLUSTER = 'eu';

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

// ── Request cache + in-flight deduplication ───────────────────────────────────
// GET responses are cached for 15 s so polling intervals don't hammer the server.
// Simultaneous identical GET requests share one in-flight Promise.
// Mutation endpoints (POST/PUT/DELETE) auto-invalidate related cache keys.

const _cache    = new Map<string, { data: any; exp: number }>();
const _inflight = new Map<string, Promise<any>>();
const CACHE_TTL = 15_000;

const INVALIDATES: Record<string, string[]> = {
  '/announcements/create.php':         ['/announcements/index.php'],
  '/announcements/update.php':         ['/announcements/index.php'],
  '/announcements/delete.php':         ['/announcements/index.php'],
  '/events/create.php':                ['/events/index.php'],
  '/events/update.php':                ['/events/index.php'],
  '/events/delete.php':                ['/events/index.php'],
  '/events/register.php':              ['/events/index.php'],
  '/notifications/mark-read.php':      ['/notifications/index.php'],
  '/notifications/mark-all-read.php':  ['/notifications/index.php'],
  '/connections/send.php':             ['/connections/list.php'],
  '/connections/respond.php':          ['/connections/list.php'],
  '/connections/remove.php':           ['/connections/list.php'],
  '/feed/posts.php':                   [],
  '/feed/post.php':                    [],
};

async function _doFetch(path: string, options: RequestInit): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('petra:session-expired'));
    throw new Error(data.error || 'Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function request(path: string, options: RequestInit = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const isGet  = method === 'GET';

  if (isGet) {
    // Return cached result if still fresh
    const hit = _cache.get(path);
    if (hit && Date.now() < hit.exp) return hit.data;

    // Deduplicate concurrent requests for the same URL
    const inFlight = _inflight.get(path);
    if (inFlight) return inFlight;

    const promise = _doFetch(path, options)
      .then(data => {
        _cache.set(path, { data, exp: Date.now() + CACHE_TTL });
        _inflight.delete(path);
        return data;
      })
      .catch(err => {
        _inflight.delete(path);
        throw err;
      });

    _inflight.set(path, promise);
    return promise;
  }

  // Mutation: invalidate related GET caches immediately
  const toInvalidate = INVALIDATES[path] ?? [];
  toInvalidate.forEach(k => _cache.delete(k));
  // Also bust any cache whose path starts with the same endpoint family
  const family = path.replace(/\/[^/]+\.php$/, '');
  for (const k of _cache.keys()) {
    if (k.startsWith(family)) _cache.delete(k);
  }

  return _doFetch(path, options);
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
  username?: string;
}) {
  return request('/users/update.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function checkUsernameAvailability(username: string) {
  return request(`/users/check-username.php?username=${encodeURIComponent(username)}`);
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
  view_once?: boolean;
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
): Promise<{ url: string; name: string; size: number; mime: string; thumbnail_url?: string }> {
  return uploadFileXHR(file, type, () => {}, filename);
}

export function uploadFileXHR(
  file: File | Blob,
  type: 'document' | 'image' | 'video' | 'audio',
  onProgress: (pct: number) => void,
  filename?: string,
): Promise<{ url: string; name: string; size: number; mime: string; thumbnail_url?: string }> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('petra_token');
    const form  = new FormData();
    form.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'));
    form.append('type', type);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch {
        reject(new Error('Invalid server response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.open('POST', `${API_BASE}/messages/upload-file.php`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
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

export async function triggerTyping(receiverId: string): Promise<void> {
  return request('/messages/typing.php', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId }),
  }).catch(() => {});
}

export async function reactToMessage(messageId: string, emoji: string) {
  return request('/messages/react.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, emoji }),
  });
}

export async function editMessage(messageId: string, content: string) {
  return request('/messages/edit.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId, content }),
  });
}

export async function starMessage(messageId: string) {
  return request('/messages/star.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
}

export async function setDisappear(partnerId: string, disappearAfter: number | null) {
  return request('/messages/set-disappear.php', {
    method: 'POST',
    body: JSON.stringify({ partner_id: partnerId, disappear_after: disappearAfter ?? 0 }),
  });
}

export async function setLock(partnerId: string, pin: string | null) {
  return request('/messages/set-lock.php', {
    method: 'POST',
    body: JSON.stringify(pin ? { partner_id: partnerId, action: 'set', pin } : { partner_id: partnerId, action: 'remove' }),
  });
}

export async function verifyLock(partnerId: string, pin: string) {
  return request('/messages/verify-lock.php', {
    method: 'POST',
    body: JSON.stringify({ partner_id: partnerId, pin }),
  });
}

export async function registerPushToken(expoToken: string, platform: 'android' | 'ios' = 'android') {
  return request('/notifications/register-token.php', {
    method: 'POST',
    body: JSON.stringify({ expo_token: expoToken, platform }),
  }).catch(() => {});
}

export async function unregisterPushToken(expoToken: string) {
  return request('/notifications/unregister-token.php', {
    method: 'POST',
    body: JSON.stringify({ expo_token: expoToken }),
  }).catch(() => {});
}

export async function toggleMute(partnerId: string, action: 'mute' | 'unmute' | 'toggle' = 'toggle') {
  return request('/messages/mute.php', {
    method: 'POST',
    body: JSON.stringify({ partner_id: partnerId, action }),
  });
}

export async function markViewed(messageId: string) {
  return request('/messages/mark-viewed.php', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
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

// ── Social Feed ───────────────────────────────────────

export async function fetchFeedPosts(offset = 0, limit = 20) {
  return request(`/feed/posts.php?offset=${offset}&limit=${limit}`);
}

export async function createFeedPost(data: {
  post_type: 'text' | 'image' | 'video' | 'link' | 'poll' | 'audio';
  visibility: 'hub' | 'global';
  content?: string;
  media?: Array<{ url: string; thumb_url: string | null; media_type: string; mime: string | null }>;
  poll_options?: string[];
  link_url?: string;
  link_title?: string;
  link_desc?: string;
  link_image?: string;
  link_domain?: string;
  audio_url?: string;
  audio_duration?: number;
  audio_waveform?: number[];
}) {
  return request('/feed/posts.php', { method: 'POST', body: JSON.stringify(data) });
}

export async function uploadFeedAudio(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; duration: number; waveform: number[] }> {
  const token = localStorage.getItem('petra_token') ?? '';
  const form  = new FormData();
  form.append('audio', file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(d);
        else reject(new Error(d.error || 'Upload failed'));
      } catch { reject(new Error('Invalid server response')); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', `${API_BASE}/upload/feed_audio.php`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}

export async function fetchLinkPreview(url: string): Promise<{ title: string | null; description: string | null; image: string | null; domain: string | null }> {
  return request(`/feed/link_preview.php?url=${encodeURIComponent(url)}`);
}

export async function deleteFeedPost(postId: string) {
  return request('/feed/post.php', {
    method: 'DELETE',
    body: JSON.stringify({ post_id: postId }),
  });
}

export async function fetchFeedComments(postId: string) {
  return request(`/feed/comments.php?post_id=${encodeURIComponent(postId)}`);
}

export async function addFeedComment(postId: string, content: string) {
  return request('/feed/comments.php', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, content }),
  });
}

export async function deleteFeedComment(commentId: string) {
  return request('/feed/comments.php', {
    method: 'DELETE',
    body: JSON.stringify({ comment_id: commentId }),
  });
}

export async function voteFeedPoll(postId: string, optionId: string) {
  return request('/feed/poll_vote.php', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, option_id: optionId }),
  });
}

export async function pinFeedPost(postId: string) {
  return request('/feed/pin.php', { method: 'POST', body: JSON.stringify({ post_id: postId }) });
}

export async function freezeFeedUser(targetUserId: string, hubId?: string | null, reason?: string) {
  return request('/feed/freeze.php', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId, hub_id: hubId ?? null, reason: reason ?? '' }),
  });
}

export async function unfreezeFeedUser(targetUserId: string, hubId?: string | null) {
  return request('/feed/freeze.php', {
    method: 'DELETE',
    body: JSON.stringify({ target_user_id: targetUserId, hub_id: hubId ?? null }),
  });
}

export async function getFrozenUsers(): Promise<{ frozen: any[] }> {
  return request('/feed/freeze.php', { method: 'GET' });
}

export async function uploadFeedMedia(
  file: File,
  type: 'image' | 'video',
  onProgress?: (pct: number) => void,
): Promise<{ url: string; thumb_url: string | null; media_type: 'image' | 'video'; mime: string }> {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('petra_token');
    const form  = new FormData();
    form.append('file', file);
    form.append('type', type);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch { reject(new Error('Invalid server response')); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', `${API_BASE}/upload/feed_media.php`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}
