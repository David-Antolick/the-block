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
