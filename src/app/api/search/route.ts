import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CANDIDATE_STATUS_LABEL, type CandidateStatus } from "@/lib/constants";
import { d, money } from "@/lib/format";

export type SearchHit = { group: string; title: string; detail: string; href: string };

/** Search across records for the command palette. Results respect the user's role. */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const digits = q.replace(/\D/g, "");
  const r = user.role;

  const [cands, partners, jobs, camps, receipts] = await Promise.all([
    db.candidate.findMany({
      where: {
        OR: [
          { fullName: { contains: q } }, { code: { contains: q.toUpperCase() } }, { passportNo: { contains: q.toUpperCase() } },
          { email: { contains: q } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      take: 8, orderBy: { updatedAt: "desc" },
      select: { id: true, fullName: true, code: true, status: true, phone: true, jobOrder: { select: { position: true, country: true } } },
    }),
    db.partner.findMany({ where: { OR: [{ name: { contains: q } }, { country: { contains: q } }, { contacts: { some: { name: { contains: q } } } }] }, take: 5, select: { id: true, name: true, country: true } }),
    db.jobOrder.findMany({ where: { OR: [{ reference: { contains: q.toUpperCase() } }, { position: { contains: q } }, { employer: { contains: q } }] }, take: 5, select: { id: true, reference: true, position: true, country: true, status: true } }),
    can(r, "campaigns.view") ? db.campaign.findMany({ where: { name: { contains: q } }, take: 4, select: { id: true, name: true, platform: true } }) : Promise.resolve([]),
    can(r, "payment.record") && /\d/.test(q)
      ? db.payment.findMany({ where: { OR: [{ receiptNo: { contains: q.toUpperCase() } }, { reference: { contains: q } }] }, take: 4, include: { candidate: { select: { fullName: true } } } })
      : Promise.resolve([]),
  ]);

  const hits: SearchHit[] = [
    ...cands.map((c) => ({
      group: "Candidates", title: c.fullName, href: `/candidates/${c.id}`,
      detail: `${c.code} · ${CANDIDATE_STATUS_LABEL[c.status as CandidateStatus] ?? c.status}${c.jobOrder ? ` · ${c.jobOrder.position}, ${c.jobOrder.country}` : ""} · ${c.phone}`,
    })),
    ...jobs.map((j) => ({ group: "Job orders", title: `${j.reference} · ${j.position}`, detail: `${j.country} · ${j.status.toLowerCase().replace("_", " ")}`, href: `/jobs/${j.id}` })),
    ...partners.map((p) => ({ group: "Partners", title: p.name, detail: p.country, href: `/partners/${p.id}` })),
    ...camps.map((c) => ({ group: "Campaigns", title: c.name, detail: c.platform.toLowerCase(), href: `/campaigns/${c.id}` })),
    ...receipts.map((p) => ({ group: "Receipts", title: `${p.receiptNo} · ${p.candidate.fullName}`, detail: `${money(p.amount)} on ${d(p.date)}`, href: `/print/receipt/${p.id}` })),
  ];
  return NextResponse.json({ hits });
}
