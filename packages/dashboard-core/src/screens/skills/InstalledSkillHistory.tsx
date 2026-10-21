import { useSkillsModule } from "../../host";
import type { LibrarySkillModel } from "../../models";

export function InstalledSkillHistory({ skill }: { skill: LibrarySkillModel }) {
  const History = useSkillsModule().History;
  const [selected, setSelected] = useState<string | null>(null);
  if (!History) return null;
  const locations = skill.locations.filter((location) => location.sourceKind === "installed");
  const location = locations.find((item) => item.id === selected) ?? locations[0];
  if (!location) return null;
  return (
    <section className="min-w-0 space-y-3">
      {locations.length > 1 ? (
        <Field>
          <FieldLabel htmlFor="history-location">Installed copy history</FieldLabel>
          <select
            id="history-location"
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={location.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.path}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <History key={location.path} skillPath={`${location.path}/SKILL.md`} />
    </section>
  );
}
import { useState } from "react";
import { Field, FieldLabel } from "@selftune/ui/primitives";
