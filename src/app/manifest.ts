import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

// Lets staff add the CRM to their phone's home screen and open it like an app.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings().catch(() => null);
  const name = s?.companyName ?? "Office CRM";
  return {
    name,
    short_name: name.length > 14 ? "Office CRM" : name,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: "#1b1a17",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Call list", url: "/calls" },
      { name: "New candidate", url: "/candidates/new" },
      { name: "Calendar", url: "/calendar" },
    ],
  };
}
