# MR.SONIC FF — Version 49 Feature Addition

## Current State

Version 48 is stable with:
- Custom UID+password auth (no Firebase Auth)
- Firebase Firestore backend (ff-war-ddbd9)
- Login/Signup with DHURANDAR-FF 3D animation + particle background
- Dashboard with game modes (1v1, 2v2, 4v4, Clash Squad, BR Solo/Duo/Squad, High Stakes)
- Match join with Team A/B for squad modes, real-time Room ID/Password
- Fixed schedule (5pm–11pm, 15min slots)
- Wallet: deposit (min ₹30), withdraw (9% fee), UPI/WhatsApp info
- Leaderboard: sorts by coins, top 20 only
- Profile: avatar letter, stats grid (coins, wins, kills, matches), edit profile
- Deposit History and Withdraw History as separate pages
- Admin Panel: dashboard, users, matches, payments, withdrawals, announcements, complaints, chat, logs
- FCM push notifications (VAPID key set)
- Dark/light mode toggle (button in header, works)
- Page transitions via framer-motion AnimatePresence
- New users start with 10 coins, no bonus
- Bottom nav: Home, Matches, Ranks, Alerts, Pay, Profile

## Requested Changes (Diff)

### Add

1. **Match Result History (per-game breakdown)**
   - After admin ends a match and awards prizes, save result to Firestore `matchResults` collection: `{matchId, mode, userId, kills, killCoins, prizeWon, timestamp, result: 'win'|'lose'|'played'}`
   - Player can see per-game breakdown in Match History tab: for each completed match — kills earned, kill coins, prize won, result badge
   - Show total earnings summary at top of Match History

2. **Leaderboard Upgrade**
   - Add 3 sort tabs: 🏆 Coins, ⚔️ Wins, 💀 Kills
   - Show full top 50 (not just 20)
   - Add search by name/UID
   - Show current user's rank even if outside top 50
   - Add animated rank change indicators

3. **Combined Transaction History page**
   - New view `TransactionHistoryView` — shows both deposits and withdrawals in one chronological list
   - Each entry: type icon (↓ Deposit / ↑ Withdraw), amount, status badge, timestamp
   - Total credited / total withdrawn summary at top
   - Accessible from Profile page and Pay page

4. **Profile Page Upgrade**
   - Add match result history grid (last 5 matches with mode, result, prize)
   - Add rank badge (based on total coins earned: Bronze/Silver/Gold/Diamond/Master)
   - Add win rate % display
   - Add "Share Profile" button (copies profile link or shows UID card)
   - Add avatar color selection (choose from 6 colors for avatar circle)

5. **Dark/Light Mode Toggle**
   - Move toggle to bottom nav as a 7th icon OR make it more visible in the top header
   - Add smooth CSS transition when toggling
   - Persist in localStorage (already done, just improve visibility)

6. **Loading Animations Between Pages**
   - Add skeleton loading cards for match list, leaderboard, history pages while data loads
   - Replace plain spinner with premium animated logo loader
   - Add shimmer effect on loading cards

7. **Admin: Enhanced Withdrawal Management**
   - Show UPI ID and amount for each withdrawal request
   - Add bulk approve/reject
   - Add filter by date range
   - Add "Mark as Paid" with payment reference input

8. **Admin: Player Ban Management**
   - Existing block/unblock exists in AdminUsersView
   - Add ban reason input when blocking
   - Show ban reason in BlockedView for the user
   - Add ban list quick view in admin dashboard

9. **Admin: Broadcast Announcements Upgrade**
   - Existing announcements exist
   - Add priority level (Normal/Important/Urgent) with color coding
   - Add scheduled announcement (set a future time)
   - Announcements show in notifications with priority color

### Modify

- `LeaderboardView`: add tabs + search + top 50
- `ProfileView`: add rank badge, win rate, match history grid, avatar color picker
- `MatchHistoryView`: add per-game result breakdown after match ends
- `AdminWithdrawalsView`: add UPI display, bulk actions
- `AdminAnnouncementsView`: add priority + schedule fields
- `AdminUsersView`: add ban reason to block action
- Loading spinner: upgrade to premium animated loader

### Remove

- Nothing removed — all existing features preserved

## Implementation Plan

1. Add `matchResults` Firestore writes in admin match-end/prize-award functions
2. Read `matchResults` in `MatchHistoryView` to show per-game breakdown
3. Add rank calculation function (Bronze <100, Silver 100-500, Gold 500-2000, Diamond 2000-10000, Master 10000+)
4. Rewrite `LeaderboardView` with tabs (coins/wins/kills), search, top 50, current user rank
5. Create `TransactionHistoryView` merging payments + withdraw collections
6. Upgrade `ProfileView` with rank badge, win rate, last 5 match results grid, avatar color picker
7. Upgrade loading overlay with shimmer skeleton cards on data-heavy pages
8. Enhance admin withdrawal view with UPI display and bulk actions
9. Add ban reason to block flow in admin users view; show in BlockedView
10. Add priority selector to announcements; show priority badge in notifications
11. Ensure dark/light toggle is more prominent (add to profile header or bottom nav)
