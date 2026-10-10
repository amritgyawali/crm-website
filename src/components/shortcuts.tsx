"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** "/" jumps to search, "n" opens a new candidate, "c" the call list. Ignored while typing. */
export function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "/") {
        const el = document.querySelector<HTMLInputElement>("[data-search]");
        if (el && el.offsetParent !== null) {
          e.preventDefault();
          el.focus();
          el.select();
        } else {
          e.preventDefault();
          router.push("/candidates");
        }
      } else if (e.key === "n") router.push("/candidates/new");
      else if (e.key === "c") router.push("/calls");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
