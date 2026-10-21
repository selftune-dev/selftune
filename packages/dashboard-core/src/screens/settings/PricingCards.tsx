import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@selftune/ui/primitives";

export interface PricingPlan {
  readonly id: "free" | "pro" | "team" | "enterprise";
  readonly name: string;
  readonly price: string | null;
  readonly period?: string | null;
  readonly description: string;
  readonly features: readonly string[];
}

export function PricingCards({
  plans,
  currentPlan,
  renderAction,
  renderOptions,
}: {
  readonly plans: readonly PricingPlan[];
  readonly currentPlan?: string;
  readonly renderAction: (plan: PricingPlan) => ReactNode;
  readonly renderOptions?: (plan: PricingPlan) => ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-label="Available plans">
      {plans
        .filter((plan) => plan.id !== "enterprise")
        .map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{plan.name}</CardTitle>
                {currentPlan === plan.id ? <Badge variant="secondary">Current plan</Badge> : null}
              </div>
              <p
                aria-label={`${plan.price}${plan.period === "forever" ? " forever" : (plan.period ?? "")}`}
                className="text-2xl font-semibold tracking-tight"
              >
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {plan.period === "forever" ? " forever" : plan.period}
                </span>
              </p>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <ul className="flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <CheckIcon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {renderOptions?.(plan)}
            </CardContent>
            <CardFooter>{renderAction(plan)}</CardFooter>
          </Card>
        ))}
    </div>
  );
}
