"use client";

import { useEffect, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { accountName, applyAccount, deviceFavorites, deviceToken, forgetAccount } from "./account.js";

async function post(body) {
  const r = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

/** Create an account or sign in: the same form, with one word of difference. */
function Door({ onIn }) {
  const tr = useT();
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  async function send(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const theme = document.documentElement.dataset.theme;
      const j = await post({ action: mode, name, password, token: deviceToken(), favorites: deviceFavorites(), prefs: { lang: tr.lang, ...(theme ? { theme } : {}) } });
      applyAccount(j.account);
      setPassword("");
      onIn(j.account.name);
    } catch (x) {
      setErr(tr.server(x.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="acctbox">
      <div className="tabs sub" role="tablist" aria-label={tr("My account")}>
        <button type="button" role="tab" aria-selected={signup} onClick={() => { setMode("signup"); setErr(""); }}>{tr("Create an account")}</button>
        <button type="button" role="tab" aria-selected={!signup} onClick={() => { setMode("login"); setErr(""); }}>{tr("Log in")}</button>
      </div>
      <form onSubmit={send} className="acctform">
        <label className="f">{tr("Your name")}
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={20} />
        </label>
        <label className="f">{tr("Password")}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : 1} maxLength={200} />
        </label>
        {signup && <p className="hint">{tr("3 to 20 letters or numbers for the name, at least 8 characters for the password. No e-mail is asked: remember your password. If you lose it, ask the site's editors for a new one.")}</p>}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn pri" type="submit" disabled={busy}>{signup ? tr("Create my account") : tr("Log in")}</button>
      </form>
    </section>
  );
}

function Inside({ name, onOut }) {
  const tr = useT();
  const [pw, setPw] = useState({ password: "", next: "" });
  const [note, setNote] = useState({ ok: true, text: "" });
  const [del, setDel] = useState("");
  const [delErr, setDelErr] = useState("");
  const say = (ok, text) => setNote({ ok, text });
  async function logout() {
    await post({ action: "logout" }).catch(() => { /* the mark goes anyway */ });
    forgetAccount();
    onOut();
  }
  async function change(e) {
    e.preventDefault();
    try {
      const j = await post({ action: "password", ...pw });
      say(true, tr.server(j.message));
      setPw({ password: "", next: "" });
    } catch (x) {
      say(false, tr.server(x.message));
    }
  }
  async function remove(e) {
    e.preventDefault();
    setDelErr("");
    try {
      await post({ action: "delete", password: del });
      forgetAccount();
      onOut();
    } catch (x) {
      setDelErr(tr.server(x.message));
    }
  }
  return (
    <>
      <section className="acctbox">
        <h2>{tr("Hello {name}", { name })}</h2>
        <p>{tr("On every device where you sign in, you find:")}</p>
        <ul>
          <li>{tr("your favorite teams")}</li>
          <li>{tr("your predictions")}</li>
          <li>{tr("your language, theme and countdown choice")}</li>
        </ul>
        <p className="hint">{tr("Match alerts are turned on device by device, since each one asks for its own permission. They follow your favorite teams.")}</p>
        <button type="button" className="btn" onClick={logout}>{tr("Log out")}</button>
      </section>
      <section className="acctbox">
        <h2>{tr("Change my password")}</h2>
        <form onSubmit={change} className="acctform">
          <label className="f">{tr("Current password")}<input type="password" autoComplete="current-password" required value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
          <label className="f">{tr("New password")}<input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          <p className="hint">{tr("Your other devices will be signed out.")}</p>
          {note.text && <p className={note.ok ? "hint" : "err"} role="status">{note.text}</p>}
          <button className="btn" type="submit">{tr("Change my password")}</button>
        </form>
      </section>
      <section className="acctbox">
        <details>
          <summary><b>{tr("Delete my account")}</b></summary>
          <p className="hint">{tr("Your account, favorite teams kept on the site and predictions are removed for good.")}</p>
          <form onSubmit={remove} className="acctform">
            <label className="f">{tr("Current password")}<input type="password" autoComplete="current-password" required value={del} onChange={(e) => setDel(e.target.value)} /></label>
            {delErr && <p className="err" role="alert">{delErr}</p>}
            <button className="btn danger" type="submit">{tr("Delete my account")}</button>
          </form>
        </details>
      </section>
    </>
  );
}

function View() {
  const tr = useT();
  const [name, setName] = useState(null); // known once in the browser
  useEffect(() => {
    setName(accountName());
    const sync = () => setName(accountName());
    window.addEventListener("vct-account", sync);
    return () => window.removeEventListener("vct-account", sync);
  }, []);
  return (
    <div className="wrap acct">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("My account")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      {name === null ? null : name ? <Inside name={name} onOut={() => setName("")} /> : (
        <>
          <p className="note">{tr("An account is optional. It lets you find your favorite teams, predictions and settings on all your devices.")}</p>
          <Door onIn={setName} />
        </>
      )}
    </div>
  );
}

export default function AccountPage({ lang }) {
  return <LangProvider lang={lang}><View /></LangProvider>;
}
