# CLAUDE.md — The Block (OPENLANE buyer-side prototype)

This file is the agent runbook for the buyer-side OPENLANE auction prototype. The setup session locked in stack and architecture decisions; before writing any code, read `docs/DECISIONS.md` (D001+). The build plan (`docs/PLAN.md`) and state snapshot (`docs/CONTEXT.md`) are gitignored — they exist locally to brief build agents, not as deliverable signal.

## Design thesis

A wholesale-vehicle buyer's two biggest unanswered questions in the public OPENLANE UI are:
1. **Am I about to overpay?** OPENLANE's comp-pricing product (autoniq) is sold separately, not embedded on listings.
2. **Is this vehicle hiding something?** Title-brand warnings (salvage / rebuilt) aren't first-class signals in their public UI.

This prototype makes both un-buryable. Every card shows a **Smart Price** comp indicator (vs. 3 nearest comps). Title brands get red banners on cards + VDP. Salvage is excluded from the default filter unless opted in. Everything else flows from those two priorities.

## Core engineering invariants

1. **Bid-validation logic is unit-tested.** The validator lives in `src/lib/bidding.ts`; tests live in `src/lib/bidding.test.ts`. Boundary cases matter more than count. This is the load-bearing pure-logic module — every UI consumer depends on it being correct.

2. **README and inline docs stand alone.** Anyone — a teammate, a future maintainer, an automated reader — should be able to clone the repo and understand intent without external context. Use the `docs/DECISIONS.md` → README pipeline so the README reads as a deliberate design writeup, not a how-to.

3. **Currency formatting is centralized in one place.** All currency renders go through `formatCurrency()` in `src/lib/format.ts`. The `CURRENCY` locale + code lives in one constant. **Never** write `${value}` or `$` inline in JSX. Rationale: consistency across pages, and locale/code becomes a single-point change if requirements shift.

## Stack

- **React 19 + Vite + TypeScript** (frontend-only, no backend, no auth)
- **Tailwind v4** for styling (via `@tailwindcss/vite` plugin)
- **React Router** for `/` (inventory grid) and `/vehicle/:id` (VDP)
- **Vitest + React Testing Library** for tests
- **localStorage** for bid persistence (key namespace: `openlane-block:`)
- Data: `data/vehicles.json` — **do not modify**. Don't touch `scripts/generate_vehicles.mjs`.

## OPENLANE vocabulary mapping (use these labels in UI copy)

Dataset uses generic terms; OPENLANE uses domain-specific ones. **Aliases live in the display layer only** — dataset field names stay as `reserve_price`, `auction_start`, etc.

| Dataset field / concept | UI label | Why |
|---|---|---|
| `reserve_price` | "Floor Price" | OPENLANE's actual term. "Reserve" is generic; "Floor Price" signals research. |
| Reserve met indicator | "Floor Met" / "Floor Not Yet Met" | Same as above. |
| Vehicle detail page | "Vehicle Details Page" or "VDP" | OPENLANE's internal name; using it reads as domain fluency. |
| Auction status (live) | "Active" (not "Live") | OPENLANE phase name. |
| Auction status (about to end) | "Closing" (last 10 min, optional) | Stretch label. Only show if comp + state-machine stretches both ship. |
| `bid_count` | "Bids" or "Bid count" | Plain English fine here. |
| Max-bid mechanic (future) | "Proxy Bid" or "Auto Bid" | OPENLANE's term. We're not building max-bid, but if we mention it in README "what I'd do with more time," use this name. |

Do not invent vocabulary that contradicts theirs. When in doubt, default to plain English over generic auction jargon.

## Never / Always

- **Always** route currency through `formatCurrency()`. No `$` inline anywhere.
- **Always** use the `Vehicle` type from `src/types/vehicle.ts`. The data is snake_case JSON — define the type once.
- **Always** validate bids through `validateBid()` in `src/lib/bidding.ts`. Components consume the result.
- **Always** label reserve as "Floor Price" in the UI. (Internal variables can use `reserve` — it's just the user-facing copy.)
- **Always** show title-brand badges (`salvage`, `rebuilt`) prominently on cards and VDP. Default filter excludes `salvage` unless toggled.
- **Always** prefer 127.0.0.1 over `localhost` in README dev-server examples (user is on Windows; see `.claude/skills/windows-localhost-ipv6/`).
- **Never** modify `data/vehicles.json` or `scripts/generate_vehicles.mjs`. The dataset is part of the deliverable.
- **Never** commit `node_modules/`, `dist/`, or `.env*`.
- **Never** inline a hardcoded currency symbol in JSX.
- **Never** invent dataset fields (fees, dealer ratings, history reports) — if it's not in the JSON, don't render it. Honest cuts go in `docs/CUTS.md`.

## Time-shift for auction timestamps (D006)

Dataset times cluster around April 2026; today is May 2026 — every lot would look "Ended." Challenge README explicitly allows normalization. Implementation in `src/lib/time.ts` (`shiftAuctionStart`, `auctionStatus`). Surface this in the README under "Notable Decisions."

## Docs-maintenance discipline (D009)

Keep these four docs current as you build. Doing so produces a coherent paper trail any reader can use to understand the project's evolution.

| Doc | When to update | What goes in |
|---|---|---|
| `docs/DECISIONS.md` | Per non-trivial architectural choice | `D###` entry: Context / Decision / Rationale / (optional) Caveat |
| `docs/LESSONS.md` | Per non-obvious root cause with a generalizable takeaway | `L###` entry: Problem / Root Cause / Solution / Lesson |
| `docs/CHANGELOG.md` | Per shipped subsystem | Reverse chronological. Append at top. Cross-link to D/L entries. |
| `docs/CUTS.md` | **Every time you decide NOT to build something** | One line + tag (`scope` / `time` / `data` / `risk` / `deferred`) |

The `docs-maintenance` skill at `.claude/skills/docs-maintenance/` covers entry formats, numbering, and verification. **Use it actively** — don't batch doc updates at the end.

## Common ops

```powershell
# From the-block/ root:
npm install                  # first-time setup
npm run dev                  # dev server (prints 127.0.0.1:5173)
npm run build                # production build
npm run preview              # serve the built bundle
npm test                     # vitest in watch mode
npm test -- --run            # vitest one-shot (CI / sanity)
npm run lint                 # eslint
```

## Repo conventions

- All source under `src/`. Components: PascalCase (`VehicleCard.tsx`). Utilities: kebab-case (`bidding.ts`, `format.ts`).
- One component per file. Tailwind for everything; only reach for `*.module.css` if Tailwind truly can't express it.
- Shared types in `src/types/`. Don't import a component file just for a type.
- Test files live next to the module they test.

## When you're done

- `npm run build` succeeds with zero TS errors
- `npm test -- --run` is green
- `docs/CUTS.md` is up to date — every deferred feature has a one-line rationale
- README.md (overwrite the upstream challenge brief) is structured as a design doc, not a how-to. Required sections: How to Run, Stack, **Design Thesis** (the comp + title-brand argument above), What I Built, Notable Decisions (lift from DECISIONS.md), Testing, **AI Tool Use** (detailed + reflective per D010), Assumptions / Cuts (lift from CUTS.md), What I'd Do With More Time.
- `WALKTHROUGH.md`, `SUBMISSION.md` (template — can be deleted or merged), `data/`, `scripts/`, `docs/the_block_repo.png` are preserved from upstream.
- Commit, push to `origin/main`, share the fork URL.
