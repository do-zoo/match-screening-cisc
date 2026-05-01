/**
 * Loads env via MATCH_DB_PROFILE (see scripts/load-env-profile.ts), then runs
 * `@better-auth/cli migrate` — same DATABASE_URL semantics as Better Auth config.
 */

import { spawnSync } from "node:child_process";

import { applyEnvProfile } from "./load-env-profile";

applyEnvProfile();

const result = spawnSync(
  "npx",
  ["@better-auth/cli@latest", "migrate"],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status === null ? 1 : result.status);
