# C1 Availability Syntax Repair

The C1 installer duplicated the `overlaps()` function declaration when replacing the availability interval block:

```ts
function overlaps(...) {function overlaps(...) {
```

This repair collapses it back to a single declaration and verifies there is exactly one copy.

Run:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_C1_AVAILABILITY_SYNTAX_REPAIR.js
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```
