import { getProjectPids, stopProjectProcesses } from "./lib/project-processes.mjs";

const pids = getProjectPids();
if (pids.length === 0) {
  console.log("No running local dev stack processes found.");
  process.exit(0);
}

console.log(`Stopping ${pids.length} local dev stack process(es): ${pids.join(", ")}`);
await stopProjectProcesses();

const remaining = getProjectPids();
if (remaining.length > 0) {
  console.error(`Could not stop process(es): ${remaining.join(", ")}`);
  process.exit(1);
}
console.log("Local dev stack stopped.");
