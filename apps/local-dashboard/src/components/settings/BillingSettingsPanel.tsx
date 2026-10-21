import { useState } from "react";
import { toast } from "sonner";
import { billingPlans } from "@selftune/runtime/billing-plans";
import { PricingCards } from "@selftune/dashboard-core/screens/settings";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldLabel,
  Input,
} from "@selftune/ui/primitives";
import {
  useCloudBillingCheckout,
  useCloudBillingPortal,
  useCloudBillingStatus,
} from "@/hooks/useSettings";

export interface BillingSettingsPanelProps {
  readonly cloudConfigured: boolean;
  readonly active: boolean;
  readonly connectPending: boolean;
  readonly onConnect: () => void;
  readonly openExternal?: (url: string) => void | Promise<void>;
}

export function BillingSettingsPanel({
  cloudConfigured,
  active,
  connectPending,
  onConnect,
  openExternal,
}: BillingSettingsPanelProps) {
  const billing = useCloudBillingStatus(cloudConfigured && active);
  const checkout = useCloudBillingCheckout();
  const portal = useCloudBillingPortal();
  const [teamSeats, setTeamSeats] = useState(3);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const data = cloudConfigured ? billing.data : undefined;
  const currentName =
    data?.availablePlans.find((plan) => plan.id === data.plan)?.name ??
    (data?.plan === "free"
      ? "Community"
      : data?.plan === "enterprise"
        ? "Enterprise"
        : data?.plan === "team"
          ? "Team"
          : "Pro");
  const busy = checkout.isPending || portal.isPending;
  const grantedAccess = data && data.plan !== "free" && !data.hasStripeCustomer;

  async function openUrl(url: string) {
    try {
      if (openExternal) await openExternal(url);
      else if (window.selftuneDesktop) await window.selftuneDesktop.openExternal(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open your browser. Please try again.");
    }
  }
  function showError(error: Error) {
    toast.error("Billing could not be opened", { description: error.message });
  }
  function openPortal() {
    portal.mutate(undefined, { onSuccess: ({ url }) => void openUrl(url), onError: showError });
  }
  function choose(plan: "pro" | "team") {
    const seats = Math.min(1000, Math.max(3, Math.trunc(teamSeats) || 3));
    setCheckoutOpened(true);
    if (!cloudConfigured) {
      void openUrl(
        `https://cloud.selftune.dev/?billing=${plan}${plan === "team" ? `&seats=${seats}` : ""}`,
      );
    } else if (
      data?.hasStripeCustomer &&
      data.plan !== "free" &&
      data.subscriptionStatus !== "canceled"
    )
      openPortal();
    else
      checkout.mutate(plan === "team" ? { plan, seats } : { plan }, {
        onSuccess: ({ url }) => void openUrl(url),
        onError: showError,
      });
  }

  return (
    <section aria-labelledby="billing-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="billing-heading" className="text-base font-semibold">
          Billing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use SelfTune locally for free. Add controlled sharing or bring your team.
        </p>
      </div>
      {!cloudConfigured ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Already have an account?
          <Button variant="link" size="sm" disabled={connectPending} onClick={onConnect}>
            {connectPending ? "Waiting for approval" : "Connect Cloud"}
          </Button>
        </div>
      ) : billing.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your plan</AlertTitle>
          <AlertDescription>
            {billing.error instanceof Error
              ? billing.error.message
              : "Billing is unavailable right now."}
            <Button variant="outline" size="sm" onClick={() => billing.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : data ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">Current plan: {currentName}</span>
          <span className="text-muted-foreground">
            {grantedAccess
              ? "Internal access"
              : data.subscriptionStatus === "none"
                ? "No active subscription"
                : `Subscription: ${data.subscriptionStatus}`}
          </span>
          <div className="ml-auto flex gap-2">
            {data.hasStripeCustomer && data.canManageBilling ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={openPortal}>
                Manage subscription
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => billing.refetch()}>
              Refresh plan
            </Button>
          </div>
        </div>
      ) : (
        <p role="status">Loading billing…</p>
      )}
      {checkoutOpened ? (
        <p role="status" className="text-sm text-muted-foreground">
          {data && (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing")
            ? "Your plan is active. You can return to sharing."
            : "Finish checkout in your browser, then return here. Your plan refreshes while Billing is open. If you are not linked yet, connect the same Cloud workspace afterward."}
        </p>
      ) : null}
      {data && !data.canManageBilling ? (
        <p className="text-sm text-muted-foreground">Only workspace owners can manage billing.</p>
      ) : null}
      <PricingCards
        plans={data?.availablePlans ?? billingPlans}
        currentPlan={data?.plan ?? (!cloudConfigured ? "free" : undefined)}
        renderOptions={(plan) =>
          plan.id === "team" && !grantedAccess && (!data || data.plan === "free") ? (
            <Field>
              <FieldLabel htmlFor="team-seats">Team seats</FieldLabel>
              <Input
                id="team-seats"
                type="number"
                min={3}
                max={1000}
                value={teamSeats}
                onChange={(event) => setTeamSeats(Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                3 members included; $15/month per additional member.
              </p>
            </Field>
          ) : null
        }
        renderAction={(plan) => {
          if (plan.id !== "pro" && plan.id !== "team")
            return <span className="text-sm text-muted-foreground">Free on this device</span>;
          const current =
            plan.id === data?.plan &&
            (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing");
          return (
            <Button
              className="w-full"
              variant={current ? "outline" : "default"}
              disabled={
                busy ||
                current ||
                Boolean(grantedAccess) ||
                (cloudConfigured && (!data || !data.canManageBilling))
              }
              onClick={() => {
                if (plan.id === "pro" || plan.id === "team") choose(plan.id);
              }}
            >
              {current
                ? "Current plan"
                : grantedAccess
                  ? "Included in your access"
                  : data && data.plan !== "free"
                    ? "Manage plan"
                    : !cloudConfigured
                      ? `Choose ${plan.name}`
                      : "Choose plan"}
            </Button>
          );
        }}
      />
    </section>
  );
}
