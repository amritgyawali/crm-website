"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { audit } from "@/lib/audit";
import { run } from "@/lib/action";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/rate-limit";

export async function login(fd: FormData) {
  let next = "/";
  const res = await run(async () => {
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const n = String(fd.get("next") ?? "");
    if (n.startsWith("/") && !n.startsWith("//")) next = n;
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `${email}|${ip}`;
    const wait = tooManyAttempts(key);
    if (wait) throw new Error(`Too many wrong attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}, or ask the admin to reset your password.`);
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      recordFailure(key);
      if (user) await audit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, summary: `Wrong password for ${user.name} from ${ip}` });
      throw new Error("That email and password do not match an active account.");
    }
    clearFailures(key);
    const token = await signSession({ uid: user.id, role: user.role, name: user.name });
    const h = await headers();
    const isHttps = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim() === "https" || (h.get("origin") ?? "").startsWith("https://");
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(isHttps));
    await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, summary: `${user.name} signed in` });
  });
  if (res?.ok) redirect(next);
  return res;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(fd: FormData) {
  return run(async () => {
    const jar = await cookies();
    const s = await readSession(jar.get(SESSION_COOKIE)?.value);
    if (!s) throw new Error("Sign in again.");
    const user = await db.user.findUniqueOrThrow({ where: { id: s.uid } });
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new Error("Current password is wrong.");
    if (next.length < 8) throw new Error("New password must be at least 8 characters.");
    if (next !== String(fd.get("confirm") ?? "")) throw new Error("The two new passwords are different.");
    if (next === current) throw new Error("Choose a password different from the current one.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    await audit({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, summary: `${user.name} changed their password` });
    return "Password changed.";
  });
}
