import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
