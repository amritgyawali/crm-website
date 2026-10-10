import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { intakeLead } from "@/lib/lead-intake";

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

  const r = await intakeLead({
    name, phone, email: s("email"), nationality: s("nationality"), note: s("note"), campaignId: s("campaignId") || null,
    externalIds: [s("adId"), s("formId"), s("ad_id"), s("form_id")],
  });
  if (!r.created) return NextResponse.json({ ok: true, duplicate: true, id: r.candidate.id, code: r.candidate.code });
  const c = r.candidate;
  return NextResponse.json({ ok: true, id: c.id, code: c.code }, { status: 201 });
}
