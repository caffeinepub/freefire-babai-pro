# MR.SONIC FF — Real-Time Messaging System

## Current State
- App uses Firebase Firestore (v10.12.2 CDN) for all data; no Firebase Auth
- Admin detected by UID === "admin"; session in localStorage
- Existing `notifications` collection stores per-user notifications (uid, title, message, read, timestamp)
- `AdminAnnouncementsView` exists but is a separate admin view; not a dedicated message box
- `NotificationsView` shows per-user notifications but is not styled as a broadcast/WhatsApp-style feed
- No dedicated `messages` collection or broadcast message feed on user dashboard
- Phone numbers stored in users/{uid}.phone — hidden from all player-facing views; admin-only visible

## Requested Changes (Diff)

### Add
- `messages` Firestore collection: `{ text, time, date, timestamp, senderName: "MR.SONIC FF", senderLogo: true }`
- Admin "Message Box" panel section: text input + Send button, visible only when currentUser === "admin"
- User-facing "Messages / Announcements" tab/section: WhatsApp broadcast-style feed showing all messages from admin, with app logo + name branding on each message bubble
- Real-time `onSnapshot` listener on `messages` collection (ordered by timestamp desc) — updates instantly on all connected clients
- Popup/toast alert when a new message arrives (for users who are logged in and on a different view)
- Admin users list in message box area: shows all users with name + UID; phone number visible only to admin
- Mobile-friendly responsive layout for messages section

### Modify
- Bottom nav: add 📢 "Messages" tab for users (or integrate into existing notifications tab with a new sub-section)
- Admin dashboard: add "📨 Message Box" quick action card leading to message compose UI
- Existing AdminAnnouncementsView: retain for per-user targeted messages; the new Message Box is for global broadcast

### Remove
- Nothing removed

## Implementation Plan
1. Add `MessagesView` component (user-facing): onSnapshot on `messages` collection, WhatsApp-broadcast style bubbles, MR.SONIC FF branding on each message, popup toast on new message arrival
2. Add `AdminMessageBoxView` component (admin-only): text input + send button writes to `messages` collection with timestamp; user list below showing all users (name, UID, phone for admin)
3. Add `messages` to View type and wire into routing
4. Add bottom nav entry for Messages (users) and admin nav entry
5. Popup alert: when a new message arrives via onSnapshot and user is not on the messages view, show a toast/banner with message preview
6. Mobile-friendly CSS: full-width bubbles, readable font sizes, sticky input at bottom for admin
