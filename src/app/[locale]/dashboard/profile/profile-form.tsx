"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Salon } from "@/lib/supabase/types";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { LocationPicker } from "@/components/discovery/location-picker";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

type Hours = { weekday: number; open_time: string | null; close_time: string | null; is_closed: boolean };
export function ProfileForm({ salon, initialHours }: { salon: Salon; initialHours: Hours[] }) {
  const t = useTranslations("merchant");
  const common = useTranslations("common");
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [form, setForm] = useState({
    name: salon.name,
    description: salon.description ?? "",
    city: salon.city ?? "",
    area: salon.area ?? "",
    address: salon.address ?? "",
    phone: salon.phone ?? "",
    instagram: salon.instagram ?? "",
    lat: salon.lat?.toString() ?? "",
    lng: salon.lng?.toString() ?? "",
  });
  const [hours, setHours] = useState<Hours[]>(
    [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
      const existing = initialHours.find((h) => h.weekday === weekday);
      return {
        weekday,
        open_time: existing?.open_time?.slice(0, 5) ?? "09:00",
        close_time: existing?.close_time?.slice(0, 5) ?? "18:00",
        is_closed: existing?.is_closed ?? true,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (hours.some((h) => !h.is_closed && (!h.open_time || !h.close_time || h.close_time <= h.open_time)))
      return setError(t("invalidHours"));
    if (Boolean(form.lat.trim()) !== Boolean(form.lng.trim())) return setError(t("coordinatesRequired"));
    const lat = form.lat.trim() ? Number(form.lat) : null;
    const lng = form.lng.trim() ? Number(form.lng) : null;
    if (
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    )
      return setError(t("coordinatesRequired"));
    setBusy(true);
    try {
      const { error: profileError } = await client
        .from("salons")
        .update({ ...form, name: form.name.trim(), lat, lng })
        .eq("id", salon.id);
      if (profileError) throw profileError;
      const { error: hoursError } = await client.from("salon_hours").upsert(
        hours.map((h) => ({
          ...h,
          salon_id: salon.id,
          open_time: h.is_closed ? null : h.open_time,
          close_time: h.is_closed ? null : h.close_time,
        })),
        { onConflict: "salon_id,weekday" },
      );
      if (hoursError) throw hoursError;
      setMessage(t("saved"));
      router.refresh();
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        context={salon.name}
        title={t("profile")}
        actions={
          <Link href={`/s/${salon.slug}`} className="text-accent font-semibold">
            {t("viewPage")}
          </Link>
        }
      />
      <form onSubmit={save} className="mt-6 max-w-3xl space-y-8">
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">{t("about")}</h2>
          <div>
            <Label htmlFor="salon-name">{t("name")}</Label>
            <Input
              id="salon-name"
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="salon-description">{t("description")}</Label>
            <Textarea
              id="salon-description"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {(["phone", "instagram", "city", "area", "address"] as const).map((field) => (
              <div key={field}>
                <Label htmlFor={`profile-${field}`}>{t(field)}</Label>
                <Input
                  id={`profile-${field}`}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-5">
            <h3 className="font-semibold">{t("mapLocation")}</h3>
            <p className="text-muted mt-1 text-sm">{t("coordinatesHint")}</p>
            <LocationPicker
              lat={salon.lat}
              lng={salon.lng}
              label={t("mapLocation")}
              onChange={(lat, lng) =>
                setForm((values) => ({ ...values, lat: String(lat), lng: String(lng) }))
              }
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">{t("coordinates")}</summary>
              <div className="mt-3 grid grid-cols-2 gap-4">
                {(["lat", "lng"] as const).map((field) => (
                  <div key={field}>
                    <Label htmlFor={`location-${field}`}>{t(field)}</Label>
                    <Input
                      id={`location-${field}`}
                      type="number"
                      step="any"
                      min={field === "lat" ? -90 : -180}
                      max={field === "lat" ? 90 : 180}
                      value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t("hours")}</h2>
          <p className="text-muted mt-1 text-sm">{salon.timezone}</p>
          <div className="mt-4 space-y-2">
            {hours.map((h, index) => (
              <div key={h.weekday} className="border-border flex flex-wrap items-center gap-3 border-b py-3">
                <span className="w-24 text-sm font-medium">{common(`weekdays.${h.weekday}` as never)}</span>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!h.is_closed}
                    onChange={(e) =>
                      setHours((values) =>
                        values.map((v, i) => (i === index ? { ...v, is_closed: !e.target.checked } : v)),
                      )
                    }
                  />
                  {t("open")}
                </label>
                {!h.is_closed ? (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${common(`weekdays.${h.weekday}` as never)} ${t("opens")}`}
                      type="time"
                      required
                      value={h.open_time ?? ""}
                      onChange={(e) =>
                        setHours((values) =>
                          values.map((v, i) => (i === index ? { ...v, open_time: e.target.value } : v)),
                        )
                      }
                      className="border-border h-11 rounded-lg border bg-white px-2"
                    />
                    <span>–</span>
                    <input
                      aria-label={`${common(`weekdays.${h.weekday}` as never)} ${t("closes")}`}
                      type="time"
                      required
                      value={h.close_time ?? ""}
                      onChange={(e) =>
                        setHours((values) =>
                          values.map((v, i) => (i === index ? { ...v, close_time: e.target.value } : v)),
                        )
                      }
                      className="border-border h-11 rounded-lg border bg-white px-2"
                    />
                  </div>
                ) : (
                  <span className="text-muted text-sm">{t("closed")}</span>
                )}
              </div>
            ))}
          </div>
        </section>
        <div className="bg-background sticky bottom-0 py-4">
          {error && (
            <p role="alert" className="mb-3 text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="mb-3 text-green-700">
              {message}
            </p>
          )}
          <Button type="submit" loading={busy}>
            {t("save")}
          </Button>
          <Link href="/dashboard/settings" className="text-muted ms-5 text-sm">
            {t("advanced")}
          </Link>
        </div>
      </form>
    </>
  );
}
