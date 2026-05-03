import "dotenv/config";
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["@better-auth/cli@latest", "migrate"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
