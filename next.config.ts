import type { NextConfig } from "next";
const staticPreview = process.env.NEXT_PUBLIC_STATIC_PREVIEW === "true";
const config: NextConfig = {
  output: staticPreview ? "export" : "standalone",
  distDir: staticPreview ? ".next-pages" : ".next",
  basePath: staticPreview ? (process.env.NEXT_PUBLIC_BASE_PATH || "/ivan-grozny") : "",
  // The static preview contains TSX screens only; the TS server route stays in Node builds.
  pageExtensions: staticPreview ? ["tsx"] : ["tsx", "ts", "jsx", "js"],
  ...(staticPreview ? {} : { outputFileTracingIncludes: { "/api/chat": ["./content/teacher-materials.md"] } }),
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  ...(staticPreview ? {} : { async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" }
    ] }];
  } })
};
export default config;
