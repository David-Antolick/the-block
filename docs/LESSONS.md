# Lessons Learned

Hard-won knowledge from building "The Block." Each entry captures a problem, its root cause, the solution, and the generalizable lesson. Read this before making non-trivial changes in the same area. Append-only; numbered `L001` upward.

If you can't articulate a generalizable principle ("future-me would want to know this"), it's not a lesson — leave it out.

---

## L001: Mixing component exports with non-component exports degrades Vite React-Refresh HMR

**Date:** 2026-05-16
**Phase:** 4

**Problem.** Initial Phase 4 work colocated a context provider component, the context object, three read hooks, and a couple of shared types/constants in one `src/state/BidContext.tsx`. ESLint flagged three errors via `react-refresh/only-export-components`. The natural reaction is to dismiss it as a style preference and silence the rule.

**Root cause.** Vite's React Refresh plugin (the runtime behind HMR fast refresh) can only preserve component state across edits when the edited file *only exports components*. The moment a single file exports a component **and** something else (a hook, a type, a context object, a constant), the plugin falls back to a full module reload on every save — every consumer along the tree loses its state. The ESLint rule isn't enforcing style; it's enforcing the precondition for the HMR feature you already paid for.

**Solution.** Split by export shape, not by feature: `src/state/bid-context.ts` (the non-component module — context object, types, hooks, shared `EMPTY_BIDS` sentinel) and `src/state/BidProvider.tsx` (the only file that exports a component). Hooks live next to the context they consume, not next to the provider, because they're read-mostly and edit-rarely — same group as the types. Naming follows the repo convention already in place: kebab-case for utility modules, PascalCase for component modules. See **D016** for the full architectural argument.

**Lesson.** A `react-refresh/only-export-components` lint hit is a signal to split, not to suppress. The split is mechanical: one `.tsx` file per component (or per tightly-coupled component cluster), everything else in `.ts` files alongside it. The rule earns its keep across any Vite + React context-provider pattern, and the split-by-export-shape heuristic generalizes — once you have it, you can spot the same problem in router files, route loaders that also export utilities, and any module that lumped "the React thing and the stuff that helps it" together.

---

## L002: A time-shift offset must be frozen once, not recomputed per call

**Date:** 2026-05-16
**Phase:** 8

**Problem.** The VDP countdown was a no-op — it sat at constant values like "3h 0m" and "1h 0m" instead of ticking down. Manual smoke also showed auction-status pills that wouldn't transition: lots stayed permanently Upcoming or permanently Active relative to where they sat in the dataset, never crossing the boundary as time passed. The pure-logic tests (`time.test.ts`) were all green because they pinned both `iso` and `now` and exercised the per-call override path; the bug only manifested in production where no `now` was passed.

**Root cause.** `shiftAuctionStart(iso, now?)` computed its offset as `(now ?? Date.now()) - DATASET_ANCHOR_MS`. In production, no `now` is passed → the offset is recomputed against a fresh `Date.now()` on every call. Algebraically:

```
shiftedStart  = parse(iso) + (Date.now() - anchor)
msUntil(shiftedStart) = shiftedStart - Date.now()
                      = parse(iso) - anchor     ← constant!
```

The shift target moves forward in lockstep with the wall clock, so the *remaining* time never changes. Status comparisons (`shiftedStart > now`) collapse to `parse(iso) > anchor`, which is also a per-lot constant — that's why the pill never advanced.

**Solution.** Capture `SESSION_NOW_MS = Date.now()` once at module load and use it as the default shift baseline. Tests that pass `now` explicitly still get per-call behavior; production callers get a baseline frozen at app load that real wall-clock can advance past. Added a regression block (`shift baseline is frozen at module load (countdown regression)`) that exercises the no-`now` path under `vi.useFakeTimers` + `vi.advanceTimersByTime`, since the bug only fires when nothing is passed and Date.now() is moving.

**Lesson.** A time-shift mechanic has *two* notions of "now": the **baseline** that picks where the dataset's clock lands relative to today, and the **current time** that flows past that baseline. They look identical at the type level (`Date | number`) but mean different things — conflating them by reading `Date.now()` for both makes the entire shift static. The tell is when a property that should depend on elapsed time turns out to be algebraically constant. Defaults that read `Date.now()` should be reviewed under "what happens if this function is called twice a second apart?" — if the answer is "the same thing forever," the default is wrong. Tests that pin both inputs (the textbook way to test a time-dependent function) won't catch this; you need a regression that exercises the default-arguments path with the wall clock visibly moving.

**Follow-on.** Freezing the baseline at module load fixes ticking-during-a-session but leaves a separate UX cliff: every full reload re-anchors and snaps the countdown back. **D006** covers the persistence design (localStorage with a 24h TTL so reloads continue the demo clock) — the in-session fix and the cross-session fix are different design calls but live in the same decision now after the Phase 9 doc consolidation.
