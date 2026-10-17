import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./database-url";
import { demoAdapter } from "./demo-db";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = databaseUrl();
  // The client connects on its first query, so a broken connection string shows up there (and on /setup).
  if (url) return new PrismaClient({ datasourceUrl: url });
  return new PrismaClient({ adapter: demoAdapter() }); // no database connected: demo mode
}

// Kept on globalThis so the server builds one client (and in demo mode, one sample database) per process.
export const db = globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient());
