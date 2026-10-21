import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SkillPackageViewer } from "@selftune/ui/components";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@selftune/ui/primitives";
import { SkillPackageIndex, SkillPackageFile } from "@selftune/runtime/skill-package-inspector";
import { schemaRequest } from "../dashboard-http";
import { useTheme } from "@selftune/dashboard-core/chrome";

export function SkillPackageInspector({ skillPath }: { readonly skillPath: string }) {
  const { resolvedTheme } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const endpoint = `/api/v2/skill-package?skillPath=${encodeURIComponent(skillPath)}`;
  const index = useQuery({
    queryKey: ["skill-package", skillPath],
    queryFn: () => schemaRequest(endpoint, SkillPackageIndex),
  });
  const paths = useMemo(() => index.data?.files.map((file) => file.path) ?? [], [index.data]);
  const path =
    selected && paths.includes(selected)
      ? selected
      : paths.includes("SKILL.md")
        ? "SKILL.md"
        : (paths[0] ?? null);
  const file = useQuery({
    queryKey: ["skill-package-file", skillPath, path],
    enabled: path !== null,
    queryFn: () =>
      schemaRequest(`${endpoint}&file=${encodeURIComponent(path ?? "")}`, SkillPackageFile),
  });
  const reason = file.data?.reason;
  const message =
    file.error?.message ??
    (reason === "too_large"
      ? "This file exceeds the 256 KiB preview limit."
      : reason === "binary"
        ? "Binary file. Text preview is not available."
        : reason === "symlink"
          ? "Symbolic link. The inspector does not follow links inside a package."
          : undefined);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Package contents</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void index.refetch();
              void file.refetch();
            }}
          >
            Refresh files
          </Button>
        </div>
        <CardDescription>
          Browse the installed files. Read-only; nothing is uploaded or executed. Git data and
          node_modules are excluded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {index.isPending ? (
          <p role="status">Loading package files…</p>
        ) : index.error ? (
          <p role="alert">{index.error.message}</p>
        ) : paths.length === 0 ? (
          <p>No files found in this package.</p>
        ) : (
          <SkillPackageViewer
            theme={resolvedTheme}
            paths={paths}
            selectedPath={path}
            onSelect={setSelected}
            content={file.data?.content ?? null}
            loading={file.isFetching}
            message={message}
          />
        )}
        {index.data?.limited ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Showing a bounded listing of up to 2,000 entries and 20 directory levels.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
