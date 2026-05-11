import { writeFileSync, appendFileSync } from "node:fs";

// Asciinema cast v2 serializer.
// Format spec: https://docs.asciinema.org/manual/asciicast/v2/
// A cast file is a JSON-lines stream: one header object, then one event array
// per output chunk: [elapsed_seconds, "o", bytes].
export class CastWriter {
  constructor(
    private readonly path: string,
    private readonly dims: { cols: number; rows: number },
  ) {}

  writeHeader(): void {
    const header = {
      version: 2,
      width: this.dims.cols,
      height: this.dims.rows,
      timestamp: Math.floor(Date.now() / 1000),
      env: {
        SHELL: process.env["SHELL"] ?? "/bin/sh",
        TERM: "xterm-256color",
      },
    };
    writeFileSync(this.path, JSON.stringify(header) + "\n");
  }

  writeEvent(elapsedSeconds: number, data: string): void {
    appendFileSync(
      this.path,
      JSON.stringify([elapsedSeconds, "o", data]) + "\n",
    );
  }
}
