# Changelog

All notable changes to "The Block." Reverse chronological — most recent at top. Format follows [keep-a-changelog](https://keepachangelog.com/).

---

## [2026-05-16] Phase 0 — Repo cleanup baseline

### Changed
- **`.gitignore`** — added `docs/PLAN.md`, `docs/CONTEXT.md`, and `.private/`. Planning artifacts brief the build agents; they're not deliverable signal.
- **`docs/DECISIONS.md`** — reworded D001, D003, D004, D005, D009, D010 to argue each decision on engineering merits (consistency, correctness, maintainability) rather than recruiter expectations.
- **`docs/CHANGELOG.md`** (this file's prior entry), **`docs/CUTS.md`** — swept residual recruiter framing.

### Rationale
Front-loading the cleanup means every subsequent phase commit is already in deliverable shape. No last-minute editorial pass at submission time; the repo reads as honest engineering work from commit zero.

---

## [2026-05-16] Setup-phase groundwork (D001-D010)

### Context
First commit of the build. A setup-phase Claude Code session inspected the upstream challenge repo, locked in stack and architecture decisions, scouted OPENLANE's actual buyer UI for vocabulary and product signals, and prepared the documentation foundation. No application code yet — the build session will run from inside `the-block/` and execute `docs/PLAN.md`.

### Added — Project documentation
- **`CLAUDE.md`**: invariants for Claude Code sessions running in this directory. Stack, core engineering invariants (bid-validation unit tests, README-as-design-doc, centralized currency formatting), never/always rules.
- **`docs/CONTEXT.md`**: current-state snapshot. Phase, doc map, key files, before-making-changes checklist.
- **`docs/PLAN.md`**: phased build plan with file-by-file scaffolding stubs and the full `bidding.ts` algorithm. No time estimates — open-ended timebox.
- **`docs/DECISIONS.md`** (this file's sibling): D001-D010 capturing setup-phase architectural choices.
- **`docs/LESSONS.md`**: scaffold; entries to come as the build hits snags.
- **`docs/CUTS.md`**: scaffold + initial cuts already decided (auth, seller workflows, payments, live multi-user bidding, several stretches deprioritized).

### Added — Project-level skills (`.claude/skills/`)
- **`verify-before-pivot/SKILL.md`**: truth-seeking calibration before structural changes or position updates.
- **`windows-localhost-ipv6/SKILL.md`**: the Windows IPv6 fallback that adds ~2s per `localhost` call. User dev environment is Windows.
- **`docs-maintenance/SKILL.md`**: workflow for keeping DECISIONS / LESSONS / CHANGELOG / CONTEXT coherent.

### Decisions & Lessons
- **D001-D010** in `docs/DECISIONS.md`
