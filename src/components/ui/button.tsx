import * as React from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Blush Immersive buttons (design/blush/DESIGN.md §4).
 * - `primary`   rose-clay pill — the main action of a view.
 * - `secondary` soft surface pill (paired with a primary, e.g. "Try on" next to "Book").
 * - `outline`   ink-outlined pill for neutral actions.
 * - `ghost` / `link` / `danger` stay text buttons so dense screens (dashboard tables) keep working.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const pillSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "min-h-14 px-7 py-3 text-base whitespace-normal text-center",
  icon: "size-11",
};

const linkSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 text-sm",
  md: "min-h-11 text-sm",
  lg: "min-h-11 text-[15px]",
  icon: "size-11",
};

const pillTone: Record<"primary" | "secondary" | "outline", string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "bg-surface text-foreground hover:text-accent shadow-sm",
  outline: "bg-transparent text-foreground shadow-[inset_0_0_0_1.5px_var(--foreground)] hover:bg-surface",
};

const linkTone: Record<"ghost" | "danger" | "link", string> = {
  link: "text-accent hover:text-foreground",
  ghost: "text-foreground hover:text-accent",
  danger: "text-danger hover:text-foreground",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap select-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60";
  if (variant === "primary" || variant === "secondary" || variant === "outline") {
    return cn(base, "rounded-full", pillTone[variant], pillSizes[size], className);
  }
  return cn(
    base,
    "gap-1.5 bg-transparent px-0",
    linkTone[variant],
    linkSizes[size],
    size === "icon" && "justify-center",
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

type LinkHref = React.ComponentProps<typeof Link>["href"];

export interface ButtonLinkProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  href: LinkHref | string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  external?: boolean;
}

/** `<Link>` with button styling. Pass `external` for plain anchors (WhatsApp, maps, downloads). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  external,
  children,
  ...props
}: ButtonLinkProps) {
  const cls = buttonClasses(variant, size, className);
  if (external || (typeof href === "string" && /^(https?:|mailto:|tel:|whatsapp:|blob:)/.test(href))) {
    return (
      <a href={href as string} className={cls} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href as LinkHref} className={cls} {...props}>
      {children}
    </Link>
  );
}

/** Bare 20px icon in a 44px hit area. Always pass `aria-label`. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    "aria-label": string;
    /** `surface` / `glass` render a round chip (headers, over imagery); `default` / `muted` are bare. */
    tone?: "default" | "muted" | "surface" | "glass";
  }
>(function IconButton({ className, tone = "default", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "hover:text-accent inline-flex size-11 shrink-0 items-center justify-center bg-transparent transition-colors disabled:opacity-50 [&>svg]:size-5",
        tone === "muted" ? "text-muted" : "text-foreground",
        tone === "surface" && "bg-surface rounded-full shadow-sm",
        tone === "glass" && "glass rounded-full",
        className,
      )}
      {...props}
    />
  );
});

/** Bare icon link (same look as IconButton). */
export function IconLink({
  href,
  className,
  children,
  ...props
}: { href: LinkHref; className?: string; children: React.ReactNode; "aria-label": string } & Omit<
  React.ComponentProps<typeof Link>,
  "href" | "className" | "children"
>) {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground hover:text-accent inline-flex size-11 shrink-0 items-center justify-center [&>svg]:size-5",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
