import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { databaseUrlProblem, demoMode } from "./database-url";
import { sessionSecret } from "./session";

export type SetupStep = { title: string; ok: boolean; detail: string };

const onVercel = () => !!process.env.VERCEL;
const envPlace = () => (onVercel() ? "Vercel → your project → Settings → Environment Variables" : "the .env file");
const redeploy = () => (onVercel() ? "then redeploy (Deployments → newest deployment → ⋯ → Redeploy)" : "then restart the server");

export function sessionSecretOk() {
  return !!sessionSecret();
}

/** Friendly reason for a failed connection. The raw error goes to the server log, not the page. */
function connectionProblem(e: unknown) {
  const code = e instanceof Prisma.PrismaClientInitializationError ? e.errorCode : e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
  const why: Record<string, string> = {
    P1000: "the database refused the user name or password in the connection string",
    P1001: "the database server could not be reached",
    P1002: "the database server did not answer in time",
    P1003: "the database named in the connection string does not exist",
    P1011: "a secure (TLS) connection could not be opened",
    P1013: "the connection string is not in a valid format",
    P1017: "the database server closed the connection",
  };
  // Connection errors often come without a code, so fall back to the wording of the message.
  const text = e instanceof Error ? e.message : "";
  const byText: [RegExp, string][] = [
    [/can't reach database server/i, why.P1001],
    [/authentication failed/i, why.P1000],
    [/database .* does not exist/i, why.P1003],
    [/timed out|timeout/i, why.P1002],
    [/\b(tls|ssl|certificate)\b/i, why.P1011],
  ];
  const reason = (code && why[code]) || byText.find(([re]) => re.test(text))?.[1] || "connecting failed";
  return `${reason}${code ? ` (${code})` : ""}`;
}

/**
 * Everything the app needs before anyone can sign in, checked in order.
 * Shown on /setup; the sign-in page sends people there while something is missing.
 */
export async function setupStatus(): Promise<{ ready: boolean; demo: boolean; steps: SetupStep[] }> {
  const steps: SetupStep[] = [];
  const demo = demoMode();
  const urlProblem = databaseUrlProblem();
  const connectHow = onVercel()
    ? `In Vercel open your project → Storage → Create Database, pick Supabase or Neon and connect it to this project; that adds the connection settings for you. Or paste a PostgreSQL connection string as DATABASE_URL in ${envPlace()}`
    : `Add a PostgreSQL connection string as DATABASE_URL in ${envPlace()}`;
  steps.push({
    title: "Database connected",
    ok: !urlProblem,
    detail: urlProblem ? `${urlProblem} ${connectHow}, ${redeploy()}.` : "A PostgreSQL connection string is set.",
  });

  let reachable = false;
  let tables = false;
  let users = 0;
  if (!demo) {
    try {
      await db.$queryRaw`SELECT 1`;
      reachable = true;
    } catch (e) {
      console.error("Setup check: database connection failed", e);
      steps.push({ title: "Database reachable", ok: false, detail: `The connection string is set, but ${connectionProblem(e)}. Copy the connection string again from your database host into ${envPlace()}, ${redeploy()}.` });
    }
  }
  if (reachable) {
    try {
      users = await db.user.count();
      tables = true;
    } catch (e) {
      // P2021 = the table does not exist, i.e. the migrations have not run yet.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021")) console.error("Setup check: reading users failed", e);
    }
    steps.push({
      title: "Tables created",
      ok: tables,
      detail: tables
        ? "The database tables exist."
        : onVercel()
          ? "The database is empty. Redeploy the newest deployment (Deployments → ⋯ → Redeploy): every build creates the tables. If it still shows this, open that deployment's build log and look for errors under “prisma migrate deploy”."
          : "The database is empty. Run “npm run db:migrate” (or “npm run setup” for demo data), then reload.",
    });
  }
  if (tables) {
    steps.push({
      title: "First admin login",
      ok: users > 0,
      detail: users > 0
        ? "At least one login exists."
        : onVercel()
          ? `No one can sign in yet. Add ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters, optional ADMIN_NAME) in ${envPlace()}, ${redeploy()}. The build creates that admin login once, while there are no users.`
          : "No one can sign in yet. Run “npm run create-admin -- --email you@company.com --password a-long-password”, then reload.",
    });
  }

  // Demo mode signs in with a built-in key; a real database needs your own, so it is listed as to do there too.
  const secretSet = (process.env.SESSION_SECRET ?? "").length >= 16;
  steps.push({
    title: "Sign-in secret key",
    ok: secretSet,
    detail: secretSet
      ? "SESSION_SECRET is set."
      : `SESSION_SECRET is ${process.env.SESSION_SECRET ? "too short" : "not set"}${demo ? " (demo mode uses a built-in one, a real database needs your own)" : ""}. Add it in ${envPlace()} as any long random text (32+ characters; the command “openssl rand -base64 48” makes one), ${redeploy()}.`,
  });

  if (demo) {
    steps.push({
      title: "First admin login",
      ok: false,
      detail: `Add ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters, optional ADMIN_NAME) in ${envPlace()} together with the database. The first deploy with the database creates the tables and this admin login.`,
    });
  }

  return { ready: !demo && steps.every((s) => s.ok), demo, steps };
}
