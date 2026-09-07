# Backend boundary

The React Native app talks only to Togetherly's HTTP/WebSocket API. Feature screens never connect directly to PostgreSQL.

Current responsibilities:

- `api.ts`: API URL, authenticated fetch, token persistence + refresh
- `auth.ts`: register, login, restore, logout, password reset
- `workspace.ts`: couple creation, invite joining, invite regeneration
- `sharedItems.ts`: first collaborative data feature
- `realtime.ts`: authenticated WebSocket subscription + reconnect

Security rule: the mobile app never decides which `couple_id` it may access. The API resolves membership from the authenticated user on every shared-data operation.
