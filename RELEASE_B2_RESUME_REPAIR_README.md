# Togetherly B2 Resume Repair

The original B2 installer stopped part-way through after successfully modifying Tasks and Memories. It failed when trying to replace one large Date Ideas block whose exact source text differed slightly.

Do **not** rerun the original B2 installer.

This repair:

- verifies Tasks and Memories already contain the expected B2 changes;
- resumes at Date Ideas using smaller, safer replacements;
- completes Lists;
- completes Countdowns;
- completes Notes;
- includes the Notes shared→private ownership UI fix;
- runs a final marker audit.

## Apply

Extract into the project root, then:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_B2_RESUME_REPAIR.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_B2_RESUME_AUDIT_REMAINING.txt` appears, send it before committing.
