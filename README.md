# The Block — buyer-side OPENLANE prototype

A wholesale-vehicle auction browse + bid prototype. 200 lots, 9 filter dimensions, comp-price verdicts, faithful auction state machine, localStorage persistence. Frontend only.

## How to run

**Windows (PowerShell):**

```powershell
git clone https://github.com/David-Antolick/the-block.git
cd the-block
npm install
npm run dev
```

**Linux / macOS (bash / zsh):**

```bash
git clone https://github.com/David-Antolick/the-block.git
cd the-block
npm install
npm run dev
```

Opens at `http://127.0.0.1:5173/`. On Windows specifically, use `127.0.0.1` rather than `localhost` — IPv6-first resolution adds ~2s per local request there; everywhere else either works.

Other scripts: `npm run build`, `npm run preview`, `npm test`, `npm test -- --run`, `npm run lint`.

## Stack

- React 19 + Vite 8 + TypeScript 6 (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- Tailwind v4 via `@tailwindcss/vite`
- React Router v7
- Vitest + React Testing Library
- localStorage for bid + session-anchor persistence
- No backend, no auth, no fetch — the 200-vehicle dataset is bundled at build time

Dependencies are exact-pinned (`.npmrc` `save-exact=true`); Node major pinned in `.nvmrc`. `npm audit` reports 0 vulnerabilities.

## Design thesis

A wholesale-vehicle buyer has two big questions before bidding: *am I overpaying?* and *is this hiding something?* OPENLANE's public UI buries both — comp pricing lives in a separate product (autoniq), and title-brand warnings sit inside a third-party history report. This prototype makes both un-buryable:

- **Smart Price** verdict (Below market / Fair price / Above market) on every card, comparing the lot's displayed bid against a band derived from its three nearest comps. One click into the VDP opens a panel with the actual comp lots and their current bids — the buyer can verify the verdict for themselves.
- **Title-brand banners** in red (salvage) / amber (rebuilt) on cards and VDPs, with an exclamation glyph that registers before the text resolves at small sizes. Salvage hidden by default; opt-in is one toggle and always visibly chipped above the grid.

Every other decision falls out of those two priorities. Default filters (salvage off, ended off), the inclusive verdict boundaries, OPENLANE's actual vocabulary in UI copy, the "Closing" state for the last ten minutes — each is the trust thesis applied somewhere.

## How this was built

I used Claude Code (Opus 4.7) as a coding assistant throughout — drafting implementations and helping me review my own work as it landed. The architecture, the design thesis, the trade-off calls, the choice of what to cut: those were mine. Claude helped with implementation drafts and test scaffolding; I drove what got built and reviewed every change before it shipped.

The build went in numbered phases (`phase 0` through `phase 9`). Core work on `main`, with the two stretches (Smart Price and the auction state machine) on their own feature branches merged back with `--no-ff` so the iteration shows up in the git log instead of being squashed flat. The paper trail lives in [docs/](docs/):

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — 18 architectural decisions, each with context / decision / rationale / caveat
- [`docs/LESSONS.md`](docs/LESSONS.md) — non-obvious bugs with generalizable takeaways
- [`docs/CUTS.md`](docs/CUTS.md) — features deliberately not built and why
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — per-phase shipping log

## What I built

**Inventory grid (`/`)**

- 9 filter dimensions: free-text search, multi-select makes / body styles / fuels / drivetrains, title status, auction status, price range, condition floor, Smart Price verdict
- 6 sort options including a two-tier "Ending soonest" that buckets active+upcoming lots above ended ones
- Active-filter chips with `Hides X` / `X included` semantics so deviations from the default are always visible and one click from reversal
- Desktop sticky sidebar; mobile bottom-sheet overlay with Escape-to-close
- Smart Price comp band computed lazily per card when the filter is off, eagerly shared with `applyFilters` when the filter is on

**Vehicle Details Page (`/vehicle/:id`)**

- Keyboard-cyclable image gallery (← → Home End)
- Title-brand banner under the title block when non-clean
- 14-row spec table, condition section with damage notes, dealership card
- Comp panel with three linked mini-cards and low/median/high
- Sticky bid panel: live status pill (Upcoming / Active / Closing / Ended), live countdown, inline-validated bid input, Buy Now button, "Your bids on this lot" list newest-first

**Bid flow**

- Pure-math `validateBid(amount, vehicle, userBids)` with typed rejection reasons and inline preview that runs on every keystroke
- Submit-time revalidation in the provider, persisted to localStorage
- Bid input disabled when the lot isn't Active; Closing lots accept bids until their countdown hits zero

**Auction state machine**

- 3-state engine (`AuctionStatus = 'upcoming' | 'active' | 'ended'`) drives filter and sort math
- 4-state display layer (`AuctionPhase = AuctionStatus | 'closing'`) promotes Active to Closing in the last 10 minutes (amber pill, pulse, `aria-live="polite"` countdown)
- Session anchor frozen at module load and persisted to localStorage for 24h so reloads pick up the demo clock where it left off rather than re-anchoring to a fresh `Date.now()`

## Notable decisions

Eighteen architectural decisions live in [`docs/DECISIONS.md`](docs/DECISIONS.md). Four worth surfacing here:

**Pure-math bid validator (D012).** `validateBid` knows nothing about time, DOM, or auction status. The UI gates Place Bid on auction status before the validator is called. Auction state is presentation; bid math is logic. The separation earned its keep when the bid panel needed a preview that runs on every keystroke against the same validator the submit handler calls — no second code path to drift.

**Centralized currency formatting (D005).** All currency renders go through `formatCurrency()` reading a single `CURRENCY` constant. Architectural cost: trivial. Wins: visual consistency, locale change is a one-line edit, no risk of "$22,800" on the card and "$22800.00" in the bid panel.

**Smart Price drops unbid comps (D020).** An unbid comp price tells you what the seller is *asking*, not what the market is *clearing at*. Mixing those signals produces a band that's wide where it shouldn't be — pinning `low` at zero would mark every priced lot as "above market." If no comps have priced activity, the badge disappears. Absence of badge is more honest than a "No comps" pill.

**OPENLANE vocabulary in the display layer (D007).** UI copy matches openlane.ca: "Floor Price" not "Reserve," "Floor Met" / "Floor Not Yet Met" (the actual reserve number is never rendered), "Vehicle Details Page," "Closing" for the last 10 minutes. Dataset field names stay as-is — aliases live in display only.

## Testing

104 cases across 7 files, all green:

| File | Cases | Surface |
|---|---|---|
| `src/lib/bidding.test.ts` | 24 | `validateBid` (boundary cases incl. D011 inclusive buy-now), `displayedCurrentBid`, `minNextBid`, `floorStatus` |
| `src/lib/comps.test.ts` | 17 | `findComps` year/mileage windows, `compPriceBand` dropping zero-priced comps, `smartPriceVerdict` inclusive boundaries |
| `src/lib/time.test.ts` | 20 | Shift math, UTC-parse regression with TZ-pinned vitest + non-UTC meta-guard, status/phase boundaries, `formatCountdown`, frozen-baseline regression |
| `src/components/filter-rail-state.test.ts` | 28 | `applyFilters` across all 9 dimensions, `enumerateActiveFilters` chip semantics (default-deviation in both directions) |
| `src/components/BidPanel.test.tsx` | 3 | Pill flip Active → Closing at the threshold, countdown render, `aria-live` polite-only-when-closing |
| `src/components/SmartPriceBadge.test.tsx` | 7 | Render rules (`unknown` / `null` band → empty), verdict-to-color mapping, tooltip keyboard accessibility in both variants |
| `src/components/VehicleCard.test.tsx` | 5 | Salvage / rebuilt banner names with `role="note"`, headline routes through `formatCurrency`, bid stack composition |

**Not covered**:  the `resolveSessionAnchor` validation branches (private function, exercised indirectly via the no-`now` path), full filter-rail interaction tests (the pure logic underneath them is tested at 28 cases).

## How I used AI

Claude generated many of the implementation drafts. The architecture, the design instincts, and the calls about what was actually worth building came from me. The interesting work was the loop in between — handing Claude a constrained brief, getting code back, then reading the diff for the things that look right on first pass but go sideways in production.

A few specific examples from the build, because they're real engineering content as much as they're examples of what AI-assisted dev actually looks like when you're paying attention:

- **Timezone parsing asymmetry (Phase 3.1).** The initial test suite for the time-shift math passed all-Z-suffixed ISO inputs. The dataset uses unzoned strings, which `new Date()` parses as the viewer's local time — so the tests were green but production was on a different path. Caught it in the diff, added a `parseDatasetIso` helper that normalizes unzoned inputs to UTC, pinned `TZ=America/Toronto` in the vitest config, and wrote a meta-guard test that fails loudly if the pin ever gets removed (D014, L002).

- **Closure-stale race in `placeBid` (Phase 4).** The bid provider's `useCallback` closed over `bidsByVehicle`, so two synchronous calls in the same render tick both read the same closure — the second commit would silently overwrite the first. Deferred to Phase 6 and fixed with a `useRef` mirror updated alongside `setBidsByVehicle`. The textbook fix was a functional setter, but it re-fires under React Strict Mode and would double-invoke `writeJSON` (D016).

- **`react-hooks/set-state-in-effect` in `ImageGallery` (Phase 6).** First cut clamped the active image index via `useEffect → setIndex`. The lint rule (and the React docs behind it) flag this as a cascading-render anti-pattern. Rewrote it to derive `safeIndex` at render time; stored state self-heals on the next interaction via `go()`'s modulo. Reused the same pattern in `useCountdown` later, which saved me re-learning it.

- **Countdown was algebraically frozen (Phase 8).** The VDP status pills and countdowns sat at constants like "3h 0m" instead of advancing. `shiftAuctionStart` was computing its offset against a fresh `Date.now()` per call, so the shifted target moved forward in lockstep with the wall clock — `msUntil(shiftedStart)` collapsed to `parse(iso) − anchor`, a per-lot constant. The pure-logic tests pinned both `iso` and `now` and exercised only the override path; the bug lived in the default-arguments path. Fix: capture `SESSION_NOW_MS` once at module load (then persist it across reloads via localStorage in Phase 8.3). A regression test using `vi.useFakeTimers()` covers the no-`now` path going forward (L002).

Commits are mine — no `Co-Authored-By` trailer. The AI usage is documented here, where it belongs, not in commit metadata.

My standard acceptance bar was: understand the diff, run the tests, smoke-test the UI, and be able to explain the trade-off.

### What I'd refine

Things I'd want to revisit if this were going to production:

- The comp algorithm is a flat make/model/year/mileage filter capped at three comps. Good enough for the demo, but real comp pricing should weight by similarity, factor in trim and condition grade, and report confidence per verdict.
- Bid validation tests cover algebraic boundaries but not property-based generation. Worth adding fast-check for the negative-space cases in a real auction system.
- The session-anchor + time-shift mechanic is a demo accommodation for static dataset timestamps. Production has real auction times — the whole helper goes away.
- Mobile bid panel is inline rather than a fixed-bottom bar. A proper sticky-bottom needs body-scroll-lock + safe-area handling, which I deferred for scope.

## OPENLANE sale formats

OPENLANE runs four formats. This prototype models the timed-auction slice:

| OPENLANE format | This prototype |
|---|---|
| Buy Now | `buy_now_price` field surfaces a Buy Now button; inclusive ceiling (D011) — a bid at exactly the buy-now is valid |
| 45M (45-minute timed auctions) | Time-shifted `auction_start` + 24h Active window; last 10 minutes flagged Closing with amber pulse |
| Simulcast (live + remote bidding) | Out of scope — needs real-time multi-user state |
| DealerBlock (dealer-only) | Same dataset shape would model with role gating; no auth in scope |

## Assumptions and cuts

Tracked in [`docs/CUTS.md`](docs/CUTS.md). Five worth surfacing here:

- **No backend.** localStorage covers bid persistence and the session anchor. "Live bids from other buyers" is the obvious production extension and would change the persistence story entirely (see "What I'd build next").
- **Time-shift normalization is a demo concession.** The dataset clusters around April 2026; without normalization every lot looks Ended today. The challenge brief explicitly permits this; the shift is implemented in `src/lib/time.ts` and explained in D006.
- **URL-state filters cut for scope.** Filter state is `useState`, not `useSearchParams`. Component state covers every demo path; shareable filtered URLs would be the first refactor in a production version (D018).
- **Playwright e2e tests cut.** Unit and component tests cover the load-bearing logic. Visual regression and full-browser flows are overkill at this scope.
- **Image lightbox / pan-zoom cut.** Thumbnail strip + main image with arrow-key cycling is the accessibility floor; lightbox is polish.

## What I'd do with more time

Ranked by priority:

1. **Proxy Bid (max-bid mechanic).** OPENLANE's actual bidding primitive — a buyer sets a maximum and the system bids against competitors in increments until that cap. Single biggest functional gap. The existing `validateBid` shape and BidContext would absorb it cleanly.
2. **Real-time multi-user bids via WebSockets.** Auctions are intrinsically multi-user; per-browser localStorage is the right tier for a prototype but the wrong tier for production. The current bid-state shape lifts to a server-pushed event log without restructuring.
3. **Observability.** This lands first in a production version. Highest-signal events: bid commits, validation failures (every rejected bid is a UX bug or regression signal), comp-band degeneracy (silent quality drop when no priced comps exist), route navigation funnels. Instrument those to a metrics sink, dashboard the validation-failure rate, and page on spikes.
4. **Filter-rail interaction tests.** The pure logic underneath is tested at 28 cases; the rail UI itself (mobile drawer keyboard, multi-select toggles, range-slider edges) isn't. Vitest + RTL coverage on the rail would close the obvious gap.
5. **Vehicle history report integration.** The dataset doesn't include Carfax/AutoCheck data; integration with a real provider would close the trust-thesis loop for buyers evaluating title-brand lots.
