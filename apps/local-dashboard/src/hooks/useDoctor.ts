import { useQuery } from "@tanstack/react-query";
import { fetchDoctor } from "../api";

const POLL_INTERVAL_MS = 30_000;

export function useDoctor() {
  return useQuery({
    queryKey: ["doctor"],
    queryFn: fetchDoctor,
    staleTime: 20_000,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
