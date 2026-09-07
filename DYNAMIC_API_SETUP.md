# Togetherly dynamic API discovery

Togetherly now checks this stable URL on startup:

`https://raw.githubusercontent.com/JLEnteprises/Togetherly/main/runtime-config.json`

Resolution order:
1. Fresh GitHub runtime config
2. Last working URL cached on the device
3. `EXPO_PUBLIC_API_URL` embedded at build time

## Automatic Quick Tunnel publishing

From PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-togetherly-tunnel.ps1 -StartBackend
```

The helper starts the backend (optional), starts `cloudflared`, detects the generated `https://*.trycloudflare.com` URL, writes it to `runtime-config.json`, commits it, and pushes it to `main`.

Requirements:
- `cloudflared` installed
- Git authenticated for `https://github.com/JLEnteprises/Togetherly`
- Repository must be publicly readable for raw.githubusercontent.com runtime discovery

You no longer rebuild the IPA when the Quick Tunnel URL changes. You only need one IPA containing this runtime-discovery patch.
