<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Node.js (nvm)

The repo pins Node via **`.nvmrc`** (`v24`). **Before running any terminal command** that invokes Node tooling (`pnpm`, `npm`, `npx`, `node`, Prisma CLI, Vitest from `PATH`, etc.), ensure the shell uses that version:

1. **`cd`** to this repo root (where `.nvmrc` lives).
2. Load nvm if needed, then **`nvm use`** (reads `.nvmrc`).

Non-interactive / agent shells often need nvm loaded explicitly:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /path/to/match-screening && nvm use && <command…>
```
