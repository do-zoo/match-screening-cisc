import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-shot M1→venue migration helper; mismatches generated client after M2 (see tsconfig exclude).
    "scripts/backfill-venue-menu-from-events.ts",
    // Local agent/skill tooling (CommonJS scripts, not app source)
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
