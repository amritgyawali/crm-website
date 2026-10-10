import Link from "next/link";
import { differenceInCalendarDays, addMonths } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getStageDays } from "@/lib/settings";
import { computeLedger } from "@/lib/ledger";
import { STAGES, type Stage } from "@/lib/constants";
import { money } from "@/lib/format";
import { PageHeader, cx } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { VisaTabs } from "../tabs";

export const metadata = { title: "Visa board" };

export default async function VisaBoard({ searchParams }: { searchParams: Promise<{ country?: string; job?: string; staff?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const stageDays = await getStageDays();
  const [cands, jobs, staff] = await Promise.all([
    db.candidate.findMany({
      where: {
        stage: { not: null }, status: { in: ["IN_PROCESS", "DEPLOYED"] },
        ...(sp.job ? { jobOrderId: sp.job } : {}), ...(sp.country ? { jobOrder: { country: sp.country } } : {}),
        ...(sp.staff ? { assignedToId: sp.staff } : {}),
      },
      orderBy: { stageEnteredAt: "asc" },
      include: {
        jobOrder: { select: { reference: true, position: true, country: true } },
        assignedTo: { select: { name: true } },
        installments: true, payments: { select: { amount: true } },
      },
    }),
    db.jobOrder.findMany({ orderBy: { reference: "asc" } }),
    db.user.findMany({ where: { active: true, role: { in: ["SALES", "OPERATIONS", "MANAGEMENT"] } }, orderBy: { name: "asc" } }),
  ]);
  const countries = [...new Set(jobs.map((j) => j.country))].sort();
  const now = new Date();

  return (
    <>
      <PageHeader title="Visa & deployment" meta="Oldest at the top of each column. Amber cards are over the stage time limit; a red line means fees are overdue." />
      <VisaTabs active="board" />
      <FilterForm>
        <select name="country" defaultValue={sp.country ?? ""} className="control !w-[170px]"><option value="">All countries</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="job" defaultValue={sp.job ?? ""} className="control !w-[240px]"><option value="">All job orders</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.reference} · {j.position}</option>)}</select>
        <select name="staff" defaultValue={sp.staff ?? ""} className="control !w-[170px]"><option value="">All staff</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      </FilterForm>
      <div className="overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="grid grid-flow-col auto-cols-[232px] gap-3 min-h-[60vh]">
          {STAGES.map((st, i) => {
            const list = cands.filter((c) => c.stage === st.value);
            return (
              <section key={st.value} className="bg-well/60 border border-rule rounded-[3px] flex flex-col min-w-0">
                <header className="px-3 py-2 border-b border-rule flex items-baseline justify-between gap-2">
                  <h2 className="text-[12.5px] font-semibold leading-tight"><span className="num text-muted mr-1">{i + 1}</span>{st.short}</h2>
                  <span className="num text-[12px] text-muted">{list.length}</span>
                </header>
                <ul className="p-2 space-y-2 flex-1">
                  {list.map((c) => {
                    const days = c.stageEnteredAt ? differenceInCalendarDays(now, c.stageEnteredAt) : 0;
                    const over = st.value !== "ARRIVED" && st.value !== "POST_ARRIVAL" && days > stageDays[st.value as Stage];
                    const L = computeLedger(c, now);
                    const passport = c.passportExpiry && c.passportExpiry < addMonths(now, 12) && c.status === "IN_PROCESS";
                    return (
                      <li key={c.id}>
                        <Link href={`/candidates/${c.id}`} className={cx("block bg-white border rounded-[3px] px-2.5 py-2 no-underline hover:border-ink-2", over ? "border-warn/60 bg-warn-tint/40" : "border-rule", L.overdue > 0 && "border-l-[3px] border-l-danger")}>
                          <div className="text-[13px] font-medium leading-tight">{c.fullName}</div>
                          <div className="text-[11.5px] text-muted mt-0.5 truncate">{c.jobOrder?.position}, {c.jobOrder?.country}</div>
                          <div className="flex items-center justify-between mt-1.5 text-[11.5px]">
                            <span className={cx("num", over ? "text-warn font-medium" : "text-muted")}>{days}d{over ? ` / ${stageDays[st.value as Stage]}` : ""}</span>
                            <span className="text-muted truncate ml-2">{c.assignedTo?.name.split(" ")[0] ?? "—"}</span>
                          </div>
                          {(L.overdue > 0 || passport) && (
                            <div className="mt-1 text-[11.5px] space-y-0.5">
                              {L.overdue > 0 && <div className="text-danger">{money(L.overdue, { whole: true })} overdue</div>}
                              {passport && <div className="text-danger">Passport expiring</div>}
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {list.length === 0 && <li className="text-[12px] text-muted px-1 py-2">Nobody here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
