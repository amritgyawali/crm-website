import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/constants";
import { d } from "@/lib/format";
import { Disclose, Field, FormGrid, Input, Money, PageHeader, Section, Select, TableWrap, Tag } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { SettingsTabs } from "../tabs";
import { saveUser } from "../actions";

export const metadata = { title: "Users & roles" };

const WHAT: Record<Role, string> = {
  ADMIN: "Everything, including users and backups.",
  MANAGEMENT: "Everything. Approves refunds, expenses and payroll.",
  FINANCE: "Fee plans, payments (incl. edits), refunds payout, expenses, payroll, reports.",
  SALES: "Own candidates, calls, recording payments, campaigns view.",
  OPERATIONS: "Visa stages, documents, job orders, partners.",
};

function UserFields({ u }: { u?: { name: string; email: string; role: string; phone: string | null; monthlySalary: number; active: boolean } }) {
  return (
    <FormGrid cols={3}>
      <Field label="Name" required><Input name="name" required defaultValue={u?.name} /></Field>
      <Field label="Email (login)" required><Input name="email" type="email" required defaultValue={u?.email} /></Field>
      <Field label="Role" required><Select name="role" defaultValue={u?.role ?? "SALES"} options={ROLES} /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={u?.phone ?? ""} /></Field>
      <Field label="Monthly salary (AED)"><Input name="monthlySalary" className="num" defaultValue={u ? String(u.monthlySalary) : ""} /></Field>
      <Field label={u ? "New password (leave empty to keep)" : "Password"} required={!u}><Input name="password" type="password" autoComplete="new-password" minLength={u ? undefined : 8} /></Field>
      {u && <Field label="Account"><Select name="active" defaultValue={u.active ? "1" : "0"} options={[{ value: "1", label: "Active" }, { value: "0", label: "Disabled" }]} /></Field>}
    </FormGrid>
  );
}

export default async function UsersPage() {
  await requirePage("users.manage");
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="users" />
      <Section title="Staff logins" flush>
        <TableWrap>
          <table className="grid-table">
            <thead><tr><th>Name</th><th>Role</th><th>Email</th><th className="r">Salary</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}{!u.active && <> <Tag tone="faint">disabled</Tag></>}</td>
                  <td>{ROLE_LABEL[u.role as Role]}</td>
                  <td className="text-[13px]">{u.email}</td>
                  <td className="r"><Money v={u.monthlySalary} zero="—" /></td>
                  <td className="text-[13px]">{d(u.joinedOn, "MMM yyyy")}</td>
                  <td className="w-[45%]">
                    <Disclose label="Edit">
                      <ActionForm action={saveUser.bind(null, u.id)} reset={false} className="space-y-3 pt-2">
                        <UserFields u={u} />
                        <Submit size="sm">Save</Submit>
                      </ActionForm>
                    </Disclose>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
      <div className="grid gap-5 mt-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Section title="Add a user">
          <ActionForm action={saveUser.bind(null, null)} className="space-y-3">
            <UserFields />
            <Submit>Add user</Submit>
          </ActionForm>
        </Section>
        <Section title="What each role can do">
          <dl className="text-[13px] space-y-2">
            {ROLES.map((r) => <div key={r.value}><dt className="font-medium">{r.label}</dt><dd className="text-muted">{WHAT[r.value]}</dd></div>)}
          </dl>
        </Section>
      </div>
    </>
  );
}
