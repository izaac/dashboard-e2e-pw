---
name: Always test before progressing
description: Never skip testing — run tests after every batch of changes, fix before moving on
type: feedback
---

Always run tests after changes before committing or progressing to more work.
**Why:** Chief expects test-then-fix cycles, not bulk edits followed by bulk testing. Small bursts: edit → test → fix → commit → next batch.
**How to apply:** After any code changes (PO methods, spec edits, new tests), run the affected specs immediately. Fix failures before adding more changes. Never accumulate untested edits.
