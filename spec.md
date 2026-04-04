# MR.SONIC FF — Features 101–110 (Batch 2 First 10)

## Current State
The MR.SONIC FF tournament platform has 156 features live. Feature 101 (Match Lobby Chat) exists but is basic. Features 102–110 from Batch 2 are not yet implemented.

## Requested Changes (Diff)

### Add
- **Feature 102: Team Voice Channel Indicator** — On each match card (for joined players), show a "🎙️ Join Voice" button that opens a WhatsApp group link. Admin can set this voice link per match in the admin panel.
- **Feature 103: Match Auto-Start Countdown** — When all match slots are filled (room is full), automatically display a "All Ready! Starting in 5...4...3...2...1..." countdown animation on the match card for all joined players.
- **Feature 104: Bet Side-Game** — Inside a match (for joined players), allow a small side bet between two players (₹10–₹50). Player A challenges Player B, Player B accepts/rejects. If accepted, coins are held; admin declares outcome manually or winner is auto-credited on match result.
- **Feature 105: Match Replay Summary** — After a match ends (result declared), show a timeline of events: who joined, when room ID was sent, kills per player, prize awarded. Accessible from match history.
- **Feature 106: Custom Match Title** — Admin can give each match a custom name (e.g. "Sunday Special", "Night Battle") in the admin panel. This title shows on match cards prominently.
- **Feature 107: Match Visibility Toggle** — Admin can hide/show individual matches from the player list. Hidden matches still exist but players can't see them.
- **Feature 108: Player Join Order** — On match player lists, show join order badge (1st, 2nd, 3rd, 4th...) next to each player's UID, with the first player distinctly marked.
- **Feature 109: Late Join Penalty Warning** — If a player tries to join a match with start time less than 5 minutes away, show a warning: "⚠️ Late join! Your entry fee is at risk if you miss the match."
- **Feature 110: Match Sharing** — On each match card, add a "📤 Share" button that generates a shareable text (copies to clipboard): "Join MR.SONIC FF Match! Mode: [mode], Prize: [prize], Time: [time]. Download: [site URL]"

### Modify
- **Feature 101 (Match Lobby Chat)** — Upgrade existing basic chat: add sender avatar initial, timestamp, emoji support, and show unread message count badge on the toggle button.
- Match data model in Firestore: add fields `customTitle`, `isVisible`, `voiceLink` to match documents.
- Admin match creation/edit form: add inputs for custom title, voice link, visibility toggle.

### Remove
Nothing removed.

## Implementation Plan
1. Update match Firestore data model (customTitle, isVisible, voiceLink fields).
2. Admin panel: add customTitle input, voiceLink input, isVisible toggle to match create/edit forms.
3. Player match list: filter out matches where `isVisible === false`.
4. Match cards: show customTitle prominently when set; show join order badges; show voice link button for joined players; show share button.
5. Late join warning: compare current time to match scheduled time, warn if <5 minutes.
6. Match auto-start countdown: when match is full, show countdown overlay on card.
7. Bet side-game: inside active match view, add side bet challenge UI (player selects opponent, amount, challenge button; opponent sees accept/reject).
8. Match replay summary: in match history view, show timeline with events.
9. Upgrade lobby chat: add avatar initial, timestamp, unread badge.
