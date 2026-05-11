// Three-screen interactive fixture. Exercises confirm-key, raw-mode text input
// with validation rejection + recovery, and arrow-key menu navigation. Used by
// snapshot.test.ts as the most varied target the framework can drive.

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      process.stdin.off("data", onData);
      resolve(chunk.toString());
    };
    process.stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  // Screen 1 — single-key confirm.
  process.stdout.write("Press y to continue\r\n");
  let k = await readKey();
  while (k !== "y") k = await readKey();
  process.stdout.write("Got y.\r\n");

  // Screen 2 — text input with length validation.
  process.stdout.write("Enter name (3+ chars):\r\n> ");
  let name = "";
  while (true) {
    const ch = await readKey();
    if (ch === "\r") {
      if (name.length >= 3) break;
      process.stdout.write(`\r\nName too short. Try again:\r\n> `);
      name = "";
    } else if (ch === "\x7f") {
      if (name.length > 0) {
        name = name.slice(0, -1);
        process.stdout.write("\b \b");
      }
    } else {
      name += ch;
      process.stdout.write(ch);
    }
  }
  process.stdout.write(`\r\nHello, ${name}!\r\n`);

  // Screen 3 — arrow-key menu.
  const items = ["Apple", "Banana", "Cherry"];
  let idx = 0;
  const render = (): void => {
    process.stdout.write("Pick a fruit:\r\n");
    items.forEach((it, i) => {
      process.stdout.write(`  ${i === idx ? "> " : "  "}${it}\r\n`);
    });
  };
  render();

  while (true) {
    const ch = await readKey();
    if (ch === "\r") break;
    if (ch === "\x1b[A") {
      idx = (idx - 1 + items.length) % items.length;
      render();
    } else if (ch === "\x1b[B") {
      idx = (idx + 1) % items.length;
      render();
    }
  }
  process.stdout.write(`You picked ${items[idx]}!\r\n`);
  process.exit(0);
}

void main();
