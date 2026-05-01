import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;
