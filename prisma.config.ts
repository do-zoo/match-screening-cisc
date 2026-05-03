import "dotenv/config";

import { env, PrismaConfig } from "prisma/config";

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // shadowDatabaseUrl: env("DATABASE_URL_UNPOOLED"),
  },
} satisfies PrismaConfig;
