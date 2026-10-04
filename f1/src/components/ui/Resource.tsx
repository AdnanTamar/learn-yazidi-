"use client";
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useI18n, type Key } from "@/i18n";
import { MagneticButton } from "./Magnetic";
import { fmtClock } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { Meta } from "@/types/f1";

export function ErrorState({ message, detail, onRetry, compact }: { message: string; detail?: string; onRetry?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={`glass flex flex-col items-center text-center ${compact ? "gap-2 p-6" : "gap-3 p-10"}`}>
      <AlertTriangle className="h-7 w-7 text-amber-400" aria-hidden />
      <p className="text-lg font-semibold">{message}</p>
      <p className="max-w-md text-sm text-white/60">{detail ?? t("err.detail")}</p>
      {onRetry && (
        <MagneticButton variant="primary" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-4 w-4" aria-hidden /> {t("common.retry")}
        </MagneticButton>
      )}
    </div>
  );
}

/** Banner for payloads served from the server's last-good cache, or from the dev mock provider. */
export function DataNotice({ meta }: { meta?: Meta }) {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  if (!meta || (!meta.stale && meta.source !== "mock")) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs">
      {meta.source === "mock" && (
        <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sky-200">{t("data.demo")}</span>
      )}
      {meta.stale && (
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-200">
          {t("data.stale")} · {t("data.asOf")} {meta.asOf ? fmtClock(meta.asOf, { locale, ...settings }) : ""}
        </span>
      )}
    </div>
  );
}

interface SWRLike<T> {
  data?: T;
  error?: unknown;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => unknown;
}

/**
 * Standard loading / error / reconnecting handling for a data hook.
 * Never renders a blank page: skeleton while loading, retry card on failure,
 * and keeps the last data visible (with a reconnect notice) when a refresh fails.
 */
export function Resource<T extends { meta?: Meta }>({
  query, loading, errorKey = "err.championship", quiet = false, children,
}: { query: SWRLike<T>; quiet?: boolean; loading: ReactNode; errorKey?: Key; children: (data: T) => ReactNode }) {
  const { t } = useI18n();
  if (!query.data) {
    if (query.error) return <ErrorState message={t(errorKey)} onRetry={() => query.mutate()} />;
    return <>{loading}</>;
  }
  return (
    <>
      {query.error ? (
        <div role="status" className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> {t("err.reconnect")}
        </div>
      ) : null}
      {!quiet && <DataNotice meta={query.data.meta} />}
      {children(query.data)}
    </>
  );
}
