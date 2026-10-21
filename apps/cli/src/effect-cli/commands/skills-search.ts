import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { searchLocalSkillsEffect } from "@selftune/runtime/skill-search/search";

export function makeSkillsSearchCommand() {
  return Command.make(
    "search",
    {
      query: Argument.String("query"),
      limit: Flag.Int("limit").pipe(Flag.withDefault(5)),
      searchDirs: Flag.String("search-dir").pipe(Flag.atLeast(0)),
      json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
    },
    Effect.fn(function* ({ query, limit, searchDirs, json }) {
      const result = yield* searchLocalSkillsEffect({
        query,
        limit,
        searchDirs: searchDirs.length ? searchDirs : undefined,
      });
      yield* Console.log(
        json
          ? JSON.stringify(result, null, 2)
          : [
              ...result.results.map(
                (hit) => `${hit.name} (${hit.id})\n  ${hit.description}\n  ${hit.skill_path}`,
              ),
              ...(result.results.length ? [] : ["No matching local skills."]),
              ...result.warnings.map((warning) => `Warning: ${warning.path}: ${warning.message}`),
            ].join("\n"),
      );
    }),
  ).pipe(
    Command.withDescription(
      "Search local skills and inactive Library packages with BM25; does not install or execute.",
    ),
  );
}
