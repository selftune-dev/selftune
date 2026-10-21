import { useState } from "react";
import { Field, FieldLabel } from "@selftune/ui/primitives";
import { useSkillsModule } from "../../host";
import type { LibrarySkillModel } from "../../models";

export function InstalledSkillPackage({ skill }: { readonly skill: LibrarySkillModel }) {
  const Inspector = useSkillsModule().PackageInspector;
  const [selected, setSelected] = useState<string | null>(null);
  const locations = skill.locations.filter((location) => location.sourceKind === "installed");
  const location = locations.find((item) => item.id === selected) ?? locations[0];
  if (!Inspector || !location) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      {locations.length > 1 ? (
        <Field>
          <FieldLabel htmlFor="package-location">Installed copy to inspect</FieldLabel>
          <select
            id="package-location"
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
      <Inspector key={location.path} skillPath={`${location.path}/SKILL.md`} />
    </section>
  );
}
