# SkyWar - Stick Man Battle Royale

## Current State
SkyWar Rooms is a basic multiplayer Firebase demo. Replacing with a full stick man battle royale game.

## Requested Changes (Diff)

### Add
- Animated stick man character with real movement: run, jump, crouch, punch, kick
- Ground-based 2D scrolling map with platforms, terrain
- Vehicles on map: jets (fly + shoot), tanks (drive + shoot), bikes (fast), buggys (4-wheel)
- Weapons scattered on ground: guns, rifles, rockets, ropes (swing), grenades
- Vehicles: player can enter/exit any vehicle by walking near it
- Jets: player enters jet, flies it, shoots missiles
- Tanks: player drives, shoots cannon
- Bikes/Buggys: fast ground transport
- Ropes: swing between platforms
- Solo + Duo mode
- Room create/join — up to 20 players in one room
- No time limit — last player/duo alive wins
- Winner declared on screen with celebration
- Firebase Firestore real-time sync for all player positions, HP, vehicles, pickups
- Mobile D-pad + action buttons
- Keyboard controls for desktop
- Battle royale shrinking zone (safe zone circle shrinks over time, outside = damage)

### Modify
- Replace old SkyWar Rooms demo UI entirely
- Keep Firebase config (ff-war-ddbd9)

### Remove
- Old kill-button text demo

## Implementation Plan
1. Canvas 2D game loop (requestAnimationFrame)
2. Stick man drawn programmatically with joints (head circle, body line, arms, legs animated)
3. Scrolling map with platforms, ground, objects
4. Vehicle system: jets, tanks, bikes, buggys — each with enter/exit, controls, weapon
5. Weapon pickups on ground: walk over to collect, press button to use
6. 20-player Firebase sync: positions, HP, vehicle state, pickups
7. Duo mode: 2 players share a team, last team alive wins
8. Safe zone circle: shrinks every 60s, outside = 1HP/sec damage
9. Lobby: Solo/Duo mode select, room create/join, player list, start when ready
10. Game over: winner announced, confetti/celebration
