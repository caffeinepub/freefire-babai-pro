# COLOUR TRADE — Colour Prediction Game

## Current State
This is a new standalone project. No existing application files. The workspace previously contained an Aviator Demo Game / MR.SONIC FF project.

## Requested Changes (Diff)

### Add
- Brand new Colour Trading / Prediction game (WinGo-style)
- Game rounds with countdown timer (e.g., 60 seconds per round)
- Three colour choices: RED (x2), VIOLET (x4.5), GREEN (x2)
- Bet amount chips: ₹10, ₹50, ₹100, ₹200, ₹500, custom input
- Place Bet button locked during result phase
- Auto round result after countdown ends — random outcome (Red/Green/Violet)
- Win/Loss logic: correct prediction pays multiplier × bet amount
- Demo wallet with starting ₹1000 balance
- Live betting history table: Round #, Color result, Bet Amount, Win/Loss
- Top Winners leaderboard with fake live data
- Live fake bets table (other players' bets sliding in)
- User profile card with wallet balance
- Result announcement animation (colour reveal)
- Round number tracker
- Responsive premium dark casino-style UI
- Sounds: win chime, loss buzz, tick countdown, result reveal
- Mute toggle

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Build single-page HTML/CSS/JS app (pure frontend, no backend/Firebase needed for demo)
2. Game loop: 60s countdown → result → 5s result display → new round
3. Colour choice buttons: RED, VIOLET, GREEN with multipliers displayed
4. Bet chip selector + custom input + Place Bet button
5. Wallet deducted on bet, credited on win
6. History table updated each round
7. Fake live bets generated every few seconds for social proof
8. Top winners panel with fake rotating data
9. Full premium dark UI matching design preview: deep navy bg, neon purple/pink/gold accents, glassmorphism cards
10. Animated result reveal (colour flash + win/loss toast)
11. Sound effects via Web Audio API
12. Mute toggle in header
