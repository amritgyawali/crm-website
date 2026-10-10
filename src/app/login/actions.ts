"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { audit } from "@/lib/audit";
import { run } from "@/lib/action";

export async function login(fd: FormData) {
  let next = "/";
  const res = await run(async () => {
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const n = String(fd.get("next") ?? "");
    if (n.startsWith("/") && !n.startsWith("//")) next = n;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error("That email and password do not match an active account.");
    }
    const token = await signSession({ uid: user.id, role: user.role, name: user.name });
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, summary: `${user.name} signed in` });
  });
  if (res?.ok) redirect(next);
  return res;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
