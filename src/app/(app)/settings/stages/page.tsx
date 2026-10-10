import { requirePage } from "@/lib/auth";
import { getStageDays } from "@/lib/settings";
import { STAGES } from "@/lib/constants";
import { Input, PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { SettingsTabs } from "../tabs";
import { saveStageDays } from "../actions";

export const metadata = { title: "Stage time limits" };

export default async function StagesPage() {
  await requirePage("settings.manage");
  const days = await getStageDays();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="stages" />
      <Section title="How long a candidate may stay in each stage" className="max-w-[640px]">
        <p className="text-[13px] text-muted mb-4">After this many days, the candidate shows up in reminders and on the visa overview.</p>
        <ActionForm action={saveStageDays} reset={false}>
          <table className="grid-table">
            <tbody>
              {STAGES.map((s, i) => (
                <tr key={s.value}>
                  <td className="num text-muted w-8">{i + 1}</td>
                  <td>{s.label}</td>
                  <td className="w-[120px]"><Input name={s.value} type="number" min={1} defaultValue={days[s.value]} className="num !min-h-[30px]" /></td>
                  <td className="text-muted text-[12.5px] w-12">days</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4"><Submit>Save limits</Submit></div>
        </ActionForm>
      </Section>
    </>
  );
}
