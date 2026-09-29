"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { expectedReward, maximumPrize, type GamePlay, type GameSnapshot } from "@rarefriends/friendsdk/game";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";

/* ───────────────────────── rooms ───────────────────────── */

const FLOOR = 0, HOLE = 1, WALL = 2;
type Dir = "U" | "D" | "L" | "R";
type Point = { x: number; y: number };
const DIRS: Readonly<Record<Dir, readonly [number, number]>> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const FACING: Readonly<Record<Dir, SpriteFacing>> = { U: "up", D: "down", L: "left", R: "right" };
const KEY_DIRS: Readonly<Record<string, Dir>> = { arrowup: "U", w: "U", arrowdown: "D", s: "D", arrowleft: "L", a: "L", arrowright: "R", d: "R" };

type Room = Readonly<{
  n: number; W: number; H: number; grid: Uint8Array; start: Point; door: Point;
  flashMs: number; portrait: boolean;
}>;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomSeed() {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Math.floor(Math.random() * 2 ** 32); }
}

/**
 * Carve a guaranteed staircase path from the start edge to the door, then scatter
 * holes and walls around it. Deeper rooms: more holes, a longer path, a shorter flash.
 * Room layouts are presentation only; they never influence RF outcomes.
 */
export function generateRoom(n: number, portrait: boolean, seed: number): Room {
  const L = portrait ? 12 : 13, V = 8;
  const W = portrait ? V : L, H = portrait ? L : V;
  const at = (u: number, v: number): Point => (portrait ? { x: v, y: L - 1 - u } : { x: u, y: v });
  const rand = mulberry32(seed);
  const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const grid = new Uint8Array(W * H), onPath = new Uint8Array(W * H);
  const index = (p: Point) => p.y * W + p.x;
  let v = ri(1, V - 2), u = 0;
  const path: Point[] = [at(0, v)];
  onPath[index(path[0])] = 1;
  const maxLateral = Math.min(V - 1, 1 + n), lateralChance = Math.min(0.85, 0.4 + 0.06 * n);
  while (u < L - 1) {
    u++;
    const p = at(u, v); path.push(p); onPath[index(p)] = 1;
    if (u < L - 1 && rand() < lateralChance) {
      const target = Math.max(0, Math.min(V - 1, v + ri(-maxLateral, maxLateral)));
      const step = Math.sign(target - v);
      while (v !== target) { v += step; const q = at(u, v); path.push(q); onPath[index(q)] = 1; }
    }
  }
  const door = at(L - 1, v);
  const holeChance = Math.min(0.72, 0.28 + 0.05 * (n - 1));
  const wallChance = Math.min(0.12, 0.04 + 0.01 * (n - 1));
  const widen = Math.max(0, 0.6 - 0.12 * (n - 1));
  for (let uu = 1; uu < L; uu++) for (let vv = 0; vv < V; vv++) {
    const i = index(at(uu, vv));
    if (onPath[i]) continue;
    const r = rand();
    grid[i] = r < holeChance ? HOLE : r < holeChance + wallChance ? WALL : FLOOR;
  }
  if (widen > 0) for (const p of path) for (const [dx, dy] of Object.values(DIRS)) {
    const q = { x: p.x + dx, y: p.y + dy };
    if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H) continue;
    if (rand() < widen) grid[index(q)] = FLOOR;
  }
  return { n, W, H, grid, start: at(0, Math.floor(V / 2)), door, flashMs: Math.max(900, 2600 - 200 * (n - 1)), portrait };
}

function holesAround(room: Room, x: number, y: number) {
  let count = 0;
  for (const [dx, dy] of Object.values(DIRS)) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < room.W && ny < room.H && room.grid[ny * room.W + nx] === HOLE) count++;
  }
  return count;
}

/* ───────────────────────── 1-bit art ───────────────────────── */

const DOOR = ["..####..", ".#....#.", "#......#", "#......#", "#....#.#", "#......#", "#......#", "########"];
const RELIC_ART: readonly (readonly string[])[] = [
  ["...##...", "..####..", "...##...", "....#...", "....#...", "....#...", "....#...", "........"], // Burnt Match
  [".######.", "...##...", "...##...", "...##...", "...##...", "....##..", ".....##.", "........"], // Bent Nail
  ["....#...", "...##...", "....#...", "..####..", "..####..", "..####..", ".######.", "........"], // Candle Stub
  ["........", "..####..", ".#....#.", "#..##..#", "#..##..#", ".#....#.", "..####..", "........"], // Glass Eye
  ["...##...", "..####..", "..####..", ".######.", ".######.", "########", "...##...", "........"], // Silver Bell
  ["...##...", "..####..", ".#....#.", ".#.##.#.", ".#.##.#.", ".#....#.", "..####..", "...##..."], // Moth Lantern
  ["#..#..#.", ".#.#.#..", "..###...", "#######.", "..###...", ".#.#.#..", "#..#..#.", "........"], // The Last Light
];
const RELIC_CLASS = ["Junk", "Common", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

function paintBits(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, px: number) {
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "#") ctx.fillRect(left + x * px, top + y * px, px, px); });
}
function relicImage(index: number) {
  const art = RELIC_ART[index] ?? RELIC_ART[0];
  const node = document.createElement("canvas"); node.width = 8; node.height = 8;
  const ctx = node.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#fff"; paintBits(ctx, art, 0, 0, 1);
  return node.toDataURL();
}
/** Canonical 16×16 Friend mask: black pixels with a white halo, integer scale. */
function paintFriend(ctx: CanvasRenderingContext2D, rows: readonly string[], centerX: number, bottomY: number, scale: number, ink = "#000", halo = true) {
  const left = Math.round(centerX - 8 * scale), top = Math.round(bottomY - 16 * scale);
  if (halo) {
    ctx.fillStyle = "#fff";
    rows.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] === "#") ctx.fillRect(left + x * scale - scale, top + y * scale - scale, scale * 3, scale * 3); });
  }
  ctx.fillStyle = ink;
  rows.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] === "#") ctx.fillRect(left + x * scale, top + y * scale, scale, scale); });
}

/* ───────────────────────── sound ───────────────────────── */

type Cue = "step" | "bonk" | "fall" | "flash" | "dark" | "clear" | "purchase" | "reveal" | "sell";
const CUES: Readonly<Record<Cue, readonly (readonly [number, number, number, number?, number?])[]>> = {
  step: [[520, 0.04, 0.03]],
  bonk: [[130, 0.14, 0.07, 70]],
  fall: [[760, 0.55, 0.06, 55]],
  flash: [[880, 0.08, 0.04], [1175, 0.1, 0.04, undefined, 0.09]],
  dark: [[120, 0.32, 0.08, 55]],
  clear: [[523, 0.12, 0.05], [659, 0.12, 0.05, undefined, 0.09], [784, 0.12, 0.05, undefined, 0.18], [1047, 0.16, 0.05, undefined, 0.27]],
  purchase: [[660, 0.08, 0.04], [990, 0.1, 0.04, undefined, 0.08]],
  reveal: [[392, 0.1, 0.05], [523, 0.1, 0.05, undefined, 0.1], [784, 0.2, 0.05, undefined, 0.2]],
  sell: [[1047, 0.08, 0.04], [1319, 0.12, 0.04, undefined, 0.08]],
};
function createSynth() {
  let audio: AudioContext | null = null;
  return {
    unlock() {
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
      } catch { audio = null; }
    },
    play(cue: Cue) {
      if (!audio || audio.state !== "running") return;
      const now = audio.currentTime;
      for (const [freq, duration, volume, slideTo, delay = 0] of CUES[cue]) {
        const osc = audio.createOscillator(), gain = audio.createGain(), start = now + delay;
        osc.type = "square"; osc.frequency.setValueAtTime(freq, start);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
        gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(audio.destination); osc.start(start); osc.stop(start + duration + 0.02);
      }
    },
    dispose() { void audio?.close(); audio = null; },
  };
}

/* ───────────────────────── game ───────────────────────── */

type Phase = "intro" | "flash" | "walk" | "fell" | "door";
type Menu = "shop" | "relics" | "settings" | "reveal" | null;
type Engine = {
  room: Room | null; pos: Point; disp: Point; facing: SpriteFacing; side: "left" | "right"; trail: Point[];
  steps: number; near: number; bonks: number; phase: Phase; flashLeft: number;
  fallAt: number; bonkAt: number; walkUntil: number; wallFlash: { i: number; until: number } | null;
};
type Layout = { T: number; ox: number; oy: number; bw: number; bh: number };
const freshEngine = (): Engine => ({
  room: null, pos: { x: 0, y: 0 }, disp: { x: 0, y: 0 }, facing: "right", side: "right", trail: [],
  steps: 0, near: 0, bonks: 0, phase: "intro", flashLeft: 0, fallAt: 0, bonkAt: 0, walkUntil: 0, wallFlash: null,
});
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function computeLayout(width: number, height: number, room: Room, card: "none" | "side" | "bottom"): Layout {
  const narrow = width < 600;
  const top = narrow ? 48 : 58, bottom = narrow ? 50 : 54, side = narrow ? 8 : 14;
  let aw = width - side * 2, ah = height - top - bottom;
  if (card === "side") aw -= narrow ? 228 : 292;
  if (card === "bottom") ah -= 196;
  const T = Math.max(6, Math.floor(Math.min(aw / room.W, ah / room.H)));
  const bw = T * room.W, bh = T * room.H;
  return { T, bw, bh, ox: Math.round(side + (aw - bw) / 2), oy: Math.round(top + (ah - bh) / 2) };
}

/** DARKROOMS: the selected Rare Friend walks pitch-black rooms from memory. The SDK runtime owns wallet, identity and confirmations. */
export default function Darkrooms({ friendId, client, paused }: GameComponentProps) {
  const definition = client.definition;
  const root = useRef<HTMLElement>(null), board = useRef<HTMLCanvasElement>(null), portrait = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine>(freshEngine()), layout = useRef<Layout | null>(null);
  const synth = useRef<ReturnType<typeof createSynth> | null>(null);
  const epoch = useRef(0), locked = useRef(false);

  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loadError, setLoadError] = useState(""), [revision, setRevision] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [roomN, setRoomN] = useState(1), [best, setBest] = useState(0);
  const [stats, setStats] = useState({ steps: 0, near: 0, bonks: 0 });
  const [vaultOpened, setVaultOpened] = useState(false);
  const [menu, setMenu] = useState<Menu>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [result, setResult] = useState<GamePlay | null>(null);
  const [muted, setMuted] = useState(true), [reducedMotion, setReducedMotion] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [size, setSize] = useState({ width: 960, height: 640 });

  const live = useRef({ paused, menu, reducedMotion, muted });
  live.current = { paused, menu, reducedMotion, muted };
  const relicImages = useMemo(() => definition.outcomes.map((_, i) => relicImage(i)), [definition]);
  const demoRoom = useMemo(() => generateRoom(3, false, 20260930), []);
  const ready = Boolean(snapshot && sprites && !loadError);

  const sfx = (cue: Cue) => { if (!live.current.muted) synth.current?.play(cue); };

  // Load the Friend's canonical artwork and the session snapshot together.
  useEffect(() => {
    let cancelled = false;
    epoch.current++;
    engine.current = freshEngine();
    setSprites(null); setSnapshot(null); setLoadError(""); setMenu(null); setResult(null); setBusy(false); locked.current = false;
    setPhase("intro"); setRoomN(1); setBest(0); setStats({ steps: 0, near: 0, bonks: 0 }); setVaultOpened(false); setError(""); setMessage("");
    void Promise.all([createFriendReader().read(friendId), client.read()]).then(([art, snap]) => {
      if (cancelled) return;
      if (snap.friendId !== friendId) throw new Error("This game session does not match the selected Friend.");
      setSprites(art); setSnapshot(snap);
    }).catch(cause => {
      if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Your Friend or the game could not load.");
    });
    return () => { cancelled = true; epoch.current++; };
  }, [friendId, client, revision]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(preference.matches); change();
    preference.addEventListener("change", change);
    synth.current = createSynth();
    return () => { preference.removeEventListener("change", change); synth.current?.dispose(); synth.current = null; };
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node); setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, [ready]);

  // Portrait of the selected Friend for the title card.
  useEffect(() => {
    const node = portrait.current, ctx = node?.getContext("2d");
    if (!node || !ctx || !sprites) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, node.width, node.height);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(node.width / 2, node.height / 2 + 4, node.width * 0.44, 0, Math.PI * 2); ctx.fill();
    paintFriend(ctx, spriteFrame(sprites, "down", false, 0).frame.rows, node.width / 2, node.height - 12, 5);
  }, [sprites, phase]);

  const startRoom = (n: number) => {
    const node = root.current;
    const tall = node ? node.clientHeight > node.clientWidth * 1.05 : false;
    const room = generateRoom(n, tall, randomSeed());
    Object.assign(engine.current, {
      room, pos: { ...room.start }, disp: { ...room.start }, trail: [{ ...room.start }],
      steps: 0, near: 0, bonks: 0, phase: "flash" as Phase, flashLeft: room.flashMs,
      fallAt: 0, bonkAt: 0, walkUntil: 0, wallFlash: null, facing: tall ? "up" : "right",
    });
    setRoomN(n); setStats({ steps: 0, near: 0, bonks: 0 }); setVaultOpened(false); setPhase("flash"); setError(""); setMessage("");
    setAnnounce(`Room ${n}. Memorize the room.`);
    sfx("flash");
    board.current?.focus({ preventScroll: true });
  };

  const bonk = (tile: number | null) => {
    const e = engine.current;
    e.bonks++; e.bonkAt = performance.now();
    if (tile !== null) e.wallFlash = { i: tile, until: e.bonkAt + 650 };
    setStats({ steps: e.steps, near: e.near, bonks: e.bonks });
    setAnnounce("Bonk. Something blocks the way.");
    sfx("bonk");
  };

  const step = (dir: Dir) => {
    const e = engine.current, room = e.room;
    if (!room || e.phase !== "walk" || live.current.paused || live.current.menu) return;
    const [dx, dy] = DIRS[dir], nx = e.pos.x + dx, ny = e.pos.y + dy, now = performance.now();
    e.facing = FACING[dir];
    if (dir === "L" || dir === "R") e.side = dir === "L" ? "left" : "right";
    if (nx < 0 || ny < 0 || nx >= room.W || ny >= room.H) return bonk(null);
    const tile = room.grid[ny * room.W + nx];
    if (tile === WALL) return bonk(ny * room.W + nx);
    e.pos = { x: nx, y: ny }; e.trail.push({ x: nx, y: ny }); e.steps++; e.walkUntil = now + 200;
    if (tile === HOLE) {
      e.phase = "fell"; e.fallAt = now; setPhase("fell");
      setAnnounce(`Your Friend fell into a hole after ${plural(e.steps, "step")}.`);
      sfx("fall");
    } else {
      if (holesAround(room, nx, ny) >= 2) e.near++;
      if (nx === room.door.x && ny === room.door.y) {
        e.phase = "door"; setPhase("door"); setBest(value => Math.max(value, room.n));
        setAnnounce(`Room ${room.n} cleared. You found the vault.`);
        sfx("clear");
      } else sfx("step");
    }
    setStats({ steps: e.steps, near: e.near, bonks: e.bonks });
  };

  const actions = useRef({ step });
  actions.current = { step };

  // Keyboard: one press, one step. Enter/Space triggers the primary button on cards.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, select, textarea, [role='dialog']")) return;
      if (live.current.paused || live.current.menu) return;
      const dir = KEY_DIRS[event.key.toLowerCase()];
      if (dir) { event.preventDefault(); if (!event.repeat) actions.current.step(dir); return; }
      if ((event.key === "Enter" || event.key === " ") && !target?.closest?.("button")) {
        const primary = root.current?.querySelector<HTMLButtonElement>("[data-primary]:not(:disabled)");
        if (primary) { event.preventDefault(); primary.click(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Render loop: the room, the light, the Friend.
  useEffect(() => {
    const node = board.current, ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    let frame = 0, previous = 0;
    const render = (now: number) => {
      const dt = previous ? Math.min(now - previous, 50) : 0; previous = now;
      const e = engine.current, rm = live.current.reducedMotion;
      const width = node.clientWidth, height = node.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
      if (node.width !== Math.round(width * dpr) || node.height !== Math.round(height * dpr)) { node.width = Math.round(width * dpr); node.height = Math.round(height * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);

      // The light fades on its own schedule, paused while menus or the runtime hold input.
      if (e.phase === "flash" && !live.current.paused && !live.current.menu && !document.hidden) {
        e.flashLeft -= dt;
        if (e.flashLeft <= 0) {
          e.phase = "walk"; setPhase("walk"); setAnnounce("Lights out. Walk from memory.");
          if (!live.current.muted) synth.current?.play("dark");
        }
      }

      const room = e.room ?? demoRoom;
      const ended = e.phase === "fell" || e.phase === "door";
      const card = ended ? (width >= height ? "side" : "bottom") : "none";
      const L = computeLayout(width, height, room, card); layout.current = L;
      const T = L.T, P = T / 8, reveal = Boolean(e.room) && (e.phase === "flash" || ended);
      const shake = !rm && now - e.bonkAt < 200 ? Math.round(Math.sin((now - e.bonkAt) / 18) * 4) : 0;
      ctx.save(); ctx.translate(shake, 0);

      for (let y = 0; y < room.H; y++) for (let x = 0; x < room.W; x++) {
        const i = y * room.W + x, tile = room.grid[i], left = L.ox + x * T, top = L.oy + y * T;
        const fellHere = e.phase === "fell" && e.pos.x === x && e.pos.y === y;
        if (tile === HOLE && (reveal || fellHere)) { ctx.fillStyle = "#fff"; ctx.fillRect(left, top, T, T); continue; }
        if (tile === WALL && (reveal || (e.wallFlash && e.wallFlash.i === i && now < e.wallFlash.until))) {
          ctx.fillStyle = "#fff";
          for (let py = 0; py < 8; py++) for (let px = py & 1; px < 8; px += 2) ctx.fillRect(left + px * P, top + py * P, P, P);
          continue;
        }
        ctx.fillStyle = "#3b3b3b";
        const dot = Math.max(1, Math.round(P));
        ctx.fillRect(left, top, dot, dot);
        const startEdge = room.portrait ? y === room.H - 1 : x === 0;
        if (startEdge) ctx.fillRect(left + (room.portrait ? 3 * P : 6 * P), top + (room.portrait ? 6 * P : 3 * P), room.portrait ? 2 * P : dot, room.portrait ? dot : 2 * P);
      }
      ctx.fillStyle = "#fff"; paintBits(ctx, DOOR, L.ox + room.door.x * T, L.oy + room.door.y * T, P);

      // The light's remaining time.
      if (e.phase === "flash" && e.room) {
        const bar = Math.max(0, e.flashLeft / e.room.flashMs);
        ctx.fillStyle = "#fff"; ctx.fillRect(L.ox, L.oy - Math.max(4, Math.round(P)) - 6, Math.round(L.bw * bar), Math.max(3, Math.round(P)));
      }

      // The path walked, shown when the room ends.
      if (ended && e.trail.length > 1) {
        ctx.save(); ctx.globalCompositeOperation = "difference"; ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1, Math.round(P * 0.75)); ctx.setLineDash([Math.max(2, P), Math.max(2, P)]);
        ctx.beginPath();
        e.trail.forEach((p, j) => { const cx = L.ox + (p.x + 0.5) * T, cy = L.oy + (p.y + 0.5) * T; if (j) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy); });
        ctx.stroke(); ctx.restore();
      }

      if (e.room && sprites) {
        const k = rm ? 1 : 1 - Math.exp(-dt / 40);
        e.disp.x += (e.pos.x - e.disp.x) * k; e.disp.y += (e.pos.y - e.disp.y) * k;
        const walking = now < e.walkUntil;
        const rows = spriteFrame(sprites, e.facing, walking, rm ? 0 : Math.floor(now / (walking ? 90 : 240)) % 8, e.side).frame.rows;
        const scale = Math.max(1, Math.floor((T * 0.78) / 16));
        const cx = L.ox + (e.disp.x + 0.5) * T, cy = L.oy + (e.disp.y + 0.5) * T;
        if (e.phase === "fell") {
          const t = rm ? 1 : Math.min(1, (now - e.fallAt) / 520);
          const s = Math.max(1, Math.round(scale * (1 - t * 0.6)));
          paintFriend(ctx, rows, cx, cy + 8 * s, s, "#000", false);
        } else {
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, T * 0.47, 0, Math.PI * 2); ctx.fill();
          paintFriend(ctx, rows, cx, cy + T * 0.42, scale);
        }
      }
      ctx.restore();
      node.dataset.phase = e.phase; node.dataset.x = String(e.pos.x); node.dataset.y = String(e.pos.y);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [sprites, demoRoom]);

  /* ─────────── economy (simulated in preview; the runtime confirms every action) ─────────── */

  async function act(work: () => Promise<void>, cue?: Cue, after?: () => void) {
    if (locked.current || paused) return;
    const version = epoch.current;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await work();
      const value = await client.read();
      if (version === epoch.current) { setSnapshot(value); if (cue) sfx(cue); after?.(); }
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "That action failed. Try again.");
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }
  const toggleSound = () => {
    const next = !muted; setMuted(next);
    if (!next) { synth.current?.unlock(); window.setTimeout(() => synth.current?.play("purchase"), 60); }
  };
  const enter = () => { if (!muted) synth.current?.unlock(); startRoom(1); };

  if (loadError || !snapshot || !sprites) {
    return <section ref={root} className="dr-game dr-center" aria-label="DARKROOMS">
      <p className="dr-mark" aria-hidden="true">DARK<span>ROOMS</span></p>
      <p role={loadError ? "alert" : "status"}>{loadError || "Lighting a match… loading your Friend."}</p>
      {loadError && <button type="button" disabled={paused} onClick={() => setRevision(value => value + 1)}>Retry</button>}
    </section>;
  }

  const maxPrize = maximumPrize(definition);
  const keys = snapshot.consumables;
  const canBuy = (quantity: bigint) => snapshot.rfBalance >= definition.price * quantity && snapshot.freeStake + definition.price * quantity >= maxPrize * quantity;
  const pending = snapshot.plays.find(play => play.outcomeId === null);
  const outcome = result?.outcomeId ? definition.outcomes[result.outcomeId - 1] : null;
  const relicCount = snapshot.inventory.reduce((total, amount) => total + amount, 0n);
  const preview = snapshot.mode === "preview";
  const cardSide = size.width >= size.height ? "side" : "bottom";
  const blocked = paused || menu !== null;

  const openVault = () => act(async () => {
    const version = epoch.current;
    const play = pending ?? (await client.play(1n))[0];
    const settled = await client.settle(play.id);
    if (version !== epoch.current) return;
    if (settled.outcomeId === null) { setMessage("The vault is still unlocking. Finish it from Relics."); return; }
    setResult(settled); setVaultOpened(true); setMenu("reveal");
  }, "reveal");

  const statLine = `${plural(stats.steps, "step")} · ${plural(stats.near, "near-miss", "near-misses")} · ${plural(stats.bonks, "bonk")}`;
  const feedback = <p className="dr-feedback" role={error ? "alert" : "status"}>{error || message || (busy ? "Waiting for confirmation…" : preview ? "Preview: RF, Keys and relics are simulated." : "Live: balances come from the contract.")}</p>;

  return <section ref={root} className="dr-game" aria-label="DARKROOMS" aria-busy={busy}>
    <div className="dr-stage" inert={blocked || undefined}>
      <canvas ref={board} className="dr-board" tabIndex={blocked ? -1 : 0}
        aria-label={`Room ${roomN}. Arrow keys or WASD move one tile. Tap beside your Friend to step that way.`}
        onPointerDown={event => {
          if (blocked) return;
          const e = engine.current, L = layout.current;
          if (!L || e.phase !== "walk") return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
          const rect = event.currentTarget.getBoundingClientRect();
          const dx = event.clientX - rect.left - (L.ox + (e.pos.x + 0.5) * L.T), dy = event.clientY - rect.top - (L.oy + (e.pos.y + 0.5) * L.T);
          if (Math.max(Math.abs(dx), Math.abs(dy)) < L.T * 0.5) return;
          step(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "L" : "R") : (dy < 0 ? "U" : "D"));
        }} />

      <header className="dr-hud">
        <span className="dr-mark dr-wide" aria-hidden="true">DARK<span>ROOMS</span></span>
        <span className="dr-chip">Room {phase === "intro" ? "—" : roomN}</span>
        <span className="dr-chip dr-soft">Best {best}</span>
        <span className="dr-spacer" />
        <span className="dr-chip" title="Keys open vaults">{plural(Number(keys), "Key")}</span>
        <span className="dr-chip dr-soft dr-wide">{rf(snapshot.rfBalance)}{preview ? " · preview" : ""}</span>
        <button type="button" onClick={() => setMenu("shop")}>Shop</button>
        <button type="button" onClick={() => setMenu("relics")}>Relics{relicCount > 0n ? ` · ${relicCount}` : ""}</button>
        <button type="button" className="dr-wide" aria-pressed={!muted} onClick={toggleSound}>{muted ? "Sound off" : "Sound on"}</button>
        <button type="button" aria-label="Settings" onClick={() => setMenu("settings")}>☰</button>
      </header>

      {(phase === "flash" || phase === "walk") && <p className="dr-hint" aria-hidden="true">
        {phase === "flash" ? "Memorize the room. The light is fading." : <>Walk from memory · <span className="dr-desk">arrows / WASD</span><span className="dr-touch">tap beside your Friend</span> · one tile per step</>}
      </p>}

      {phase === "intro" && <div className="dr-intro">
        <canvas ref={portrait} width={112} height={112} className="dr-portrait" aria-hidden="true" />
        <div className="dr-intro-copy">
          <p className="dr-kicker">{sprites.familyName} · Friend #{friendId.toString()}</p>
          <h1 className="dr-title">DARK<span>ROOMS</span></h1>
          <p>Every room is pitch black. For a moment your Friend's light shows the holes. Then the light goes out and you walk from memory.</p>
          <ul>
            <li>One key press or tap moves one tile.</li>
            <li>Step in a hole and the run ends. Your Keys are safe.</li>
            <li>Reach the door, then open its vault with a Key.</li>
          </ul>
          <button type="button" className="dr-primary" data-primary onClick={enter}>Enter the dark</button>
        </div>
      </div>}

      {phase === "fell" && <div className={`dr-card dr-card-${cardSide}`}>
        <p className="dr-kicker">Room {roomN}</p>
        <h2>Your Friend fell</h2>
        <p>{statLine}</p>
        <p className="dr-dim">White tiles were holes. The dotted line is the way you walked. Your Keys are safe.</p>
        <button type="button" className="dr-primary" data-primary onClick={() => startRoom(1)}>Try again from Room 1</button>
      </div>}

      {phase === "door" && <div className={`dr-card dr-card-${cardSide}`}>
        <p className="dr-kicker">Room {roomN} cleared</p>
        <h2>You found the vault</h2>
        <p>{statLine}</p>
        {pending ? <button type="button" className="dr-primary" data-primary disabled={busy || paused} onClick={() => void openVault()}>Finish opening the vault</button>
          : vaultOpened ? <p className="dr-dim">Vault opened. Your relic is in Relics.</p>
          : keys > 0n ? <button type="button" className="dr-primary" data-primary disabled={busy || paused} onClick={() => void openVault()}>Open the vault · 1 Key</button>
          : <><p className="dr-dim">The vault is locked. A Key costs {rf(definition.price)}{preview ? " (simulated)" : ""}.</p>
            <button type="button" disabled={busy || paused} onClick={() => setMenu("shop")}>Get a Key</button></>}
        <button type="button" className={vaultOpened || (!pending && keys === 0n) ? "dr-primary" : undefined}
          data-primary={vaultOpened || (!pending && keys === 0n) ? true : undefined} disabled={busy} onClick={() => startRoom(roomN + 1)}>Next room →</button>
        {feedback}
      </div>}
      <p className="dr-sr" aria-live="polite">{announce}</p>
    </div>

    {menu && <GameMenu title={menu === "shop" ? "Key shop" : menu === "relics" ? "Relics" : menu === "reveal" ? "From the vault" : "Settings"}
      onClose={busy ? undefined : () => setMenu(null)}>
      {menu === "shop" ? <>
        <p>A Key opens the vault behind one cleared door. Each vault holds one relic, drawn from this table. You can sell relics back for RF at any time.</p>
        <table className="dr-table"><thead><tr><th>Relic</th><th>Chance</th><th>Value</th></tr></thead><tbody>
          {definition.outcomes.map((item, i) => <tr key={item.name}><td><img src={relicImages[i]} alt="" width={16} height={16} /> {item.name}</td><td>{item.chanceBps / 100}%</td><td>{rf(item.reward)}</td></tr>)}
        </tbody></table>
        <p className="dr-dim">Key price {rf(definition.price)} · average return {rf(expectedReward(definition))} per Key · the rest stays in the vault as the game's edge.</p>
        <div className="dr-row">
          <button type="button" className="rf-frame-primary" disabled={!canBuy(1n) || busy || paused} onClick={() => void act(() => client.buy(1n), "purchase", () => setMessage("One Key added to your Friend."))}>Buy 1 Key · {rf(definition.price)}</button>
          <button type="button" disabled={!canBuy(3n) || busy || paused} onClick={() => void act(() => client.buy(3n), "purchase", () => setMessage("Three Keys added to your Friend."))}>Buy 3 Keys · {rf(definition.price * 3n)}</button>
        </div>
        {!canBuy(1n) && <p>{snapshot.rfBalance < definition.price ? "Not enough RF for a Key." : "Key sales are paused until the vault has enough free backing."}</p>}
        <p className="dr-dim">You hold {plural(Number(keys), "Key")}. Every Key reserves {rf(maxPrize)} of backing so the top relic can always be paid.</p>
      </> : menu === "relics" ? <>
        {pending && <button type="button" className="rf-frame-primary" disabled={busy || paused} onClick={() => void openVault()}>Finish opening the vault</button>}
        <p>Kept relics keep their fixed value with no expiry.</p>
        {definition.outcomes.map((item, i) => <div className="dr-item" key={item.name}>
          <img src={relicImages[i]} alt="" width={24} height={24} />
          <span><strong>{item.name}</strong><small>{snapshot.inventory[i].toString()} owned · {rf(item.reward)} · {RELIC_CLASS[i]}</small></span>
          <button type="button" disabled={busy || paused || snapshot.inventory[i] === 0n || item.reward === 0n}
            onClick={() => void act(() => client.redeem(i + 1, 1n), "sell", () => setMessage(`Sold one ${item.name}.`))}>Sell one</button>
        </div>)}
      </> : menu === "reveal" && outcome && result?.outcomeId ? <div className="dr-reveal">
        <img src={relicImages[result.outcomeId - 1]} alt="" width={96} height={96} />
        <h3>{outcome.name}</h3>
        <p>{RELIC_CLASS[result.outcomeId - 1]} · {outcome.chanceBps / 100}% chance · worth {rf(outcome.reward)}</p>
        <p className="dr-dim">{preview ? "Simulated relic, already in your Friend's inventory." : "Your relic is in your Friend's inventory."}</p>
        <div className="dr-row">
          <button type="button" disabled={busy || paused} onClick={() => setMenu(null)}>Keep it</button>
          {outcome.reward > 0n && <button type="button" className="rf-frame-primary" disabled={busy || paused}
            onClick={() => void act(() => client.redeem(result.outcomeId!, 1n), "sell", () => { setMenu(null); setMessage(`Sold ${outcome.name} for ${rf(outcome.reward)}.`); })}>Sell · {rf(outcome.reward)}</button>}
        </div>
      </div> : <>
        <button type="button" aria-pressed={!muted} onClick={toggleSound}>{muted ? "Sound off" : "Sound on"}</button>
        <label className="dr-check"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduce motion</label>
        <p>Reduce motion removes the step glide, the bonk shake and the falling animation.</p>
        <p>Controls: arrow keys or WASD move one tile. On touch screens, tap the side of your Friend you want to step toward. Enter continues.</p>
        <p>{preview ? "All RF, Keys and relics are simulated in this preview. Reloading resets them." : "Keys and relics use live contract actions with wallet confirmation."} Wallet connection and Friend ownership are handled by the Rare Friends runtime.</p>
      </>}
      {menu !== "reveal" && feedback}
    </GameMenu>}
  </section>;
}
