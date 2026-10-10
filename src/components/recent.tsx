"use client";

import { useEffect } from "react";

export type RecentItem = { group: string; title: string; detail?: string; href: string };
const KEY = "crm-recent";

export function readRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

/** Remembers the records this person opened, newest first, for the Ctrl+K palette. Kept on this device only. */
export function TrackRecent({ item }: { item: RecentItem }) {
  useEffect(() => {
    try {
      const list = [item, ...readRecent().filter((r) => r.href !== item.href)].slice(0, 8);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage blocked: nothing to remember */
    }
  }, [item]);
  return null;
}
