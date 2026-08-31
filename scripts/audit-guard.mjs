// Security watchdog for the energy-marketplace monorepo. Zero dependencies.
//
// Runs a set of local checks and prints a report. Exits non-zero when any
// finding is at or above the fail threshold, so it doubles as a CI gate.
//
// Checks:
//   deps      npm audit across every workspace, grouped by severity
//   secrets   regex sweep of git-tracked files for keys / mnemonics / tokens
//   files     sensitive files that should never be committed (.env, *.pem, ...)
//   gitignore the ignore rules that keep secrets out of the repo are present
//   history   (opt-in) the same secret patterns across past commits
//   outdated  (opt-in) direct dependencies a major version or more behind
//
// Usage:
//   node scripts/audit-guard.mjs [options]
//
//   --json                 emit findings as JSON instead of text
//   --fail-on <level>       min severity that makes the process exit 1
//                          (critical|high|moderate|low, default: high)
//   --history              also scan git history for secret patterns
//   --outdated             also run `npm outdated` (needs network, slower)
//   --skip <a,b>           skip checks by name (deps,secrets,files,gitignore)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const valArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
};

const asJson = hasFlag("json");
const scanHistory = hasFlag("history");
const scanOutdated = hasFlag("outdated");
const skip = new Set((valArg("skip", "") || "").split(",").filter(Boolean));
const severities = ["low", "moderate", "high", "critical"];
const failOn = (valArg("fail-on", "high") || "high").toLowerCase();
const failRank = Math.max(0, severities.indexOf(failOn));

// Workspaces to audit — a dir counts if it has a package.json.
const workspaces = [".", "backend", "frontend", "smart-contracts"].filter((d) =>
  existsSync(join(root, d, "package.json")),
);

const findings = [];
const record = (check, severity, title, detail) =>
  findings.push({ check, severity, title, detail });

function run(cmd, cmdArgs, opts = {}) {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, cmdArgs, {
        cwd: opts.cwd || root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      }),
    };
  } catch (err) {
    // Tools like `npm audit` exit non-zero when they find something; the
    // payload we want is still on stdout.
    return { ok: false, out: err.stdout?.toString() || "", err: err.stderr?.toString() || String(err) };
  }
}

// ---------------------------------------------------------------- deps
function checkDeps() {
  for (const ws of workspaces) {
    const dir = join(root, ws);
    const hasLock = existsSync(join(dir, "package-lock.json"));
    if (!hasLock && !existsSync(join(dir, "node_modules"))) {
      record("deps", "low", `${ws}: skipped npm audit`, "no package-lock.json and no node_modules — run `npm install` here first");
      continue;
    }
    const res = run("npm", ["audit", "--json"], { cwd: dir });
    let parsed;
    try {
      parsed = JSON.parse(res.out);
    } catch {
      record("deps", "moderate", `${ws}: npm audit did not return JSON`, (res.err || res.out).slice(0, 300));
      continue;
    }
    const counts = parsed.metadata?.vulnerabilities || {};
    const total = severities.reduce((n, s) => n + (counts[s] || 0), 0) + (counts.info || 0);
    if (total === 0) {
      record("deps", "info", `${ws}: no known vulnerabilities`, "");
      continue;
    }
    // One finding per advisory so the worst ones surface individually.
    const advisories = parsed.vulnerabilities || {};
    for (const [name, v] of Object.entries(advisories)) {
      const sev = severities.includes(v.severity) ? v.severity : "moderate";
      const via = (v.via || [])
        .map((x) => (typeof x === "string" ? x : `${x.title || x.name || ""}`))
        .filter(Boolean);
      const fix = v.fixAvailable === true ? "fix available (npm audit fix)"
        : v.fixAvailable && v.fixAvailable.name ? `fix: upgrade to ${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (breaking)" : ""}`
        : "no automatic fix";
      record("deps", sev, `${ws}: ${name} (${sev})`, `${via.slice(0, 2).join("; ") || "transitive"} — ${fix}`);
    }
  }
}

// ------------------------------------------------------------ outdated
function checkOutdated() {
  for (const ws of workspaces) {
    const res = run("npm", ["outdated", "--json"], { cwd: join(root, ws) });
    let parsed;
    try {
      parsed = JSON.parse(res.out || "{}");
    } catch {
      continue;
    }
    for (const [name, info] of Object.entries(parsed)) {
      const cur = info.current || "?";
      const latest = info.latest || "?";
      const majorCur = parseInt(cur, 10);
      const majorLatest = parseInt(latest, 10);
      if (Number.isFinite(majorCur) && Number.isFinite(majorLatest) && majorLatest > majorCur) {
        record("outdated", "low", `${ws}: ${name} ${cur} -> ${latest}`, "a major version or more behind — review changelog for security fixes");
      }
    }
  }
}

// ------------------------------------------------------------- secrets
const secretRules = [
  { name: "EVM private key", re: /\b0x[a-fA-F0-9]{64}\b/ },
  // Needs a mnemonic/seed cue on the line too — a bare run of words is prose.
  { name: "BIP39 mnemonic (12+ words)", re: /(?:mnemonic|seed[\s_-]?phrase|MNEMONIC)["':=\s]+["']?([a-z]{3,10}\s+){11,23}[a-z]{3,10}/i },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Generic API secret assignment", re: /(?:api[_-]?key|secret|token|passwd|password)["']?\s*[:=]\s*["'][^"'\s]{16,}["']/i },
  { name: "Private key PEM block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "RPC URL with embedded key", re: /https:\/\/[a-z0-9-]+\.(?:infura|alchemy|alchemyapi|quiknode|quicknode|ankr|blastapi)\.io\/[^\s"']*[A-Za-z0-9_-]{20,}/i },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
];
// Well-known public test keys (Hardhat / Anvil account #0..#9) — never a leak.
const knownTestKeys = new Set([
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
]);
const redact = (s) => (s.length <= 12 ? "*".repeat(s.length) : `${s.slice(0, 6)}…${s.slice(-4)}`);

function textFiles() {
  const res = run("git", ["ls-files", "-z"], { cwd: root });
  if (!res.ok && !res.out) return [];
  return res.out.split("\0").filter(Boolean);
}

function checkSecrets() {
  const skipExt = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|mov|lock)$/i;
  const NUL = String.fromCharCode(0);
  for (const rel of textFiles()) {
    if (skipExt.test(rel)) continue;
    const abs = join(root, rel);
    let size = 0;
    try {
      size = statSync(abs).size;
    } catch {
      continue;
    }
    if (size > 512 * 1024) continue;
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (content.includes(NUL)) continue; // binary (NUL byte present)
    const lines = content.split(/\r?\n/);
    for (const rule of secretRules) {
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(rule.re);
        if (!m) continue;
        if (rule.name === "EVM private key" && knownTestKeys.has(m[0].toLowerCase())) continue;
        // The .example file is expected to name these keys with empty values.
        if (rel.endsWith(".env.example")) continue;
        const sev = /private key|mnemonic|PEM|RPC URL/.test(rule.name) ? "critical" : "high";
        record("secrets", sev, `${rel}:${i + 1} — ${rule.name}`, `match: ${redact(m[0])}`);
      }
    }
  }
}

// --------------------------------------------------------------- files
function checkFiles() {
  const bad = /(^|\/)\.env(\.[a-z]+)?$|\.(pem|key|keystore|p12|pfx|ppk)$|(^|\/)id_(rsa|dsa|ecdsa|ed25519)$|(^|\/)secrets?\.(json|ya?ml)$/i;
  for (const rel of textFiles()) {
    if (rel.endsWith(".env.example") || rel.endsWith(".pub")) continue;
    if (bad.test(rel)) {
      record("files", "critical", `tracked sensitive file: ${rel}`, "remove from git (`git rm --cached`), rotate any secret it held, confirm it is gitignored");
    }
  }
}

// ----------------------------------------------------------- gitignore
function checkGitignore() {
  const gi = join(root, ".gitignore");
  const body = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  const want = [".env", "node_modules"];
  for (const rule of want) {
    if (!new RegExp(`^\\s*\\*?/?${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(body) && !body.includes(rule)) {
      record("gitignore", "high", `.gitignore is missing a rule for "${rule}"`, "add it so these are never committed");
    }
  }
}

// ----------------------------------------------------------- history
function checkHistory() {
  for (const rule of secretRules) {
    const res = run("git", ["log", "--all", "--oneline", "-i", "-P", `-G${rule.re.source}`, "--", "."], { cwd: root });
    const commits = (res.out || "").split("\n").filter(Boolean).slice(0, 20);
    for (const c of commits) {
      record("history", "high", `git history — ${rule.name}`, `introduced or touched in: ${c}`);
    }
  }
  if (!findings.some((f) => f.check === "history")) {
    record("history", "info", "no secret patterns found in git history", "");
  }
}

// -------------------------------------------------------------- report
const order = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
function report() {
  const real = findings.filter((f) => f.severity !== "info");
  const worst = real.reduce((r, f) => Math.max(r, severities.indexOf(f.severity)), -1);
  const fail = real.some((f) => severities.indexOf(f.severity) >= failRank);

  if (asJson) {
    console.log(JSON.stringify({ findings, failed: fail, failOn }, null, 2));
    return fail;
  }

  console.log(`\n  security watchdog — ${new Date().toISOString()}`);
  console.log(`  workspaces: ${workspaces.join(", ")}\n`);
  const byCheck = {};
  for (const f of findings) (byCheck[f.check] ||= []).push(f);
  for (const [check, list] of Object.entries(byCheck)) {
    list.sort((a, b) => order[a.severity] - order[b.severity]);
    console.log(`  [${check}]`);
    for (const f of list) {
      const tag = f.severity.toUpperCase().padEnd(8);
      console.log(`    ${tag} ${f.title}${f.detail ? `\n             ${f.detail}` : ""}`);
    }
    console.log("");
  }
  const counts = severities
    .map((s) => `${real.filter((f) => f.severity === s).length} ${s}`)
    .reverse()
    .join("  ");
  console.log(`  summary: ${counts}`);
  console.log(`  gate: fail-on=${failOn} -> ${fail ? "FAIL" : "pass"}${worst >= 0 ? ` (worst: ${severities[worst]})` : ""}\n`);
  return fail;
}

// ---------------------------------------------------------------- main
try {
  if (!skip.has("deps")) checkDeps();
  if (scanOutdated) checkOutdated();
  if (!skip.has("secrets")) checkSecrets();
  if (!skip.has("files")) checkFiles();
  if (!skip.has("gitignore")) checkGitignore();
  if (scanHistory) checkHistory();
} catch (err) {
  console.error(`audit-guard: ${err.stack || err}`);
  process.exit(2);
}

process.exit(report() ? 1 : 0);
