"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, LOCALES, type Key, type Lang } from "./dictionary";

interface Ctx {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}
const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
      localStorage.setItem("lang", l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // First visit without a cookie: follow the browser language.
  useEffect(() => {
    if (document.cookie.includes("lang=")) return;
    if (navigator.language?.toLowerCase().startsWith("nl")) setLangState("nl");
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = dictionaries[lang];
    return {
      lang,
      locale: LOCALES[lang],
      setLang,
      t: (key, vars) => {
        let s = dict[key] ?? dictionaries.en[key] ?? key;
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
        return s;
      },
    };
  }, [lang, setLang]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useI18n must be used within LanguageProvider");
  return c;
}
export type { Key, Lang };
