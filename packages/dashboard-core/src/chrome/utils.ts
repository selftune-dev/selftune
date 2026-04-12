import type { DashboardSearchItem } from "./types";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesSearchItem(item: DashboardSearchItem, query: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;

  const haystack = [item.label, item.meta ?? "", ...(item.keywords ?? [])].map(normalize).join(" ");

  return haystack.includes(needle);
}
