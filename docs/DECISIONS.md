# Architecture & Design Decisions

Decisions made for "The Block," the OPENLANE buyer-side auction prototype. Entries are tight by design — one paragraph each, lifting only the non-obvious why. Cross-link to lessons as `L###`.

**Numbering:** linear with gaps. Phase 9 consolidated some entries during a documentation refactor (`D009`, `D015`, `D019`, `D022`, `D023` were merged into the entries that absorb them — see the parents for current rationale). Numbers are preserved for older entries so prior commits' cross-links still resolve.

---

### D001: React + Vite + TypeScript
Frontend stack. TypeScript catches a class of mistakes at compile time that would otherwise surface in review; Vite gives a fast dev loop; the dataset is static so no backend is needed. Considered a Node + JSON API layer — rejected as fake review surface without product value.

### D002: Tailwind v4 via `@tailwindcss/vite`
Utility-first styling, no PostCSS config. Tailwind v4's Vite-native plugin removes historical setup friction; every spacing/color decision is visible in the JSX. Alternative considered: CSS modules + a hand-rolled token file — slower, less defensible.

### D003: localStorage for bid persistence
Per-browser persistence under the `openlane-block:` namespace, bids at `openlane-block:bids:v1`. Matches the "place a bid, refresh, still there" user contract without standing up a backend. The `v1` suffix lets us migrate the schema later without colliding with old data.

### D004: Vitest + React Testing Library
Vitest reuses the existing Vite config; no parallel toolchain. Tests co-located with source (`bidding.test.ts` next to `bidding.ts`). Setup at `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`.

### D005: Centralized currency formatting
All currency renders go through `formatCurrency(amount)` in `src/lib/format.ts`, which reads from a single `CURRENCY = { locale, code }` constant. **Never** inline `${value}` or a `$` symbol in JSX. The `Intl.NumberFormat` instance is computed once at module load. Locale/code becomes a one-line change.

### D006: Time-shift normalization, frozen session anchor, 24h Active window
Three closely-related calls about the demo clock. (a) Dataset `auction_start` clusters around April 2026; `shiftAuctionStart(iso, now)` offsets every timestamp by `now − DATASET_ANCHOR` so the demo has a believable mix of upcoming / active / ended. (b) The shift baseline is frozen at module load (`SESSION_NOW_MS`) and persisted to `localStorage` under `session-anchor:v1` with a 24h TTL, so countdowns tick correctly during a session and a reload picks up the same clock instead of snapping back. The TTL is long enough for "back after lunch / overnight" continuity, short enough that "back next week" gets a fresh distribution. (c) `ACTIVE_WINDOW_MS = 24h`, tuned in Phase 9 from the initial 6h after the mix check produced 9 Active lots at the session anchor (below PLAN.md's 10–30 target). The dataset clusters in ~6h slots with a 6h gap right before the anchor, so 12h was vacuous and 24h was the smallest bump that moved the count to ~29. The Closing pill (`CLOSING_WINDOW_MS = 10 min`, D021) keeps the urgency-tail signal correct regardless of the outer window — that 24h Active + 10m Closing asymmetry is the price of the wider window, acknowledged in the README. (Absorbs former D022 and D023.) See L002 for the frozen-baseline regression that motivated (b).

### D007: Match OPENLANE's actual vocabulary
UI labels use OPENLANE's domain words, not generic auction jargon. `reserve_price` → "Floor Price"; reserve-met indicator → "Floor Met" / "Floor Not Yet Met" (the reserve number itself is never surfaced); detail page → "Vehicle Details Page" / "VDP"; live states → "Active" / "Closing" / "Ended". Dataset field names stay snake_case; aliases live only in the display layer.

### D008: Two stretches — Smart Price comp indicator + faithful state machine
Both stretches make the buyer experience more trustworthy. (A) Smart Price: a green/blue/red badge on every card comparing the current bid to a band over 3 nearest comps (same make+model, year ±1, similar mileage); VDP expands into a comp panel. (B) Faithful state machine: OPENLANE phase names with a Closing pill in the last 10 minutes, live countdown on the VDP, salvage/rebuilt title-brand banners, salvage hidden by default. Two stretches held in reserve if either ran long (watchlist, quick-bid buttons) — neither needed. See D020 for Smart Price design and D021 for state-machine design.

### D010: Detailed AI-tool-use writeup in README
The README dedicates a top-level section to AI tool use: workflow (orchestrator + builder agents + senior-review pattern), three concrete review-catch examples that named specific commits, and a "what I'd refine" subsection that owns the limitations. Specific and reflective beats vague and defensive — names the files and the contribution shape so a reader can evaluate the workflow concretely.

### D011: Buy-now price is an inclusive upper bound
`validateBid` rejects `amount > buy_now_price`; `amount === buy_now_price` is valid. Matches the buyer mental model ("I'll match the Buy Now") and means the Buy Now button can route through the same `placeBid` path as a typed bid without a separate code path.

### D012: `validateBid` is pure math — no auction-status, no time, no DOM
Bid validation in `src/lib/bidding.ts` is over `(amount, vehicle, userBids)` only. Auction status is presentation and lives in `auctionStatus()`; the UI gates the Place Bid button on `status === 'active'` before calling the validator. Mixing the two would couple the core logic to time and make tests harder to write at boundaries.

### D013: Pinned dependencies + dataset JSON import plumbing
Two setup-time mechanics worth recording. (a) Every direct dep in `package.json` is pinned exact (no `^`/`~`); `.npmrc` has `save-exact=true`; `package-lock.json` committed; `.nvmrc` pins Node 24. Floating versions on a clone-and-run deliverable produce drift that's hard to reproduce in review. (b) Dataset bundling uses `resolveJsonModule: true` with a narrow `include` (`"data/vehicles.json"`) on `tsconfig.app.json`, and `src/data/vehicles.ts` is the single typed re-export — every consumer imports `VEHICLES` from there. The 200-row dataset bundles cleanly into the JS chunk; bundle warning at ~507 kB acknowledged in CHANGELOG. (Absorbs former D015.)

### D014: Treat unzoned dataset timestamps as UTC
Dataset values like `"2026-04-05T19:00:00"` (no `Z` or offset) would parse as local time per the ES spec, making `shiftAuctionStart` output and `auctionStatus` buckets vary by viewer timezone. `parseDatasetIso` appends `Z` for bare strings; already-zoned inputs pass through. The vitest runner is pinned to `TZ=America/Toronto` so the parity tests in `time.test.ts` actually exercise the asymmetry on UTC CI runners. Caught in review (see PLAN.md AI-workflow examples).

### D016: State-mgmt hygiene around React quirks — HMR split + `placeBid` ref-mirror
Two closely-related calls about the bid state plumbing. (a) Split across `src/state/bid-context.ts` (non-component: context object, hooks, types) and `src/state/BidProvider.tsx` (component: provider + storage + actions) so React Refresh's `react-refresh/only-export-components` keeps HMR working. Same split shape used in `src/components/filter-rail-state.ts`. (b) `placeBid` reads and writes through a `useRef` mirror (`latestRef.current`) rather than closing over `bidsByVehicle` directly — two synchronous calls in the same tick would otherwise see the same stale closure and the second commit would clobber the first. A functional setter (`setState(prev => ...)`) would resolve the staleness but re-runs under Strict Mode, which would double-fire `writeJSON` and validation. The ref is read inline and updated alongside `setBidsByVehicle(next)` so the next read inside `placeBid` reflects the new state. (Absorbs former D019.) See L001.

### D017: Default inventory filters hide salvage + ended
The trust thesis (CLAUDE.md) is that title-brand prominence is non-negotiable; the inventory defaults reflect that. `DEFAULT_FILTER_STATE` ships with `titleStatuses: ['clean', 'rebuilt']` and `auctionStatuses: ['upcoming', 'active']`. Both omissions surface as removable chips above the grid so users can see and undo the defaults — hidden filters are worse than visible ones.

### D018: Filter state lives in component state, not URL params
`useState` on the Inventory page; URL-state filters (`useSearchParams` plumbing for share/back/copy) logged as a `time` cut in CUTS.md. Component state covers every demo path and the bar to do URL state right (serialize, parse-validate, prune defaults, restore on navigation) is higher than it looks.

### D020: Smart Price — inclusive band boundaries, drop unbid comps, whole-map memo key
Three design micro-decisions inside the Phase 7 stretch. (a) `smartPriceVerdict` uses inclusive boundaries: `price === band.low` is "fair," not "below"; matches the buyer mental model ("matching the cheapest comp is fair"). (b) `compPriceBand` filters comps whose `displayedCurrentBid ≤ 0` *before* computing low/median/high — a lot with no bids tells us what the seller's *asking*, not what the market's *clearing at*; mixing those signals widens the band uselessly. Returns `null` when no priced comps survive, which renders as no badge (cleaner than a "no signal" pill). (c) Memo key is `bidsByVehicle` itself, not a narrow per-id key — any bid commit on the target or on a comp invalidates the cached band in one tick.

### D021: Faithful state machine — `auctionPhase` derived from `auctionStatus`, countdown on VDP only
Stretch B (D008) added three surfaces with their own micro-decisions. (a) `AuctionPhase = AuctionStatus | 'closing'` and a derived `auctionPhase()` helper that flips Active → Closing once `msUntil(end) ≤ CLOSING_WINDOW_MS` (10 min). `auctionStatus` stays the three-state engine for filter/sort math; `auctionPhase` is display-only — Closing lots still accept bids. (b) `useCountdown` is used on the VDP only; the inventory grid evaluates `auctionPhase` once per render and accepts that a card on screen won't auto-flip without a navigation. Per-card ticking (200 timers for a non-load-bearing signal) was rejected. (c) `useCountdown` derives ms-remaining on read from `Date.now()` rather than holding it in state; the effect only increments an unused tick counter — same fix shape as `ImageGallery`'s `safeIndex`, avoiding the `react-hooks/set-state-in-effect` cascade. (d) The planned hover tooltip on the Salvage filter toggle was replaced with an always-visible inline help paragraph — hover-only fails keyboard users and the trust thesis says the salvage exclusion should be a visible default, not a hidden one.
