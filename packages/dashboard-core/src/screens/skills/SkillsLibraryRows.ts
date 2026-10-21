import { useMemo } from "react";
import type { DashboardLibraryQueryState } from "../../host";
import type { InventoryFilter, SourceFilter } from "./SkillsLibraryFilters";
import type { ReviewFilter } from "./SkillsLibraryRecommendationFilter";
import { sortSkills, type SortState } from "./SkillsLibrarySorting";

export function useLibraryRows({
  inventory,
  search,
  category,
  connection,
  lifecycle,
  review,
  sort,
  source,
}: {
  inventory: DashboardLibraryQueryState;
  search: string;
  category: string;
  connection: string;
  lifecycle: InventoryFilter;
  review: ReviewFilter;
  sort: SortState | null;
  source: SourceFilter;
}) {
  const skills = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (inventory.data?.skills ?? []).filter((skill) => {
      if (review === "archive" && !skill.archiveRecommendation) return false;
      if (review === "consolidate" && !skill.consolidationRecommendation) return false;
      if (lifecycle !== "all" && skill.lifecycle !== lifecycle) return false;
      if (category !== "all" && skill.category?.id !== category) return false;
      if (source !== "all" && !skill.sources.some((item) => item.kind === source)) return false;
      if (
        connection !== "all" &&
        !skill.locations.some((location) => location.connection === connection)
      )
        return false;
      if (!query || inventory.searchHandled) return true;
      return [
        skill.name,
        skill.category?.label ?? "",
        ...(skill.category?.matchedTerms ?? []),
        skill.status,
        ...skill.sources.map((item) => item.label),
        ...skill.locations.flatMap((location) => [
          location.label,
          location.path,
          location.connection ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    return sort ? sortSkills(filtered, sort) : filtered;
  }, [
    category,
    connection,
    inventory.data,
    inventory.searchHandled,
    lifecycle,
    review,
    search,
    sort,
    source,
  ]);
  const connections = useMemo(
    () =>
      [
        ...new Set(
          (inventory.data?.skills ?? []).flatMap((skill) =>
            skill.locations.flatMap((location) =>
              location.connection ? [location.connection] : [],
            ),
          ),
        ),
      ].toSorted(),
    [inventory.data],
  );
  const consolidationSkills = useMemo(
    () =>
      (inventory.data?.skills ?? []).filter(
        (skill) => skill.consolidationRecommendation || skill.consolidationAvailable,
      ),
    [inventory.data],
  );
  const archiveRecommendationCount = useMemo(
    () =>
      (inventory.data?.skills ?? []).filter(
        (skill) => skill.archiveRecommendation || skill.archiveAvailable,
      ).length,
    [inventory.data],
  );
  return { skills, connections, consolidationSkills, archiveRecommendationCount };
}
