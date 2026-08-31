# Security watchdog

Three layers, all free, none of which need your computer running:

| Layer | Where it runs | What it catches |
|---|---|---|
| `npm run audit` | your machine, on demand | vulnerable deps, secrets in tracked files, sensitive files, weak `.gitignore` |
| `.github/workflows/security-watchdog.yml` | GitHub's free runners, weekly + on PR | everything above + gitleaks history sweep + Slither on the contracts |
| `.github/dependabot.yml` + GitHub settings | GitHub, continuously | new upstream versions, freshly disclosed CVEs in your dependency tree |

## 1. Local script — `npm run audit`

Zero dependencies (plain Node, like `scripts/mem-guard.mjs`). Run it whenever you want a snapshot:

```bash
npm run audit           # deps + secrets + files + gitignore, ~15s
npm run audit:full      # also scans git history and `npm outdated`
node scripts/audit-guard.mjs --json --skip deps    # machine-readable, skip a check
node scripts/audit-guard.mjs --fail-on critical    # only exit 1 on criticals
```

Checks:

- **deps** — `npm audit` in `.`, `backend`, `frontend`, `smart-contracts`; one line per advisory with the fix.
- **secrets** — regex sweep of every git-tracked file for EVM private keys, `mnemonic:`/`seed phrase:` lines, AWS keys, PEM private-key blocks, JWTs, GitHub tokens, and RPC URLs with an embedded Infura/Alchemy key. Hardhat's public test keys are whitelisted.
- **files** — anything tracked that looks like `.env`, `*.pem`, `*.key`, a keystore, an SSH private key, or `secrets.json`.
- **gitignore** — confirms `.env` and `node_modules` are ignored.
- **history** (`--history`) — the secret patterns run against past commits (`git log -G`). Mnemonic hits here need a human look — prose can trip the pattern.
- **outdated** (`--outdated`) — direct deps a major version or more behind.

Exit code: `0` clean, `1` a finding at or above `--fail-on` (default `high`), `2` the script itself errored.

## 2. GitHub Actions — `security-watchdog.yml`

Runs on GitHub-hosted runners (free: unlimited for public repos, 2,000 min/month for private — this job is a few minutes/week).

- **Weekly** (Mon 06:00 UTC) and **manual** (Actions tab → Run workflow): full report including `--history --outdated`, gitleaks over full history, Slither on `smart-contracts`. If anything fails it opens/refreshes a single issue labelled `security-watchdog`.
- **On PR / push to `main`** that touches a `package.json` or lockfile: fast gate. Only **critical** findings fail the check, so the current backlog does not block every PR. Tighten to `--fail-on high` in the workflow once the backlog is cleared.
- Every run writes a collapsible report to the workflow **Summary** page.

## 3. GitHub-native settings to switch on (one-time, in the repo UI)

**Settings → Advanced Security** (or **Code security and analysis**):

- **Dependabot alerts** — on. Flags CVEs in your tree in the Security tab.
- **Dependabot security updates** — on. Auto-PRs the fix for an alert.
- **Secret scanning** + **Push protection** — on. Free for public repos; blocks a push that contains a recognised token.
- `.github/dependabot.yml` (in this change) — weekly grouped version-bump PRs for all four npm dirs and the workflow actions.

## Current backlog (first run, 2026-08-31)

`npm run audit` reports **0 critical / 16 high / 10 moderate / 13 low**, almost all in `frontend` and `smart-contracts` dev tooling:

- `frontend`: `next` → 16.3.4 clears `next`/`postcss`/`sharp`; `npm audit fix` clears `brace-expansion`, `js-yaml`, `nanoid`, `ws`, `viem`.
- `smart-contracts`: `npm audit fix` clears most; `mocha` → 12 (breaking) clears `serialize-javascript`/`diff`.
- No secrets and no sensitive files are tracked. `.env` is correctly ignored.
- The `--history` mnemonic hit in commit `ced8e8f` is prose in a docs/agent file — verify, then ignore.

> Separately: `backend/package.json` pins `"typeorm": "^1.1.0"`, but TypeORM's real line is `0.3.x`. Confirm that resolves to what you expect.
