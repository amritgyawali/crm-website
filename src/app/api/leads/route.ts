import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextCandidateCode } from "@/lib/numbering";

/**
 * Lead intake for Facebook / Instagram lead forms (via Zapier, Make or a Meta webhook relay).
 * POST JSON { name, phone, email?, nationality?, campaignId? | adId? | formId?, note? }
 * Header: x-api-key: <LEADS_API_KEY>
 */
export async function POST(req: NextRequest) {
  const key = process.env.LEADS_API_KEY ?? "";
  const given = req.headers.get("x-api-key") ?? "";
  if (!key || key === "change-me" || given.length !== key.length || !timingSafeEqual(Buffer.from(given), Buffer.from(key)))
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const name = s("name") || s("full_name");
  const phone = s("phone") || s("phone_number");
  if (!name || !phone) return NextResponse.json({ error: "name and phone are required" }, { status: 422 });

  const external = s("adId") || s("formId") || s("ad_id") || s("form_id");
  const campaign = s("campaignId")
    ? await db.campaign.findUnique({ where: { id: s("campaignId") } })
    : external
      ? await db.campaign.findFirst({ where: { externalId: external } })
      : null;

  const existing = await db.candidate.findFirst({ where: { phone } });
  if (existing) return NextResponse.json({ ok: true, duplicate: true, id: existing.id, code: existing.code });

  const c = await db.$transaction(async (tx) =>
    tx.candidate.create({
      data: {
        code: await nextCandidateCode(tx), fullName: name, phone, email: s("email") || null, nationality: s("nationality") || "Unknown",
        leadSource: campaign ? "CAMPAIGN" : "OTHER", campaignId: campaign?.id ?? null, jobOrderId: campaign?.jobOrderId ?? null,
        sourceNote: [s("note"), external && !campaign ? `Unmatched ad/form ${external}` : ""].filter(Boolean).join(" · ") || "Imported from lead form",
      },
    }),
  );
  await audit({ action: "CREATE", entity: "Candidate", entityId: c.id, summary: `Lead imported: ${c.fullName}${campaign ? ` (${campaign.name})` : ""}` });
  return NextResponse.json({ ok: true, id: c.id, code: c.code }, { status: 201 });
}
