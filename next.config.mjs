/** @type {import('next').NextConfig} */
const nextConfig = {
  // libsql is a native module: keep it out of the bundle, and make sure the server gets its files for Linux.
  serverExternalPackages: ["libsql", "web-push"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/libsql/**", "./node_modules/@libsql/**", "./node_modules/detect-libc/**", "./node_modules/@neon-rs/**"],
  },
  // NEXT_DIST_DIR: another build folder, so that a build can run while npm run dev keeps .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
