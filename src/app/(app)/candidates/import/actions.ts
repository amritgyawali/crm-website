"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { run, str } from "@/lib/action";
import { nextCandidateCode } from "@/lib/numbering";
import { parseLooseDate, readSheet, type ImportRow } from "@/lib/import";
import { normalizePhone } from "@/lib/phone";

const MAX_ROWS = 2000;

function sourceOf(v: string | undefined): string | null {
  const t = (v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return null;
  if (["campaign", "facebook", "fb", "instagram", "ig", "tiktok", "ad", "ads", "boost", "social"].some((k) => t.startsWith(k))) return "CAMPAIGN";
  if (["walkin", "office", "visit"].some((k) => t.startsWith(k))) return "WALK_IN";
  if (["referral", "referred", "friend", "reference"].some((k) => t.startsWith(k))) return "REFERRAL";
  if (["partner", "agent", "agency", "subagent"].some((k) => t.startsWith(k))) return "PARTNER";
  if (t === "other") return "OTHER";
  return null;
}

export async function importCandidates(fd: FormData) {
  return run(async () => {
    const user = await requirePerm("candidate.edit");
    const file = fd.get("file");
    if (!file || typeof file === "string" || !file.size) throw new Error("Choose an Excel (.xlsx) or CSV file.");
    if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB. Split it into smaller files.");
    const checkOnly = str(fd, "mode") !== "import";
    const defaultSource = str(fd, "defaultSource") || null;
    const defaultStaff = str(fd, "defaultStaff") || null;

    const { rows, unknownHeaders } = await readSheet(file);
    if (rows.length > MAX_ROWS) throw new Error(`Up to ${MAX_ROWS} rows per file. This file has ${rows.length}.`);

    const [campaigns, partners, jobs, staff, existing] = await Promise.all([
      db.campaign.findMany({ select: { id: true, name: true, jobOrderId: true } }),
      db.partner.findMany({ select: { id: true, name: true } }),
      db.jobOrder.findMany({ select: { id: true, reference: true } }),
      db.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true } }),
      db.candidate.findMany({ select: { phone: true, passportNo: true } }),
    ]);
    const lc = (s: string) => s.trim().toLowerCase();
    const phoneKey = (p: string) => p.replace(/[^\d]/g, "").slice(-9);
    const seenPhones = new Set(existing.map((e) => phoneKey(e.phone)));
    const seenPassports = new Set(existing.map((e) => e.passportNo?.toUpperCase()).filter(Boolean));

    const errors: string[] = [];
    const dupes: number[] = [];
    const ready: { row: ImportRow; data: Omit<Prisma.CandidateUncheckedCreateInput, "code"> }[] = [];

    for (const r of rows) {
      const problems: string[] = [];
      if (!r.fullName) problems.push("no name");
      if (!r.phone || r.phone.replace(/\D/g, "").length < 8) problems.push("phone missing or too short");
      if (!r.nationality) problems.push("no nationality");
      const source = sourceOf(r.leadSource) ?? (r.campaign ? "CAMPAIGN" : r.partner ? "PARTNER" : r.referredBy ? "REFERRAL" : defaultSource);
      if (!source) problems.push(`lead source "${r.leadSource ?? ""}" not recognised`);
      const campaign = r.campaign ? campaigns.find((c) => lc(c.name) === lc(r.campaign!)) : null;
      if (source === "CAMPAIGN" && !campaign) problems.push(r.campaign ? `campaign "${r.campaign}" not found` : "campaign name missing");
      const partner = r.partner ? partners.find((p) => lc(p.name) === lc(r.partner!)) : null;
      if (source === "PARTNER" && !partner) problems.push(r.partner ? `partner "${r.partner}" not found` : "partner name missing");
      const job = r.jobOrder ? jobs.find((j) => lc(j.reference) === lc(r.jobOrder!)) : null;
      if (r.jobOrder && !job) problems.push(`job order "${r.jobOrder}" not found`);
      const person = r.staff ? staff.find((u) => lc(u.email) === lc(r.staff!) || lc(u.name) === lc(r.staff!)) : null;
      if (r.staff && !person) problems.push(`staff "${r.staff}" not found`);
      const passportExpiry = parseLooseDate(r.passportExpiry);
      if (r.passportExpiry && !passportExpiry) problems.push(`passport expiry "${r.passportExpiry}" is not a date`);

      if (problems.length) {
        errors.push(`Row ${r._row}: ${problems.join(", ")}`);
        continue;
      }
      const pk = phoneKey(r.phone!);
      const pp = r.passportNo?.toUpperCase();
      if (seenPhones.has(pk) || (pp && seenPassports.has(pp))) {
        dupes.push(r._row);
        continue;
      }
      seenPhones.add(pk);
      if (pp) seenPassports.add(pp);
      ready.push({
        row: r,
        data: {
          fullName: r.fullName!, phone: normalizePhone(r.phone!), whatsapp: r.whatsapp ? normalizePhone(r.whatsapp) : null, email: r.email ?? null, nationality: r.nationality!,
          gender: r.gender ?? null, dateOfBirth: parseLooseDate(r.dateOfBirth), currentLocation: r.currentLocation ?? null,
          trade: r.trade ?? null, passportNo: pp ?? null, passportExpiry, leadSource: source!,
          campaignId: source === "CAMPAIGN" ? campaign!.id : null, sourcePartnerId: source === "PARTNER" ? partner!.id : null,
          referredBy: source === "REFERRAL" ? r.referredBy ?? null : null,
          jobOrderId: job?.id ?? campaign?.jobOrderId ?? null,
          assignedToId: person?.id ?? defaultStaff, notes: r.notes ?? null, sourceNote: `Imported from ${file.name}`,
        },
      });
    }

    const lines = [
      `${rows.length} rows read. ${ready.length} ready to import, ${dupes.length} already in the system, ${errors.length} with problems.`,
      ...(dupes.length ? [`Skipped as duplicates (same phone or passport): rows ${dupes.slice(0, 30).join(", ")}${dupes.length > 30 ? "…" : ""}`] : []),
      ...errors.slice(0, 25),
      ...(errors.length > 25 ? [`…and ${errors.length - 25} more rows with problems.`] : []),
      ...(unknownHeaders.length ? [`Columns ignored: ${unknownHeaders.join(", ")}`] : []),
    ];
    if (checkOnly) return lines.join("\n") + (ready.length ? "\nNothing saved yet. Choose “Import” to add them." : "");

    if (!ready.length) throw new Error(lines.join("\n"));
    for (const item of ready) {
      await db.$transaction(async (tx) => {
        await tx.candidate.create({ data: { ...item.data, code: await nextCandidateCode(tx) } });
      });
    }
    await audit({ userId: user.id, action: "CREATE", entity: "Candidate", summary: `Imported ${ready.length} candidates from ${file.name}` });
    return [`Imported ${ready.length} candidates.`, ...lines.slice(1)].join("\n");
  });
}
