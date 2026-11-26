import { headers } from "next/headers";
import { siteBase } from "../lib/maj40.js";

// drawn on request: the address depends on where the site runs (the production address when set, else the one asked for)
export const dynamic = "force-dynamic";

export default async function robots() {
  const h = await headers();
  const base = siteBase(process.env.VERCEL_PROJECT_PRODUCTION_URL, h.get("x-forwarded-host") || h.get("host"), h.get("x-forwarded-proto"));
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/overlay"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
