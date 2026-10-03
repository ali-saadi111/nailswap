import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/shell/wordmark";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("ui.errors");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 py-4">
      <Wordmark />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-[34px] leading-tight">{t("notFoundTitle")}</h1>
        <p className="text-muted mt-2 text-[15px]">{t("notFoundBody")}</p>
        <ButtonLink href="/" size="lg" className="mt-8">
          {t("goHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
