import { RemoteArtifact, sha256, type LibrarySnapshot } from "@selftune/control-plane";
import { commitRemoteArtifacts } from "@selftune/library/remote/sync";
import type { RemoteLibraryHandle } from "@selftune/library/remote/transport";
import { encodePackageBundle } from "@selftune/runtime/remote-library-sync";
import { computePortableSkillVersionHash } from "@selftune/library/hash";
import {
  decodePortablePackageBundleSync,
  encodePortablePackageBundleSync,
  DISTRIBUTION_PACKAGE_BUNDLE_PROFILE,
} from "@selftune/control-plane";

function privatePackage(packagePath: string) {
  const bundle = decodePortablePackageBundleSync(
    encodePackageBundle(packagePath, true),
    DISTRIBUTION_PACKAGE_BUNDLE_PROFILE,
  );
  const files = bundle.files.filter(
    (file) =>
      !["evals/generated.json", "evals/release.json", "selftune.synthesis.json"].includes(
        file.path,
      ),
  );
  const bytes = encodePortablePackageBundleSync({ files }, DISTRIBUTION_PACKAGE_BUNDLE_PROFILE);
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error("exceeds the 4 MiB cloud backup limit");
  return { bytes, objectHash: sha256(bytes), revisionHash: computePortableSkillVersionHash(files) };
}

export async function syncPrivateLibrary(input: {
  library: LibrarySnapshot;
  handle: RemoteLibraryHandle;
  selectedSkillIds?: readonly string[];
}) {
  await input.handle.capabilities();
  if (
    input.selectedSkillIds?.some(
      (id) => !input.library.skills.some((skill) => skill.skillId === id),
    )
  )
    throw new Error("Selected skill not found. Refresh your library and try again.");
  const objects = [];
  const seen = new Set<string>();
  let uploaded = 0;
  let unchanged = 0;
  const failures: string[] = [];
  for (const skill of input.library.skills) {
    if (input.selectedSkillIds && !input.selectedSkillIds.includes(skill.skillId)) continue;
    for (const revision of skill.revisions) {
      const location = revision.locations[0];
      if (!location) continue;
      let prepared: ReturnType<typeof privatePackage>;
      try {
        prepared = privatePackage(location.packagePath);
      } catch (cause) {
        failures.push(
          `${skill.name}: ${cause instanceof Error ? cause.message : "package could not be read"}`,
        );
        continue;
      }
      const { bytes, objectHash, revisionHash } = prepared;
      const artifactId = `backup-skill-object/${objectHash}/${skill.name}/${revisionHash}`;
      if (seen.has(artifactId)) continue;
      seen.add(artifactId);
      if (await input.handle.hasObject(objectHash)) unchanged += 1;
      else {
        await input.handle.putObject(objectHash, bytes);
        uploaded += 1;
      }
      objects.push(
        RemoteArtifact.make({
          artifactId,
          artifactType: "skill_revision",
          objectHash,
          revisionHash,
          updatedAt: new Date().toISOString(),
        }),
      );
    }
  }
  const failureMessage = () =>
    `Backup incomplete: ${failures.length} package(s) need attention. ${uploaded} uploaded, ${unchanged} already stored. ${failures.slice(0, 5).join("; ")}`;
  if (failures.length && !objects.length) throw new Error(failureMessage());
  const snapshot = await commitRemoteArtifacts({ handle: input.handle, artifacts: objects });
  if (failures.length) throw new Error(failureMessage());
  return { snapshot, uploaded, unchanged };
}
