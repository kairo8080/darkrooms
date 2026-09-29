#!/usr/bin/env bash
# Vercel build: fetch FriendSDK v0.1.4, add DARKROOMS, validate it and build the static preview into public/.
set -euo pipefail
SDK_COMMIT=ca3bf183b809ecf22d87c63d88ce03969a3f8da2
rm -rf .sdk public
mkdir .sdk
curl -fsSL "https://codeload.github.com/spokesz/friendsdk/tar.gz/${SDK_COMMIT}" | tar -xz -C .sdk --strip-components=1
cp -R games/darkrooms .sdk/games/darkrooms
cd .sdk
npm ci --no-audit --no-fund
npm run build
node scripts/dev-game.mjs check games/darkrooms
node scripts/dev-game.mjs build games/darkrooms
cd ..
mkdir -p public
cp -R .sdk/games/darkrooms/.friendsdk/. public/
rm -f public/.friendsdk-output.json
ls -la public
