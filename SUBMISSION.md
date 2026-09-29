# DARKROOMS

Every room is pitch black. Your Rare Friend's light shows the holes for a moment, then goes out, and you walk it to the door from memory.

**Builder:** kairo8080 ([GitHub @kairo8080](https://github.com/kairo8080)) · **Category:** Character Spotlight (also relevant to Economy Potential) · **SDK:** FriendSDK v0.1.4

**One sentence:** Your verified Rare Friend is the only light in a 1-bit world of dark rooms, and the Keys it spends in $RAREFRIENDS open a vault behind every door you reach.

## Links

- **Playable preview:** https://kairo8080.github.io/darkrooms/
- **Source:** https://github.com/kairo8080/darkrooms (game component in `games/darkrooms`)
- **Wallet and network:** a browser wallet on **Robinhood mainnet (chain 4663)** holding a hardwired Rare Friends Generations NFT (**generation ≥ 1**). The SDK runtime checks ownership before play. No RF, ETH or signature is needed; the economy is simulated.

## Run it

Node.js 22+ on Linux or Ubuntu/WSL2:

```sh
git clone https://github.com/spokesz/friendsdk.git
cd friendsdk
git checkout ca3bf183b809ecf22d87c63d88ce03969a3f8da2   # FriendSDK v0.1.4
npm ci
git clone https://github.com/kairo8080/darkrooms.git ../darkrooms
cp -R ../darkrooms/games/darkrooms games/darkrooms
npm run dev:game -- games/darkrooms
```

Open the printed URL (normally `http://localhost:4173`), connect your wallet, pick your Friend and choose **Enter the dark**.

## Play

1. **Memorize.** Each room starts lit for 2.6 s (0.2 s less per room, never under 0.9 s). White tiles are holes, checkered tiles are walls, the door is on the far side.
2. **Walk in the dark.** Arrow keys or WASD move one tile per press. On touch screens, tap the side of your Friend you want to step toward. Walls and edges bonk harmlessly. A hole ends the run.
3. **Open the vault.** At the door, spend one Key to open that room's vault and reveal a relic. Keep it or sell it back. Then take the next, harder room.

When a room ends, the whole map is revealed with the dotted path you walked, plus steps, near-misses and bonks. Sound (muted by default) and reduced motion are in Settings; phones in portrait get a 3 : 4 layout via `host.css`. Everything stays inside the SDK container.

## Rules and rewards

**All balances, Keys and relics are simulated.** The preview starts with 20 RF and 100 RF of simulated prize backing. One Key costs **1 RF** and opens one vault behind one cleared door. Falling never costs a Key.

| Relic | Class | Chance | Redemption value |
|---|---|---:|---:|
| Burnt Match | Junk | 18% | 0 RF |
| Bent Nail | Common | 28% | 0.25 RF |
| Candle Stub | Common | 22% | 0.50 RF |
| Glass Eye | Uncommon | 16% | 1 RF |
| Silver Bell | Rare | 9% | 2 RF |
| Moth Lantern | Epic | 5% | 4 RF |
| The Last Light | Legendary | 2% | 10 RF |

Expected reward: **0.92 RF per Key**, so 8% of every Key's RF stays with the vault. Each purchased Key reserves the 10 RF maximum prize; kept relics keep their backing and have no redemption expiry. New Key sales stop when free backing is insufficient. Skill decides how often you reach a vault, never the odds inside it: room layouts are presentation only and RF outcomes come from the SDK's `play`/`settle` actions.

## Why it fits the categories

- **Character Spotlight.** The selected Friend is the protagonist and the only lit thing on screen: its canonical 16 × 16 sprite, all walk and idle frames and four facings, standing in its own pool of light. The title card shows the Friend's family and token ID.
- **Economy Potential.** Keys are a pure RF sink with a readable table. Designed next steps (not implemented, need SDK capabilities beyond v0.1.4): *Flares* that relight a room once and are burned on use (second consumable); *Second Wind* to continue a run from the room you fell in (burn); *Brass Keys* for deeper-room vaults with a bigger table (multiple consumable tiers); a weekly depth leaderboard funded by a share of Key sales (persistence).
- **Token Activity.** Every vault costs a Key. No live metrics are claimed; the preview is simulated.

## Checks, credits and limitations

- GitHub Actions ([workflow](https://github.com/kairo8080/darkrooms/blob/main/.github/workflows/preview.yml)) on FriendSDK v0.1.4: `npm ci`, `npm run build`, `npx friendsdk check games/darkrooms`, `npx friendsdk build games/darkrooms`, `tsc` typecheck, and browser checks at 960 px and 360 px with the SDK's mock wallet (`tests/darkrooms.browser.mjs`: enter, wait for lights out, step, settings, sound toggle, shop). Results: CHECK_RESULTS.
- A scripted local playthrough on both layouts (enter → memorize → walk the solved path → reach the door → buy a Key → open the vault → reveal → next room → fall) reported no browser errors.
- Browser tests use mocked wallets and RPC. A real-wallet playthrough on the hosted preview: REAL_WALLET_STATUS.
- Credits: Rare Friends canonical Friend sprites via the FriendSDK sprite reader ([NOTICE](https://github.com/spokesz/friendsdk/blob/main/NOTICE.md)). Room, door and relic pixel art and all sounds are original and made in code. No third-party assets.
- Not included: live contracts, trading, wearable NFTs, creator fees, persistence. The session resets on reload. Production publication needs separate Rare Friends review.
