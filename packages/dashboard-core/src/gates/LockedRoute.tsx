import { UpgradeCard } from "./UpgradeCard";

interface LockedRouteProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: readonly string[];
  primaryAction: {
    href: string;
    label: string;
  };
  secondaryAction?: {
    href: string;
    label: string;
  };
  note?: string;
}

export function LockedRoute(props: LockedRouteProps) {
  return (
    <div className="@container/main flex flex-1 flex-col py-6">
      <div className="grid grid-cols-12 gap-6 px-4 lg:px-6">
        <div className="col-span-12">
          <UpgradeCard {...props} />
        </div>
      </div>
    </div>
  );
}
