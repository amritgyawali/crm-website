import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { readSession, SESSION_COOKIE } from "./session";
import { can, type Permission } from "./permissions";

export const getUser = cache(async () => {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const user = await db.user.findUnique({
    where: { id: s.uid },
    select: { id: true, name: true, email: true, role: true, active: true, phone: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

/** For pages: redirect away when the role lacks access. */
export async function requirePage(perm: Permission) {
  const u = await requireUser();
  if (!can(u.role, perm)) redirect("/?denied=1");
  return u;
}

/** For server actions: throw when not allowed. */
export async function requirePerm(perm: Permission) {
  const u = await getUser();
  if (!u) throw new Error("Your session has ended. Sign in again.");
  if (!can(u.role, perm)) throw new Error("Your role does not allow this action.");
  return u;
}
