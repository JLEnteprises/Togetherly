# Release A — Palette Type Repair

The 73 client errors are one underlying TypeScript strictness issue, not 73 separate feature bugs.

Release A made participant colours dynamic. `participantPalettes` is backed by a Proxy that can resolve any valid `#RRGGBB` colour at runtime, but TypeScript's `noUncheckedIndexedAccess` correctly treats a dynamic `record[key]` lookup as possibly undefined.

This repair changes source lookups from:

```ts
participantPalettes[color].accent
```

to the already-existing type-safe helper:

```ts
participantPalette(color).accent
```

and from:

```ts
theme.participantPalettes[color].accent
```

to:

```ts
theme.participantPalette(color).accent
```

`participantPalette()` always returns a complete palette, so TypeScript can prove the value is present.

The installer uses the TypeScript AST rather than blind regex replacement, so nested expressions such as `participantPalettes[colorForUser(id)]` are handled safely.

## Run

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_A_PALETTE_TYPE_REPAIR.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
npm.cmd run backend:migrate
```

If `RELEASE_A_PALETTE_LOOKUP_REMAINING.txt` appears, send that file before proceeding.
