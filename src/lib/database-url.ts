// Finds the PostgreSQL connection string. Used by the app, the build scripts and the setup page.
// DATABASE_URL is the main name. Vercel's database integrations add other names too
// (Supabase adds only POSTGRES_PRISMA_URL / POSTGRES_URL), so those work without renaming anything.
// No imports: the plain build scripts load this file as well.

type Env = Record<string, string | undefined>;

const POOLED = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"] as const;
const DIRECT = ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"] as const;

// postgres:// or postgresql://, plus prisma+postgres:// from Vercel's "Prisma Postgres" integration.
const isPostgres = (v: string | undefined): v is string => !!v && /^(postgres(ql)?|prisma\+postgres):\/\//i.test(v.trim());
const first = (env: Env, names: readonly string[]) => names.map((n) => env[n]).find(isPostgres)?.trim();

/** Connection string for the app (pooled when the host gives one). */
export function databaseUrl(env: Env = process.env) {
  return first(env, POOLED);
}

/** Connection string for migrations (direct, non-pooled when the host gives one). */
export function directDatabaseUrl(env: Env = process.env) {
  return first(env, DIRECT) ?? databaseUrl(env);
}

/**
 * Demo mode: no database connected, so the app runs on built-in sample data that is not kept (src/lib/demo-db.ts).
 * The names are spelled out (not looked up by a variable) so Next.js also passes them to the middleware.
 */
export function demoMode() {
  return !databaseUrl({ DATABASE_URL: process.env.DATABASE_URL, POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL, POSTGRES_URL: process.env.POSTGRES_URL });
}

/** Why there is no usable connection string, or null when there is one. Never repeats the value itself. */
export function databaseUrlProblem(env: Env = process.env): string | null {
  if (databaseUrl(env)) return null;
  const set = POOLED.find((n) => env[n]?.trim());
  if (!set) return "DATABASE_URL is not set.";
  const scheme = env[set]!.trim().match(/^[a-z][a-z0-9+.-]*:/i)?.[0];
  return `${set} is set, but it is not a PostgreSQL connection string${scheme ? ` (it starts with "${scheme}")` : ""}. It must start with postgresql:// or postgres://.`;
}
