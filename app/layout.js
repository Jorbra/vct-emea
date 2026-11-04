import { cookies, headers } from "next/headers";
import "./globals.css";
import { LANG_COOKIE, isRtl, makeT, normLang } from "../lib/i18n.js";
import { THEME_COOKIE, normTheme } from "../lib/theme.js";
import { isAdmin } from "../lib/session.js";
import EditorAccess from "../components/EditorAccess";
import MatchAlerts from "../components/MatchAlerts";

export async function generateMetadata() {
  // the site's own address, so that links shared on Discord or X can show its picture
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const description = "Résultats, tableaux, programme et équipes du VCT EMEA et des Game Changers EMEA.";
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: "VCT EMEA",
    description,
    icons: { icon: "/brand/emea-icon.png", apple: "/brand/icon-192.png" }, // browser tab, phone home screen
    openGraph: { siteName: "VCT EMEA", type: "website", title: "VCT EMEA", description, images: [{ url: "/brand/emea-kickoff.png" }] },
    twitter: { card: "summary", title: "VCT EMEA", description, images: ["/brand/emea-kickoff.png"] },
  };
}

export const viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#121212" }, { media: "(prefers-color-scheme: light)", color: "#f5f4f2" }],
};

export default async function RootLayout({ children }) {
  const jar = await cookies();
  const lang = normLang(jar.get(LANG_COOKIE)?.value);
  const theme = normTheme(jar.get(THEME_COOKIE)?.value);
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700;800&display=swap"
        />
      </head>
      <body>
        <a className="skip" href="#content">{makeT(lang)("Go to the content")}</a>
        <div id="content" tabIndex={-1}>{children}</div>
        <EditorAccess lang={lang} isAdmin={await isAdmin()} />
        <MatchAlerts />
      </body>
    </html>
  );
}
