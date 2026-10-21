import { useCallback, useMemo, useState, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardLibraryQueryState } from "@selftune/dashboard-core/host";
import { fetchAnalytics, fetchLibrary } from "./api";
import { useLibrary, useLibraryIndex } from "./hooks/useLibrary";
import { useSkillIntelligence } from "./hooks/useSkillIntelligence";
import { usePortfolio } from "./hooks/usePortfolio";
import { useSettings } from "./hooks/useSettings";
import { mapLocalLibraryInventory } from "./local-library-model";
import { mapLocalLibraryIndex } from "./local-library-index-model";
import type { LibrarySnapshot } from "./types";

export function useLocalLibraryInventory(
  options: { search?: string; full?: boolean } = {},
): DashboardLibraryQueryState {
  const [requestedFull, setRequestedFull] = useState(false);
  const [details, setDetails] = useState<readonly LibrarySnapshot[]>([]);
  const full = options.full || requestedFull;
  const search = useDeferredValue(options.search ?? "");
  const index = useLibraryIndex(search, !full);
  const complete = useLibrary({ enabled: full });
  const query = full ? complete : index;
  const queryClient = useQueryClient();
  const intelligence = useSkillIntelligence();
  const portfolio = usePortfolio();
  const settings = useSettings();
  const analytics = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    staleTime: 30_000,
  });
  const mapComplete = useCallback(
    (snapshot: LibrarySnapshot) =>
      mapLocalLibraryInventory(
        snapshot,
        intelligence.data ?? null,
        portfolio.data ?? null,
        settings.data?.harnesses ?? [],
        analytics.data ?? null,
      ),
    [intelligence.data, portfolio.data, settings.data?.harnesses, analytics.data],
  );
  const data = useMemo(() => {
    if (full) return complete.data ? mapComplete(complete.data) : null;
    if (!index.data) return null;
    const model = mapLocalLibraryIndex(
      index.data,
      intelligence.data ?? null,
      portfolio.data ?? null,
      settings.data?.harnesses ?? [],
      analytics.data ?? null,
    );
    const hydrated = new Map(
      details
        .filter((snapshot) => snapshot.generatedAt === index.data?.generatedAt)
        .flatMap((snapshot) => mapComplete(snapshot).skills)
        .map((skill) => [skill.id, skill]),
    );
    return { ...model, skills: model.skills.map((skill) => hydrated.get(skill.id) ?? skill) };
  }, [
    full,
    complete.data,
    index.data,
    details,
    intelligence.data,
    portfolio.data,
    settings.data?.harnesses,
    analytics.data,
    mapComplete,
  ]);
  const loadAll = useCallback(async () => {
    await complete.refetch({ throwOnError: true });
    setRequestedFull(true);
  }, [complete.refetch]);
  return {
    data,
    isLoading: query.isLoading,
    error: query.error ? query.error.message : null,
    searchHandled: !full,
    loadAll,
    async loadDetails(skillId) {
      const existing = data?.skills.find((skill) => skill.id === skillId);
      if (existing && existing.detailsLoaded !== false) return existing;
      if (!index.data) throw new Error("Wait for the library to finish loading.");
      const generation = index.data.generatedAt;
      const snapshot = await queryClient.fetchQuery({
        queryKey: ["library", "detail", generation, skillId],
        queryFn: () => fetchLibrary({ skillId, snapshot: generation }),
        staleTime: 10_000,
      });
      const skill = mapComplete(snapshot).skills[0];
      if (!skill) throw new Error("The skill is no longer in the library. Refresh and try again.");
      setDetails((previous) => [
        ...previous.filter(
          (entry) => entry.generatedAt === generation && entry.skills[0]?.skillId !== skillId,
        ),
        snapshot,
      ]);
      return skill;
    },
    async refresh() {
      setDetails([]);
      await Promise.all([
        query.refetch(),
        intelligence.refetch(),
        portfolio.refetch(),
        analytics.refetch(),
      ]);
    },
  };
}
