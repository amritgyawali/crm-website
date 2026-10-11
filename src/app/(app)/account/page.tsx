import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { dt } from "@/lib/format";
import { Field, Input, KV, PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { changePassword } from "../../login/actions";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  const logins = await db.auditLog.findMany({
    where: { userId: user.id, action: { in: ["LOGIN", "LOGIN_FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return (
    <>
      <PageHeader title="My account" meta={ROLE_LABEL[user.role as Role]} />
      <div className="grid gap-5 lg:grid-cols-2 max-w-[1000px]">
        <div className="space-y-5">
          <Section title="Details">
            <KV items={[["Name", user.name], ["Email (login)", user.email], ["Phone", user.phone], ["Role", ROLE_LABEL[user.role as Role]]]} />
            <p className="text-[12.5px] text-muted mt-3">Ask management to change your name, email or role.</p>
          </Section>
          <Section title="Change password">
            <ActionForm action={changePassword} className="space-y-3">
              <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" required /></Field>
              <Field label="New password" hint="At least 8 characters"><Input name="next" type="password" autoComplete="new-password" minLength={8} required /></Field>
              <Field label="New password again"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
              <Submit>Change password</Submit>
            </ActionForm>
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Recent sign-ins" flush>
            <ul className="divide-y divide-rule">
              {logins.map((l) => (
                <li key={l.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-3">
                  <span className={l.action === "LOGIN_FAILED" ? "text-danger" : ""}>{l.action === "LOGIN_FAILED" ? "Wrong password" : "Signed in"}</span>
                  <span className="num text-muted">{dt(l.createdAt)}</span>
                </li>
              ))}
            </ul>
            <p className="px-4 py-2 text-[12px] text-muted border-t border-rule">If you see a sign-in you don&apos;t recognise, change your password and tell the admin.</p>
          </Section>
          <Section title="Keyboard shortcuts">
            <ul className="text-[13px] space-y-1.5">
              {[["/", "Search candidates"], ["n", "New candidate"], ["c", "My call list"]].map(([k, v]) => (
                <li key={k} className="flex items-center gap-3"><kbd className="num text-[12px] border border-rule-2 rounded-[2px] px-1.5 bg-field min-w-[22px] text-center">{k}</kbd>{v}</li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
