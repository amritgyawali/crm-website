"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { need, optNum, optStr, run, str } from "@/lib/action";
import { DEFAULT_STAGE_DAYS, ROLES, SETTING_DEFAULTS, STAGE_ORDER, type SettingKey } from "@/lib/constants";
import { makeBackup } from "@/lib/backup";

export async function saveSettings(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("settings.manage");
    const changed: string[] = [];
    for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
      if (!fd.has(key)) continue;
      const value = str(fd, key);
      await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      changed.push(key);
    }
    await audit({ userId: user.id, action: "UPDATE", entity: "Setting", summary: `Changed settings: ${changed.join(", ")}` });
    return "Settings saved.";
  });
}

export async function saveStageDays(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("settings.manage");
    for (const stage of STAGE_ORDER) {
      const maxDays = Math.max(1, Math.round(optNum(fd, stage) ?? DEFAULT_STAGE_DAYS[stage]));
      await db.stageSetting.upsert({ where: { stage }, create: { stage, maxDays }, update: { maxDays } });
    }
    await audit({ userId: user.id, action: "UPDATE", entity: "StageSetting", summary: "Changed stage time limits" });
    return "Stage limits saved.";
  });
}

export async function saveUser(id: string | null, fd: FormData) {
  return run(async () => {
    const actor = await requirePerm("users.manage");
    const role = str(fd, "role");
    if (!ROLES.some((r) => r.value === role)) throw new Error("Choose a role.");
    if (role === "ADMIN" && actor.role !== "ADMIN") throw new Error("Only an admin can create another admin.");
    const email = need(fd, "email", "Email").toLowerCase();
    const password = str(fd, "password");
    const data = { name: need(fd, "name", "Name"), email, role, phone: optStr(fd, "phone"), monthlySalary: optNum(fd, "monthlySalary") ?? 0, active: str(fd, "active") !== "0" };
    const clash = await db.user.findUnique({ where: { email } });
    if (clash && clash.id !== id) throw new Error("Another user already has this email.");
    if (id) {
      if (id === actor.id && (!data.active || data.role !== actor.role)) throw new Error("You cannot change your own role or deactivate yourself.");
      const before = await db.user.findUniqueOrThrow({ where: { id }, select: { name: true, email: true, role: true, active: true, monthlySalary: true } });
      await db.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) } });
      await audit({ userId: actor.id, action: "UPDATE", entity: "User", entityId: id, summary: `Edited user ${data.name}${password ? " (password reset)" : ""}`, before, after: data });
      return "User saved.";
    }
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const u = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
    await audit({ userId: actor.id, action: "CREATE", entity: "User", entityId: u.id, summary: `Added user ${u.name} (${u.role})` });
    return "User added. Give them the email and password.";
  });
}

export async function saveTemplate(id: string | null, fd: FormData) {
  return run(async () => {
    const user = await requirePerm("settings.manage");
    const data = { name: need(fd, "name", "Name"), audience: str(fd, "audience") === "PARTNER" ? "PARTNER" : "CANDIDATE", body: need(fd, "body", "Message") };
    if (id) await db.messageTemplate.update({ where: { id }, data });
    else await db.messageTemplate.create({ data });
    await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "MessageTemplate", entityId: id, summary: `Saved template ${data.name}` });
    return "Template saved.";
  });
}

export async function deleteTemplate(id: string) {
  return run(async () => {
    await requirePerm("settings.manage");
    await db.messageTemplate.delete({ where: { id } });
  });
}

export async function runBackup() {
  return run(async () => {
    const user = await requirePerm("backup.download");
    const b = await makeBackup();
    await audit({ userId: user.id, action: "CREATE", entity: "Backup", summary: `Backup saved on server (${Math.round(b.size / 1024)} KB)` });
    return "Backup saved on the server.";
  });
}
