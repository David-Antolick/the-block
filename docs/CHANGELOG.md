# Changelog

All notable changes to "The Block." Reverse chronological — most recent at top. Format follows [keep-a-changelog](https://keepachangelog.com/).

---

## [2026-05-16] Phase 7 — Stretch A · Smart Price comps (`feature/smart-price`)

Cross-links **D008** (stretch decision) and **D020** (verdict/band design micro-decisions). First stretch branch; merges to `main` after M7 verification.

### Added
- **`src/lib/comps.ts`** — pure-function comp engine matching the bidding-module discipline (D012). `findComps(target, pool)` filters by same make+model, `target.year ± YEAR_WINDOW` (1), excludes the target by id, then sorts by absolute mileage distance and truncates to `COMP_COUNT` (3). `compPriceBand(target, pool, bidsByVehicle)` runs `findComps` and reads each comp's `displayedCurrentBid(...)` — user-placed bids on comps move the band the way they'd move any market signal. Returns `null` when no comps or every comp price ≤ 0. `smartPriceVerdict(price, band)` buckets the candidate against the band with inclusive boundaries (`'below' | 'fair' | 'above' | 'unknown'`). Median is `prices[floor(n/2)]` post-sort — exact for odd n, biased toward the higher value for even n; acknowledged in JSDoc + the panel footnote (I3).
- **`src/lib/comps.test.ts`** — 16 cases. `findComps`: exclude-by-id, make/model match, year ±1 boundaries (in vs. out), mileage-ordering with mixed near/far, `COMP_COUNT` cap, empty-pool fallthrough. `compPriceBand`: null on no-comps, null on all-zero prices, low/median/high over real prices, user-bid on a comp reshapes the high. `smartPriceVerdict`: null band → unknown, zero price → unknown, strict-below, inclusive at low boundary, inclusive at high boundary, strict-above.
- **`src/components/SmartPriceBadge.tsx`** — verdict pill (green / blue / red / gray) + `role="tooltip"` carrying the comp-set explanation (count · low · median · high). `tabIndex={0}` + `peer-focus:block` keeps the tooltip reachable for keyboard users — hover-only would fail the M7 accessibility floor. `size="sm"` for the card slot, `size="md"` for the VDP headline. `tooltipId` prop scopes `aria-describedby` so card-grid + VDP badges don't collide.
- **`src/components/CompPanel.tsx`** — "Comparable lots" section on the VDP: low/median/high `<dl>`, three mini-cards linking to each comp's VDP (`{year} {make} {model}` · odometer + lot · `displayedCurrentBid` formatted). `useMemo` keyed on `[vehicle, bidsByVehicle]` so commits in either direction (target or comp) refresh the panel in one tick. Falls back to "No recent comps with active pricing…" when the band is null.

### Changed
- **`src/components/VehicleCard.tsx`** — dropped the `<SmartPriceSlot />` placeholder; renders the real `<SmartPriceBadge />` keyed on `compPriceBand(vehicle, VEHICLES, bidsByVehicle)`. Memo key matches the panel for consistency.
- **`src/components/BidPanel.tsx`** — headline current bid now reads as a flex row with the SmartPriceBadge (`size="md"`) next to it. Same memo shape; the badge updates the instant a comp's bid commits.
- **`src/pages/VehicleDetail.tsx`** — left column adds `<CompPanel />` between `ConditionSection` and `DealershipCard`, so the comp explanation lands directly under the condition signal that frames it.

### Verified
- `npm run lint` — clean.
- `npm test -- --run` — 71 passed (55 prior + 16 in the new `comps.test.ts`).
- `npm run build` — zero TS errors. Bundle 504 kB JS / 115 kB gzip (~+5 kB JS over Phase 6 — the comp lib + two components + the new VDP slot).
- Spot-check: opened three VDPs by make/model density (Ram 1500, Mazda CX-5, BMW 5 Series); each rendered three comp mini-cards and a non-degenerate band. Verdict on a starting-bid-only lot resolves to `'below'` (price > 0 < band.low) per M7 expectation, never `'above'`.

### Decisions
- **D020** — Smart Price verdict uses inclusive band boundaries; band/verdict drop to `null`/`'unknown'` when the comp signal degenerates; consumers memoize on the whole `bidsByVehicle` map.

---

## [2026-05-16] Phase 5 — Inventory grid + filter rail + sort

### Added
- **`src/components/VehicleCard.tsx`** — clickable `<Link>` card (whole card → VDP). Hero image with lazy loading + alt = `"{year} {make} {model}"`. Title-brand badge pinned top-left of the image: red for `salvage`, amber for `rebuilt`, hidden for `clean`. Auction-status pill top-right ("Upcoming" / "Active" / "Ended" — no "Closing" yet; reserved for Stretch B). Title + trim + lot, condition-grade chip, odometer / body / location dl, and a current-bid block routed through `formatCurrency(displayedCurrentBid(vehicle, useBidsFor(vehicle.id)))`. Floor copy is "Floor Met" / "Floor Not Yet Met" only when `reserve_price != null` — the reserve number is never rendered (per CLAUDE.md + D007). `<SmartPriceSlot />` placeholder bottom-right of the price block holds visual rhythm for the Phase 7 (Stretch A) badge.
- **`src/components/FilterRail.tsx`** — dual-surface filter rail. Desktop (`lg+`) renders as a sticky sidebar; mobile renders a fixed-position bottom-sheet overlay with backdrop + Escape-to-close + Done button (per I5 — no focus-trap library). State is owned by the page and passed via `value` / `onChange`. Facet values (makes, body styles, fuels, drivetrains) are derived from the inventory at render via `useMemo`, so the rail tracks the dataset rather than enumerating statically. Native `<label>`-wrapped checkboxes throughout; price range uses paired `<input type="number">`, condition grade uses `<input type="range">` (0–5, step 0.5).
- **`src/components/filter-rail-state.ts`** — non-component sibling holding `FilterState`, `DEFAULT_FILTER_STATE`, `ALL_TITLE_STATUSES`, `ALL_AUCTION_STATUSES`, `applyFilters(vehicles, state, bidsByVehicle)`, and `enumerateActiveFilters(state)`. Split for the same `react-refresh/only-export-components` reason as D016 / L001. `applyFilters` uses `displayedCurrentBid(...)` for the price-range filter so the filter and the card never disagree on the number being filtered against.
- **`src/pages/Inventory.tsx`** — replaces the Phase 4 stub wholesale. Owns `FilterState` + `SortKey` + mobile-rail-open state, subscribes to `useBids()`, derives `filteredSorted` via `useMemo`. Renders header (count, mobile "Filters" button with chip count, sort `<select>`), active-filter chips (clickable `×` per chip, "Reset all" link), `<FilterRail>` sidebar + grid (1 / 2 / 3 columns at sm / xl breakpoints), and an empty state with "Reset filters" CTA. Sort options: Ending soonest (default), Year newest, Price low / high, Mileage lowest, Condition highest. The "Ending soonest" comparator buckets active+upcoming (close > now) ahead of ended and orders within each bucket: ascending for live lots, descending for ended (so opted-in "show ended" leads with freshly-dead lots, not stale ones).
- **`src/components/filter-rail-state.test.ts`** — 23 cases covering `applyFilters` (empty-array = no-filter, multi-select AND semantics, default salvage/ended omissions, opt-in inclusion, `displayedCurrentBid` integration on the price filter, min/max bounds, condition threshold, case-insensitive search across make / model / trim / lot, whitespace-only search treated as empty) and `enumerateActiveFilters` (no chips on default, search chip uses trimmed query, one chip per multi-select item, default-deviation chips in both directions for title + auction status, currency-formatted price chips, `chip.clear()` reverses its own effect without touching other filters). Anchor-relative ISOs keep auction-status assertions clear of the 6h boundary so the millisecond drift inside `auctionStatus`'s two `Date.now()` calls doesn't flake tests.

### Changed
- **`src/components/VehicleCard.tsx`** — `STATUS_LABEL` and `STATUS_PILL_CLASS` now key off the exported `AuctionStatus` union from `src/lib/time.ts` instead of re-declaring the literal union inline. If a future variant lands in `time.ts` (e.g. Stretch B's "closing"), the card will fail to compile until the records are updated — the source of truth lives in one place.

### Verified
- `npm run lint` — clean.
- `npm run build` — zero TS errors. Bundle 488 kB JS / 111 kB gzip (+17 kB JS over Phase 4 — the new components and filter logic).
- `npm test -- --run` — 55 passed (32 prior + 23 in the new filter-rail-state suite).
- Default view rendered count: 56 lots (51 upcoming + 9 active − salvage overlap, against today's clock and the 6h `ACTIVE_WINDOW_MS`). Mix flagged for Phase 9 review per I2.
- Grep for `\$\{` / `'\$'` in `src/**/*.tsx` — only matches are template literals for image alt, route paths, class names, and chip-count display. No inline currency.

### Decisions
- **D017** — Default inventory filters hide salvage titles and ended lots; chips surface both omissions.
- **D018** — Inventory filter state lives in component state (`useState`), not URL params; URL-state filters logged as a `time` cut.

### Cuts
- **URL-state filters** — `time` (CUTS.md, polish section).

---

## [2026-05-16] Phase 6 — Vehicle Details Page (VDP)

First true two-agent fan-out: Agent A built the left-column components in parallel with Agent B building the right column, then main-agent integration composed them into `src/pages/VehicleDetail.tsx`.

### Added — Left column (Agent A)
- **`src/components/ImageGallery.tsx`** — main image + thumbnail strip; ←/→/Home/End cycle when the gallery has focus; nav-button overlays for mouse; `aria-current` / `aria-selected` on the active thumb; figure + figcaption for SR context; "N / M" counter; placeholder block when `images.length === 0`.
- **`src/components/VehicleTitleBlock.tsx`** — lot eyebrow → H1 (year/make/model) → trim + city/province sub-line.
- **`src/components/TitleBrandBanner.tsx`** — full-width banner under the title block; red for salvage, amber for rebuilt, returns null for clean. `role="note"`. Phase 6 baseline; Stretch B (D008) can extend.
- **`src/components/SpecTable.tsx`** — 14-row `<dl>` (VIN through Location), two-column on desktop / one on mobile. Odometer routed through `formatOdometer()`.
- **`src/components/ConditionSection.tsx`** — grade pill (Excellent ≥4 / Average ≥3 / Rough), condition report paragraph, damage notes with "No reported damage." fallback per M6.
- **`src/components/DealershipCard.tsx`** — initials avatar + dealership name + location. Sticks to dataset fields (no invented rating/history per CLAUDE.md).

### Added — Right column (Agent B)
- **`src/components/BidPanel.tsx`** — status pill, headline current bid via `formatCurrency(displayedCurrentBid(...))`, floor indicator (state-only, never the reserve number per D007), live preview validation + submit-time `validateBid`, Place Bid disabled when `auctionStatus !== 'active'`, Buy Now button when `buy_now_price != null` (also gated on Active), "Your bids on this lot" newest-first. Positioning-agnostic — page wraps for layout.

### Changed
- **`src/state/BidProvider.tsx`** — Phase 4 carry-over fix: `placeBid` now reads/writes through a `useRef` mirror of `bidsByVehicle` so two synchronous calls in the same tick can't clobber each other. Dep array empties → stable callback identity. See **D019**.
- **`src/pages/VehicleDetail.tsx`** — replaced the Phase 4 stub with the two-column composition: left column on `lg:col-span-2`, sticky right column on `lg+`, single-column stack below. Back-to-inventory link + not-found fallback retained.

### Fixed — During integration
- **`src/components/ImageGallery.tsx`** — `react-hooks/set-state-in-effect` lint hit. The original `useEffect → setIndex` guard for image-array shrink caused cascading renders. Replaced with derived `safeIndex = count > 0 ? Math.min(index, count - 1) : 0` clamped during render; stored state self-heals on next interaction via `go()`'s modulo.

### Verified
- `npm run lint` — zero issues.
- `npm test -- --run` — 55 passed (no new test surface this phase; `BidPanel.test.tsx` and `ImageGallery.test.tsx` are deferred to Phase 9 per the user's polish-later stance).
- `npm run build` — zero TS errors. Bundle 499 kB JS / 114 kB gzip (~+11 kB over Phase 5).

### Decisions
- **D019** — `placeBid` reads and writes through a ref, not a closure or functional setter (Strict Mode side-effect avoidance).

### Open for Phase 7+
- Component tests for the right-column bid flow + the image gallery's keyboard nav — pure-function targets (`applyFilters`, `enumerateActiveFilters`) are already covered; component-tests gap remains.
- Mobile bid panel is inline rather than fixed-bottom (the floor pattern, per I5). A true fixed-bottom needs body-scroll-lock + safe-area handling; tracked as polish.

---

## [2026-05-16] Phase 4 — App shell, routing, BidContext

### Added
- **`src/state/bid-context.ts`** — `BidContext`, `BidsByVehicle` type, `BidContextValue`, and the read hooks `useBids` / `useBidsFor` / `usePlaceBid`. Hooks throw with a clear message if used outside `<BidProvider>`. `useBidsFor` returns a frozen module-level empty array so consumers' memo/effect deps are referentially stable when an unrelated vehicle's bids change.
- **`src/state/BidProvider.tsx`** — `BidProvider` component. Lazy-hydrates state once from `localStorage` via `readJSON('bids:v1', {})` (namespaced to `openlane-block:bids:v1` per D003). `placeBid(vehicle, amount)` revalidates against current state at commit time using `validateBid` (per D012 — pure-math; provider is the validate-and-commit choke-point), persists on `ok`, and returns the `ValidationResult` so callers render the same error message as inline preview.
- **`src/App.tsx`** — replaces the Phase 1 splash with `BrowserRouter` → `BidProvider` → header + `Routes`. React Router v7 per I6. Routes: `/` → `Inventory`, `/vehicle/:id` → `VehicleDetail`, `*` → inline `NotFound`. Provider wraps the router so any future page (Phase 5+) has hook access without extra plumbing.
- **`src/pages/Inventory.tsx`** — Phase 4 stub: lists the first 20 vehicles as `<Link>`s to their VDPs so the router can be smoke-tested. Replaced wholesale in Phase 5.
- **`src/pages/VehicleDetail.tsx`** — Phase 4 stub: reads `:id`, renders headline fields + a minimal place-bid form that exercises `usePlaceBid` end-to-end. Returns a not-found block for unknown ids. Replaced in Phase 6 by the full VDP.

### Changed
- `EMPTY_BIDS` is now exported from `bid-context.ts` and imported by `BidProvider.tsx` (previously declared in both files). Both halves now share the same frozen-empty-array reference so `useBidsFor` and the provider's commit path can't drift apart.

### Verified
- `npm run lint` — zero issues. (Initial draft colocated provider + hooks in one `.tsx`; React Refresh's `only-export-components` flagged the hooks — see L001. Split into `bid-context.ts` (non-component) + `BidProvider.tsx` per D016 instead of suppressing the rule.)
- `npm test -- --run` — 32 passed (no test-surface changes in this phase).
- `npm run build` — exits 0, zero TS errors. Bundle now ~471 kB JS / 107 kB gzip — the jump from the Phase 3 baseline (~191 kB JS) is the dataset being tree-shaken in for the first time via `Inventory`'s `VEHICLES.slice(0, 20)`. Expected per D015's caveat; will revisit only if growth becomes a problem.

### Carry-overs to Phase 6
- `placeBid` closes over `bidsByVehicle`; two synchronous calls in the same render tick both read the same closure and the second overwrites the first. Fix flagged in `docs/PLAN.md` Phase 6 — use a `useRef` for the latest state, read inside the callback, update inline alongside `setBidsByVehicle`. Signature unchanged.

### Decisions
- **D016** — Split bid state across `bid-context.ts` (non-component) and `BidProvider.tsx` (component) to preserve React Refresh HMR.

### Lessons
- **L001** — A `react-refresh/only-export-components` lint hit is a signal to split, not to suppress; the rule enforces the precondition for HMR fast refresh.

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
