import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dt } from "@/lib/format";
import { Empty, Input, PageHeader, Section, Select, TableWrap, Tag, btn } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { Pager } from "@/components/pager";
import { SettingsTabs } from "../tabs";

export const metadata = { title: "Activity log" };
const PER = 100;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ entity?: string; user?: string; q?: string; page?: string }> }) {
  await requirePage("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.entity) where.entity = sp.entity;
  if (sp.user) where.userId = sp.user;
  if (sp.q) where.summary = { contains: sp.q, mode: "insensitive" };
  const [rows, total, entities, users] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { user: { select: { name: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="activity" />
      <FilterForm>
        <Select name="entity" defaultValue={sp.entity ?? ""} placeholder="All records" options={entities.map((e) => ({ value: e.entity, label: e.entity }))} className="!w-[170px]" />
        <Select name="user" defaultValue={sp.user ?? ""} placeholder="Anyone" options={users.map((u) => ({ value: u.id, label: u.name }))} className="!w-[170px]" />
        <Input name="q" defaultValue={sp.q} placeholder="Search text" className="!w-[200px]" />
        <button className={btn("secondary")}>Search</button>
        <a className={btn("secondary")} href="/api/export/audit">Export</a>
      </FilterForm>
      <Section flush>
        {rows.length === 0 ? <Empty>No activity.</Empty> : (
          <TableWrap>
            <table className="grid-table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>What happened</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap num text-[12.5px]">{dt(r.createdAt)}</td>
                    <td className="whitespace-nowrap">{r.user?.name ?? "System"}</td>
                    <td><Tag tone={r.action === "DELETE" ? "red" : r.action === "UPDATE" ? "amber" : r.action === "APPROVE" ? "green" : "plain"}>{r.action.toLowerCase()}</Tag></td>
                    <td className="text-[13px]">{r.entity}</td>
                    <td className="text-[13px]">
                      {r.summary}
                      {(r.before || r.after) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[12px] text-muted">before / after</summary>
                          <pre className="text-[11px] bg-well p-2 mt-1 overflow-x-auto max-w-[640px] whitespace-pre-wrap">{r.before && `Before: ${r.before}\n`}{r.after && `After: ${r.after}`}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pager page={page} pages={Math.ceil(total / PER)} params={sp as Record<string, string>} base="/settings/activity" />
      </Section>
    </>
  );
}
