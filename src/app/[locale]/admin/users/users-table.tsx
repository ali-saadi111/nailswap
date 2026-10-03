"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Avatar, FilterToggle } from "@/components/ui/primitives";
import { fmtDay, prettyPhone } from "@/lib/format";

interface Row {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  isAdmin: boolean;
  locale: string;
  createdAt: string;
  roles: string[];
  bookings: number;
}

export function UsersTable({ rows }: { rows: Row[] }) {
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<"all" | "salon" | "client" | "admin">("all");
  const list = rows.filter((r) => {
    if (kind === "salon" && !r.roles.length) return false;
    if (kind === "client" && (r.roles.length || r.isAdmin)) return false;
    if (kind === "admin" && !r.isAdmin) return false;
    return !q || `${r.name ?? ""} ${r.phone ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <PageHeader
        context={ta("usersTotal", { count: rows.length })}
        title={ta("users")}
        actions={
          <label className="relative inline-flex items-center">
            <Search className="text-muted pointer-events-none absolute start-0 size-5" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ta("searchSalonsUsers")}
              className="field h-11 w-72 ps-7 text-base"
              aria-label={tc("search")}
            />
          </label>
        }
      />
      <div className="flex flex-wrap gap-x-6">
        {(["all", "client", "salon", "admin"] as const).map((k) => (
          <FilterToggle key={k} pressed={kind === k} onClick={() => setKind(k)}>
            {k === "all" ? tc("all") : ta(`user_${k}` as never)}
          </FilterToggle>
        ))}
      </div>
      <div className="mt-2 overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="table-head grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_minmax(200px,1.3fr)_90px_70px_110px]">
            <span>{ta("user")}</span>
            <span>{tc("phone")}</span>
            <span>{ta("rolesCol")}</span>
            <span>{ta("bookingsCol")}</span>
            <span>{tc("language")}</span>
            <span>{ta("joined")}</span>
          </div>
          {list.map((r) => (
            <div
              key={r.id}
              className="table-row h-auto min-h-16 grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_minmax(200px,1.3fr)_90px_70px_110px] py-2"
            >
              <span className="flex items-center gap-3">
                <Avatar name={r.name ?? r.phone ?? "?"} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{r.name ?? "–"}</span>
                  {r.email && <span className="text-muted block truncate text-[13px]">{r.email}</span>}
                </span>
              </span>
              <span dir="ltr">{r.phone ? prettyPhone(r.phone) : "–"}</span>
              <span className="text-muted truncate text-[13px]">
                {r.isAdmin ? ta("platformAdmin") : r.roles.join(", ") || ta("user_client")}
              </span>
              <span className="tabular-nums">{r.bookings}</span>
              <span className="uppercase">{r.locale}</span>
              <span className="text-muted" dir="ltr">
                {fmtDay(r.createdAt, locale, undefined, { day: "numeric", month: "short", year: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
