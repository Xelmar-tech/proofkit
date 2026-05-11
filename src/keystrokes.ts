import type { PressKey } from "./types.ts";

// ANSI escape sequences for the special keys exposed via `press`.
// `xterm`-flavored, matches what node-pty's slave end would produce when a real
// terminal user presses these keys.
export const KEY_SEQUENCES: Record<PressKey, string> = {
  Enter: "\r",
  Escape: "\x1b",
  Backspace: "\x7f",
  Tab: "\t",
  Up: "\x1b[A",
  Down: "\x1b[B",
  Left: "\x1b[D",
  Right: "\x1b[C",
};
