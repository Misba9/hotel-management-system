#!/usr/bin/env node
/**
 * Frees dev server ports (macOS/Linux: `lsof`). No-op if nothing is listening.
 *
 * - `PORTS_TO_FREE` — comma-separated, e.g. `3000,3001` (used from repo root `npm run dev`)
 * - `PORT_TO_FREE` — single port (default `3000`; used by `customer-web` `npm run free-port`)
 */
import { execSync } from "node:child_process";

const multi = process.env.PORTS_TO_FREE?.trim();
const ports = multi
  ? [...new Set(multi.split(",").map((p) => p.trim()).filter(Boolean))]
  : [process.env.PORT_TO_FREE?.trim() || "3000"];

function freePort(port) {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const pids = [...new Set(out.split(/[\s\n]+/).map((s) => s.trim()).filter(Boolean))];
    for (const pid of pids) {
      const n = Number(pid);
      if (!Number.isFinite(n) || n <= 0) continue;
      try {
        process.kill(n, "SIGKILL");
        console.log(`[free-port] freed ${port}: killed PID ${n}`);
      } catch {
        /* process may have exited */
      }
    }
  } catch {
    /* nothing bound to port */
  }
}

for (const port of ports) {
  freePort(port);
}
