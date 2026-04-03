# MR.SONIC FF Tournament Site

## Current State
SkyWar Rooms / Colour Trade code in project. Need full MR.SONIC FF rebuild.

## Requested Changes (Diff)

### Add
- Full MR.SONIC FF Free Fire tournament platform
- UID + password authentication (no Firebase Auth)
- Custom admin account (UID: admin, password: admin123)
- Session persistence via localStorage
- Tournament match modes: 1v1, 2v2, Squad 4v4, Clash Squad, BR Solo, BR Duo, BR Squad
- Wallet system: deposit (min ₹30), withdrawal
- Admin panel with match management, player list, Room ID/Password assignment
- Team A/Team B join system for Squad 4v4 and Clash Squad
- Per-player entry fee auto-calculated (admin sets total, divided by players)
- Team leader gets prize on winner announcement
- Per-kill tracker for BR modes
- Leaderboard, match result history, transaction history
- Push notifications via FCM (VAPID key: BCzMqbB_dFDAD5hkqs_tqprrJRnSwSA1kU8lc4GoVKd4wYNY-pj6VAtjXlio3tP-HIsmb2W3oBOy83-pnr1V-Fc)
- Real-time Room ID/Password reveal for players
- Fixed match schedule 5pm-11pm, 15-min gaps
- DHURANDAR-FF 3D animation on login/signup
- MR.SONIC FF watermark on login/signup pages
- Create Account button (green #00c864, logo-like, first preference)
- Staggered entrance animations, natural dark backgrounds
- Payment page (separate, bottom nav 💳)
- UPI: 8247835354@ibl, WhatsApp: 7013256124 info box
- Rules & Regulations section
- Profile rank badge, avatar color picker
- Admin announcements with priority
- Player ban/unban
- Skeleton loaders
- Phone numbers ONLY visible to admin (hidden from all players)
- Admin wallet visibility: all player balances, ranked list
- New users start with 10 coins, no bonus
- Room auto-close when full
- PWA support
- Firebase Firestore backend (ff-war-ddbd9)

### Modify
- Replace current Colour Trade/SkyWar code entirely

### Remove
- Colour Trade game code
- SkyWar Rooms code
- Bonus withdrawal feature

## Implementation Plan
1. Build single HTML file with all features using pure HTML/CSS/JS
2. Firebase Firestore SDK v10.12.2 for all data
3. localStorage for session persistence
4. FCM for push notifications
5. Deploy as index.html
