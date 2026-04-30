import { spawnSync } from "node:child_process";

const isVercel = process.env.VERCEL === "1";

if (!isVercel) {
  console.log("Skipping prisma migrate deploy (not running on Vercel).");
  process.exit(0);
}

console.log("Running prisma migrate deploy (Vercel build)...");
const result = spawnSync("pnpm", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
