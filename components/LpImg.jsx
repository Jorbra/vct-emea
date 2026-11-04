"use client";

import { useState } from "react";

/** A logo from Liquipedia, kept by this site; nothing when it is missing or does not load. */
export default function LpImg({ f, dark = "", alt = "" }) {
  const [broken, setBroken] = useState(false);
  if (!f || broken) return <span className="lpimg none" aria-hidden="true" />;
  const url = (x) => `/api/lp-img?f=${encodeURIComponent(x)}`;
  // two logos when Liquipedia has one per theme: the stylesheet shows the right one
  /* eslint-disable @next/next/no-img-element */
  return dark && dark !== f ? (
    <>
      <img className="lpimg forlight" src={url(f)} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      <img className="lpimg fordark" src={url(dark)} alt={alt} loading="lazy" onError={() => setBroken(true)} />
    </>
  ) : <img className="lpimg" src={url(f)} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  /* eslint-enable @next/next/no-img-element */
}
