import { cn } from "@/lib/cn";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

/**
 * PixelButton — tombol moLearn. Gaya modern & rapi: border halus 1px +
 * shadow lembut (bukan offset solid 16-bit), label tak wrap, dan touch
 * target minimal 44px agar nyaman. Dua varian: `primary` (forest green →
 * hover leaf green) dan `ghost` (permukaan kartu, aksen hover amber).
 */

type Variant = "primary" | "ghost";

interface BaseProps {
  variant?: Variant;
  /**
   * Ukuran: `sm` untuk toolbar (~40px), `md` untuk aksi utama (~44px),
   * `lg` untuk CTA beraksen.
   */
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<BaseProps["size"]>, string> = {
  sm: "h-10 px-md py-xs text-label-md",
  md: "h-11 px-lg py-sm text-label-lg",
  lg: "h-12 px-xl py-md text-label-lg",
};

function buttonClasses(variant: Variant, size: BaseProps["size"], extra?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-sm whitespace-nowrap border border-outline-subtle rounded-md font-label shadow-card-sm transition-transform duration-press ease-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary",
    sizeClasses[size ?? "md"],
    variant === "primary"
      ? "bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary"
      : "bg-surface-card text-on-surface-card hover:bg-amber-container hover:text-on-amber-container",
    extra,
  );
}

interface PixelButtonAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    BaseProps {
  href: string;
}

export function PixelButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: PixelButtonAnchorProps) {
  return (
    <a
      {...rest}
      className={cn(buttonClasses(variant, size), className)}
    />
  );
}

interface PixelButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    BaseProps {}

export function PixelButton(props: PixelButtonProps) {
  const { variant = "primary", size = "md", className, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={cn(buttonClasses(variant, size), className)}
    />
  );
}
