import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prisma_pg_pool__: Pool | undefined;
}

const pool =
  globalThis.__prisma_pg_pool__ ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma_pg_pool__ = pool;

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;
