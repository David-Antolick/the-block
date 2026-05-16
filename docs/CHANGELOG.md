# Changelog

All notable changes to "The Block." Reverse chronological — most recent at top. Format follows [keep-a-changelog](https://keepachangelog.com/).

---

## [2026-05-16] Phase 3.1 — Timezone fix in `src/lib/time.ts`

### Fixed
- **Unzoned dataset timestamps were parsed as local time.** `data/vehicles.json` stores `auction_start` as bare ISO strings (`"2026-04-05T19:00:00"`); per the ECMAScript spec these parse as local. The anchor `DATASET_ANCHOR_MS` was declared in UTC via `Date.UTC(...)`, so `(now - anchor)` and `parse(datasetIso) + offset` operated in different frames — `shiftAuctionStart` output and `auctionStatus` buckets drifted by the viewer's timezone offset. The Phase 3 tests didn't catch it because every input was Z-suffixed.

### Added
- `parseDatasetIso(iso)` private helper in `src/lib/time.ts` that appends `'Z'` when no timezone designator is present (regex `/(Z|[+-]\d{2}:?\d{2})$/`) before parsing. All three exported functions (`shiftAuctionStart`, `auctionStatus`, `msUntil`) route their ISO inputs through it.
- `describe('parseDatasetIso convention (D014)', …)` block in `src/lib/time.test.ts` with parity assertions for `shiftAuctionStart` and `auctionStatus` between bare vs Z-suffixed inputs — the check that would have caught the original bug.
- `env: { TZ: 'America/Toronto' }` in `vite.config.ts` test block, pinning vitest's process to a non-UTC timezone. Without it the parity assertions pass vacuously on a UTC CI runner (bare and Z-suffixed parse to the same epoch ms) and the regression would silently stop guarding the fix.
- Meta-guard test asserting the runtime tz offset is non-zero, so a future removal of the TZ pin fails loudly instead of letting the parity tests degrade into no-ops.

### Verified
- `npm test -- --run` — 32 passed (29 prior + 3 in the D014 block: 2 parity + 1 meta-guard).
- `npm run build` — exits 0, zero TS errors.

### Decisions
- **D014** — Treat unzoned dataset timestamps as UTC via `parseDatasetIso`.

---

## [2026-05-16] Phase 3 — Helpers (time, storage, typed data import)

### Added
- **`src/lib/time.ts`** — `shiftAuctionStart`, `auctionStatus`, `msUntil`. Anchor `DATASET_ANCHOR_MS = Date.UTC(2026, 3, 5, 12, 0, 0)`. `ACTIVE_WINDOW_MS = 6h` per I2 in the build plan. `AuctionStatus = 'upcoming' | 'active' | 'ended'` (lowercase, matching the `FloorStatus` union convention in `bidding.ts`).
- **`src/lib/time.test.ts`** — boundary cases for shift-preserves-order, upcoming, active (start boundary + just-inside-window), ended (at-boundary + long-past), and msUntil sign.
- **`src/lib/storage.ts`** — namespaced (`openlane-block:`) localStorage wrapper per D003. `readJSON<T>(key, fallback): T` and `writeJSON<T>(key, value): void`. SSR guard (`typeof window === 'undefined'`); JSON parse failures and quota errors fall back rather than throw.
- **`src/data/vehicles.ts`** — typed re-export of `data/vehicles.json` as `readonly Vehicle[]`. Single import choke-point.
- **`tsconfig.app.json`** — added `resolveJsonModule: true` and `"data/vehicles.json"` to `include` so the typed JSON import compiles. See **D015**.

### Verified
- `npm test -- --run` — 29 passed (24 bidding + 5 time).
- `npm run build` — exits 0, zero TS errors. Bundle ~191 kB JS / ~8 kB CSS. Dataset is available to bundle via `src/data/vehicles.ts` but currently tree-shaken (no UI consumer until Phase 4+); bundle size will grow once imported.

### Decisions
- **D015** — Bundle the dataset via `resolveJsonModule` + narrow `include`.

---

## [2026-05-16] Phase 1 — Scaffold

### Added
- **Vite + React 19 + TypeScript 6 + Tailwind v4 + Vitest** scaffold. Dev server bound to `127.0.0.1:5173` (Windows IPv6-fallback avoidance). Build emits a ~8 kB CSS bundle (Tailwind tree-shaking verified) and a ~191 kB JS bundle.
- **Strict TS config** in `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, plus `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `erasableSyntaxOnly`.
- **ESLint flat config** with `typescript-eslint`, `react-hooks` recommended, and `react-refresh/vite`. `npm run lint` reports zero issues on the placeholder code.
- **Vitest** with jsdom environment, globals, and `@testing-library/jest-dom` matchers wired in `src/test/setup.ts`. Types include `vitest/globals` and `@testing-library/jest-dom` so matchers don't need explicit imports in test files.
- **Dependency pinning**: `.npmrc` (`save-exact=true`), `.nvmrc` (`24`). Every direct dep in `package.json` pinned exact. `package-lock.json` committed. See **D013**.

### Verified
- `npm audit` — 0 vulnerabilities (no accepted-risk entries needed in DECISIONS).
- `npm run build` — exits 0, zero TS errors, no silenced warnings.
- `npm run test:run` — exits 0, "No test files found" (clean state; `passWithNoTests: true` in `vite.config.ts` will be removed in Phase 2 once real tests land).
- `npm run lint` — exits 0, zero issues.
- `npm run dev` — splash page renders at `http://127.0.0.1:5173/`, Tailwind classes applied, no console errors.

### Decisions
- **D013** — Pin all dependencies to exact versions.

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
