import { cookies, headers } from "next/headers";
import "./globals.css";
import { LANG_COOKIE, WITH_PAGE, isRtl, makeT, normLang } from "../lib/i18n.js";
import { AR as AR_WORDS, TR as TR_WORDS } from "../lib/i18n-more.js";
import { THEME_SCRIPT } from "../lib/theme.js";
import { periodOf } from "../lib/period.js";
import LogoContrast from "../components/LogoContrast";
import { Barlow, Barlow_Condensed } from "next/font/google";

// the site's fonts, served by the site itself (fetched once at build time): no request to Google on each page
const barlow = Barlow({ weight: ["400", "500", "600"], subsets: ["latin", "latin-ext"], display: "swap", variable: "--ff-barlow" });
const barlowCond = Barlow_Condensed({ weight: ["600", "700", "800"], subsets: ["latin", "latin-ext"], display: "swap", variable: "--ff-barlow-cond" });
import { isAdmin } from "../lib/session.js";
import EditorAccess from "../components/EditorAccess";
import AccountSync from "../components/AccountSync";
import MobileTabs from "../components/MobileTabs";
import { LangProvider } from "../components/lang.jsx";
import { TeamTheme } from "../components/visual.jsx";
import { SiteBanner } from "../components/Round6Bits.jsx";
import { HEAD_SCRIPT, OFFLINE_SCRIPT } from "../lib/headscripts.js";
import { SiteFooter } from "../components/Round9.jsx";
import { BackToTop } from "../components/Round14.jsx";
import { Motion } from "../components/Round22.jsx";
import { getDb } from "../lib/db.js";
import { shownApercu } from "../lib/apercu.js";
import { LazyCloseAlerts, LazyCommandPalette, LazyKeyHelp, LazyLiveTeamBanner, LazyMatchAlerts, LazyMatchNightTheme, LazyResultToast, LazyUpdateNotice, LazyWelcome } from "../components/LazyLayout.jsx";
import ScoreFlash from "../components/ScoreFlash.jsx";
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
  // an editor who asked to see the site as a visitor (editor, "New things in preview") gets only what is open to everyone
  const asVisitor = jar.get("vct-visitor-view")?.value === "1";
  try { ft = shownApercu(getDb(), admin && !asVisitor); } catch { /* no database yet: none */ }
  return (
    <html lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} data-period={periodOf()} data-ft={ft.join(" ")} className={`${barlow.variable} ${barlowCond.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + ";" + HEAD_SCRIPT }} />
        {/* Turkish or Arabic: their words come with the page, before the scripts read them (lib/i18n-extra-browser.js) */}
        {WITH_PAGE.includes(lang) && <script dangerouslySetInnerHTML={{ __html: `window.__vctDict=${JSON.stringify({ lang, d: lang === "tr" ? TR_WORDS : AR_WORDS }).replace(/</g, "\\u003c")};` }} />}
      </head>
      <body>
        <a className="skip" href="#content">{makeT(lang)("Go to the content")}</a>
        {banner && <LangProvider lang={lang}><SiteBanner banner={banner} /></LangProvider>}
        <LangProvider lang={lang}><LazyLiveTeamBanner /><LazyWelcome teams={welcomeTeams} /></LangProvider>
        <div id="content" tabIndex={-1}>{children}</div>
        <LangProvider lang={lang}><SiteFooter /><BackToTop /></LangProvider>
        <EditorAccess lang={lang} isAdmin={admin} />
        {admin && <LangProvider lang={lang}><LazyUpdateNotice /></LangProvider>}
        <LazyMatchAlerts />
        <LangProvider lang={lang}><MobileTabs /><LazyResultToast /><LazyCloseAlerts /><Motion /><LazyMatchNightTheme /><TeamTheme /><LazyCommandPalette /><LazyKeyHelp /><LogoContrast /></LangProvider>
        <ScoreFlash />
        <AccountSync />
        <script dangerouslySetInnerHTML={{ __html: OFFLINE_SCRIPT }} />
      </body>
    </html>
  );
}
