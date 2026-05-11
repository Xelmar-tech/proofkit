// Strip ANSI escape sequences from a string.
//
// Covers four families that show up in real TUIs:
//   1. CSI    `\x1b[ ... [@-~]`         — cursor positioning, colors, erase
//   2. OSC    `\x1b] ... (\x07|\x1b\\)` — window title, hyperlinks
//   3. C1 Fe  `\x1b[@-_]`                — single-byte Fe (cursor up/down/etc.)
//   4. Fp/Fs  `\x1b[ -/]?[0-9A-Za-z=><`'`~|}]` — DECSC/DECRC (ESC7/ESC8),
//             charset designation (ESC(B, ESC)0), application keypad mode, etc.
//
// The fourth family is what was leaving stray `78` digits in real-world
// captures: `\x1b7` saves the cursor and `\x1b8` restores it; without an
// alternation for them the regex left the `7` and `8` payload bytes behind.
const ANSI =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-_]|\x1b[ -/]?[0-9A-Za-z=><`~|}]/g;

export const stripAnsi = (s: string): string => s.replace(ANSI, "");
