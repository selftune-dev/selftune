import { ArrowUpRightIcon, CheckIcon, LockIcon } from "lucide-react";

interface UpgradeAction {
  href: string;
  label: string;
}

interface UpgradeCardProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: readonly string[];
  primaryAction: UpgradeAction;
  secondaryAction?: UpgradeAction;
  note?: string;
}

export function UpgradeCard({
  eyebrow,
  title,
  description,
  highlights = [],
  primaryAction,
  secondaryAction,
  note,
}: UpgradeCardProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(79,242,255,0.18),transparent_32%),linear-gradient(180deg,rgba(8,16,27,0.98),rgba(7,12,22,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="grid gap-10 p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:p-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            <LockIcon className="size-3" />
            <span>{eyebrow}</span>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl font-headline text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300">{description}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={primaryAction.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <span>{primaryAction.label}</span>
              <ArrowUpRightIcon className="size-4" />
            </a>
            {secondaryAction ? (
              <a
                href={secondaryAction.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-primary/30 hover:text-primary"
              >
                <span>{secondaryAction.label}</span>
                <ArrowUpRightIcon className="size-4" />
              </a>
            ) : null}
          </div>

          {note ? <p className="text-sm text-slate-500">{note}</p> : null}
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
          <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            What unlocks
          </div>
          <div className="space-y-3">
            {highlights.map((highlight) => (
              <div
                key={highlight}
                className="flex items-start gap-3 rounded-2xl border border-white/6 bg-background/40 px-4 py-3"
              >
                <div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <CheckIcon className="size-3.5" />
                </div>
                <p className="text-sm leading-6 text-slate-200">{highlight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
