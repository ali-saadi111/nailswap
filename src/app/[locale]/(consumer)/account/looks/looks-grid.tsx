"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { NailGroup, fillForDesign } from "@/components/nails/nail";
import { api } from "@/lib/client/api";
import { fmtDay } from "@/lib/format";

export interface SavedLook {
  id: string;
  title: string | null;
  imageUrl: string | null;
  createdAt: string;
  jobId: string | null;
  shape: string;
  kind: "ai" | "ar";
  salon: { id: string; slug: string; name: string } | null;
  design: { id: string; name: string; category: string; coverUrl: string | null } | null;
  polish: { id: string; shadeName: string; hexColor: string } | null;
}

export function LooksGrid({ initial }: { initial: SavedLook[] }) {
  const t = useTranslations("ui.account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [looks, setLooks] = React.useState(initial);

  async function remove(id: string) {
    const prev = looks;
    setLooks((l) => l.filter((x) => x.id !== id));
    try {
      await api.del(`/api/account/looks/${id}`);
      toast.success(t("removed"));
    } catch {
      setLooks(prev);
      toast.error(tc("somethingWrong"));
    }
  }

  return (
    <>
      <header className="flex h-[52px] items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-[34px] leading-none">{t("looksTitle")}</h1>
          <span className="text-muted text-sm">{t("looksCount", { count: looks.length })}</span>
        </div>
        <IconLink href="/try" aria-label={t("createLook")} className="-me-3">
          <Plus />
        </IconLink>
      </header>

      {looks.length === 0 ? (
        <EmptyState
          title={t("noLooks")}
          description={t("noLooksBody")}
          action={
            <Link
              href="/try"
              className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
            >
              <Plus className="size-5" strokeWidth={1.75} />
              {t("createLook")}
            </Link>
          }
        />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-3">
          {looks.map((l) => {
            const fill = l.design
              ? fillForDesign({ category: l.design.category, coverUrl: l.design.coverUrl })
              : l.polish?.hexColor;
            const name = l.title ?? l.design?.name ?? l.polish?.shadeName ?? t("looksTitle");
            const bookHref = l.salon
              ? `/s/${l.salon.slug}/book?${l.design ? `designId=${l.design.id}&` : ""}${l.jobId ? `tryonJobId=${l.jobId}` : ""}`
              : null;
            return (
              <div key={l.id} className="min-w-0">
                {l.imageUrl ? (
                  <Link
                    href={l.jobId && l.salon ? `/s/${l.salon.slug}/try?jobId=${l.jobId}` : "/try"}
                    className="rounded-media bg-surface-2 block aspect-[4/5] overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.imageUrl} alt={name} className="size-full object-cover" />
                  </Link>
                ) : (
                  <NailGroup shape={l.shape} fill={fill} count={4} size={22} gap={6} className="h-9" />
                )}
                <div className="mt-3 truncate text-[15px] leading-5 font-medium">{name}</div>
                <div className="text-muted mt-0.5 truncate text-[13px]">
                  {[
                    l.salon?.name,
                    fmtDay(l.createdAt, locale, "Asia/Beirut", { day: "numeric", month: "short" }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => remove(l.id)}
                    className="text-muted hover:text-danger min-h-11 text-[12px]"
                  >
                    {t("remove")}
                  </button>
                  {bookHref && (
                    <Link
                      href={bookHref}
                      className="text-accent hover:text-foreground min-h-11 text-sm leading-[44px] font-medium"
                      aria-label={`${t("book")} ${name}`}
                    >
                      {t("book")}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {looks.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/try"
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <Plus className="size-5" strokeWidth={1.75} />
            {t("createLook")}
          </Link>
          <span className="text-muted text-[13px]">{t("liveOrAi")}</span>
        </div>
      )}
    </>
  );
}
