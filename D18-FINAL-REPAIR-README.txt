Togetherly v1.14.3 — D18 Final Repair

What happened
The D18 repair reached `expo lint`.

Because this project had no ESLint configuration yet, Expo automatically:
- installed eslint
- installed eslint-config-expo
- generated ESLint configuration
- changed package.json / package-lock / node_modules

Then, inside that same Expo CLI run, Expo failed with:

  Cannot find module 'eslint'

This was an Expo lint bootstrap/tooling failure, not a Togetherly TypeScript or runtime failure.

What this final repair does
1. Removes only the transient ESLint dependencies that Expo added during that failed run.
2. Removes an Expo-generated ESLint config if one was created.
3. Reconciles package-lock/node_modules using npm install --ignore-scripts.
4. Re-runs the complete D18 source-level UX regression audit.
5. Runs the established project validations:
   - frontend TypeScript
   - server TypeScript
   - server logic smoke checks
6. Verifies the accidental ESLint dependencies are gone.

Why lint is not retried
The project did not previously have an ESLint setup.
`expo lint` is interactive on first use and mutates the project.
That makes it unsuitable as a release validation step until linting is intentionally introduced as its own configured change.

D18 remains a no-new-dependency release.

Run:
  node APPLY_RELEASE_D18_FINAL_REPAIR.js

If this passes, D18 is complete and the current UX roadmap is complete.
