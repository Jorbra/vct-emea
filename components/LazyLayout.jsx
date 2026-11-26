"use client";
// The layout's helpers that show nothing until the visitor does something or a match event comes (the Ctrl+K palette, the
// "?" help, the first visit's welcome, the alerts and toasts, the editors' update note): loaded after the page, in pieces of
// their own, instead of weighing on every page's first load.
import dynamic from "next/dynamic";

export const LazyCommandPalette = dynamic(() => import("./Round8Bits.jsx").then((m) => m.CommandPalette), { ssr: false });
export const LazyKeyHelp = dynamic(() => import("./KeyHelp.jsx"), { ssr: false });
export const LazyWelcome = dynamic(() => import("./Round11.jsx").then((m) => m.Welcome), { ssr: false });
export const LazyLiveTeamBanner = dynamic(() => import("./Round11.jsx").then((m) => m.LiveTeamBanner), { ssr: false });
export const LazyCloseAlerts = dynamic(() => import("./LiveMore.jsx").then((m) => m.CloseAlerts), { ssr: false });
export const LazyResultToast = dynamic(() => import("./visual.jsx").then((m) => m.ResultToast), { ssr: false });
export const LazyMatchAlerts = dynamic(() => import("./MatchAlerts.jsx"), { ssr: false });
export const LazyUpdateNotice = dynamic(() => import("./UpdateNotice.jsx"), { ssr: false });
export const LazyMatchNightTheme = dynamic(() => import("./Season17.jsx").then((m) => m.MatchNightTheme), { ssr: false });
