// Fixture: emits the same line three times via in-place \r redraws, then
// finalizes with \n. A correct terminal emulator overwrites in place; a
// naive append-only buffer keeps all three versions. Used to prove that
// the xterm-headless integration handles CR semantics.

process.stdout.write("\rstatus: starting");
setTimeout(() => process.stdout.write("\rstatus: working "), 30);
setTimeout(() => process.stdout.write("\rstatus: done    \n"), 60);
setTimeout(() => process.exit(0), 100);
