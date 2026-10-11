"use server";

import { requirePerm } from "@/lib/auth";
import { readPassportPhoto, passportAiEnabled } from "@/lib/passport-ai";
import type { PassportData } from "@/lib/mrz";

export type ScanResult = { ok: true; data: PassportData; warnings: string[] } | { ok: false; error: string };

export async function scanPassportPhoto(fd: FormData): Promise<ScanResult> {
  try {
    await requirePerm("candidate.edit");
    if (!passportAiEnabled()) return { ok: false, error: "Photo reading is not switched on. Paste the two lines from the passport instead." };
    const file = fd.get("photo");
    if (!file || typeof file === "string" || !file.size) return { ok: false, error: "Choose a photo of the passport page." };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Photo is larger than 8 MB." };
    const r = await readPassportPhoto(Buffer.from(await file.arrayBuffer()), file.type);
    return { ok: true, data: r.data, warnings: r.warnings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read the photo." };
  }
}
