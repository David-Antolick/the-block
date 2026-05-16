# Cuts — What I Didn't Build and Why

Living list of features, polish items, and ideas explicitly decided NOT to ship. Sources the README's "Assumptions and Scope" and "What I'd Do With More Time" sections, plus the walkthrough cheat sheet for "what you cut and why."

Format: brief title, one-line rationale, and a tag indicating *why* it was cut.

Tags:
- `scope` — explicitly out of the challenge brief
- `time` — would have fit conceptually but didn't fit the time budget
- `data` — the dataset doesn't support it honestly
- `risk` — would have added more failure surface than value
- `deferred` — kept in mind, may revisit if other stretches ship faster than expected

---

## Cut at setup phase (2026-05-16)

### Explicitly out of scope per challenge brief
- **Authentication / user accounts** — `scope` — Challenge: *"Authentication and user accounts are not required."*
- **Seller workflows / dealer admin** — `scope` — Challenge: *"You do not need to build seller workflows, checkout, payments, or dealer admin tooling."*
- **Checkout / payments** — `scope` — Same.
- **Real-time multi-user bidding** — `scope` — Requires a backend; "frontend-only is completely acceptable." Single-user bid persistence via localStorage is sufficient.

### Considered as stretches, deprioritized
- **Watchlist with `/watchlist` route** — `deferred` — Most-expected stretch; doesn't differentiate. Picked up only if comp indicator and state-machine stretches ship faster than expected.
- **Quick-bid increment buttons (+$500/$1k/$2.5k) + bid-history sparkline** — `deferred` — Nice craft signal but lower-leverage than comps. Available as a fallback.
- **True "landed cost" calculator (fees + transport + tax breakdown)** — `data` — OPENLANE has this data internally; our dataset doesn't include fees. Fabricating fees would undermine the prototype's credibility.
- **Per-seller arbitration risk stat** — `data` — Would require inventing a stat the dataset doesn't support. Title-status prominence achieves the same trust signal honestly.
- **Saved-search presets** — `deferred` — Useful for power users; lower-leverage than per-card comp indicators.

### Polish / quality items intentionally bounded
- **URL-state filters (`useSearchParams`)** — `time` — Per D018. Component state covers every demo path; URL plumbing (serialize, parse-validate, prune defaults, back-button) is real work and not on the trust-thesis critical path. Refactor path annotated in `src/components/filter-rail-state.ts`.
- **End-to-end (Playwright) tests** — `time` — Bid-validator unit tests cover the load-bearing logic; component tests beyond that are gravy. E2E is a nice-to-have I'd add in production.
- **Component tests for cards, filters, bid panel** — *partially closed in Phase 9.* BidPanel, SmartPriceBadge, VehicleCard, and FilterRail-state all have component tests now (104 tests across 7 files). Remaining gaps — ImageGallery keyboard nav, CompPanel rendering, full Inventory-page integration — are still `time`-cut.
- **SmartPriceBadge tooltip on card grid is hover-only** — `time` — Inside a card link, the badge is decorative and drops its tab stop so the parent link owns keyboard focus. Keyboard users get the comp data via card → VDP → CompPanel (a full-detail panel with the same low/median/high + the three comps). The badge's `aria-label` carries the band description so screen readers always announce it. Adding a focus tooltip on the card variant would add ~200 tab stops to the grid for a path that's already accessible. The VDP badge (`interactive=true`) does surface the tooltip on focus.
- **Image lightbox / pan-zoom on the gallery** — `time` — Thumbnail + main with arrow keys is the floor. Lightbox is a polish layer.
- **Internationalization beyond the currency demo** — `scope` — `formatCurrency()` proves the architecture; full i18n is out of scope.
- **Persistent user identity across browsers** — `scope` — Auth-adjacent; not required.
- **Vehicle history report (Carfax/AutoCheck embed)** — `data` — Dataset doesn't include it; faking it would be dishonest.
- **Server-Sent Events for live bid updates** — `scope` — Requires a backend.

---

_Add entries as you decide not to build something. The walkthrough will ask why each cut was made._
