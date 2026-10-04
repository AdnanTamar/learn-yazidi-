"use client";
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-white/[.06]">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-white/50">{hint}</span>}
      </span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function SettingsMenu() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button aria-label={t("nav.settings")} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[.05] text-white/80 transition hover:bg-white/10 hover:text-white">
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label={t("settings.title")} className="glass absolute right-0 top-12 z-50 w-72 p-2 !bg-[#10131a]/95">
          <p className="eyebrow px-3 py-2">{t("settings.title")}</p>
          <Toggle label={t("settings.motion")} hint={t("settings.motionHint")} checked={settings.motion} onChange={(motion) => update({ motion })} />
          <Toggle label={t("settings.clock")} checked={settings.clock24} onChange={(clock24) => update({ clock24 })} />
          <Toggle label={t("settings.tz")} checked={settings.utc} onChange={(utc) => update({ utc })} />
        </div>
      )}
    </div>
  );
}
