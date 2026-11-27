"use client";

// The bot's dashboard on its own page (/admin/bot): the whole width, a side menu, each page with its address.
import BotPanel from "./BotPanel.jsx";
import { LangProvider } from "./lang.jsx";
import UnsavedGuard from "./UnsavedGuard.jsx";

export default function BotFull({ lang }) {
  return (
    <LangProvider lang={lang}>
      <UnsavedGuard>
        <div className="botfull">
          <header className="botfullhead">
            <a className="btn small" href="/admin">‹ Éditeur</a>
            <h1><span aria-hidden="true">🤖</span> Bot Discord</h1>
          </header>
          <BotPanel full />
        </div>
      </UnsavedGuard>
    </LangProvider>
  );
}
