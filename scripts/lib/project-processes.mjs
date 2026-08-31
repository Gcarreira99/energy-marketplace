import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");

export function getProjectPids() {
  try {
    const output = execSync("ps -eo pid=,args=", { encoding: "utf8" });
    return output
      .split(/\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        const [pidString, ...rest] = trimmed.split(/\s+/);
        const command = rest.join(" ");
        const matchesProjectProcess = [
          `${root}/smart-contracts/node_modules/.bin/hardhat node`,
          `${root}/backend/node_modules/.bin/nest start --watch`,
          // `nest start --watch` forks the compiled server as its own child process once a
          // build completes; killing only the watcher above leaves this one running and
          // still bound to the backend port.
          `${join(root, "backend", "dist", "main")}`,
          `${root}/frontend/node_modules/.bin/next dev`,
          // Matched without the root prefix: `npm run dev` invokes this as the literal
          // relative string "node scripts/dev.mjs" (npm does not resolve it to an
          // absolute path), so an absolute-path match here never fires.
          "scripts/dev.mjs",
        ].some((pattern) => command.includes(pattern));
        if (!matchesProjectProcess) return [];
        const pid = Number.parseInt(pidString, 10);
        if (!Number.isFinite(pid) || pid === process.pid) return [];
        return [pid];
      });
  } catch {
    return [];
  }
}

export async function stopProjectProcesses() {
  const pids = getProjectPids();
  if (pids.length === 0) return false;
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
    }
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
  for (const pid of getProjectPids()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
    }
  }
  return true;
}
