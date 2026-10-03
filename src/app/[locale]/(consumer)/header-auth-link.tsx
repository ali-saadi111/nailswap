"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useMe } from "@/lib/client/use-me";

/** "Sign in" link, or the user's first name once the session is known. */
export function HeaderAuthLink() {
  const t = useTranslations("common");
  const { user } = useMe();
  if (user) {
    return (
      <Link
        href="/account"
        className="text-accent hover:text-foreground min-h-11 text-[15px] leading-[44px] font-medium"
      >
        {user.fullName?.split(" ")[0] ?? t("myAccount")}
      </Link>
    );
  }
  return (
    <Link
      href="/login"
      className="text-accent hover:text-foreground min-h-11 text-[15px] leading-[44px] font-medium"
    >
      {t("signIn")}
    </Link>
  );
}
