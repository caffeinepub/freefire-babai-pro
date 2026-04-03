# MR.SONIC FF — Complete Rebuild with Profit System & Premium UI

## Current State
MR.SONIC FF is a full Free Fire tournament platform (Version 62) with Firebase Firestore backend, custom UID/password auth, match system, wallet, admin panel, push notifications, leaderboard, clans, achievements, and 50+ features. Built with React + TypeScript + Framer Motion.

## Requested Changes (Diff)

### Add
- **Admin Profit System (0 loss guarantee):**
  - Admin commission auto-deducted from every match prize pool (configurable %, default 10%)
  - Revenue dashboard: daily/weekly/monthly earnings graph in admin panel
  - All prize payouts show admin net profit after commission
  - Admin can view total revenue earned, total paid out, net profit at a glance
- **All 50 features from the idea list** (those not already present):
  - PWA install prompt card (beautiful, first-visit)
  - Referral system (₹10 bonus on successful referral)
  - Weekly tournament with special prize pool
  - Season ranking (monthly leaderboard reset)
  - Hall of Fame (all-time top players)
  - Match lobby chat (joined players chat before match)
  - Match countdown timer (before room start)
  - Quick join button
  - Player ready-up system
  - Kill/Death ratio + Win rate % in profile
  - Total earnings graph (monthly) in profile
  - Player card sharing (copy profile stats)
  - Bulk payment (admin pays multiple players at once)
  - Match history export (admin)
  - Report player feature
  - OTP-style withdrawal confirm (PIN confirm)
  - Fair play badge for verified players
  - VIP badge for top spenders
  - Name color for premium players
  - Lucky draw (₹10 entry, ₹500 prize weekly)
  - Multi-language toggle (Telugu/English)
  - Offline mode basic info
  - Suspicious activity alert for admin

### Modify
- **UI Polish — Clean, Premium, Awe-inspiring:**
  - Cinematic esports posters for each game mode (SVG-based, no external images needed)
  - Deploy button: vivid orange gradient, pulse animation, premium CTA
  - Create Account button: green, bold, logo-like with DHURANDAR-FF branding
  - All cards: glassmorphism, orange glow borders, clean spacing
  - Home page quick actions: large poster-style cards with gradient overlays
  - MR.SONIC FF watermark on login/signup as large diagonal text background
  - All color usage consistent — deep orange #ff6b00 as primary
  - Mobile-first responsive, no oversized screens
  - Smooth page transitions, micro-animations on interactions
  - Zero empty states — every section has beautiful placeholder content

### Remove
- No bonus/spin/daily login features (per user request)
- No cartoonish or comedy visuals

## Implementation Plan
1. Update App.tsx — add profit commission system to all match prize payouts
2. Add admin revenue dashboard with earnings chart
3. Add referral system, lucky draw, weekly tournament sections
4. Add PWA install prompt component
5. Add player ready-up and lobby chat to match flow
6. Add bulk payment and match history export to admin panel
7. Add report player and fair play badge features
8. Add multi-language toggle (Telugu/English)
9. Polish all UI — posters, cards, buttons, colors, spacing
10. Add VIP/premium badges, name color system
11. Fix all scroll/layout issues, mobile responsiveness
12. Validate and deploy
