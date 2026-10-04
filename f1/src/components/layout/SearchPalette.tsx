"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Flag as FlagIcon, MapPin, Search, Shield, User, Globe2, CornerDownLeft } from "lucide-react";
import { useI18n, type Key } from "@/i18n";
import { useOverview } from "@/hooks/useF1";
import { regionName } from "@/lib/countries";
import { gpName } from "@/lib/format";

type Kind = "drivers" | "teams" | "circuits" | "races" | "countries";
interface Item { kind: Kind; id: string; label: string; sub?: string; href: string; hay: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ICONS = { drivers: User, teams: Shield, circuits: MapPin, races: FlagIcon, countries: Globe2 };

export function SearchButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button onClick={onClick} aria-label={t("search.open")} className="flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[.05] px-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden xl:inline text-white/50">{t("nav.search")}</span>
      <kbd className="hidden rounded border border-white/15 px-1.5 text-[0.65rem] text-white/50 xl:inline">⌘K</kbd>
    </button>
  );
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, locale } = useI18n();
  const { data } = useOverview();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const out: Item[] = [];
    for (const d of data.drivers) out.push({ kind: "drivers", id: d.id, label: d.name, sub: d.teamName ?? d.nationality, href: `/drivers/${d.id}`, hay: norm(`${d.name} ${d.code} ${d.number ?? ""} ${d.nationality}`) });
    for (const tm of data.teams) out.push({ kind: "teams", id: tm.id, label: tm.name, sub: tm.nationality, href: `/teams/${tm.id}`, hay: norm(tm.name) });
    const seen = new Set<string>();
    for (const r of data.calendar) {
      const name = gpName(r, lang, locale);
      out.push({ kind: "races", id: `r${r.round}`, label: name, sub: `R${r.round} · ${r.circuitName}`, href: `/races/${r.round}`, hay: norm(`${r.name} ${name} ${r.locality} ${r.country}`) });
      out.push({ kind: "circuits", id: `c${r.circuitId}`, label: r.circuitName, sub: `${r.locality}, ${regionName(r.countryCode, locale, r.country)}`, href: `/races/${r.round}`, hay: norm(`${r.circuitName} ${r.locality}`) });
      if (r.countryCode && !seen.has(r.countryCode)) {
        seen.add(r.countryCode);
        const cn = regionName(r.countryCode, locale, r.country);
        out.push({ kind: "countries", id: r.countryCode, label: cn, href: `/calendar?q=${encodeURIComponent(cn)}`, hay: norm(`${cn} ${r.country}`) });
      }
    }
    return out;
  }, [data, lang, locale]);

  const results = useMemo(() => {
    const s = norm(q.trim());
    if (!s) return [];
    return items
      .map((i) => ({ i, score: i.hay.startsWith(s) ? 0 : i.hay.split(" ").some((w) => w.startsWith(s)) ? 1 : i.hay.includes(s) ? 2 : 9 }))
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score)
      .slice(0, 24)
      .map((x) => x.i);
  }, [q, items]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    if (open) {
      prev.current = document.activeElement as HTMLElement;
      setQ("");
      setTimeout(() => input.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      prev.current?.focus?.();
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const go = (i?: Item) => {
    if (!i) return;
    onClose();
    router.push(i.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((v) => Math.min(results.length - 1, v + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((v) => Math.max(0, v - 1)); }
    else if (e.key === "Enter") go(results[idx]);
  };

  useEffect(() => {
    document.getElementById(`sr-${idx}`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const groups = (["drivers", "teams", "races", "circuits", "countries"] as Kind[]).map((k) => ({ k, rows: results.filter((r) => r.kind === k) })).filter((g) => g.rows.length);
  let n = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={t("nav.search")} onKeyDown={onKey} className="glass w-full max-w-xl overflow-hidden !bg-[#0e1118]/95" initial={{ y: -16, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -10, scale: 0.98, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-5 w-5 text-white/50" aria-hidden />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("nav.search")} role="combobox" aria-expanded aria-controls="search-results" aria-activedescendant={results.length ? `sr-${idx}` : undefined} className="h-14 w-full bg-transparent text-base outline-none placeholder:text-white/35" />
              <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[0.65rem] text-white/50">esc</kbd>
            </div>
            <div id="search-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
              {!q.trim() && <p className="px-3 py-8 text-center text-sm text-white/45">{t("search.hint")}</p>}
              {q.trim() && !results.length && <p className="px-3 py-8 text-center text-sm text-white/55">{t("search.noResults", { q })}</p>}
              {groups.map((g) => (
                <div key={g.k} className="mb-1">
                  <p className="eyebrow px-3 pb-1 pt-3 !text-[0.62rem]">{t(`search.${g.k}` as Key)}</p>
                  {g.rows.map((r) => {
                    n++;
                    const my = n;
                    const Icon = ICONS[r.kind];
                    return (
                      <motion.button layout key={r.kind + r.id} id={`sr-${my}`} role="option" aria-selected={idx === my} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, delay: Math.min(my, 8) * 0.012 }} onMouseEnter={() => setIdx(my)} onClick={() => go(r)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${idx === my ? "bg-white/10" : ""}`}>
                        <Icon className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.label}</span>{r.sub && <span className="block truncate text-xs text-white/50">{r.sub}</span>}</span>
                        {idx === my && <CornerDownLeft className="h-3.5 w-3.5 text-white/40" aria-hidden />}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
