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
      <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="font-display text-[34px] leading-tight">{t("looksTitle")}</h1>
          <span className="text-muted text-sm">{t("looksCount", { count: looks.length })}</span>
        </div>
        <IconLink
          href="/try"
          aria-label={t("createLook")}
          className="bg-accent text-accent-contrast hover:text-accent-contrast rounded-full"
        >
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
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {looks.map((l) => {
            const fill = l.design
              ? fillForDesign({ category: l.design.category, coverUrl: l.design.coverUrl })
              : l.polish?.hexColor;
            const name = l.title ?? l.design?.name ?? l.polish?.shadeName ?? t("looksTitle");
            const bookHref = l.salon
              ? `/s/${l.salon.slug}/book?${l.design ? `designId=${l.design.id}&` : ""}${l.jobId ? `tryonJobId=${l.jobId}` : ""}`
              : null;
            return (
              <div key={l.id} className="bg-surface min-w-0 rounded-[26px] p-2 pb-1">
                {l.imageUrl ? (
                  <Link
                    href={l.jobId && l.salon ? `/s/${l.salon.slug}/try?jobId=${l.jobId}` : "/try"}
                    className="bg-latte block aspect-[4/5] overflow-hidden rounded-[20px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.imageUrl} alt={name} className="size-full object-cover" />
                  </Link>
                ) : (
                  <span className="bg-hero flex aspect-[4/5] items-end justify-center rounded-[20px] pb-8">
                    <NailGroup shape={l.shape} fill={fill} count={4} size={22} gap={6} />
                  </span>
                )}
                <div className="mt-2.5 truncate px-1.5 text-[15px] leading-5 font-extrabold">{name}</div>
                <div className="text-muted mt-0.5 truncate px-1.5 text-[13px] font-semibold">
                  {[
                    l.salon?.name,
                    fmtDay(l.createdAt, locale, "Asia/Beirut", { day: "numeric", month: "short" }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex items-center justify-between px-1.5">
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
                      className="text-accent hover:text-foreground min-h-11 text-sm leading-[44px] font-extrabold"
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
