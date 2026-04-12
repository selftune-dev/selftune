"use client";

import { useState } from "react";
import { RocketIcon } from "lucide-react";

export interface OverviewOnboardingBannerProps {
  skillCount: number;
  storageKey?: string;
}

export function OverviewOnboardingBanner({
  skillCount,
  storageKey = "selftune-onboarding-dismissed",
}: OverviewOnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  if (skillCount > 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // ignore local storage failures
    }
  };

  return (
    <div className="col-span-12 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <RocketIcon className="size-6 text-primary" />
        </div>
        <h2 className="font-headline text-lg font-semibold">Welcome to selftune</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No skills detected yet. Once you start using selftune in your project, skills will appear
          here automatically.
        </p>
        <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
              1
            </div>
            <div>
              <p className="text-xs font-medium">Run selftune</p>
              <p className="text-[11px] text-muted-foreground">
                Enable selftune in your project to start tracking skills
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-500">
              2
            </div>
            <div>
              <p className="text-xs font-medium">Skills appear</p>
              <p className="text-[11px] text-muted-foreground">
                Skills are detected and monitored automatically
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-500">
              3
            </div>
            <div>
              <p className="text-xs font-medium">Watch evolution</p>
              <p className="text-[11px] text-muted-foreground">
                Proposals flow in with validated improvements
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
