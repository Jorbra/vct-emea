const base = () => `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "vct-emea.vercel.app"}`;

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/overlay"] },
    sitemap: `${base()}/sitemap.xml`,
  };
}
