/** @type {import('next').NextConfig} */
const nextConfig = {
  // libsql is a native module: keep it out of the bundle, and make sure the server gets its files for Linux.
  serverExternalPackages: ["libsql", "web-push"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/libsql/**", "./node_modules/@libsql/**", "./node_modules/detect-libc/**", "./node_modules/@neon-rs/**"],
  },
  // NEXT_DIST_DIR: another build folder, so that a build can run while npm run dev keeps .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // the light copies of the game's pictures and the brand files do not change: browsers keep them a week, the CDN a month
  async headers() {
    return [
      { source: "/va/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000" }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }] },
    ];
  },
};

export default nextConfig;
