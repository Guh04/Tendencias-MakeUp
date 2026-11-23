import type { NextConfig } from "next";

/**
 * Desenvolvimento: servidor normal.
 * Instalador (DESKTOP_BUILD=1): site 100% estatico, servido de dentro do programa em /admin.
 */
const desktop = process.env.DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@tendencias/core", "@tendencias/ui"],
  ...(desktop ? { output: "export", basePath: "/admin", images: { unoptimized: true } } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
