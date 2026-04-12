# @selftune/dashboard-core

Shared dashboard application layer used by both the cloud dashboard and the local OSS dashboard. Canonical copy lives here; synced to `oss/selftune/packages/dashboard-core` via `scripts/sync-embedded-shared.sh`.

| Directory | Contents |
|-----------|----------|
| `src/host/` | Capability model, host adapter contracts, provider/context hooks |
| `src/models/` | Normalized view models shared across hosts |
| `src/routes/` | Route definition and route access helpers |
| `src/chrome/` | Shared shell, sidebar, header, runtime badge, and chrome types |
| `src/gates/` | Shared feature gates, locked-route surfaces, and upgrade CTAs |
| `src/screens/` | Shared screen implementations; analytics, the overview autonomy/comparison/support surfaces, skills library, and the skill report scaffold/trust chrome are extracted |

**Exports:** `.`, `./host`, `./models`, `./routes`, `./chrome`, `./gates`, `./screens`

**Dependencies:** `@selftune/ui`, `lucide-react`, `react` (peer), `react-dom` (peer)

**Important:** Do NOT edit `oss/selftune/packages/dashboard-core/` directly. Edit here and run `scripts/sync-embedded-shared.sh`.
