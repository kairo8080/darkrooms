// Run from a FriendSDK v0.1.4 checkout that contains games/darkrooms.
// Uses the SDK's mock wallet, mock Robinhood RPC and sample canonical Friend sprites.
import { testGame } from "./scripts/testing.mjs";

const check = async ({ game }) => {
  await game.getByRole("button", { name: "Enter the dark" }).click();
  const board = game.locator("canvas.dr-board");
  await game.locator('canvas.dr-board[data-phase="walk"]').waitFor({ timeout: 10_000 });
  const before = await board.getAttribute("data-x") + "," + await board.getAttribute("data-y");
  await board.press("ArrowUp");
  await board.press("ArrowRight");
  const phase = await board.getAttribute("data-phase");
  const after = await board.getAttribute("data-x") + "," + await board.getAttribute("data-y");
  if (!["walk", "fell", "door"].includes(phase)) throw new Error(`Unexpected phase after stepping: ${phase}`);
  if (phase === "walk" && before === after) throw new Error("The Friend did not move and no bonk was possible from the start tile.");
  await game.getByRole("button", { name: "Settings" }).click();
  const dialog = game.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sound off" }).click();
  await dialog.getByRole("button", { name: "Sound on" }).click();
  await dialog.getByRole("button", { name: "Close Settings" }).click();
  await game.getByRole("button", { name: "Shop" }).click();
  await game.getByRole("dialog").getByText("The Last Light").waitFor();
  await game.getByRole("button", { name: "Close Key shop" }).click();
};

for (const [label, options] of [["desktop", { width: 960, height: 800 }], ["phone", { width: 360, height: 720 }]]) {
  const result = await testGame("games/darkrooms", { ...options, screenshot: `../artifacts/darkrooms-${label}.png`, check });
  console.log(`DARKROOMS ${label} browser check passed`, result);
}
