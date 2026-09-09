Togetherly v1.14.3 — Runtime Discovery BOM Repair

Problem found
The Windows tunnel launcher writes runtime-config.json using:

  Set-Content -Encoding utf8

In Windows PowerShell 5.1 this writes a UTF-8 BOM.

The GitHub runtime-config.json therefore begins with an invisible BOM before the opening {
character.

The installed Togetherly IPA already contains dynamic runtime API discovery and fetches:
  https://raw.githubusercontent.com/JLEnteprises/Togetherly/main/runtime-config.json

However its runtime parser currently calls response.json() directly. If React Native does not
strip the BOM, the JSON parse fails silently and Togetherly falls back to an old cached or
embedded tunnel URL.

This repair:
- changes the PowerShell tunnel script to write UTF-8 WITHOUT BOM
- makes the app parse runtime config defensively by stripping a BOM
- bumps the runtime URL cache key from v1 to v2 to avoid stale tunnel cache
- rewrites the current local runtime-config.json without BOM
- runs frontend TypeScript, server TypeScript and server logic checks

IMPORTANT immediate test
After this repair passes:

1. CLOSE the current Togetherly backend/tunnel windows.
2. Start the fixed server+tunnel BAT again.
3. Let it discover and push the new runtime-config.json.
4. Force-close Togetherly on the iPhone.
5. Open Togetherly again.

Because the currently installed IPA already has GitHub runtime discovery, simply publishing
a BOM-free runtime-config.json may fix the installed IPA immediately, even before rebuilding.

The client-side defensive parser/cache fix will require a future IPA rebuild, but it prevents
this issue from recurring.

Run:
  node APPLY_RUNTIME_DISCOVERY_BOM_REPAIR.js
