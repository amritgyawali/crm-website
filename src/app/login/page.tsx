import { ActionForm, Submit } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { login } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getSettings();
  const year = new Date().getFullYear();
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_440px]">
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-rule bg-[#ebe7de]">
        <div className="font-serif text-[22px] font-semibold">{s.companyName}</div>
        <div className="max-w-md">
          <p className="font-serif text-[30px] leading-[1.2] text-ink-2">
            Candidates, fees, visa files and partners, all in one book.
          </p>
          <p className="mt-4 text-[13px] text-muted">{s.companyAddress}</p>
        </div>
        <div className="text-[12px] text-muted">Internal system. Access is logged. © {year}</div>
      </div>

      <div className="flex items-center justify-center p-6 bg-sheet">
        <div className="w-full max-w-[340px]">
          <div className="lg:hidden font-serif text-[20px] font-semibold mb-8">{s.companyName}</div>
          <h1 className="text-[20px] font-semibold">Staff sign-in</h1>
          <p className="text-[13px] text-muted mt-1 mb-6">Use the email your manager set up for you.</p>
          <ActionForm action={login} reset={false} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="username" required autoFocus />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Submit className="w-full">Sign in</Submit>
          </ActionForm>
          <p className="text-[12px] text-muted mt-8">Forgot your password? Ask the office admin to reset it.</p>
        </div>
      </div>
    </main>
  );
}
