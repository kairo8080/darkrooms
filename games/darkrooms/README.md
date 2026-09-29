# DARKROOMS

SDK version **v0.1.4**. A 1-bit memory game starring your Rare Friend.

Every room is pitch black. When a room starts, your Friend's light shows the
whole room for a moment: white tiles are holes, checkered tiles are walls, and
the door is on the far side. Then the light goes out. Walk your Friend to the
door from memory. Behind every door is a vault; a **Key** opens it and gives one
relic. Deeper rooms have more holes, longer paths and a shorter light.

This directory contains only the game component. The SDK runtime supplies wallet
connection, owned Friend selection, the fresh generation ≥ 1 ownership check,
the sandbox and all confirmations.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys / WASD | Move one tile per press (holding a key does not repeat) |
| Tap or click beside your Friend | Step one tile toward that side |
| Enter / Space | Continue on the current card (Enter the dark, Try again, Next room) |
| Shop, Relics, ☰ | Buy Keys, sell relics, sound and reduced-motion settings |

Sound is on by default and unlocks on the first tap or key press; turn it off
with Sound in the top bar or in Settings. Reduced motion (from the system setting
or Settings) removes the step glide, the bonk shake and the falling animation. Gameplay input
stops while the runtime or a game menu is open, and the light's countdown pauses.

## Room rules

- Room *n* (from 1): hole chance `min(72%, 28% + 5%·(n−1))`, wall chance
  `min(12%, 4% + 1%·(n−1))`, light time `max(0.9 s, 2.6 s − 0.2 s·(n−1))`.
- Every room has a guaranteed path from the start edge to the door.
- Stepping on a hole ends the run; the next run starts at Room 1. Keys are never
  lost by falling. Walking into a wall or the edge is a harmless "bonk".
- A near-miss is a step onto a tile with two or more holes next to it.
- Room layouts use browser randomness for presentation only. They never affect
  RF outcomes, which come only from the SDK's `play`/`settle` actions.

## Economy (simulated in preview)

| Rule | Exact value |
| --- | --- |
| Key price | 1 RF (`1000000000000000000` base units) |
| Use | One Key opens the vault behind one cleared door; one vault per cleared room |
| Burnt Match | 18% / 1,800 bps; 0 RF (junk) |
| Bent Nail | 28% / 2,800 bps; 0.25 RF |
| Candle Stub | 22% / 2,200 bps; 0.5 RF |
| Glass Eye | 16% / 1,600 bps; 1 RF |
| Silver Bell | 9% / 900 bps; 2 RF |
| Moth Lantern | 5% / 500 bps; 4 RF |
| The Last Light | 2% / 200 bps; 10 RF |
| Expected reward | **0.92 RF per Key** (8% stays with the vault) |
| Backing | Each purchased or pending Key reserves the 10 RF maximum; kept relics reserve their fixed value |
| Redemption | Fixed value, no expiry, paid to the selected Friend's canonical wallet in an approved live integration |

Skill decides how often you reach a vault. It never changes the odds inside it.
All balances, Keys and relics are simulated in the preview and reset on reload.
No trading, creator fees, wearable NFTs or persistence are implemented.

## Artwork and sound

The Friend is drawn from its canonical 16 × 16 Generations sprite (black mask,
one-pixel white halo, integer scale, all eight walk and idle frames) read through
the SDK sprite reader. Rooms, the door and relic icons are original 1-bit pixel
art made for this game. The page around the game is black too (`host.css`).

Sound is a small chip-style synth written for this game: 12.5%, 25% and 50%
pulse channels, a triangle bass and a noise channel, with volume and pitch
stepped at 60 frames per second. Cues: alternating footsteps, a wall thud, a
falling sweep, a light-on arpeggio, countdown ticks that rise as the light
fades, a lights-out thump, a door fanfare, a coin for Keys, a build-up before
each vault and a reveal jingle that grows with the relic's rarity. There are no
audio files or recordings.
