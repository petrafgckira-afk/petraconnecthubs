export type UserRole = 'member' | 'leader' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profession: HubType;
  company?: string;
  avatarUrl?: string;
  initials: string;
  bio?: string;
  skills: string[];
  connectionsCount: number;
  hubsCount: number;
  contributionDetails?: string;
  joinedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export type HubType =
  | 'Business'
  | 'Technology'
  | 'Medical'
  | 'Finance'
  | 'Education'
  | 'Media & Creative'
  | 'Leadership & Ministry';

export interface Hub {
  id: HubType;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  leadName: string;
  leadAvatar: string;
  memberCount: number;
  colorClass: string;
  gradientClass: string;
}

export interface HubAnnouncement {
  id: string;
  hubId: HubType | 'All';
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  authorImage?: string | null;
  date: string;
  commentsCount: number;
  likesCount: number;
  likedByUser?: boolean;
  isOwner?: boolean;
}

export interface HubEvent {
  id: string;
  hubId: HubType | 'All';
  title: string;
  description: string;
  date: string;
  time: string;
  timeRaw?: string;
  location: string;
  speakerName?: string;
  speakerTitle?: string;
  attendeesCount: number;
  isRegistered?: boolean;
  isOwner?: boolean;
}

export interface HubResource {
  id: string;
  hubId: HubType;
  title: string;
  description: string;
  fileType: 'pdf' | 'video' | 'link' | 'doc';
  fileSize?: string;
  downloadUrl: string;
  uploadedBy: string;
  downloadCount: number;
  date: string;
}

export interface Connection {
  id: string;
  memberId: string;
  status: 'connected' | 'pending_sent' | 'pending_received' | 'not_connected';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  user: {
    id: string;
    name: string;
    initials: string;
    profession: HubType;
    role: UserRole;
    company?: string;
    avatarUrl?: string;
    online: boolean;
  };
  messages: Message[];
  unreadCount: number;
}

export interface PetraNotification {
  id: string;
  type: 'announcement' | 'approval' | 'connection' | 'event' | 'message';
  title: string;
  description: string;
  time: string;
  read: boolean;
  meta?: {
    hubId?: HubType;
    senderId?: string;
    eventId?: string;
  };
}
