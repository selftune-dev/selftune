export function buildLiveRunHref(payload: {
  event_id: string;
  action: string;
  skill_name?: string | null;
}): string {
  const params = new URLSearchParams({
    event: payload.event_id,
    action: payload.action,
  });
  if (payload.skill_name) {
    params.set("skill", payload.skill_name);
  }
  return `/live-run?${params.toString()}`;
}

export function navigateToLiveRun(payload: {
  event_id: string;
  action: string;
  skill_name?: string | null;
}): string {
  const href = buildLiveRunHref(payload);
  if (typeof window === "undefined") return href;
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return href;
}
