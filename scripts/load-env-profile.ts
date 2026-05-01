/**
 * Loads `.env`, then overlays one file by match-screening convention:
 * - default / `MATCH_DB_PROFILE=development` (also `dev`) → `.env.local`
 * - `MATCH_DB_PROFILE=production` (also `prod`) → `.env.prod`
 *
 * Vercel/production runtime does not use these files; CLI on a dev machine does.
 */

import fs from "node:fs";

import dotenv from "dotenv";

const PROFILE_VAR = "MATCH_DB_PROFILE" as const;

export type ResolvedDbProfile = "development" | "production";

function resolveDbProfile(env: NodeJS.ProcessEnv): ResolvedDbProfile {
  const raw = String(env[PROFILE_VAR] ?? "")
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  return "development";
}

export function overlayPathForProfile(
  profile: ResolvedDbProfile,
  cwd: string,
): string {
  return profile === "production"
    ? `${cwd}/.env.prod`
    : `${cwd}/.env.local`;
}

/** Current profile derived from env (reads `MATCH_DB_PROFILE`). */
export function getResolvedDbProfile(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDbProfile {
  return resolveDbProfile(env);
}

/**
 * Load base `.env` then profile overlay (.env.local or .env.prod) when files exist.
 * Overlay wins on key collision (`override: true`).
 */
export function applyEnvProfile(cwd = process.cwd()): void {
  const base = `${cwd}/.env`;
  if (fs.existsSync(base)) {
    dotenv.config({ path: base });
  }

  const profile = resolveDbProfile(process.env);
  const overlay = overlayPathForProfile(profile, cwd);
  if (fs.existsSync(overlay)) {
    dotenv.config({ path: overlay, override: true });
  }
}
