"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, CalendarDays, Gauge, GitCompareArrows, Home, MoreHorizontal, Radio, Shield, Trophy, User, ClipboardList, X } from "lucide-react";
import { useI18n, type Key } from "@/i18n";
import { useOverview, useSchedule } from "@/hooks/useF1";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SettingsMenu } from "./SettingsMenu";
import { SearchButton, SearchPalette } from "./SearchPalette";

const ITEMS = [
  { href: "/", key: "nav.home", Icon: Home },
  { href: "/live", key: "nav.live", Icon: Radio },
  { href: "/standings", key: "nav.standings", Icon: Trophy },
  { href: "/drivers", key: "nav.drivers", Icon: User },
  { href: "/teams", key: "nav.teams", Icon: Shield },
  { href: "/calendar", key: "nav.calendar", Icon: CalendarDays },
  { href: "/results", key: "nav.results", Icon: ClipboardList },
  { href: "/statistics", key: "nav.statistics", Icon: BarChart3 },
] as const satisfies readonly { href: string; key: Key; Icon: unknown }[];
const MORE = [...ITEMS.slice(3).filter((i) => i.href !== "/calendar"), { href: "/compare", key: "nav.compare", Icon: GitCompareArrows }] as const;

const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function LiveDot() {
  return <span className="live-dot" aria-hidden />;
}

export function NavigationBar() {
  const { t } = useI18n();
  const path = usePathname();
  const { data } = useOverview();
  const schedule = useSchedule(data?.calendar);
  const live = Boolean(schedule?.liveRace);
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
      else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="glass mx-auto flex h-14 max-w-[1400px] items-center gap-3 !rounded-full px-3 pl-4 sm:h-16 sm:px-4 sm:pl-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Pit Wall – home">
            <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#ff5a3c] to-[#d41e14]">
              <Gauge className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="display hidden text-xl leading-none sm:block">Pit<span className="text-accent">Wall</span></span>
          </Link>

          <nav aria-label={t("nav.menu")} className="ml-3 hidden flex-1 items-center gap-0.5 xl:flex">
            {ITEMS.map(({ href, key }) => {
              const on = active(path, href);
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`relative flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.82rem] font-semibold transition-colors xl:px-3.5 ${on ? "text-white" : "text-white/60 hover:text-white"}`}>
                  {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/[.11]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <span className="relative flex items-center gap-1.5">
                    {href === "/live" && live && <LiveDot />}
                    {t(key)}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {live && (
              <Link href="/live" className="hidden items-center gap-2 rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold tracking-wider text-red-100 sm:flex xl:hidden">
                <LiveDot /> {t("live.badge")}
              </Link>
            )}
            <LanguageSwitcher />
            <SearchButton onClick={() => setSearch(true)} />
            <SettingsMenu />
          </div>
        </div>
      </header>

      {/* mobile / tablet bottom navigation */}
      <nav aria-label={t("nav.menu")} className="fixed inset-x-0 bottom-0 z-50 px-3 safe-bottom xl:hidden">
        <ul className="glass mx-auto grid max-w-md grid-cols-5 !rounded-[28px] p-1.5 !bg-[#0c0e14]/80">
          {[ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[5]].map(({ href, key, Icon }) => {
            const on = active(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 rounded-[22px] py-2 text-[0.66rem] font-semibold ${on ? "bg-white/12 text-white" : "text-white/55"}`}>
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden />
                    {href === "/live" && live && <span className="live-dot absolute -right-1.5 -top-1" aria-hidden />}
                  </span>
                  {t(key)}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} aria-expanded={more} className={`flex w-full flex-col items-center gap-0.5 rounded-[22px] py-2 text-[0.66rem] font-semibold ${MORE.some((m) => active(path, m.href)) ? "bg-white/12 text-white" : "text-white/55"}`}>
              <MoreHorizontal className="h-5 w-5" aria-hidden /> {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div role="dialog" aria-modal="true" aria-label={t("nav.more")} className="glass absolute inset-x-3 bottom-3 p-3 !bg-[#0e1118]/95 safe-bottom" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <p className="eyebrow">{t("nav.more")}</p>
                <button onClick={() => setMore(false)} aria-label={t("common.close")} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" aria-hidden /></button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {MORE.map(({ href, key, Icon }) => (
                  <li key={href}>
                    <Link href={href} className={`flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-semibold ${active(path, href) ? "bg-white/12" : "bg-white/[.04]"}`}>
                      <Icon className="h-5 w-5 text-accent" aria-hidden /> {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchPalette open={search} onClose={() => setSearch(false)} />
    </>
  );
}
