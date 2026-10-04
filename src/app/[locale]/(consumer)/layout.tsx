import { setRequestLocale } from "next-intl/server";
import { ConsumerShell } from "@/components/shell/consumer-shell";

export default async function ConsumerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ConsumerShell wide>{children}</ConsumerShell>;
}
