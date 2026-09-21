# Petra Connect Hubs — Full System Documentation

> **How to use this document:** Every section is self-contained and independently editable. When a feature is added, changed, or removed, update only the relevant section. The Table of Contents links directly to each section. Keep the "Last Updated" line at the top of any section you edit.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack — What, Why & How](#3-tech-stack--what-why--how)
4. [Repository & Directory Structure](#4-repository--directory-structure)
5. [Authentication System](#5-authentication-system)
6. [Database Schema](#6-database-schema)
7. [Backend API Reference](#7-backend-api-reference)
8. [Desktop Application](#8-desktop-application)
9. [Mobile Application](#9-mobile-application)
10. [Features by Module](#10-features-by-module)
11. [Performance Optimisations](#11-performance-optimisations)
12. [Deployment & CI/CD](#12-deployment--cicd)
13. [Development Workflow](#13-development-workflow)
14. [Security](#14-security)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)

---

## 1. Project Overview

*Last Updated: 2026-09-21*

**Petra Connect Hubs** is a private professional community and fellowship platform built for **Petra Full Gospel Church**. It provides a structured digital space where members can connect, communicate, collaborate, and grow together within their respective professional hubs.

### Purpose
The church organises its members into **Hubs** — groups built around professions (Technology, Business, Medicine, etc.). This platform gives each hub a dedicated digital home, and gives the broader church community tools to stay connected across hubs.

### Who Uses It
| Role | Description |
|---|---|
| **Member** | A regular church member who belongs to one hub |
| **Hub Leader** | Leads a hub; can approve members, post announcements, manage events |
| **Admin** | Church administrator; has full access across all hubs |

### What It Does
- Members join hubs and connect with each other professionally
- Hub Leaders manage their hub's members, announcements, and events
- A social feed (like a private community newsfeed) for sharing posts, images, polls, and audio
- Direct messaging between members with rich media support
- Notifications for all activity
- Admin panel for full platform governance

### Platforms
| Platform | Technology | Status |
|---|---|---|
| Desktop Web App | React + TypeScript | Live at `https://connecthubs.petrafgc.org` (or configured domain) |
| Mobile App (Android) | Flutter + Dart | APK distributed directly (not on Play Store yet) |
| Backend API | PHP + MySQL | Live at `https://api.petrafgc.org/petra-api/` |

---

## 2. System Architecture

*Last Updated: 2026-09-21*

```
┌─────────────────────┐     ┌─────────────────────┐
│   Desktop Web App   │     │   Mobile App (APK)  │
│   React/TypeScript  │     │   Flutter/Dart       │
│   Hosted on cPanel  │     │   Android (ARM)      │
└────────┬────────────┘     └──────────┬──────────┘
         │  HTTPS requests              │  HTTPS requests
         │  JSON responses              │  JSON responses
         ▼                             ▼
┌─────────────────────────────────────────────────┐
│              Backend REST API                   │
│         PHP 8 — file-per-endpoint pattern       │
│         Hosted: api.petrafgc.org/petra-api/     │
│         Server: Turbify (cPanel / Apache)       │
└────────────────────┬────────────────────────────┘
                     │  MySQLi prepared statements
                     ▼
┌─────────────────────────────────────────────────┐
│              MySQL Database                     │
│         Database: petra_connect_hubs            │
│         Hosted: Turbify cPanel                  │
└─────────────────────────────────────────────────┘
```

### Architecture Decisions

**Why a separate API server?**
Both the desktop and mobile app share the exact same backend. A single PHP API means any feature built once is available on both platforms immediately — no duplication of business logic.

**Why file-per-endpoint (not a framework like Laravel)?**
Turbify shared hosting has limitations. Laravel's artisan, composer autoloading and complex routing can conflict with shared hosting configurations. Plain PHP files work everywhere with zero setup — you upload a file and it works. The trade-off is more files, but for this scale it is perfectly maintainable.

**Why separate repos for desktop and mobile?**
They use completely different technologies (React vs Flutter). Keeping them separate avoids dependency conflicts, simplifies CI/CD pipelines, and allows each to be deployed independently.

---

## 3. Tech Stack — What, Why & How

*Last Updated: 2026-09-21*

### Frontend — Desktop

| Technology | Version | What it is | Why it was chosen |
|---|---|---|---|
| **React** | 19 | UI library for building component-based interfaces | Industry standard, massive ecosystem, component reuse across all pages |
| **TypeScript** | 5.8 | Typed superset of JavaScript | Catches bugs at compile time; essential when the codebase grows across many files |
| **Vite** | 6 | Build tool and dev server | Extremely fast hot-reload during development; produces optimised production bundles |
| **Tailwind CSS** | 4 | Utility-first CSS framework | Rapid styling without writing separate CSS files; consistent design system |
| **Lucide React** | latest | Icon library | Clean, consistent SVG icons used throughout the UI |
| **Motion** | 12 | Animation library | Smooth transitions and animated UI elements |
| **Pusher JS** | 8 | Real-time WebSocket client | Powers live typing indicators and instant message delivery in the chat |

**How they work together:** Vite serves the app during development with instant hot-reload. On build (`npm run build`), Vite bundles everything into a `dist/` folder of static files that Apache on cPanel serves directly. React renders the UI, TypeScript ensures type safety, and Tailwind handles all styling.

---

### Frontend — Mobile

| Technology | Version | What it is | Why it was chosen |
|---|---|---|---|
| **Flutter** | 3.47.4 | Cross-platform UI framework | Single codebase runs on Android, iOS, Web, Windows, Linux — write once, deploy everywhere |
| **Dart** | bundled | Programming language for Flutter | Fast, strongly typed, compiles to native ARM code |
| **go_router** | 14 | Declarative navigation/routing | Clean URL-like routing with redirect guards for auth; integrates with Provider |
| **Provider** | 6 | State management | Lightweight, officially recommended by Flutter team; sufficient for this app's complexity |
| **Dio** | 5 | HTTP client | More powerful than the built-in `http` package; supports interceptors for auth headers, timeouts, FormData |
| **flutter_secure_storage** | 9 | Encrypted local storage | Stores JWT tokens securely in the device's keychain (not plain SharedPreferences) |
| **cached_network_image** | 3 | Image caching | Profile photos and media are cached on device; no re-downloading on every scroll |
| **flutter_svg** | 2 | SVG renderer | Renders the Petra logo SVG in-app without rasterisation loss |
| **image_picker** | 1 | Camera/gallery access | Lets users pick photos for profiles and feed posts |
| **video_player** | 2 | In-app video playback | Plays video posts in the social feed |
| **audioplayers** | 6 | Audio playback | Plays voice messages and audio posts |
| **url_launcher** | 6 | Opens URLs in browser | Link previews in the feed open in the device browser |
| **local_auth** | 2 | Biometric authentication | Fingerprint/face unlock for the app |

**How they work together:** Flutter builds the UI as a widget tree. `go_router` handles navigation between screens with auth redirects. `Provider` makes `AuthService` available to any widget that needs it. `Dio` (via `ApiService`) handles all API calls with automatic JWT injection via an interceptor.

---

### Backend

| Technology | What it is | Why it was chosen |
|---|---|---|
| **PHP 8** | Server-side scripting language | Runs natively on every shared hosting provider including Turbify; no server setup required |
| **MySQL** | Relational database | Reliable, well-supported on cPanel, excellent performance for this data model |
| **MySQLi (prepared statements)** | PHP database driver | Prevents SQL injection; faster than PDO for simple queries |
| **JWT (custom implementation)** | JSON Web Token authentication | Stateless auth — the server doesn't store sessions, every request is self-contained |
| **Apache (.htaccess)** | Web server | Comes with XAMPP/cPanel; handles CORS, Gzip, and URL rewriting |

---

### Infrastructure & Tooling

| Tool | Purpose |
|---|---|
| **XAMPP** | Local development server (Apache + MySQL + PHP on Windows) |
| **Turbify / cPanel** | Production hosting for the API and desktop app |
| **GitHub** | Version control and source of truth for the codebase |
| **GitHub Actions** | CI/CD — automatically builds and deploys the desktop app on every push |
| **Python + svglib** | Used once to convert the Petra logo SVG to PNG for the mobile app icon |

---

## 4. Repository & Directory Structure

*Last Updated: 2026-09-21*

### Desktop App — `petra-connect-hubs/`
```
petra-connect-hubs/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-deploy to cPanel on git push
├── src/
│   ├── App.tsx                 # Root component — state, routing, all page logic
│   ├── index.css               # Global styles, Tailwind imports
│   ├── main.tsx                # React entry point
│   ├── types.ts                # TypeScript type definitions for the whole app
│   ├── assets/
│   │   └── images/
│   │       └── petra-logo.svg  # Official Petra logo (complex traced SVG)
│   ├── components/             # One file per page/feature
│   │   ├── LandingPage.tsx     # Public landing page (not logged in)
│   │   ├── LoginPage.tsx       # Login form
│   │   ├── RegisterPage.tsx    # Registration form
│   │   ├── Navigation.tsx      # Sidebar nav (desktop) + bottom bar (mobile)
│   │   ├── Dashboard.tsx       # Main dashboard (announcements, events, stats)
│   │   ├── MyHubPage.tsx       # Hub-specific page (members, resources)
│   │   ├── MembersPage.tsx     # Full members directory with connect/message
│   │   ├── MessagesPage.tsx    # Real-time messaging (conversations + threads)
│   │   ├── NotificationsPage.tsx
│   │   ├── HubLeaderPanel.tsx  # Hub leader tools (create posts, manage hub)
│   │   ├── AdminPanel.tsx      # Admin tools (users, roles, audit logs)
│   │   ├── ProfilePage.tsx     # User profile view and edit
│   │   └── SocialFeed.tsx      # Social feed (posts, reactions, comments)
│   └── services/
│       └── api.ts              # All API calls + request cache + dedup
├── DOCUMENTATION.md            # This file
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Mobile App — `petra_mobile_flutter/`
```
petra_mobile_flutter/
├── lib/
│   ├── main.dart               # App entry point
│   ├── app.dart                # GoRouter setup + page transitions
│   ├── theme/
│   │   └── app_theme.dart      # Brand colours, typography, theme
│   ├── services/
│   │   ├── api_service.dart    # All API calls via Dio
│   │   └── auth_service.dart   # JWT storage, login state, ChangeNotifier
│   ├── screens/
│   │   ├── splash_screen.dart  # Animated splash (particles + network + typewriter)
│   │   ├── login_screen.dart
│   │   ├── register_screen.dart
│   │   ├── home/
│   │   │   ├── home_screen.dart        # Bottom nav shell + badge polling
│   │   │   ├── dashboard_screen.dart   # Stats, announcements, events
│   │   │   ├── feed_screen.dart        # Social feed
│   │   │   ├── messages_screen.dart    # Chat UI
│   │   │   └── profile_screen.dart     # User profile
│   │   └── admin/
│   │       ├── admin_panel_screen.dart # Admin tools
│   │       └── hub_leader_screen.dart  # Hub leader tools
│   └── widgets/
│       └── petra_widgets.dart  # Shared reusable widgets
├── android/                    # Android-specific config and icons
├── assets/
│   └── images/
│       └── icon.png            # App icon (Petra logo, 1024×1024)
└── pubspec.yaml
```

### Backend API — `petra-api/` (on XAMPP / cPanel)
```
petra-api/
├── config/
│   ├── database.php    # DB connection + normalizeUrl() helper
│   ├── auth.php        # JWT generation, verification, requireAuth()
│   ├── cors.php        # CORS headers (allows all origins)
│   └── notify.php      # createNotification() helper
├── auth/
│   ├── login.php
│   └── register.php
├── users/
│   ├── profile.php     # GET own profile
│   ├── update.php      # POST update profile fields
│   ├── photo.php       # POST upload profile photo
│   ├── view.php        # GET any user's public profile
│   └── check-username.php
├── hubs/
│   └── index.php       # GET all hubs
├── hub-members/
│   ├── my-status.php   # GET caller's hub membership
│   ├── pending.php     # GET pending approvals (leader/admin)
│   ├── approve.php     # POST approve a membership
│   └── reject.php      # POST reject a membership
├── announcements/
│   ├── index.php       # GET all announcements
│   ├── create.php
│   ├── update.php
│   └── delete.php
├── events/
│   ├── index.php       # GET all events
│   ├── create.php
│   ├── update.php
│   ├── delete.php
│   ├── register.php    # POST toggle event registration
│   └── view.php        # GET event + attendees
├── connections/
│   ├── list.php        # GET connection statuses
│   ├── send.php        # POST send request
│   ├── respond.php     # POST accept/decline
│   └── remove.php      # POST remove connection
├── messages/
│   ├── conversations.php   # GET conversation list with unread counts
│   ├── thread.php          # GET message thread with a user
│   ├── send.php            # POST send message (all types)
│   ├── delete.php
│   ├── edit.php
│   ├── react.php           # POST emoji reaction
│   ├── star.php
│   ├── mark-read.php
│   ├── mark-delivered.php
│   ├── mark-all-delivered.php
│   ├── typing.php          # POST typing indicator via Pusher
│   ├── mute.php
│   ├── set-disappear.php   # Disappearing messages timer
│   ├── set-lock.php        # PIN-lock a conversation
│   ├── verify-lock.php
│   ├── upload-file.php     # POST upload document/image/video/audio
│   └── upload-audio.php    # POST upload voice message
├── notifications/
│   ├── index.php
│   ├── mark-read.php
│   ├── mark-all-read.php
│   ├── register-token.php  # POST register Expo push token
│   └── unregister-token.php
├── feed/
│   ├── posts.php           # GET paginated feed / POST create post
│   ├── post.php            # DELETE a post
│   ├── comments.php        # GET/POST/DELETE comments
│   ├── reactions.php       # POST react to post
│   ├── poll_vote.php       # POST vote on a poll
│   ├── pin.php             # POST pin a post
│   ├── freeze.php          # GET/POST/DELETE user posting freeze
│   └── link_preview.php    # GET Open Graph preview for a URL
├── admin/
│   ├── users.php           # GET all users
│   ├── approve-account.php
│   ├── update-role.php
│   ├── delete-user.php
│   └── audit-logs.php      # GET/POST audit log entries
├── upload/
│   ├── feed_media.php      # POST upload feed image/video
│   └── feed_audio.php      # POST upload feed audio
├── dashboard/
│   └── stats.php           # GET dashboard statistics
├── .htaccess               # Gzip, cache headers, JWT forwarding fix
└── migrate_optimize.php    # One-time DB index migration (run once, then delete)
```

---

## 5. Authentication System

*Last Updated: 2026-09-21*

### How It Works

The system uses a **custom JWT (JSON Web Token)** implementation rather than a third-party library. This keeps dependencies at zero and works on any PHP host.

**Token structure:** `base64(payload).hmac_sha256_signature`

The payload contains:
```json
{
  "user_id": "uuid-string",
  "role": "member|hub_leader|admin",
  "exp": 1234567890
}
```

**Token lifetime:** 7 days. After that the user must log in again.

### Login Flow

```
User submits email + password
        ↓
auth/login.php — verifies credentials against users table (password_verify)
        ↓
Generates JWT token
        ↓
Returns: { token, user object }
        ↓
Client stores token:
  Desktop  → localStorage ('petra_token')
  Mobile   → flutter_secure_storage (encrypted keychain)
        ↓
Every subsequent API request sends:
  Authorization: Bearer <token>
        ↓
requireAuth() in config/auth.php verifies the token on every endpoint
```

### Session Guard (Desktop)
- **Token expiry check:** On every page load, `isSessionActive()` in `api.ts` checks the stored expiry. If expired, clears storage and redirects to landing page.
- **401 handler:** If the server returns 401, the API layer fires a `petra:session-expired` custom event. `App.tsx` listens for this and forces logout immediately.
- **Inactivity timeout:** After 30 minutes of no user interaction (mouse, keyboard, scroll), the session is cleared automatically.

### Session Guard (Mobile)
- `AuthService` (a `ChangeNotifier`) holds `isLoggedIn` state.
- `go_router` redirect logic: unauthenticated users are redirected to `/login`; authenticated users hitting `/login` are redirected to `/dashboard`.
- Token stored in `flutter_secure_storage` — survives app restarts, cleared only on logout or expired token.

### Roles & Permissions
| Permission | Member | Hub Leader | Admin |
|---|---|---|---|
| View feed, members, events | ✅ | ✅ | ✅ |
| Post in social feed | ✅ | ✅ | ✅ |
| Message other members | ✅ | ✅ | ✅ |
| Approve/reject hub members | ❌ | ✅ (own hub) | ✅ |
| Create announcements | ❌ | ✅ (own hub) | ✅ (any hub) |
| Create events | ❌ | ✅ (own hub) | ✅ (any hub) |
| Pin / freeze posts | ❌ | ✅ (own hub) | ✅ |
| Manage all users and roles | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

---

## 6. Database Schema

*Last Updated: 2026-09-21*

**Database name:** `petra_connect_hubs`

All IDs are UUIDs (generated in PHP with `random_bytes`). All tables use `utf8mb4` charset.

### Core Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| full_name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE | |
| password | VARCHAR(255) | bcrypt hash |
| role | ENUM | member, hub_leader, admin |
| profession | VARCHAR(100) | Maps to a hub type |
| bio | TEXT | |
| profile_image | VARCHAR(500) | URL to uploaded photo |
| username | VARCHAR(50) UNIQUE | Optional public handle |
| status | ENUM | pending, approved |
| created_at | DATETIME | |

#### `hubs`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| name | VARCHAR(255) | e.g. "Technology Hub" |
| description | TEXT | |
| created_at | DATETIME | |

#### `hub_members`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| hub_id | VARCHAR(36) FK → hubs | |
| user_id | VARCHAR(36) FK → users | |
| status | ENUM | pending, approved, rejected |
| joined_at | DATETIME | |

*Indexes: `idx_hm_user(user_id)`, `idx_hm_hub_status(hub_id, status)`*

#### `connection_requests`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| sender_id | VARCHAR(36) FK → users | |
| receiver_id | VARCHAR(36) FK → users | |
| status | ENUM | pending, accepted, declined |
| created_at | DATETIME | |

*Indexes: `idx_cr_sender`, `idx_cr_receiver`, `idx_cr_status`*

### Announcements & Events

#### `announcements`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| hub_id | VARCHAR(36) FK → hubs | NULL = global |
| author_id | VARCHAR(36) FK → users | |
| title | VARCHAR(255) | |
| content | TEXT | |
| created_at | DATETIME | |

#### `events`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| hub_id | VARCHAR(36) FK → hubs | |
| creator_id | VARCHAR(36) FK → users | |
| title | VARCHAR(255) | |
| description | TEXT | |
| date | DATE | |
| time | TIME | |
| location | VARCHAR(255) | |
| created_at | DATETIME | |

#### `event_registrations`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| event_id | VARCHAR(36) FK → events | |
| user_id | VARCHAR(36) FK → users | |
| registered_at | DATETIME | |

### Social Feed

#### `hub_posts`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| author_id | VARCHAR(36) FK → users | |
| hub_id | VARCHAR(36) FK → hubs | NULL = global |
| post_type | ENUM | text, image, video, link, poll, audio |
| visibility | ENUM | hub, global |
| content | TEXT | |
| link_url / link_title / link_desc / link_image / link_domain | VARCHAR | For link posts |
| audio_url | VARCHAR(500) | For audio posts |
| audio_duration | FLOAT | |
| audio_waveform | JSON | Waveform data array |
| is_pinned | TINYINT | 0/1 |
| is_deleted | TINYINT | Soft delete |
| created_at | DATETIME | |

*Indexes: `idx_hp_feed(is_deleted, is_pinned, created_at)`, `idx_hp_hub`, `idx_hp_author`, `idx_hp_visibility`*

#### `hub_post_media`
Stores image/video attachments per post. Multiple rows per post.
`post_id`, `url`, `thumb_url`, `media_type`, `mime`, `sort_order`

#### `hub_post_reactions`
Emoji reactions on posts.
`post_id`, `user_id`, `reaction` (emoji string)

#### `hub_post_comments`
`id`, `post_id`, `author_id`, `content`, `is_deleted`, `created_at`

#### `hub_post_poll_options`
`id`, `post_id`, `label`, `sort_order`

#### `hub_post_poll_votes`
`id`, `post_id`, `option_id`, `user_id`

#### `user_posting_freeze`
Records users who have been banned from posting by a leader/admin.
`id`, `user_id`, `hub_id` (NULL = global freeze), `frozen_by`, `reason`, `created_at`

### Messaging

#### `messages`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| sender_id | VARCHAR(36) FK → users | |
| receiver_id | VARCHAR(36) FK → users | |
| message_type | ENUM | text, image, video, audio, document, poll, contact, event |
| content | TEXT | Text content or JSON for rich types |
| file_url | VARCHAR(500) | For media messages |
| reply_to_id | VARCHAR(36) | For threaded replies |
| is_deleted | TINYINT | |
| is_starred | TINYINT | |
| is_edited | TINYINT | |
| view_once | TINYINT | Disappears after viewing |
| delivered_at | DATETIME | |
| read_at | DATETIME | |
| disappear_after | INT | Seconds (0 = off) |
| created_at | DATETIME | |

*Indexes: `idx_msg_sender`, `idx_msg_receiver`, `idx_msg_pair(sender_id, receiver_id, created_at)`*

#### `notifications`
`id`, `user_id`, `title`, `body`, `type`, `reference_id`, `is_read`, `created_at`

*Index: `idx_notif_user(user_id, is_read, created_at)`*

---

## 7. Backend API Reference

*Last Updated: 2026-09-21*

**Base URL:** `https://api.petrafgc.org/petra-api/`
**Authentication:** All endpoints (except login/register) require `Authorization: Bearer <token>` header.
**Response format:** Always JSON. Errors include `{ "error": "message" }`.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login.php` | No | Login with email + password. Returns `{ token, user }` |
| POST | `/auth/register.php` | No | Register new account. Returns `{ token, user }` |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/profile.php` | Get own full profile |
| POST | `/users/update.php` | Update name, profession, bio, location, username |
| POST | `/users/photo.php` | Upload profile photo (multipart) |
| GET | `/users/view.php?id=X` | Get any user's public profile |
| GET | `/users/check-username.php?username=X` | Check username availability |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats.php` | Hub member count, connections count, pending approvals |

### Hubs & Membership
| Method | Endpoint | Description |
|---|---|---|
| GET | `/hubs/index.php` | List all hubs |
| GET | `/hub-members/my-status.php` | Own hub membership status |
| GET | `/hub-members/pending.php` | Pending approvals for leader/admin |
| POST | `/hub-members/approve.php` | Approve a membership request |
| POST | `/hub-members/reject.php` | Reject a membership request |

### Announcements
| Method | Endpoint | Description |
|---|---|---|
| GET | `/announcements/index.php` | All announcements visible to the caller |
| POST | `/announcements/create.php` | Create announcement (leader/admin) |
| POST | `/announcements/update.php` | Edit announcement |
| POST | `/announcements/delete.php` | Delete announcement |

### Events
| Method | Endpoint | Description |
|---|---|---|
| GET | `/events/index.php` | All events visible to caller |
| POST | `/events/create.php` | Create event |
| POST | `/events/update.php` | Edit event |
| POST | `/events/delete.php` | Delete event |
| POST | `/events/register.php` | Toggle registration (attend/unattend) |
| GET | `/events/view.php?id=X` | Event detail + attendee list |

### Connections
| Method | Endpoint | Description |
|---|---|---|
| GET | `/connections/list.php` | Map of userId → connection status |
| POST | `/connections/send.php` | Send connection request |
| POST | `/connections/respond.php` | Accept or decline a request |
| POST | `/connections/remove.php` | Remove existing connection |

### Members
| Method | Endpoint | Description |
|---|---|---|
| GET | `/members/index.php` | Directory of all approved members |

### Messages
| Method | Endpoint | Description |
|---|---|---|
| GET | `/messages/conversations.php` | Conversation list with last message + unread count |
| GET | `/messages/thread.php?with=X` | Full message thread with a user |
| GET | `/messages/thread.php?with=X&since=T` | Only messages newer than timestamp |
| POST | `/messages/send.php` | Send message (all types) |
| POST | `/messages/delete.php` | Delete a message |
| POST | `/messages/edit.php` | Edit message content |
| POST | `/messages/react.php` | Add emoji reaction |
| POST | `/messages/star.php` | Star/unstar a message |
| POST | `/messages/mark-read.php` | Mark thread as read |
| POST | `/messages/mark-delivered.php` | Mark as delivered |
| POST | `/messages/mark-all-delivered.php` | Mark all as delivered (on login) |
| POST | `/messages/typing.php` | Trigger typing indicator via Pusher |
| POST | `/messages/mute.php` | Mute/unmute a conversation |
| POST | `/messages/set-disappear.php` | Set disappearing messages timer |
| POST | `/messages/set-lock.php` | PIN-lock a conversation |
| POST | `/messages/verify-lock.php` | Verify lock PIN |
| POST | `/messages/upload-file.php` | Upload file attachment |
| POST | `/messages/upload-audio.php` | Upload voice message |

### Social Feed
| Method | Endpoint | Description |
|---|---|---|
| GET | `/feed/posts.php?offset=0&limit=20` | Paginated feed (max 50 per page) |
| POST | `/feed/posts.php` | Create a post |
| DELETE | `/feed/post.php` | Delete a post |
| GET | `/feed/comments.php?post_id=X` | Get comments on a post |
| POST | `/feed/comments.php` | Add a comment |
| DELETE | `/feed/comments.php` | Delete a comment |
| POST | `/feed/reactions.php` | React to a post |
| POST | `/feed/poll_vote.php` | Vote on a poll |
| POST | `/feed/pin.php` | Pin/unpin a post |
| GET | `/feed/freeze.php` | Get frozen users (leader/admin) |
| POST | `/feed/freeze.php` | Freeze a user's posting |
| DELETE | `/feed/freeze.php` | Unfreeze a user |
| GET | `/feed/link_preview.php?url=X` | Fetch Open Graph preview for URL |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications/index.php` | All notifications for caller |
| POST | `/notifications/mark-read.php` | Mark one notification read |
| POST | `/notifications/mark-all-read.php` | Mark all read |
| POST | `/notifications/register-token.php` | Register Expo push token |
| POST | `/notifications/unregister-token.php` | Unregister push token |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/users.php` | All users with roles and status |
| POST | `/admin/approve-account.php` | Approve a pending account |
| POST | `/admin/update-role.php` | Change a user's role |
| POST | `/admin/delete-user.php` | Delete a user account |
| GET | `/admin/audit-logs.php` | Audit log entries |
| POST | `/admin/audit-logs.php` | Write an audit log entry |

### Uploads
| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload/feed_media.php` | Upload image or video for feed post |
| POST | `/upload/feed_audio.php` | Upload audio for feed post |

---

## 8. Desktop Application

*Last Updated: 2026-09-21*

### State Management
All application state lives in `App.tsx`. There is no external state management library (no Redux, no Zustand). State is passed to child components as props and callbacks. This is intentional — the app is simple enough that prop-drilling is clear and traceable.

Key state variables in `App.tsx`:
- `isLoggedIn` / `currentView` — controls which page is shown
- `currentUser` — the logged-in user's profile
- `announcements`, `events`, `notifications` — data fetched from API, polled periodically
- `connections` — map of userId → connection status, updated optimistically

### Routing
There is no React Router. Navigation is controlled by a `currentView` string state. Each value renders a different component in `renderCurrentView()`. This is simpler than URL-based routing for an SPA that doesn't need shareable URLs.

### Code Splitting
All 12 page components are **lazy-loaded** with `React.lazy()`. This means:
- On first load, only the landing page bundle is downloaded
- Each page's code is only downloaded when the user first visits it
- Covered by a `<Suspense>` wrapper with a minimal loading fallback

### API Layer (`src/services/api.ts`)
Every API call goes through the `request()` function which provides:
- **JWT injection** — automatically adds `Authorization: Bearer` header
- **401 handling** — fires `petra:session-expired` event on auth failure
- **GET cache** — responses cached 15 seconds (prevents polling from actually hitting the server every time)
- **In-flight deduplication** — two simultaneous identical GET requests share one HTTP call
- **Mutation invalidation** — POST/DELETE calls automatically clear related GET cache entries

### Polling Strategy
The desktop app polls for updates on intervals (no WebSockets except for Pusher/typing):
| Data | Interval | Why |
|---|---|---|
| Announcements + Events | 30 seconds | These change rarely; 30s is responsive enough |
| Notifications | 10 seconds | More time-sensitive; users expect prompt alerts |
| Mark all delivered | 10 seconds | Senders see "delivered" ticks quickly |
| Own profile | 60 seconds | Avatar/name rarely changes mid-session |

The 15-second GET cache means even if these timers fire, no actual HTTP request goes out unless the cache has expired.

---

## 9. Mobile Application

*Last Updated: 2026-09-21*

### Navigation
`go_router` manages 4 routes:

| Route | Screen | Transition |
|---|---|---|
| `/` | SplashScreen | Fade |
| `/login` | LoginScreen | Vertical rise (slides up 6% + fade) |
| `/register` | RegisterScreen | Silk slide (from right + fade) |
| `/dashboard` | HomeScreen | Scale 96%→100% + fade (feels like reward) |

The router has a `redirect` guard: unauthenticated users are always sent to `/login`; authenticated users hitting `/login` go directly to `/dashboard`.

### Home Screen (Tab Shell)
`HomeScreen` is a tab shell using `IndexedStack` (all tabs stay alive, no re-render on tab switch). It hosts:
- **Home (tab 0)** — DashboardScreen — notification badge
- **Feed (tab 1)** — FeedScreen
- **Messages (tab 2)** — MessagesScreen — unread message badge
- **Profile (tab 3)** — ProfileScreen
- **Hub (tab 4, leaders only)** — HubLeaderScreen
- **Admin (tab 4/5, admins only)** — AdminPanelScreen

Badge counts are polled every **30 seconds** via a single `ApiService` instance created once in `initState`.

### Splash Screen
A fully animated splash screen with three phases:
1. **Particle assembly** — 36 pre-positioned particles converge toward the centre
2. **Logo reveal** — Petra logo fades and scales in as particles arrive
3. **Network web** — 8-node network with 11 edges draws in around the logo
4. **Title + buttons** — "Petra Connect Hubs" typewriter text, then CTA buttons

The animation uses 4 `AnimationController`s coordinated via `Interval` curves on a single 6400ms master controller. If the user is already logged in, the animation still plays but navigation to dashboard happens automatically at 3500ms.

### App Icon
The app icon is the official Petra logo converted from the desktop SVG to PNG at all Android mipmap densities:
- mdpi: 48×48, hdpi: 72×72, xhdpi: 96×96, xxhdpi: 144×144, xxxhdpi: 192×192

### API Layer (`lib/services/api_service.dart`)
All HTTP calls go through `ApiService` which wraps **Dio** with:
- A base URL interceptor pointing to the API server
- JWT injection via `onRequest` interceptor
- Automatic session clear on 401 via `onError` interceptor
- 15-second connect timeout, 30-second receive timeout

### Brand Colours
```dart
const Color kOrange   = Color(0xFFF37021);  // Primary accent — buttons, active states
const Color kNavy     = Color(0xFF0F132E);  // Primary background — splash, nav bar
const Color kWhite    = Color(0xFFFFFFFF);
const Color kGraySub  = Color(0xFF9CA3AF);  // Subtext
const Color kGrayBorder = Color(0xFFE5E7EB);
```

---

## 10. Features by Module

*Last Updated: 2026-09-21*

### Landing Page (Desktop only)
- Public-facing page for unauthenticated visitors
- Animated background with dark navy + orange glow orbs
- Call to action to Register or Login

### Authentication
- **Register:** Full name, email, password, profession selection
- **Login:** Email + password; pending accounts show a specific error
- **Session restore:** On page load, stored token is validated; if valid, user goes straight to dashboard
- **Inactivity logout:** 30 minutes of inactivity (desktop); token expiry (mobile)

### Dashboard
Shows a summary of the user's hub activity:
- Hub name and membership status
- Stats: hub member count, connections count, pending approvals (leaders/admins)
- Announcements list with like interaction
- Upcoming events with register/unregister toggle
- Quick links to other modules

### Social Feed
A community newsfeed visible to hub members (hub posts) and all members (global posts):
- **Post types:** Text, Image (up to 9), Video, Link (with Open Graph preview), Poll (up to 6 options), Audio/Voice
- **Interactions:** Emoji reactions, comments, pin (leader/admin), delete
- **Freeze:** Leaders/admins can freeze a user's posting ability from within the feed
- **Pagination:** 20 posts per page, infinite scroll
- Feed is filtered by hub membership (members only see their hub + global posts; admins see all)

### Members Directory
- List of all approved members across all hubs
- Connect / disconnect with any member
- Send a message directly from the directory
- Connection status shown per member (connected / pending / not connected)

### My Hub
- Members of the user's own hub
- Hub resources (downloadable files)
- Hub-specific announcements

### Messages
Full-featured direct messaging between members:
- Conversation list with unread counts and last message preview
- Message types: text, image, video, audio, document, contact card, event link, polls
- Rich features: reply-to (threading), emoji reactions, edit, delete, star, view-once, disappearing messages, PIN-lock conversation
- Real-time typing indicators via Pusher WebSocket
- Read/delivered receipts (single/double grey ticks → blue ticks)

### Notifications
- Real-time activity alerts: new messages, connection requests, announcements, event registrations, feed activity
- Mark individual or all as read
- Clear notifications
- Badge count on nav icon

### Hub Leader Panel
Available to users with role `hub_leader`:
- Approve or reject pending member requests
- Create and manage announcements for their hub
- Create and manage events for their hub
- View hub member list

### Admin Panel
Available to users with role `admin`:
- Full user list with search and filters (all / pending / active / frozen)
- Change user roles (member → hub_leader → admin)
- Approve pending accounts
- Freeze / unfreeze accounts
- Delete users
- Audit log with timestamped entries of all admin actions
- Scope selector: manage all hubs or focus on a specific hub

### Profile
- View and edit own profile: name, profession, bio, location, username
- Upload / change profile photo
- View connection count

---

## 11. Performance Optimisations

*Last Updated: 2026-09-21*

### Database (Backend)
- **22 indexes** added across all critical tables via `migrate_optimize.php`
- Key compound indexes: `hub_posts(is_deleted, is_pinned, created_at)`, `messages(sender_id, receiver_id, created_at)`, `notifications(user_id, is_read, created_at)`, `hub_members(hub_id, status)`
- **N+1 eliminated in social feed:** The feed endpoint previously ran ~5 queries per post (media, reactions, comments, poll options, frozen status). This was replaced with 6 total batch queries for any page size. For a 20-post page: ~100 queries → 6 queries.

### Network (Backend)
- **Gzip compression** enabled via `.htaccess` for all JSON responses — reduces payload size by 60–70%
- **Static media caching** — uploaded images, videos, and audio files are served with `Cache-Control: 30 days` headers

### Desktop React
- **React.lazy + Suspense** — all 12 page components are code-split; each page's bundle only downloads when first visited
- **useCallback** on all event handlers — prevents child components from receiving new function references on every parent re-render
- **useMemo** for computed values (notification badge count)
- **API GET cache** (15-second TTL) — polling timers fire but no HTTP request is made unless data is stale
- **In-flight deduplication** — two simultaneous requests to the same endpoint share one HTTP call
- **Mutation cache invalidation** — POST/DELETE endpoints automatically clear related GET cache entries
- **Reduced polling:** announcements 5s→30s, notifications 5s→10s, delivery marks 3s→10s, profile 5s→60s

### Mobile Flutter
- **`cached_network_image`** — profile photos and media are cached on device; never re-downloaded on scroll
- **`ApiService` singleton** — created once in `initState`, not on every poll cycle. Previously rebuilt an entire Dio client every 15 seconds.
- **`IndexedStack`** for tabs — all tab screens stay alive in memory; no rebuild on tab switch
- **Badge poll interval** 15s → 30s
- **Release APK** — tree-shaking removes all unused code, compiled to native ARM; 177MB debug → 55.6MB release, 2–3× faster runtime

---

## 12. Deployment & CI/CD

*Last Updated: 2026-09-21*

### Hosting
| Component | Host | URL |
|---|---|---|
| Backend PHP API | Turbify (cPanel) | `https://api.petrafgc.org/petra-api/` |
| Desktop Web App | Turbify (cPanel) | Configured domain |
| Mobile APK | Manual distribution | Shared as a direct download link |

### Desktop App — Automatic Deployment
File: `.github/workflows/deploy.yml`

**Trigger:** Any push to `main` or `master` branch.

**Pipeline:**
1. GitHub Actions runner (Ubuntu) checks out the code
2. Node.js 20 is set up with npm cache
3. `npm ci` installs exact dependencies from `package-lock.json`
4. `npm run build` produces the optimised `dist/` folder
5. `SamKirkland/FTP-Deploy-Action` uploads only changed files to cPanel

**Required GitHub Secrets:**
| Secret | Value |
|---|---|
| `FTP_HOST` | FTP server address (e.g. `ftp.petrafgc.org`) |
| `FTP_USERNAME` | cPanel username |
| `FTP_PASSWORD` | cPanel password |
| `FTP_REMOTE_DIR` | Remote directory (e.g. `/public_html/`) |

**Result:** Every `git push` from the developer's PC deploys the live site within ~2 minutes.

### Backend PHP — Manual Deployment
PHP files are edited locally in `C:\xampp\htdocs\petra-api\`, tested against local XAMPP, then uploaded to cPanel via File Manager or FTP.

**Recommended:** Set up Git Version Control in cPanel for the PHP backend so it can also be auto-deployed via `git push`.

### Mobile APK — Manual Build & Distribute
```bash
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk` (~55MB)

Distribute by uploading to the server and sharing a download link, or via a WhatsApp/email link. Users enable "Install unknown apps" on their device, tap the APK to install.

**Note:** `kApiBase` in `lib/services/api_service.dart` must point to the production URL before building a release APK. Currently it points to the local hotspot IP — update to `https://api.petrafgc.org/petra-api` before any public distribution.

---

## 13. Development Workflow

*Last Updated: 2026-09-21*

### Local Setup

**Desktop App:**
```bash
cd petra-connect-hubs
npm install
npm run dev          # Starts on http://localhost:3000
```

**Backend API:**
- Start XAMPP (Apache + MySQL)
- Files live at `C:\xampp\htdocs\petra-api\`
- Access at `http://localhost/petra-api/`

**Mobile App:**
```bash
cd petra_mobile_flutter
flutter pub get
flutter run          # Requires Android device or emulator
```
For device testing: change `kApiBase` to your PC's local IP on the shared network.

### Day-to-Day Workflow
1. Edit code locally
2. Test against local XAMPP server
3. `git add . && git commit -m "description" && git push`
4. Desktop app auto-deploys via GitHub Actions
5. PHP changes: upload manually to cPanel (or set up cPanel Git)
6. Mobile changes: `flutter build apk --release`, upload new APK

### Environment Variables / Config
| File | Variable | Dev value | Prod value |
|---|---|---|---|
| `src/services/api.ts` | `API_BASE` | `http://localhost/petra-api` | `https://api.petrafgc.org/petra-api/` |
| `lib/services/api_service.dart` | `kApiBase` | Local hotspot IP | `https://api.petrafgc.org/petra-api` |
| `config/auth.php` | `JWT_SECRET` | `petra_connect_hubs_secret_2026` | **Change this on production** |
| `config/database.php` | DB credentials | root / (empty) | cPanel DB user / password |

---

## 14. Security

*Last Updated: 2026-09-21*

### What Is in Place
- **Prepared statements** — all database queries use `bind_param()`. SQL injection is not possible.
- **bcrypt password hashing** — `password_hash()` / `password_verify()` used throughout
- **JWT HMAC-SHA256 signature** — tokens cannot be forged without the secret
- **Token expiry** — 7-day lifetime, checked on both client and server
- **Role checks on every endpoint** — endpoints that require leader/admin role verify this from the token, not user input
- **HTTPS** — all production traffic is encrypted in transit
- **Inactivity timeout** — desktop auto-logs-out after 30 minutes of inactivity

### What Needs Attention
- **JWT secret** (`petra_connect_hubs_secret_2026`) is a weak default. **Must be changed to a strong random string on production.** Update `config/auth.php`.
- **CORS** is currently set to `*` (all origins). For production, restrict to `https://petrafgc.org` in `config/cors.php`.
- **`migrate_optimize.php`** should be deleted from the server after running — it is publicly accessible.
- **Database backups** — cPanel's backup tool should be run regularly. No automated backup is currently configured.

---

## 15. Known Limitations & Future Work

*Last Updated: 2026-09-21*

### Current Limitations
| Area | Limitation |
|---|---|
| Mobile | APK still points to local IP — must update `kApiBase` before distribution |
| Mobile | Not on Google Play Store — requires manual APK install |
| Mobile | iOS not yet built (needs Mac + Xcode + Apple Developer account) |
| Backend | No WebSockets for feed/notifications — relies on polling |
| Backend | Push notifications infrastructure exists (Expo tokens stored) but not fully wired |
| Security | JWT secret is a weak default |
| Security | CORS allows all origins |
| Database | No automated backups |

### Planned / In Progress
- [ ] Social Feed — full feature parity between desktop and mobile
- [ ] Members Directory — mobile implementation
- [ ] My Hub — mobile implementation
- [ ] In-app APK update checker (mobile)
- [ ] CI/CD for PHP backend (cPanel Git Version Control)
- [ ] iOS build
- [ ] Push notifications (Expo)
- [ ] Change JWT secret to production-grade value
- [ ] Restrict CORS to production domain

---

*End of documentation. Update the relevant section and its "Last Updated" date whenever changes are made.*
