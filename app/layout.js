import { cookies, headers } from "next/headers";
import "./globals.css";
import { LANG_COOKIE, isRtl, makeT, normLang } from "../lib/i18n.js";
import { THEME_SCRIPT } from "../lib/theme.js";
import { periodOf } from "../lib/period.js";
import KeyHelp from "../components/KeyHelp";
import LogoContrast from "../components/LogoContrast";
import { Barlow, Barlow_Condensed } from "next/font/google";

// the site's fonts, served by the site itself (fetched once at build time): no request to Google on each page
const barlow = Barlow({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], display: "swap", variable: "--ff-barlow" });
const barlowCond = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin", "latin-ext"], display: "swap", variable: "--ff-barlow-cond" });
import { isAdmin } from "../lib/session.js";
import EditorAccess from "../components/EditorAccess";
import MatchAlerts from "../components/MatchAlerts";
import AccountSync from "../components/AccountSync";
import MobileTabs from "../components/MobileTabs";
import { LangProvider } from "../components/lang.jsx";
import { ResultToast, TeamTheme } from "../components/visual.jsx";
import { SiteBanner } from "../components/Round6Bits.jsx";
import { HEAD_SCRIPT, OFFLINE_SCRIPT } from "../lib/headscripts.js";
import { CommandPalette } from "../components/Round8Bits.jsx";
import { SiteFooter } from "../components/Round9.jsx";
import { BackToTop } from "../components/Round14.jsx";
import { CloseAlerts } from "../components/LiveMore.jsx";
import { Motion } from "../components/Round22.jsx";
import { MatchNightTheme } from "../components/Season17.jsx";
import { LiveTeamBanner, Welcome } from "../components/Round11.jsx";
import { getDb } from "../lib/db.js";
import { shownApercu } from "../lib/apercu.js";
import UpdateNotice from "../components/UpdateNotice.jsx";
import { activeBanner } from "../lib/round6.js";

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
  // themeColor: set by THEME_SCRIPT (lib/theme.js), which knows the chosen theme
};

export default async function RootLayout({ children }) {
  const jar = await cookies();
  const lang = normLang(jar.get(LANG_COOKIE)?.value);
  let banner = null;
  let welcomeTeams = [];
  try { const { getState } = await import("../lib/db.js"); welcomeTeams = (getState(getDb()).kickoff.teams || []).filter((t) => t && t.name).map((t) => ({ name: t.name, logo: t.logo || "", tag: t.tag || "" })); } catch { /* none */ }
  try { banner = activeBanner(getDb()); } catch { /* no database yet: no banner */ }
  const admin = await isAdmin();
  // the new things this visitor sees: all of them for an editor (preview), those opened to everyone otherwise
  let ft = [];
  try { ft = shownApercu(getDb(), admin); } catch { /* no database yet: none */ }
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} data-period={periodOf()} data-ft={ft.join(" ")} className={`${barlow.variable} ${barlowCond.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + ";" + HEAD_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#content">{makeT(lang)("Go to the content")}</a>
        {banner && <LangProvider lang={lang}><SiteBanner banner={banner} /></LangProvider>}
        <LangProvider lang={lang}><LiveTeamBanner /><Welcome teams={welcomeTeams} /></LangProvider>
        <div id="content" tabIndex={-1}>{children}</div>
        <LangProvider lang={lang}><SiteFooter /><BackToTop /></LangProvider>
        <EditorAccess lang={lang} isAdmin={admin} />
        {admin && <LangProvider lang={lang}><UpdateNotice /></LangProvider>}
        <MatchAlerts />
        <LangProvider lang={lang}><MobileTabs /><ResultToast /><CloseAlerts /><Motion /><MatchNightTheme /><TeamTheme /><CommandPalette /><KeyHelp /><LogoContrast /></LangProvider>
        <AccountSync />
        <script dangerouslySetInnerHTML={{ __html: OFFLINE_SCRIPT }} />
      </body>
    </html>
  );
}
