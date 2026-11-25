// Starts the site (next start) as the container's first process. When the container is asked to stop (a new version
// replaces it), the site keeps answering a few seconds more before stopping: the proxy has time to send visitors to the
// new version, so nobody sees "Bad Gateway" during a deploy. STOP_DRAIN_MS sets the wait (6 s by default, under Docker's 10 s).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const DRAIN_MS = Math.max(0, Math.min(9000, Number(process.env.STOP_DRAIN_MS ?? 6000) || 0));
const cmd = process.env.SERVE_CMD ? process.env.SERVE_CMD.split(" ") : [createRequire(import.meta.url).resolve("next/dist/bin/next"), "start"];
const child = spawn(process.execPath, [...cmd, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });

let stopping = false;
const stop = (sig) => {
  if (stopping) return;
  stopping = true;
  console.log(`[serve] ${sig}: still answering for ${DRAIN_MS} ms, then stopping`);
  setTimeout(() => child.kill("SIGTERM"), DRAIN_MS);
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
