# Architecture & Design Decisions

Decisions made for "The Block," the OPENLANE buyer-side auction prototype. Append-only; superseded entries are marked but not removed. See `docs/CHANGELOG.md` for shipping log and `docs/LESSONS.md` for hard-won knowledge.

Numbering: `D001` upward, append-only. Cross-link to lessons as `L###`.

---

## Setup phase (2026-05-16)

### D001: React + Vite + TypeScript for the frontend
**Date:** 2026-05-16
**Context:** Challenge permits any framework. Frontend-only is allowed.
**Decision:** React 19 + Vite + TypeScript. No backend. Data loaded statically from `data/vehicles.json` via `import` at build time.
**Rationale:** TypeScript catches a class of mistakes at compile time that would otherwise surface in review. Vite gives a fast dev loop. Static JSON import avoids a fake API layer we'd have to design and defend without adding any product value.

### D002: Tailwind v4 via `@tailwindcss/vite`
**Date:** 2026-05-16
**Context:** Need a styling approach that lets us ship polished UI without burning time on CSS architecture.
**Decision:** Tailwind v4 with the Vite plugin (`@tailwindcss/vite`). Single `@import "tailwindcss"` in `src/index.css`. No PostCSS config needed.
**Rationale:** Tailwind v4's Vite-native plugin removes the historical Tailwind setup friction. Utility-first matches the "polish + craft" rubric — every spacing/color decision is visible in the JSX. Alternative considered: CSS modules with a hand-rolled design-token file. Slower; less defensible to reviewers who'd expect a framework choice.

### D003: localStorage for bid persistence
**Date:** 2026-05-16
**Context:** A buyer placing a bid and refreshing the page should see their bid retained. No backend is in scope.
**Decision:** `localStorage` keyed under the `openlane-block:` namespace. Bids stored as `Record<vehicleId, UserBid[]>` at `openlane-block:bids:v1`.
**Rationale:** Per-browser persistence is the right tier for a prototype — adds zero infrastructure and demonstrates the core "place a bid, refresh, still there" user contract. Alternatives: (a) in-memory only — refresh loses bids, which breaks the user expectation; (b) Node + JSON backend — adds review surface and operational concerns without improving the prototype's product surface. The `v1` suffix in the key lets us migrate the schema later without colliding with old data.

### D004: Vitest + React Testing Library for tests
**Date:** 2026-05-16
**Context:** Bid validation is the only piece of substantive pure logic in the app; correctness matters and is cheap to verify. The toolchain needs to integrate with Vite without duplicating config.
**Decision:** Vitest as the runner (Vite-native, fast), RTL for any component tests. Test files co-located with source (`bidding.test.ts` next to `bidding.ts`). Setup file at `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`.
**Rationale:** Vitest reuses the existing Vite config; no parallel toolchain to maintain. RTL is the React community default for component tests if we add any. Test priority is the bid validator first — pure logic, high consequence, boundary-rich — with component/integration tests added if time allows.

### D005: Centralized currency formatting
**Date:** 2026-05-16
**Context:** Currency is rendered across many components (cards, VDP headline, bid panel, comp panel, "your bids" list). Inlining `$` symbols and ad-hoc formatting invites inconsistency ("$22,800" vs. "$22800.00") and makes any future locale/currency change a search-and-replace risk.
**Decision:** All currency renders go through `formatCurrency(amount)` in `src/lib/format.ts`, which reads from a single `CURRENCY = { locale, code }` constant. **Never** inline `${value}` or a `$` symbol in JSX. The `Intl.NumberFormat` instance is computed once at module load.
**Rationale:** A single formatting choke-point enforces consistency across the app and reduces the locale/code to a one-line change at the constant. The architectural cost is trivial (a helper + a constant); the readability and maintainability win is durable. Caveat: the same rule applies to `formatOdometer()` if we ever need a unit change (km↔mi).

### D006: Time-shift normalization for `auction_start`
**Date:** 2026-05-16
**Context:** Dataset's `auction_start` values cluster around April 2026; today is May 16, 2026. Without shifting, every lot looks ended and the demo is dead.
**Decision:** `shiftAuctionStart(iso, now)` in `src/lib/time.ts` offsets every dataset timestamp by `now - DATASET_ANCHOR` where `DATASET_ANCHOR = 2026-04-05T12:00:00`. UI computes status against the shifted timestamp. Document explicitly in the README.
**Rationale:** Challenge README explicitly permits this: *"If you want to show countdowns or 'live' states, it's fine to normalize them relative to 'now' in your prototype."* Better to surface a working demo with a stated assumption than a technically-honest demo where every lot is "Ended." Alternative considered: rewrite `data/vehicles.json` timestamps — rejected because the dataset is part of the deliverable and modifying it would look like cheating.

### D007: Match OPENLANE's actual vocabulary
**Date:** 2026-05-16
**Context:** Research of openlane.com / openlane.ca shows specific industry vocabulary: "Floor Price" (not "Reserve"), "Active/Closing/Pending" (auction state phases), "Vehicle Details Page" / "VDP," "Proxy Bid" / "Auto Bid" (max-bid mechanic). Using generic auction language would read as "didn't do the research."
**Decision:** UI labels use OPENLANE's vocabulary. The dataset field is `reserve_price`; the UI labels it "Floor Price." The detail page is the "Vehicle Details Page." Auction state pills use "Upcoming / Active / Ended." The "Closing" phase (last N minutes of a Live lot) is a stretch if time permits. **Dataset field names stay as-is** — only the display layer aliases them.
**Rationale:** Cheap craft signal. Speaks to "judgment" criterion: chose deliberate domain vocabulary over default invention. Caveat: if a reviewer prefers the more generic "Reserve / Reserve Met," we can defend the choice with the research.

### D008: Stretch features — comp indicator + faithful state machine
**Date:** 2026-05-16
**Context:** Challenge says stretches should make the buyer experience "clearer, more useful, or more trustworthy." OPENLANE UI research identifies "embedded comp pricing on cards" and "title-brand prominence" as their visible gaps.
**Decision:** Ship two stretches:
1. **Smart Price comp indicator** — on each inventory card, a green/yellow/red badge comparing the current bid to a "fair price band" computed from 3 nearest comps (same make+model, year ±1, similar mileage band). On the VDP, expand into a comp panel showing the 3 comps with their current bids + condition grades. (Maps to "more useful" — answers a real buyer question.)
2. **Faithful auction state machine + title-status prominence** — use OPENLANE phase names, "Floor Price / Floor Met" labels, live countdown on the VDP, sort-by-ending-soonest. Bundle in: salvage / rebuilt title-brand red banners on cards + VDP, default filter excludes salvage unless opted in. (Maps to "more trustworthy" and "clearer.")

Two stretches held in reserve if time runs out on these:
3. Watchlist with `/watchlist` route
4. Quick-bid increment buttons + bid-history sparkline

**Rationale:** Comp indicator on cards is a feature OPENLANE *doesn't have publicly* — directly exploits the research gap and signals product thinking. Faithful state machine reads as someone who learned the domain. Both stretches reuse the existing types, format helpers, and bidding module, so build cost is mostly UI.
**Caveat:** If the comp algorithm is slow over 200 vehicles ×3-comp lookups in render, memoize via `useMemo` keyed on filter state.

### D009: Maintain DECISIONS / LESSONS / CHANGELOG / CUTS docs through the build
**Date:** 2026-05-16
**Context:** A short-lived build benefits from a paper trail any future reader can use to understand *why* the code looks the way it does. Without it, the rationale behind non-obvious choices evaporates by the next session.
**Decision:** Keep `docs/DECISIONS.md`, `docs/LESSONS.md`, `docs/CHANGELOG.md`, and `docs/CUTS.md` updated as the build proceeds. Use the `docs-maintenance` skill workflow (copied into `.claude/skills/`). The README's final pass distills these into "Notable Decisions" and "What I'd Do With More Time" sections.
**Rationale:** Costs ~10 minutes per build session; produces a coherent record of decisions, deferrals, and learned lessons. CUTS.md in particular pays for itself — every cut has a documented why, so deferred work isn't mistaken for missed work.
**Caveat:** Don't let doc maintenance become procrastination. If a session's decisions are trivial (e.g., picking a color), they don't earn entries.

### D010: Detailed + reflective AI-tool-use writeup in README
**Date:** 2026-05-16
**Context:** The challenge brief invites AI tool use and asks builders to be ready to explain how they used them, what decisions they made, and what they would refine. A vague answer ("I used Claude as autocomplete") is less honest than the actual workflow and harder to learn from than a specific one.
**Decision:** README dedicates a top-level section to AI tool use. Names specific files / patterns / sessions where Claude Code contributed. Includes a "what I'd refine" subsection that owns the limitations of AI-generated code.
**Rationale:** Specific and reflective beats vague and defensive. Naming the files and the contribution shape gives the reader something concrete to evaluate; the "what I'd refine" subsection signals critical engagement with the tooling rather than uncritical reliance on it.

---

## Build phase

### D011: Buy-now price is an inclusive upper bound for bids
**Date:** 2026-05-16
**Context:** `validateBid` rejects amounts strictly greater than `buy_now_price`. The exact-equal boundary (`amount === buy_now_price`) needed a deliberate ruling — it could be read either way, and the test suite has to assert one.
**Decision:** Inclusive ceiling. A bid exactly equal to `buy_now_price` is valid; one dollar above is rejected with reason `above_buy_now`. The boundary is covered by an explicit test case in `bidding.test.ts`.
**Rationale:** Matches the buyer mental model — "I'll just match the Buy Now price" should succeed, not silently fail. Inclusive is also how OPENLANE's own UI treats the threshold in practice. The alternative (exclusive) creates a confusing one-dollar gap between "highest legal bid" and "Buy Now" with no product justification.
**Caveat:** If a future requirement separates "place bid" from "take buy now" as distinct intents (so reaching the buy-now price *auto-converts* the action), this rule changes. Today they're the same submit path, so the ceiling is the right semantic.

### D012: `validateBid` is pure math — no auction-status, no time, no DOM
**Date:** 2026-05-16
**Context:** It's tempting to fold "lot must be Active to accept bids" into `validateBid` so the validator becomes a one-stop gate. But auction status is a function of `now`, which makes the validator time-coupled and pulls a clock into the test surface.
**Decision:** `validateBid` (and the rest of `bidding.ts`) sees only `(amount, vehicle, userBids)`. Auction-status gating lives in the UI: the Place Bid button is disabled when `auctionStatus(vehicle) !== 'active'`, and submission is short-circuited before `validateBid` is even called. The bidding module imports nothing from `time.ts`.
**Rationale:** Separates the two questions a reviewer would want answered independently: (1) is this *amount* well-formed against this lot? (2) is this lot *currently accepting* bids? Mixing them couples the unit tests to a clock and makes "what does the validator do" harder to reason about. Pure-math validators also compose better with future surfaces — e.g., a "what would this bid look like" preview tooltip that runs even on Ended lots.
**Caveat:** This shifts a responsibility onto callers (UI must gate on status). The discipline is small — `disabled={status !== 'active'}` on the bid button — and is enforced by the M6 smoke check.

---

### D013: Pin all dependencies to exact versions
**Date:** 2026-05-16
**Context:** A loose `package.json` with caret ranges (`^1.2.3`) means every reinstall can drift to a new transitive tree and silently change behavior. For a deliverable other people will clone and run, that reproducibility gap is the wrong default.
**Decision:** Pin every direct dependency to an exact version (no `^`, no `~`). Enforce going forward with `.npmrc` containing `save-exact=true`. Lock the Node major version via `.nvmrc` (currently `24`). Run `npm audit` after every install; address high/critical CVEs explicitly, never via `npm audit fix --force`. Commit `package-lock.json`.
**Rationale:** Reproducible installs are a low-cost supply-chain hygiene win. The `.npmrc` flag prevents accidental loosening when future deps get added. `npm audit` at Phase 1 reported 0 vulnerabilities — no accepted-risk entries needed.
**Caveat:** Exact pins mean we won't auto-pick up patch upgrades. That's the point — upgrades become an explicit, reviewable change.

### D014: Treat unzoned dataset timestamps as UTC via `parseDatasetIso`
**Date:** 2026-05-16
**Context:** `data/vehicles.json` stores `auction_start` as bare ISO strings with no timezone designator (e.g. `"2026-04-05T19:00:00"`). Per the ECMAScript spec, `new Date(iso)` parses such strings as **local time**. The time-shift anchor (`DATASET_ANCHOR_MS`) is declared in UTC via `Date.UTC(...)`. The two frames being different means `(now - anchor)` is computed in UTC, but `parse(datasetIso) + offset` lands the dataset value at a timezone-dependent moment — `shiftAuctionStart` output and `auctionStatus` buckets drift by the viewer's tz offset (~5h in EST, ~9h in JST). The original `time.test.ts` cases passed because every input was Z-suffixed, masking the asymmetry between test inputs and production inputs.
**Decision:** Introduce a private `parseDatasetIso(iso)` helper in `src/lib/time.ts` that appends `'Z'` when no timezone designator is present (regex `/(Z|[+-]\d{2}:?\d{2})$/`), then parses. All three exported functions (`shiftAuctionStart`, `auctionStatus`, `msUntil`) route their ISO inputs through it. The anchor stays as `Date.UTC(2026, 3, 5, 12, 0, 0)`. Regression block (`parseDatasetIso convention (D014)` in `time.test.ts`) asserts parity between bare and Z-suffixed inputs against the dataset's actual shape — and pins vitest's process timezone (`env: { TZ: 'America/Toronto' }` in `vite.config.ts`) plus a non-UTC-offset meta-guard so the parity assertions don't degrade into no-ops on a UTC CI runner.
**Rationale:** The dataset's missing-`Z` is the source-of-truth convention we have to accept (it's part of the deliverable, not something to mutate). Normalizing on the parsing side keeps the rest of the module timezone-agnostic and the anchor explicit. The regex tolerates the few zoned forms a future dataset variant might use (`Z`, `±HH:MM`, `±HHMM`) so the helper isn't fragile to format drift. Pinning the test TZ is the cheapest way to make the regression bug-shape independent of where it runs.
**Caveat:** If a future schema migration adds real local timezones to the dataset (e.g. dealer-local times in the seller's region), this convention is wrong and would silently mis-bucket lots. The fix is dataset-side: emit explicit `±HH:MM` offsets and the helper continues to work.

### D015: Bundle the dataset via `resolveJsonModule` + narrow `include`
**Date:** 2026-05-16
**Context:** `data/vehicles.json` lives outside `src/`. The vite-default `tsconfig.app.json` has `include: ["src"]` and no `resolveJsonModule`, so a typed `import data from '../../data/vehicles.json'` doesn't compile. Alternatives considered: (a) `fetch('/vehicles.json')` at runtime, (b) an ambient `.d.ts` declaring the JSON module as `any`, (c) bundling via the tsconfig knobs.
**Decision:** Set `resolveJsonModule: true` and add the single file `"data/vehicles.json"` (not `"data/**"`) to `include`. Dataset is re-exported once from `src/data/vehicles.ts` as `readonly Vehicle[]` so the path and cast both live behind one choke-point.
**Rationale:** The dataset is build-time static and ~200 records — bundling beats `fetch` (no async, no loading state, no network failure mode, no extra `public/` copy step). `resolveJsonModule: true` is the canonical TS lever for typed JSON. Narrowing `include` to the one JSON file (not a glob over `data/**`) keeps the type-check surface tight, leaves `scripts/generate_vehicles.mjs` untouched, and means the only path the compiler walks outside `src/` is the deliberate one.
**Caveat:** Bundling means the dataset ships inside the JS bundle once a consumer imports it (Phase 4+). For a 200-record demo the size impact is acceptable; we'll measure the actual delta against the Phase 1 baseline (~191 kB JS) at first import. If the dataset grew an order of magnitude, we'd want to revisit and lazy-load instead.
