import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { intakeLead } from "@/lib/lead-intake";

/**
 * Facebook / Instagram Lead Ads webhook.
 * Setup (Meta app → Webhooks → Page → leadgen):
 *   Callback URL  https://<your-domain>/api/leads/meta
 *   Verify token  the value of META_VERIFY_TOKEN
 * Env: META_VERIFY_TOKEN, META_APP_SECRET (signature check), META_PAGE_TOKEN (to fetch lead details).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

type FieldData = { name: string; values: string[] }[];

function pick(fields: FieldData, ...names: string[]) {
  for (const n of names) {
    const f = fields.find((x) => x.name.toLowerCase() === n);
    if (f?.values?.[0]) return f.values[0].trim();
  }
  return "";
}

async function fetchLead(leadgenId: string): Promise<FieldData | null> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) return null;
  const v = process.env.META_GRAPH_VERSION ?? "v21.0";
  const r = await fetch(`https://graph.facebook.com/${v}/${encodeURIComponent(leadgenId)}?fields=field_data,ad_id,form_id&access_token=${encodeURIComponent(token)}`);
  if (!r.ok) throw new Error(`Graph API ${r.status}`);
  return ((await r.json()) as { field_data?: FieldData }).field_data ?? null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "META_APP_SECRET is not set" }, { status: 503 });
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: { entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const results: { leadgenId: string; result: string }[] = [];
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "leadgen" || !ch.value) continue;
      const v = ch.value as { leadgen_id?: string; ad_id?: string; form_id?: string; field_data?: FieldData };
      const leadgenId = String(v.leadgen_id ?? "");
      try {
        // relays sometimes include the answers; otherwise fetch them from the Graph API
        const fields = v.field_data ?? (leadgenId ? await fetchLead(leadgenId) : null);
        if (!fields) {
          results.push({ leadgenId, result: "no field data (set META_PAGE_TOKEN)" });
          continue;
        }
        const first = pick(fields, "first_name");
        const last = pick(fields, "last_name");
        const name = pick(fields, "full_name", "name") || [first, last].filter(Boolean).join(" ");
        const phone = pick(fields, "phone_number", "phone", "whatsapp_number", "mobile");
        if (!name || !phone) {
          results.push({ leadgenId, result: "missing name or phone" });
          continue;
        }
        const r = await intakeLead({
          name, phone, email: pick(fields, "email"), nationality: pick(fields, "nationality", "country"),
          note: `Meta lead ${leadgenId}`, externalIds: [String(v.ad_id ?? ""), String(v.form_id ?? "")],
        });
        results.push({ leadgenId, result: r.created ? `created ${r.candidate.code}` : `duplicate of ${r.candidate.code}` });
      } catch (e) {
        results.push({ leadgenId, result: e instanceof Error ? e.message : "failed" });
      }
    }
  }
  // always 200 so Meta doesn't retry leads we've seen; problems are in the response for debugging
  return NextResponse.json({ ok: true, results });
}
