import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { findDuplicates } from "@/lib/duplicates";
import { d } from "@/lib/format";
import { Empty, PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { StatusTag } from "@/components/tags";
import { SettingsTabs } from "../tabs";
import { ignoreGroup, mergeCandidates } from "./actions";

export const metadata = { title: "Duplicates" };

export default async function DuplicatesPage() {
  await requirePage("settings.manage");
  const row = await db.setting.findUnique({ where: { key: "dupIgnored" } });
  const groups = await findDuplicates(new Set(row ? (JSON.parse(row.value) as string[]) : []));
  const ids = groups.flatMap((g) => g.ids);
  const cands = await db.candidate.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, code: true, fullName: true, phone: true, passportNo: true, nationality: true, status: true, createdAt: true,
      assignedTo: { select: { name: true } }, _count: { select: { callLogs: true, payments: true, documents: true, stageEvents: true } },
    },
  });
  const byId = new Map(cands.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="duplicates" />
      <p className="text-[13px] text-muted -mt-2 mb-4 max-w-[760px]">
        Records that look like the same person. Merging keeps the record you pick and moves calls, payments, refunds, documents and messages onto it. A fee plan or visa history moves only if the kept record has none. The others are deleted; the merge is written to the activity log.
      </p>
      {groups.length === 0 ? <Section><Empty>No likely duplicates found.</Empty></Section> : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Section key={g.key} title={g.reason} note={`${g.ids.length} records`} actions={<ActionButton action={ignoreGroup.bind(null, g.key)} variant="ghost">Not the same person</ActionButton>} flush>
              <ActionForm action={mergeCandidates.bind(null, g.key)}>
                <TableWrap>
                  <table className="grid-table">
                    <thead><tr><th>Keep</th><th>Candidate</th><th>Phone</th><th>Passport</th><th>Status</th><th>Staff</th><th className="r">Calls</th><th className="r">Payments</th><th className="r">Docs</th><th>Added</th></tr></thead>
                    <tbody>
                      {g.ids.map((id, i) => {
                        const c = byId.get(id);
                        if (!c) return null;
                        return (
                          <tr key={id}>
                            <td><input type="radio" name="keep" value={id} defaultChecked={i === 0} aria-label={`Keep ${c.fullName}`} /></td>
                            <td><Link className="row-link" href={`/candidates/${id}`}>{c.fullName}</Link><div className="num text-[12px] text-muted">{c.code} · {c.nationality}</div></td>
                            <td className="num text-[13px]">{c.phone}</td>
                            <td className="num text-[13px]">{c.passportNo ?? "—"}</td>
                            <td><StatusTag status={c.status} /></td>
                            <td className="text-[13px]">{c.assignedTo?.name ?? "—"}</td>
                            <td className="r num">{c._count.callLogs}</td>
                            <td className="r num">{c._count.payments}</td>
                            <td className="r num">{c._count.documents}</td>
                            <td className="text-[13px] whitespace-nowrap">{d(c.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
                <div className="px-4 py-3 border-t border-rule"><Submit variant="danger" size="sm">Merge into the ticked record</Submit></div>
              </ActionForm>
            </Section>
          ))}
        </div>
      )}
    </>
  );
}
