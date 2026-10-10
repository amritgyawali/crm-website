import { cache } from "react";
import { db } from "./db";
import { DEFAULT_STAGE_DAYS, SETTING_DEFAULTS, type SettingKey, type Stage } from "./constants";

export const getSettings = cache(async () => {
  const rows = await db.setting.findMany();
  const out: Record<SettingKey, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
});

export const getStageDays = cache(async () => {
  const rows = await db.stageSetting.findMany();
  const out: Record<string, number> = { ...DEFAULT_STAGE_DAYS };
  for (const r of rows) out[r.stage] = r.maxDays;
  return out as Record<Stage, number>;
});

export const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
