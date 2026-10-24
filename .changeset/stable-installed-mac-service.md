---
"@selftune/desktop": patch
---

Register the macOS background service from the signed app bundle when SelfTune is installed in Applications. Updating the app no longer moves that service to a new version-specific executable path. Temporary Mac app copies, Windows, and Linux retain the extracted runtime.
