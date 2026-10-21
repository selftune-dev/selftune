import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EvaluationHistory } from "@selftune/control-plane/domain/evaluation-report";
import { SkillEvaluations as EvaluationView } from "@selftune/dashboard-core/screens/skill-report";
import { schemaRequest } from "../dashboard-http";
import { useSettings } from "../hooks/useSettings";

export function SkillEvaluations({ skillName }: { skillName: string }) {
  const client = useQueryClient();
  const key = ["evaluation-history", skillName];
  const path = `/api/v2/evaluations?skill=${encodeURIComponent(skillName)}`;
  const query = useQuery({
    queryKey: key,
    queryFn: () => schemaRequest(path, EvaluationHistory),
    staleTime: 5000,
    refetchInterval: 30000,
  });
  const settings = useSettings();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) throw new Error("Report exceeds 2 MiB");
      return schemaRequest(path, EvaluationHistory, await file.text());
    },
    onSuccess: (history) => client.setQueryData(key, history),
  });
  return (
    <EvaluationView
      history={query.data ?? []}
      harnesses={settings.data?.harnesses ?? []}
      busy={query.isPending || upload.isPending}
      error={upload.error?.message ?? query.error?.message}
      onImport={(file) => upload.mutate(file)}
    />
  );
}
