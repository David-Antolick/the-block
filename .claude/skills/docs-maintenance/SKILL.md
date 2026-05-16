---
name: docs-maintenance
description: Maintain a project's DECISIONS.md, LESSONS.md, CHANGELOG.md, and CONTEXT.md as a connected unit. Use when the user says "push to the docs", "update the docs", "log this", "document this decision/lesson", "refresh CONTEXT", or after shipping a non-trivial change that future-them or a future LLM will need context on. Handles entry numbering, cross-references, format consistency, CONTEXT.md staleness checks, and choosing which docs need an update.
---

# Docs Maintenance: DECISIONS / LESSONS / CHANGELOG / CONTEXT

Four docs, one unit. They reference each other and divide labor by *time horizon*: DECISIONS and LESSONS are append-only history, CHANGELOG is reverse-chronological shipping log, CONTEXT.md is the always-current state snapshot. A single change can need entries in any combination. This skill captures the workflow for keeping them in sync and the format conventions that make them useful to future-you and to LLMs that pick up the project later.

## When to apply

Trigger on explicit invocations:
- "push to the docs" / "update the docs"
- "log this decision" / "log this in DECISIONS"
- "log this lesson" / "add a lesson"
- "add a changelog entry" / "changelog this"
- "document this"

Also volunteer this workflow proactively after shipping something the user will want context on later — a non-trivial architectural choice, a tricky bug fix with a non-obvious root cause, or a multi-file feature. Ask "want me to push this to the docs?" rather than doing it unprompted.

## Step 1 — Decide what kind of entry this is

Walk the conversation back to identify what happened. Then match to one or more of:

| Happened | Goes in |
|---|---|
| Made an architectural choice with tradeoffs | DECISIONS |
| Hit a bug with a non-obvious root cause + generalizable takeaway | LESSONS |
| Shipped user-facing or operator-facing change | CHANGELOG |
| Tried something and removed it because it was worse | LESSONS (anti-pattern) |
| Reversed a previous decision | DECISIONS (new entry) + supersede old |
| **State of the project shifted** (phase change, new active area, known-issue resolved/added, current focus moved) | **CONTEXT** |
| Trivial commit, dependency bump, typo fix | **None** — don't log noise |

Most non-trivial work touches *multiple* docs: there was a decision (DECISIONS), it was driven by a problem (LESSONS), something shipped (CHANGELOG), and the project's current-state snapshot may have shifted (CONTEXT). Look for all four threads before writing — CONTEXT especially is easy to forget because it's the only one that's *replacement* rather than *append*.

If you can't articulate a generalizable lesson — *"future-me would want to know X"* — don't write a lesson entry. Logging every bug fix turns LESSONS.md into a graveyard.

## Step 2 — Detect existing conventions (don't assume)

Before writing anything, **read enough of each doc to match local conventions**:

```bash
# Quick reconnaissance:
head -50 docs/DECISIONS.md
head -50 docs/LESSONS.md
head -60 docs/CHANGELOG.md
head -80 docs/CONTEXT.md   # if present
grep -nE "^### D[0-9]+|^### L[0-9]+" docs/DECISIONS.md docs/LESSONS.md | tail -5
```

You're checking:
- **Numbering scheme**: `D001` vs `D###` vs `ADR-001` vs none. Get the highest existing number; the next entry is `N+1`.
- **Date format**: `YYYY-MM-DD` vs `YYYY-MM` vs `Month YYYY`. Match exactly.
- **Topic groupings**: `## RAG Pipeline`, `## Frontend`, etc. Find the right section to append to, or propose a new section if none fits.
- **Metadata-line style**: bold-keyword (`**Context:**`) vs YAML frontmatter vs plain prose. Match exactly.
- **Trailing whitespace for linebreaks**: many docs use `  ` (two spaces at end of line) to force markdown line breaks within an entry. Preserve.
- **CONTEXT.md staleness**: check the date stamp at the top. If it's >30 days old, the file may not reflect current state — flag this when proposing edits and verify against the *current* repo before trusting the snapshot.

If the project has **no existing docs**, ask the user before creating them. Don't create scaffolding unprompted. If they say yes, use the defaults in the templates below.

## Step 3 — Write the entries

### DECISIONS.md entry template

```markdown
### D{NUM}: {Short title — the choice, not the problem}
**Date:** {YYYY-MM-DD}
**Context:** {One or two sentences. What problem or situation forced a choice?}
**Decision:** {What we chose. Be specific — file paths, library names, config values.}
**Rationale:** {Why. Include the alternatives considered and why they lost. Mention any L### that informed this.}
**Caveat:** {Optional — known tradeoffs, future revisit triggers, scale ceilings.}
```

**Status field rule**: **omit `Status:` when active** (active is the default). Add it *only* when the decision is no longer current:

```markdown
**Status:** Superseded by D{NEW}
```
```markdown
**Status:** Deprecated — {one-sentence reason}
```

When superseding, do **not** delete the old entry. Mark its status, leave the body intact, and reference it from the new entry's Rationale.

### LESSONS.md entry template

```markdown
### L{NUM}: {Short title — the takeaway, not the bug name}
**Date:** {YYYY-MM-DD}
**Problem:** {What went wrong, observably. The symptom, not the cause.}
**Root Cause:** {The actual mechanism. Often non-obvious — that's why it's a lesson.}
**Solution:** {What fixed it. Include file paths / function names if applicable.}
**Lesson:** {The generalizable principle. This is what a future LLM reading this doc needs. If you can't write one, this isn't lesson-worthy.}
```

Title patterns that age well:
- `L047: ChromaDB Not Thread-Safe for Writes`
- `L132: Stripe API Moves Fields to Nested Objects`
- `L139: FAA Download URLs Are Date-Coded and Change Monthly`

Avoid:
- `L047: Fixed eval crash` (describes the symptom, not the lesson)
- `L132: Stripe bug` (could mean anything)

The lesson title should make sense to someone who has never seen the bug. State the principle.

### CHANGELOG.md entry template

CHANGELOG is **reverse chronological** — new entries go at the **top**, not the bottom. Most-recent-first because that's what readers want.

```markdown
## [{YYYY-MM-DD}] {Brief title} ({D### or L### references})

### Context
{One paragraph of narrative. What forced this work, what was the situation, what's the broader thread.}

### Added — {Subsection name}
- **`{file/component}`**: {one-line description with the specific change}
- ...

### Changed — {Subsection name}
- ...

### Fixed — {Subsection name}
- ...

### Removed — {Subsection name}
- ...

### Decisions & Lessons
- **D{N}-D{M}** in `docs/DECISIONS.md`
- **L{N}-L{M}** in `docs/LESSONS.md`
```

**Section names** match keep-a-changelog standard: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

**Use em-dash consistently**: `### Added — Foo` (em-dash, not double-hyphen).

The trailing `### Decisions & Lessons` block is the cross-link contract — it's the bridge that lets readers walk from "what shipped" to "why we chose it" and "what we learned." If there are no D/L entries for this changelog, omit the section rather than padding it.

### CONTEXT.md — refresh, don't append

CONTEXT.md is fundamentally different from the other three docs: **it's REPLACE rather than APPEND**. There are no D###/L### entries to add; instead, you re-write the affected sections to reflect new state.

**When to refresh CONTEXT.md**:
- Phase transition (setup → build → polish → submission)
- A new subsystem is now in production (or one was removed)
- Current focus shifted
- A "known issue" was resolved (delete it) or a new one emerged (add it)
- The doc's date stamp is more than ~2 weeks old AND meaningful work happened in between

**The date stamp at the top is the trust signal.** Always update it when you edit the file.

**Don't write history into CONTEXT.md.** History goes in DECISIONS / LESSONS / CHANGELOG.

## Step 4 — Wire up cross-references

Cross-references make the docs a *unit* instead of three separate logs. Apply liberally:

- **DECISIONS → LESSONS**: in Rationale, when a lesson informed the choice. Example: `Mitigated by paraphrasing (see L001).`
- **LESSONS → DECISIONS**: in Solution, when a decision was the fix. Example: `Switched to per-round caps (D079).`
- **DECISIONS → DECISIONS**: for supersession (`**Status:** Superseded by D079`) and for build-on (`Extends D045 by adding...`).
- **LESSONS → LESSONS**: when one lesson explains another.
- **CHANGELOG → both**: in the trailing `### Decisions & Lessons` block.

Notation is bare: `D079`, `L048`. No markdown links — they're fragile across renames.

## Step 5 — Verify before claiming done

Before reporting the docs are updated, sanity-check:

1. **Numbers are sequential and unique**
2. **Cross-references resolve** — every `D###` / `L###` mentioned should actually exist
3. **Date matches today** — use the current date, not a remembered one
4. **CHANGELOG entry is at the TOP** of the file, not appended
5. **No `Status: Active`** noise on new DECISIONS (omit by default)
6. **CONTEXT.md date stamp updated** if touched
7. **CONTEXT.md hasn't absorbed history** — that belongs in DECISIONS

## Common mistakes to avoid

- **Don't log trivial commits.** Dependency bumps, typo fixes — these don't earn entries.
- **Don't write a lesson when there's no lesson.** "Forgot a semicolon" is not L###. The principle has to generalize.
- **Don't duplicate "why" between CHANGELOG and DECISIONS.** CHANGELOG has the narrative; DECISIONS has the rationale. Link, don't copy.
- **Don't delete superseded entries.** They're the history. Mark status, link forward.
- **Don't put new CHANGELOG entries at the bottom.** Reverse chronological — top is most recent.
- **Don't skip the cross-references.** The cross-references are the entire value-add of having three docs instead of one.
- **Don't pick a date from conversation context.** Use the current date.
- **Don't let CONTEXT.md go stale silently.** If the file's date stamp is more than ~30 days old and you're already editing, do a staleness pass.
- **Don't pad CONTEXT.md with history.** Resist the urge to add a "## Recent Changes" section — that's what CHANGELOG is for.
