// Interactive fixture: prompts for a name, echoes back. Exercises the
// `type` / `press: Enter` / `expectText` triangle.

process.stdout.write("Enter your name: ");
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let buf = "";

process.stdin.on("data", (chunk: Buffer) => {
  const s = chunk.toString();
  for (const ch of s) {
    if (ch === "\r" || ch === "\n") {
      process.stdout.write(`\r\nHello, ${buf}!\r\n`);
      process.exit(0);
    } else if (ch === "\x7f") {
      if (buf.length > 0) {
        buf = buf.slice(0, -1);
        process.stdout.write("\b \b");
      }
    } else {
      buf += ch;
      process.stdout.write(ch);
    }
  }
});
