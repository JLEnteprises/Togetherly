# Apply Batch 1 on Windows

This ZIP is an overlay for the current `Togetherly-v1.14-Everywhere` project. It does not replace the dynamic-API or Watch hotfix files.

1. Extract this ZIP directly into:

`C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere`

Choose **Replace files in the destination** when Windows asks.

2. In CMD or PowerShell:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
npm run typecheck
npm --prefix server run typecheck
```

3. If both pass:

```cmd
git add src server BATCH1_DRAWING_MEMORIES_HANGMAN_AUDIT.md
git commit -m "Fix drawing memories and hangman"
git push
```

4. Rebuild the normal release/PhoneOnly IPA through GitHub Actions. These are app-code changes, so they require a new IPA install.

5. After starting the backend, the existing server smoke suite can be run using the project’s normal smoke command if desired.
