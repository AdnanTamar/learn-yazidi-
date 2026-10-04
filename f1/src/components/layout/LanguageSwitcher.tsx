"use client";
import { useI18n, type Lang } from "@/i18n";
import { Flag } from "@/components/ui/Media";

const OPTIONS: { lang: Lang; code: string; label: string }[] = [
  { lang: "en", code: "GB", label: "English" },
  { lang: "nl", code: "NL", label: "Nederlands" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t("common.language")} className="flex items-center gap-0.5 rounded-full border border-white/12 bg-white/[.05] p-0.5">
      {OPTIONS.map((o) => {
        const on = lang === o.lang;
        return (
          <button
            key={o.lang}
            onClick={() => setLang(o.lang)}
            aria-pressed={on}
            lang={o.lang}
            title={o.label}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
          >
            <Flag code={o.code} size={20} className="!h-3" />
            <span className={compact ? "sr-only" : "hidden sm:inline"}>{o.label}</span>
            <span className="sm:hidden" aria-hidden>{o.lang.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
