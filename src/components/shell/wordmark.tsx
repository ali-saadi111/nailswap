import { Link } from "@/i18n/navigation";
import { Nail } from "@/components/nails/nail";
import { cn } from "@/lib/utils";

/** Small rose almond nail + "NailSwap" in Urbanist 800. */
export function Wordmark({
  suffix,
  href = "/",
  className,
  size = 22,
}: {
  suffix?: string;
  href?: string;
  className?: string;
  size?: number;
}) {
  return (
    <Link
      href={href}
      className={cn("text-foreground inline-flex items-center gap-2", className)}
      aria-label="NailSwap"
    >
      <Nail
        shape="almond"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.78)}
        fill="var(--accent)"
      />
      <span className="font-display leading-none" style={{ fontSize: size }}>
        NailSwap
      </span>
      {suffix && (
        <span
          className="text-muted ms-0.5 text-[15px] leading-none font-normal"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {suffix}
        </span>
      )}
    </Link>
  );
}
