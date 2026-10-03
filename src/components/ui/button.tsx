import * as React from "react";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 06 Nude Clinic buttons (DESIGN.md §4–5).
 * `primary` is the one cocoa pill per view. Every other variant renders as a text link so that
 * existing call sites keep compiling while the page loses its boxes.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const pillSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5.5 text-sm",
  lg: "h-13 px-7 text-[15px]",
  icon: "size-11",
};

const linkSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 text-sm",
  md: "min-h-11 text-sm",
  lg: "min-h-11 text-[15px]",
  icon: "size-11",
};

const linkTone: Record<Exclude<ButtonVariant, "primary">, string> = {
  secondary: "text-accent hover:text-foreground",
  link: "text-accent hover:text-foreground",
  outline: "text-foreground hover:text-accent",
  ghost: "text-foreground hover:text-accent",
  danger: "text-danger hover:text-foreground",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-60";
  if (variant === "primary") {
    return cn(
      base,
      "bg-accent text-accent-contrast hover:bg-accent-hover rounded-full",
      pillSizes[size],
      size === "icon" && "rounded-full",
      className,
    );
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
  React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string; tone?: "default" | "muted" }
>(function IconButton({ className, tone = "default", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "hover:text-accent inline-flex size-11 shrink-0 items-center justify-center bg-transparent transition-colors disabled:opacity-50 [&>svg]:size-5",
        tone === "muted" ? "text-muted" : "text-foreground",
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
