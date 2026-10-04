"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Settings {
  motion: boolean;
  clock24: boolean;
  utc: boolean;
}
const DEFAULTS: Settings = { motion: true, clock24: true, utc: false };
const Ctx = createContext<{ settings: Settings; update: (p: Partial<Settings>) => void } | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("settings");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setSettings({ ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}), ...(reduced ? { motion: false } : {}) });
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion ? "on" : "off";
  }, [settings.motion]);

  const update = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...p };
      try {
        localStorage.setItem("settings", JSON.stringify(n));
      } catch {}
      return n;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSettings must be used within SettingsProvider");
  return c;
}
