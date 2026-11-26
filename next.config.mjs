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
      // every page and file: no guessing of file types, only the domain sent to other sites, and no camera, microphone or
      // location (the site uses none). No frame rule: the overlays and embeds are meant to be shown in other pages.
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ] },
      { source: "/va/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000" }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }] },
    ];
  },
};

export default nextConfig;
