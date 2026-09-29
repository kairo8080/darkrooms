# DARKROOMS

A 1-bit memory game for Rare Friends, built with **FriendSDK v0.1.4**.

Every room is pitch black. Your Friend's light shows the holes for a moment, then
goes out, and you walk to the door from memory. Keys (1 RF, simulated) open the
vault behind each door for a relic worth 0–10 RF.

- **Play the preview:** https://kairo8080.github.io/darkrooms/
- **Needs:** a browser wallet on Robinhood mainnet (chain 4663) holding a
  hardwired Rare Friends Generations NFT (generation ≥ 1). No RF, ETH or
  signature is needed; the economy is simulated.
- **Game source:** [`games/darkrooms`](games/darkrooms) — rules, controls and
  exact economy terms are in its [README](games/darkrooms/README.md).

## Run it locally

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

Open the printed URL (normally `http://localhost:4173`), connect your wallet,
switch to Robinhood if asked, pick your Friend and choose **Enter the dark**.

Build the static preview with `npm run build && npx friendsdk build games/darkrooms`;
the output is `games/darkrooms/.friendsdk/`.

## Checks

[`.github/workflows/preview.yml`](.github/workflows/preview.yml) runs on every push:
FriendSDK install and build, `friendsdk check`, `friendsdk build`, publish to the
`gh-pages` branch, TypeScript typecheck, and browser checks at desktop and phone
sizes using the SDK's mock wallet ([`tests/darkrooms.browser.mjs`](tests/darkrooms.browser.mjs)).

## License

Game code: Apache-2.0, matching FriendSDK. Rare Friends artwork is read at runtime
through the SDK under its [NOTICE](https://github.com/spokesz/friendsdk/blob/main/NOTICE.md).
