import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { PhoneHeader, BackButton } from "@/components/shell/phone-header";
import { LEGAL } from "@/content/legal";

export function generateStaticParams() {
  return [{ doc: "terms" }, { doc: "privacy" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  const t = await getTranslations({ locale, namespace: "ui.legal" });
  return { title: doc === "privacy" ? t("privacyTitle") : t("termsTitle") };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  if (doc !== "terms" && doc !== "privacy") notFound();
  const t = await getTranslations("ui.legal");
  const content = LEGAL[doc];
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(content.updated),
  );

  return (
    <>
      <PhoneHeader leading={<BackButton fallback="/" />} center={<Wordmark />} />
      <div role="tablist" aria-label={t("documents")} className="mt-2 flex gap-6">
        <Link href="/legal/terms" role="tab" aria-selected={doc === "terms"} className="tab-link">
          {t("terms")}
        </Link>
        <Link href="/legal/privacy" role="tab" aria-selected={doc === "privacy"} className="tab-link">
          {t("privacy")}
        </Link>
      </div>
      <h1 className="font-display mt-6 text-[34px] leading-10">
        {doc === "privacy" ? t("privacyTitle") : t("termsTitle")}
      </h1>
      <p className="text-muted mt-1.5 text-[13px]">
        {t("updated", { date: updated, minutes: content.minutes })}
      </p>

      <nav aria-label={t("contents")} className="mt-6">
        <h2 className="text-muted text-[13px]">{t("contents")}</h2>
        <ol className="mt-1">
          {content.sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-foreground hover:text-accent flex h-11 items-center gap-3 text-[15px]"
              >
                <span className="text-muted w-4">{i + 1}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="legal mt-1 max-w-[640px]">
        {content.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </>
  );
}
