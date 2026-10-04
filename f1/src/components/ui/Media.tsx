"use client";
import { useEffect, useRef, useState } from "react";
import { flagUrl } from "@/lib/format";
import { regionName } from "@/lib/countries";
import { useI18n } from "@/i18n";
import type { Driver } from "@/types/f1";

const emojiFlag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

/** Flag image (flagcdn) with an emoji fallback if the image cannot load. */
export function Flag({ code, className = "", size = 20 }: { code: string | null; className?: string; size?: 20 | 40 | 80 }) {
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Server-rendered images can fail before hydration, so onError never fires: check once on mount.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true);
  }, []);
  const url = flagUrl(code, size);
  if (!url || !code) return null;
  const name = regionName(code, locale);
  if (failed) return <span role="img" aria-label={name} className={`inline-block leading-none ${className.includes("!h-") ? "text-[1.6em]" : ""}`}>{emojiFlag(code)}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={url} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`inline-block h-[0.95em] w-auto rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,.18)] ${className}`} />
  );
}

/** Driver headshot with an initials fallback (photos come from OpenF1 and may be missing or blocked). */
export function DriverPhoto({ driver, className = "", priority = false }: { driver: Pick<Driver, "name" | "photo" | "color" | "code">; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = driver.code || driver.name.split(" ").map((p) => p[0]).join("");
  return (
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative"} overflow-hidden [container-type:size] ${className}`} style={{ background: `linear-gradient(160deg, ${driver.color}55, ${driver.color}0d 70%)` }}>
      {driver.photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={driver.photo}
          alt={driver.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="racing-num text-white/70" style={{ fontSize: "min(30cqw, 40cqh)" }}>{initials}</span>
        </div>
      )}
    </div>
  );
}

/** Team mark: a monogram badge in the team colour (no trademarked logos are bundled). */
export function TeamMark({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  const letters = name.replace(/\b(F1 Team|Racing)\b/gi, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl font-black italic text-white ${className}`} style={{ background: `linear-gradient(145deg, ${color}, ${color}88)`, boxShadow: `0 6px 20px -8px ${color}` }}>
      <span className="display text-[1.05em] leading-none drop-shadow">{letters}</span>
    </span>
  );
}
