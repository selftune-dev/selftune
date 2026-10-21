"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FileTree, useFileTree, useFileTreeSearch } from "@pierre/trees/react";
import { SearchIcon } from "lucide-react";
import { File } from "@pierre/diffs/react";
import Markdown from "react-markdown";
import { Button } from "../primitives/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../primitives/input-group";
import { cn } from "../lib/utils";

export interface SkillPackageViewerProps {
  readonly paths: readonly string[];
  readonly selectedPath: string | null;
  readonly content: string | null;
  readonly message?: string;
  readonly loading?: boolean;
  readonly onSelect: (path: string) => void;
  readonly theme?: "light" | "dark";
  readonly flush?: boolean;
}

export function SkillPackageViewer(props: SkillPackageViewerProps) {
  return <SkillPackageViewerContent key={props.paths.join("\u0000")} {...props} />;
}

function SkillPackageViewerContent({
  paths,
  selectedPath,
  content,
  message,
  loading,
  onSelect,
  theme = "light",
  flush = false,
}: SkillPackageViewerProps) {
  const [source, setSource] = useState(false);
  const { model } = useFileTree({
    paths: useMemo(() => [...paths], [paths]),
    initialExpansion: "open",
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    search: false,
    fileTreeSearchMode: "hide-non-matches",
    onSelectionChange: (selection) => {
      const path = selection[0];
      if (path && paths.includes(path)) onSelect(path);
    },
  });
  const search = useFileTreeSearch(model);
  useEffect(() => {
    if (!selectedPath || model.getSelectedPaths().includes(selectedPath)) return;
    for (const path of model.getSelectedPaths()) model.getItem(path)?.deselect();
    model.getItem(selectedPath)?.select();
  }, [model, selectedPath]);
  const treeStyle: CSSProperties & { [key: `--${string}`]: string } = {
    height: "100%",
    colorScheme: theme,
    "--trees-fg-override": "var(--foreground)",
    "--trees-fg-muted-override": "var(--muted-foreground)",
    "--trees-bg-override": "var(--card)",
    "--trees-bg-muted-override": "var(--secondary)",
    "--trees-border-color-override": "var(--border)",
    "--trees-selected-bg-override": "var(--secondary)",
    "--trees-selected-fg-override": "var(--foreground)",
    "--trees-search-bg-override": "var(--card)",
    "--trees-search-fg-override": "var(--foreground)",
  };
  const markdown = /\.(md|markdown|mdx)$/i.test(selectedPath ?? "");
  const frontmatter = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const body = frontmatter ? (content?.slice(frontmatter[0].length) ?? "") : (content ?? "");
  return (
    <div
      className={cn(
        "grid h-[min(65dvh,42rem)] min-h-96 min-w-0 grid-rows-[9rem_minmax(0,1fr)] overflow-hidden bg-card md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]",
        !flush && "rounded-xl border",
      )}
    >
      <nav
        aria-label="Package files"
        className="flex min-h-0 flex-col overflow-hidden border-b md:border-r md:border-b-0"
      >
        {paths.length > 1 ? (
          <div className="shrink-0 p-3">
            <InputGroup>
              <InputGroupInput
                aria-label="Search package files"
                placeholder="Search files…"
                value={search.value}
                onChange={(event) => search.setValue(event.target.value || null)}
              />
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
            </InputGroup>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <FileTree model={model} style={treeStyle} />
        </div>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="truncate font-mono text-xs" title={selectedPath ?? undefined}>
            {selectedPath ?? "Select a file"}
          </span>
          {markdown ? (
            <Button
              variant="outline"
              size="sm"
              aria-pressed={source}
              onClick={() => setSource(!source)}
            >
              {source ? "Preview" : "Source"}
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto" aria-label="File content" aria-busy={loading}>
          {loading ? (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              Loading file…
            </p>
          ) : message ? (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              {message}
            </p>
          ) : content !== null && selectedPath ? (
            markdown && !source ? (
              <article className="skill-markdown p-5">
                {frontmatter ? (
                  <details className="mb-4">
                    <summary>Package metadata</summary>
                    <pre>{frontmatter[1]}</pre>
                  </details>
                ) : null}
                <Markdown
                  skipHtml
                  components={{
                    img: ({ alt }) => (
                      <span className="text-muted-foreground">
                        [Image: {alt || "image"} — not loaded in preview]
                      </span>
                    ),
                    a: ({ href, children }) => {
                      let filePath: string | null = null;
                      try {
                        const url = new URL(href ?? "", `https://package.invalid/${selectedPath}`);
                        if (url.origin === "https://package.invalid")
                          filePath = decodeURIComponent(url.pathname.slice(1));
                      } catch {
                        /* Leave malformed links inert. */
                      }
                      const target = filePath;
                      if (target && paths.includes(target))
                        return (
                          <button
                            type="button"
                            className="text-primary underline"
                            onClick={() => onSelect(target)}
                          >
                            {children}
                          </button>
                        );
                      return (
                        <a
                          href={
                            href?.startsWith("https://") || href?.startsWith("http://")
                              ? href
                              : undefined
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {body}
                </Markdown>
              </article>
            ) : (
              <File
                file={{ name: selectedPath, contents: content }}
                disableWorkerPool
                options={{
                  overflow: "wrap",
                  theme: { light: "pierre-light", dark: "pierre-dark" },
                  themeType: theme,
                }}
              />
            )
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Select a file to inspect its contents.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
