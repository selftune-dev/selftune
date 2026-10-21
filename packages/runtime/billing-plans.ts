import type { DesktopBillingPlan } from "./dashboard-contract";
export const billingPlans: readonly DesktopBillingPlan[] = [
  {
    id: "free",
    name: "Community",
    price: "$0",
    period: null,
    description: "Find, review, package, and install skills on your machine.",
    features: [
      "Unlimited local skills and Skill Sets",
      "Discovery across supported agents and projects",
      "Local evaluation and reviewable proposals",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "Share skills and Skill Sets through controlled links.",
    features: [
      "Explicit skill and Skill Set sharing",
      "Expiring and revocable share links",
      "Linked-device and revision status",
    ],
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$49",
    period: "/month",
    description: "Distribute reviewed Skill Sets across a workspace.",
    features: ["Everything in Pro", "3 members included", "Workspace membership and access roles"],
    highlighted: false,
    seats: { minimum: 3, label: "members" },
  },
];
