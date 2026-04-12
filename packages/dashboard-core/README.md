# @selftune/dashboard-core

Shared dashboard application layer for SelfTune cloud and local hosts.

This package owns:

- capability and entitlement contracts
- host adapter interfaces
- normalized dashboard view models
- shared route definition helpers
- shared dashboard chrome primitives used by cloud and local hosts
- shared feature gates and locked-route upgrade surfaces
- shared screen implementations, including analytics, the overview autonomy/comparison/support surfaces, skills library, and the shared skill report scaffold/trust chrome

## Usage

```ts
import {
  DashboardChrome,
  DashboardHostProvider,
  canUseFeature,
  type Capabilities,
  type DashboardHostAdapter,
} from "@selftune/dashboard-core";
```

## OSS Mirror

This package is canonical in the root `packages/` directory and mirrored into
`oss/selftune/packages/dashboard-core` via `scripts/sync-embedded-shared.sh`.
