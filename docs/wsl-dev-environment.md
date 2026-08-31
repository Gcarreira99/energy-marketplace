# WSL2 dev environment tuning

## Background

Running `npm run dev` (which runs `scripts/dev.mjs`) starts four Node stacks at once:

| Stack | Process |
| --- | --- |
| Orchestrator | `node scripts/dev.mjs` |
| Local chain | `npx hardhat node` |
| Backend | `npm run start:dev` → `nest start --watch` (a `tsc` watcher **plus** a forked `node dist/main`) |
| Frontend | `npm run dev` → `next dev` (Next.js 16 → Turbopack) |

On a 16 GB / 8-core Windows host, WSL2's defaults (no `.wslconfig`) cap the Linux VM at
**8 GB RAM with only 2 GB swap**. On top of a ~3.7 GB idle baseline inside WSL — VS Code
Server, Copilot, the Hardhat language server, and **two TypeScript servers each allowed
3 GB** — the peak on first browser load pushes past that cap.

With only 2 GB swap the Linux guest cannot page out fast enough, so instead of the OOM
killer terminating one process, the whole VM thrashes, `vmmemWSL` balloons on the Windows
side, Windows starts swapping the entire VM, and everything locks up. `wsl --shutdown`
often can't get through either, forcing a full PC restart.

The changes below make WSL degrade **gracefully** (a single process is `Killed` and the dev
run continues) and keep Windows comfortably functional (≥ 6 GB free even at WSL peak).

## Changes applied

`memory=` and `swap=` are **ceilings, not reservations** — WSL allocates on demand up to
those limits and, with `autoMemoryReclaim`, hands memory back to Windows as it frees up.
When WSL is shut down it consumes ~0 memory regardless of these numbers.

### 1. `C:\Users\<you>\.wslconfig` (new file)

From inside WSL this path is `/mnt/c/Users/<you>/.wslconfig`.

```ini
[wsl2]
memory=10GB
swap=8GB

[experimental]
autoMemoryReclaim=gradual
```

| Line | Effect |
| --- | --- |
| `memory=10GB` | Raises the VM cap from the implicit 8 GB to 10 GB. At WSL peak, Windows still keeps ~6 GB. |
| `swap=8GB` | The key change. Creates a sparse `%USERPROFILE%\swap.vhdx` on `C:` (grows to at most 8 GB, reclaimable). Gives the Linux OOM killer room to kill one process instead of freezing the VM. |
| `autoMemoryReclaim=gradual` | Returns cached memory to Windows over time. |

### 2. `.env` (repo root) — append one line

`.env` is git-ignored, so this is a per-machine local change:

```
NODE_OPTIONS=--max-old-space-size=1536
```

`scripts/dev.mjs` loads every `KEY=value` line from `.env` into `process.env` and spawns
each child with it, so this caps the V8 heap of `hardhat node`, `nest start --watch`, and
`next dev`. They garbage-collect under pressure instead of ballooning. If `next dev`
OOM-crashes (only that process dies — recoverable), raise the value to `2048`.

### 3. `~/.vscode-server/data/User/settings.json` (new file)

```json
{
  "typescript.tsserver.maxTsServerMemory": 2048
}
```

The VS Code TypeScript server otherwise runs with a 3 GB ceiling (there are two instances).
This trims the semantic instance to 2 GB, shaving ~1 GB off the WSL idle baseline. Takes
effect on the next VS Code window reload.

## Applying / re-applying

1. Create/edit the three files above.
2. In a **normal Windows PowerShell or CMD window** (not inside WSL):
   ```
   wsl --shutdown
   ```
   Wait ~10 seconds. This also stops the VS Code server.
3. Reopen the WSL terminal / VS Code Remote window. The server restarts under the new
   limits and picks up the new tsserver setting.

## Verifying

```bash
# Inside WSL, after wsl --shutdown + reopen:
free -m                       # Mem total ~10000, Swap ~8192
grep -E 'MemTotal|SwapTotal' /proc/meminfo

# TS server now capped at 2048:
ps -eo pid,cmd | grep '[t]sserver.js'

# During `npm run dev`, in a second terminal, load http://localhost:3000 in the browser:
watch -n2 free -m             # stays below ~9 GB; swap use stays modest
# If the stack overshoots you'll see "Killed" in the dev output — recoverable, no freeze.

# Confirm a child inherited the heap cap:
tr '\0' '\n' < /proc/$(pgrep -f 'next dev' | head -1)/environ | grep NODE_OPTIONS
```

On Windows: Task Manager → Details → `Vmmem` / `vmmemWSL` memory now tops out near 10 GB;
Windows keeps ≥ 6 GB free.

## Reverting

Do any subset, then run `wsl --shutdown` from Windows PowerShell for it to take effect.

| Change | Revert |
| --- | --- |
| `.wslconfig` | Delete `C:\Users\<you>\.wslconfig` (or set `memory`/`swap` back). **Note:** this returns WSL to its implicit 8 GB / 2 GB-swap default — the configuration that caused the freeze. |
| `.env` | Remove the `NODE_OPTIONS=--max-old-space-size=1536` line (and its comment) from the repo-root `.env`. |
| VS Code setting | Remove the `typescript.tsserver.maxTsServerMemory` key from `~/.vscode-server/data/User/settings.json` (or delete the file if it holds nothing else). |

The `swap.vhdx` file created under `%USERPROFILE%` can be deleted once `.wslconfig` no
longer references a larger swap and WSL has been shut down.

## Tuning

| Want | Do |
| --- | --- |
| More headroom for the dev stack | Raise `memory` toward `12GB`. Windows then drops to ~4 GB at WSL peak — fine unless you also run heavy Windows apps (Chrome with many tabs, Docker Desktop, Teams). |
| Prioritise Windows | Lower `memory` to `8GB`. Keep `swap=8GB` — the swap alone is what prevents the hard freeze. |
| `next dev` crashes with "JavaScript heap out of memory" | Raise `NODE_OPTIONS` to `--max-old-space-size=2048` in `.env`. |
| Reclaim all WSL memory immediately | `wsl --shutdown` from Windows — frees everything back to Windows on demand. |
| Reduce peak further | Don't run all stacks at once: start `hardhat node` + backend in one terminal and `next dev` in another, and/or close VS Code during a full-stack run. |
