// Memory watchdog for local dev on WSL2. Zero dependencies, no sudo.
//
// Polls /proc/meminfo once per interval and appends a CSV line to
// logs/mem-guard.log. When MemAvailable stays below --threshold-mb for two
// consecutive samples it SIGKILLs the process group of the largest local dev
// process (hardhat node / next dev / nest start / a node process launched from
// this repo). Without this, a runaway dev process drives WSL2 into an
// unrecoverable swap-thrash that needs a Windows restart.
//
// Usage:
//   node scripts/mem-guard.mjs [--observe] [--threshold-mb N] [--interval-ms N]
//
//   --observe        log and report only, never kill
//   --threshold-mb   MemAvailable floor in MiB (default 700)
//   --interval-ms    poll interval in ms (default 1000)

import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const logDir = join(root, "logs");
const logFile = join(logDir, "mem-guard.log");
const PAGE_SIZE = 4096;
const MIB = 1024 * 1024;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const numArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return fallback;
  const parsed = Number(args[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const observe = hasFlag("observe");
const thresholdMb = numArg("threshold-mb", 700);
const intervalMs = numArg("interval-ms", 1000);
const thresholdBytes = thresholdMb * MIB;

// Command substrings that mark a process we are willing to kill.
const devMarkers = ["hardhat", "next dev", "next-server", "nest start", "nest build"];
// Never touch a process whose command contains one of these, even if a broader
// rule below would otherwise match it.
const neverMarkers = [".vscode-server", ".claude", "mem-guard.mjs", "language-server", "tsserver", "atuin"];

const toMb = (bytes) => Math.round(bytes / MIB);

function readMeminfo() {
  const text = readFileSync("/proc/meminfo", "utf8");
  const field = (key) => {
    const match = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"));
    return match ? Number(match[1]) * 1024 : 0;
  };
  return { memAvailable: field("MemAvailable"), swapFree: field("SwapFree") };
}

function ownProcessGroup() {
  try {
    const stat = readFileSync("/proc/self/stat", "utf8");
    return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
  } catch {
    return -1;
  }
}
const ownPgrp = ownProcessGroup();

function listProcesses() {
  const processes = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid) continue;
    let comm = "";
    let cmdline = "";
    let pgrp = 0;
    let rssBytes = 0;
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      // stat is: pid (comm) state ppid pgrp ... — comm may contain spaces/parens
      pgrp = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
      comm = readFileSync(`/proc/${pid}/comm`, "utf8").trim();
      cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
      rssBytes = (Number(readFileSync(`/proc/${pid}/statm`, "utf8").split(" ")[1]) || 0) * PAGE_SIZE;
    } catch {
      continue; // process vanished mid-scan
    }
    processes.push({ pid, pgrp, comm, cmdline, rssBytes });
  }
  return processes;
}

function isKillable(proc) {
  const haystack = `${proc.comm} ${proc.cmdline}`;
  if (neverMarkers.some((marker) => haystack.includes(marker))) return false;
  if (devMarkers.some((marker) => haystack.includes(marker))) return true;
  // A bare `node` process started from somewhere inside this repo (scripts/dev.mjs,
  // the forked Nest server, etc.).
  if (/\bnode\b/.test(haystack) && proc.cmdline.includes(root)) return true;
  return false;
}

let consecutiveBreaches = 0;

function tick() {
  const { memAvailable, swapFree } = readMeminfo();
  const processes = listProcesses();
  const top3 = [...processes]
    .sort((a, b) => b.rssBytes - a.rssBytes)
    .slice(0, 3)
    .map((proc) => `${proc.comm}:${toMb(proc.rssBytes)}`)
    .join(" ");
  const csv = `${new Date().toISOString()},${toMb(memAvailable)},${toMb(swapFree)},${top3}`;
  try {
    appendFileSync(logFile, `${csv}\n`);
  } catch {
    // logging must never take down the guard
  }

  const low = memAvailable < thresholdBytes;
  consecutiveBreaches = low ? consecutiveBreaches + 1 : 0;
  process.stdout.write(`[mem-guard] ${csv}  ${low ? `LOW ${consecutiveBreaches}/2` : "ok"}\n`);
  if (consecutiveBreaches < 2) return;
  consecutiveBreaches = 0;

  const victims = processes.filter(isKillable).sort((a, b) => b.rssBytes - a.rssBytes);
  if (victims.length === 0) {
    const note = `[mem-guard] MemAvailable ${toMb(memAvailable)} MiB < ${thresholdMb} MiB but found no local dev process to kill`;
    process.stdout.write(`${note}\n`);
    try {
      appendFileSync(logFile, `${note}\n`);
    } catch {}
    return;
  }

  const victim = victims[0];
  const sharesOurGroup = victim.pgrp === ownPgrp;
  const action = observe ? "WOULD KILL" : "KILLING";
  const target = sharesOurGroup ? `pid ${victim.pid}` : `pgid ${victim.pgrp}`;
  const note = `[mem-guard] MemAvailable ${toMb(memAvailable)} MiB < ${thresholdMb} MiB — ${action} ${target}`
    + ` (${victim.comm}, ${toMb(victim.rssBytes)} MiB): ${victim.cmdline.slice(0, 140)}`;
  process.stdout.write(`${note}\n`);
  try {
    appendFileSync(logFile, `${note}\n`);
  } catch {}
  if (observe) return;

  try {
    if (sharesOurGroup) process.kill(victim.pid, "SIGKILL");
    else process.kill(-victim.pgrp, "SIGKILL");
  } catch {
    try {
      process.kill(victim.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

mkdirSync(logDir, { recursive: true });
process.stdout.write(
  `[mem-guard] watching — threshold ${thresholdMb} MiB, interval ${intervalMs} ms, `
    + `${observe ? "observe (no kill)" : "armed"} — log: ${logFile}\n`,
);
tick();
setInterval(tick, intervalMs);
