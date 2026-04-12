import type { ReactNode } from "react";
import {
  EyeIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShieldQuestionIcon,
} from "lucide-react";

import { Badge } from "@selftune/ui/primitives";
import type { TrustState } from "@selftune/ui/types";

export function SkillReportTrustBadge({ state }: { state: TrustState }) {
  const config = getSkillReportTrustBadgeConfig(state);

  return (
    <Badge variant={config.variant} className="gap-1 shrink-0 text-[10px]">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function getSkillReportTrustBadgeConfig(state: TrustState): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: ReactNode;
} {
  switch (state) {
    case "low_sample":
      return {
        label: "Low Sample",
        variant: "secondary",
        icon: <ShieldQuestionIcon className="size-3" />,
      };
    case "observed":
      return {
        label: "Observed",
        variant: "outline",
        icon: <EyeIcon className="size-3" />,
      };
    case "watch":
      return {
        label: "Watch",
        variant: "secondary",
        icon: <ShieldAlertIcon className="size-3" />,
      };
    case "validated":
      return {
        label: "Validated",
        variant: "default",
        icon: <ShieldCheckIcon className="size-3" />,
      };
    case "deployed":
      return {
        label: "Deployed",
        variant: "default",
        icon: <ShieldCheckIcon className="size-3" />,
      };
    case "rolled_back":
      return {
        label: "Rolled Back",
        variant: "destructive",
        icon: <ShieldIcon className="size-3" />,
      };
  }
}
