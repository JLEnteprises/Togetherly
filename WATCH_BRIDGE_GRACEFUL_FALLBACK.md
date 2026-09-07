# Togetherly WatchBridge graceful fallback hotfix

This patch makes Apple Watch integration optional at runtime.

If `TogetherlyWatchBridge` is unavailable or throws, the iPhone app now:
- continues launching normally;
- reports Watch support as unavailable;
- skips Watch context sync;
- uses no-op Watch event subscriptions;
- treats Watch cleanup as best-effort.

It does **not** replace the autolink fix. Keep the autolink fix as well so the
bridge works when native linking/signing is healthy.
