import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import * as Schema from "effect/Schema";
import { LibrarySnapshot } from "@selftune/control-plane/domain";
import {
  compactLibrarySnapshot,
  expandLibrarySnapshot,
} from "@selftune/control-plane/library-transport";

const path = process.argv[2];
if (!path) throw new Error("Supply an explicit local library cache artifact path.");
const { data } = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Struct({ data: LibrarySnapshot })),
)(readFileSync(path, "utf8"));
const started = performance.now();
const compact = compactLibrarySnapshot(data);
const compactJson = JSON.stringify(compact);
const encodeMs = performance.now() - started;
const expanded = expandLibrarySnapshot(compact);
if (!isDeepStrictEqual(expanded, data))
  throw new Error("Library transport changed canonical data.");
console.log(
  JSON.stringify({
    skills: data.skills.length,
    originalBytes: Buffer.byteLength(JSON.stringify(data)),
    compactBytes: Buffer.byteLength(compactJson),
    encodeMs,
    exactRoundTrip: true,
  }),
);
