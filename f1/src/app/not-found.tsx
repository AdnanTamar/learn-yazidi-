"use client";
import { useI18n } from "@/i18n";
import { ErrorState } from "@/components/ui/Resource";
import { MagneticLink } from "@/components/ui/Magnetic";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg py-10">
      <ErrorState message={t("err.notFound")} detail="404" />
      <div className="mt-5 text-center"><MagneticLink href="/" variant="primary">{t("nav.home")}</MagneticLink></div>
    </div>
  );
}
