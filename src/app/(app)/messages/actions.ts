"use server";

import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";

/** Records that a WhatsApp message was opened for sending. Never throws: logging must not block sending. */
export async function logMessage(candidateId: string, template: string | null, body: string) {
  try {
    const user = await requirePerm("call.log");
    await db.messageLog.create({ data: { candidateId, userId: user.id, template, body: body.slice(0, 2000) } });
    await db.candidate.update({ where: { id: candidateId }, data: { lastContactedAt: new Date() } });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
