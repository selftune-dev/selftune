"use client";

import { cn } from "./utils";
import type { RuntimeBadgeProps } from "./types";

export function RuntimeBadge({
  href,
  label,
  detail,
  tone = "healthy",
  renderLink,
}: RuntimeBadgeProps) {
  const toneClassName =
    tone === "warning"
      ? "text-amber-400 ring-amber-400/20 hover:bg-amber-400/8"
      : tone === "critical"
        ? "text-destructive ring-destructive/20 hover:bg-destructive/8"
        : "text-primary ring-primary/20 hover:bg-primary/8";

  const dotClassName =
    tone === "warning"
      ? "bg-amber-400"
      : tone === "critical"
        ? "bg-destructive"
        : "animate-pulse bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_60%,transparent)]";

  return (
    <footer className="pointer-events-none fixed bottom-4 right-4 z-20">
      {renderLink({
        href,
        className: cn(
          "glass-panel pointer-events-auto flex items-center gap-2 rounded-full border border-foreground/5 px-3 py-2 font-headline text-[10px] uppercase tracking-[0.18em] text-slate-300 shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          toneClassName,
        ),
        children: (
          <>
            <span className={cn("size-1.5 rounded-full", dotClassName)} />
            <span>{label}</span>
            <span className="text-foreground/25">/</span>
            <span className="text-slate-400">{detail}</span>
          </>
        ),
      })}
    </footer>
  );
}
