"use client";
import { useI18n } from "@/i18n";
import { ErrorState } from "@/components/ui/Resource";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return <div className="mx-auto max-w-lg py-10"><ErrorState message={t("err.generic")} detail={error.message} onRetry={reset} /></div>;
}
