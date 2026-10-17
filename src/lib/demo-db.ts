// Demo mode: when no database is connected, the app runs on PGlite, a full PostgreSQL that lives in the
// server's memory, filled with the demo data. Nothing is saved for good: a restart (or a new server
// instance on Vercel) starts again from the demo data. Connect a database to leave demo mode.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { Prisma, PrismaClient } from "@prisma/client";
import { seedDemo } from "../../prisma/demo-data";

type AdapterFactory = NonNullable<Prisma.PrismaClientOptions["adapter"]>;

/** A ready-made demo database saved by the build (scripts/demo-snapshot.ts), so the server starts in about a second. */
export const DEMO_SNAPSHOT = path.join(".demo", "demo-db.tar.gz");

// pglite-prisma-adapter 0.6 is typed against Prisma 6.10. Only the query argument *types* changed since,
// and the adapter never reads them (it passes the values straight to PGlite), so the cast is safe.
const adapterFor = (pg: PGlite) => new PrismaPGlite(pg) as unknown as AdapterFactory;

/** A new in-memory database with the same tables as a real one (the committed migrations) and the demo data. */
export async function buildDemoDatabase() {
  const pg = new PGlite();
  const dir = path.join(process.cwd(), "prisma", "migrations"); // next.config.ts ships these to Vercel
  const names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const name of names) await pg.exec(readFileSync(path.join(dir, name, "migration.sql"), "utf8"));
  const seeder = new PrismaClient({ adapter: adapterFor(pg) });
  await seedDemo(seeder);
  await seeder.$disconnect();
  return pg;
}

async function openDemoDatabase() {
  const file = path.join(process.cwd(), DEMO_SNAPSHOT);
  if (existsSync(file)) {
    try {
      const pg = new PGlite({ loadDataDir: new Blob([readFileSync(file)]) });
      await pg.waitReady;
      return { pg, from: "the build's snapshot" };
    } catch (e) {
      console.error("Demo mode: the saved sample database could not be opened, building a new one", e);
    }
  }
  return { pg: await buildDemoDatabase(), from: "scratch" };
}

/** A Prisma driver adapter that opens the demo database on the first query (not on import, e.g. during the build). */
export function demoAdapter(): AdapterFactory {
  let ready: Promise<AdapterFactory> | undefined;
  const open = () =>
    (ready ??= (async () => {
      const started = Date.now();
      const { pg, from } = await openDemoDatabase();
      console.log(`Demo mode (no database connected): sample data loaded from ${from} in ${Date.now() - started} ms.`);
      return adapterFor(pg);
    })().catch((e) => {
      console.error("Demo mode: preparing the sample database failed", e);
      ready = undefined; // try again on the next request
      throw e;
    }));
  return {
    provider: "postgres",
    adapterName: "pglite-prisma-adapter",
    connect: async () => (await open()).connect(),
  };
}
