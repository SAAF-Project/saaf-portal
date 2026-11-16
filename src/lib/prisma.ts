import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Connections one server instance may hold. Small on purpose: many instances share one database. */
const POOL_MAX = 3;

// One client per server instance, in production too. It used to be kept only outside production, so every call there
// built a new client with its own connection pool.
export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString, max: POOL_MAX });
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}
