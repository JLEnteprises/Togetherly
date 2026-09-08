# Togetherly v1.14.3 Dynamic API TypeScript Fix

This patch fixes the TypeScript errors introduced by the dynamic runtime API patch in `src/services/backend/api.ts`.

It declares `embeddedApiUrl` and `backendConfigPromise`, and makes the active `apiUrl` mutable so runtime discovery can replace the embedded fallback URL.

Apply over the project root, then run:

```cmd
git add src\services\backend\api.ts
git commit -m "Fix dynamic API runtime config"
git push
```
