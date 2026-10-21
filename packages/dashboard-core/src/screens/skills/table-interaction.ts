export function isInteractiveTableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, textarea, select, [role=combobox], [role=menuitem]") !== null
  );
}
