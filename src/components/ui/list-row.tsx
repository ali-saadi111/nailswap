import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type LinkHref = React.ComponentProps<typeof Link>["href"];

/**
 * List row (DESIGN.md §4): leading avatar/nails · title 16/600 · meta 13 muted · trailing value
 * or chevron, separated by a hairline. Renders as a link when `href` is given.
 */
export function ListRow({
  href,
  external,
  onClick,
  leading,
  title,
  meta,
  trailing,
  chevron,
  className,
  minHeight = "min-h-14",
  align = "center",
  children,
}: {
  href?: LinkHref | string;
  external?: boolean;
  onClick?: () => void;
  leading?: React.ReactNode;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  className?: string;
  minHeight?: string;
  align?: "center" | "start";
  children?: React.ReactNode;
}) {
  const cls = cn(
    "border-border flex w-full gap-3.5 border-b py-2 text-start",
    align === "center" ? "items-center" : "items-start",
    minHeight,
    (href || onClick) && "hover:text-accent transition-colors",
    className,
  );
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        {title && <span className="text-foreground block truncate text-[15px] font-semibold">{title}</span>}
        {meta && <span className="text-muted mt-0.5 block text-[13px]">{meta}</span>}
        {children}
      </span>
      {trailing && <span className="text-muted shrink-0 text-[13px]">{trailing}</span>}
      {chevron && (
        <ChevronRight className="text-muted size-[18px] shrink-0 rtl:-scale-x-100" strokeWidth={1.75} />
      )}
    </>
  );
  if (href && (external || (typeof href === "string" && /^https?:/.test(href)))) {
    return (
      <a href={href as string} className={cls} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }
  if (href)
    return (
      <Link href={href as LinkHref} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}
