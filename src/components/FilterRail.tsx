// Inventory filter rail. Two surfaces from one component:
//   - desktop (lg+): sticky sidebar, always visible
//   - mobile (<lg): hidden by default; the page renders a "Filters" button
//     that flips `isOpen`, opening a fixed-position bottom-sheet overlay with
//     a backdrop + close button (per I5 — no focus-trap library)
//
// State is owned by the page (I4: component state, no URL params) and passed
// in via `value`/`onChange`. The page derives the filtered list from `value`
// using `applyFilters` from `./filter-rail-state`.
//
// The `FilterState` shape, defaults, applier, and chip enumerator live in
// `./filter-rail-state.ts` so this file stays component-only and React Refresh
// HMR keeps working (same constraint as D016 / L001).

import { useEffect, useMemo } from 'react';
import type { BodyStyle, Drivetrain, FuelType, Vehicle } from '../types/vehicle';
import type { AuctionStatus } from '../lib/time';
import {
  ALL_AUCTION_STATUSES,
  ALL_TITLE_STATUSES,
  DEFAULT_FILTER_STATE,
  type FilterState,
} from './filter-rail-state';

interface Props {
  vehicles: readonly Vehicle[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Mobile overlay open state. Ignored on desktop (rail is always visible). */
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterRail({ vehicles, value, onChange, isOpen, onClose }: Props) {
  // Facet values are derived from the inventory rather than enumerated
  // statically — keeps the rail in sync with whatever the dataset actually
  // contains, and degrades gracefully if a future make or body style appears.
  const facets = useMemo(() => deriveFacets(vehicles), [vehicles]);

  // Close the mobile overlay on Escape. Best-effort accessibility floor (no
  // focus trap per I5); a real implementation would also restore focus.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const railContent = (
    <RailBody
      value={value}
      onChange={onChange}
      facets={facets}
      onResetAll={() => onChange(DEFAULT_FILTER_STATE)}
    />
  );

  return (
    <>
      {/* Desktop: sticky sidebar. Hidden below lg; the page renders the
          mobile-open button. */}
      <aside
        aria-label="Filters"
        className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:rounded-lg lg:border lg:border-zinc-200 lg:bg-white lg:p-4"
      >
        {railContent}
      </aside>

      {/* Mobile: bottom-sheet overlay. Tailwind doesn't gate keyboard reach
          on `hidden`, so we also bail out of rendering when closed. */}
      {isOpen && (
        <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Filters</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
              >
                Done
              </button>
            </div>
            {railContent}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Internals ─────────────────────────────────────────────────────────────

interface Facets {
  makes: readonly string[];
  bodyStyles: readonly BodyStyle[];
  fuelTypes: readonly FuelType[];
  drivetrains: readonly Drivetrain[];
}

function deriveFacets(vehicles: readonly Vehicle[]): Facets {
  const makes = new Set<string>();
  const bodyStyles = new Set<BodyStyle>();
  const fuelTypes = new Set<FuelType>();
  const drivetrains = new Set<Drivetrain>();
  for (const v of vehicles) {
    makes.add(v.make);
    bodyStyles.add(v.body_style);
    fuelTypes.add(v.fuel_type);
    drivetrains.add(v.drivetrain);
  }
  return {
    makes: [...makes].sort((a, b) => a.localeCompare(b)),
    bodyStyles: [...bodyStyles].sort((a, b) => a.localeCompare(b)),
    fuelTypes: [...fuelTypes].sort((a, b) => a.localeCompare(b)),
    drivetrains: [...drivetrains].sort((a, b) => a.localeCompare(b)),
  };
}

interface RailBodyProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  facets: Facets;
  onResetAll: () => void;
}

const AUCTION_STATUS_LABEL: Record<AuctionStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  ended: 'Ended',
};

function RailBody({ value, onChange, facets, onResetAll }: RailBodyProps) {
  function toggleIn<T extends string>(
    current: readonly T[],
    item: T,
    checked: boolean,
  ): readonly T[] {
    if (checked) {
      if (current.includes(item)) return current;
      return [...current, item];
    }
    return current.filter((x) => x !== item);
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Filters</h2>
        <button
          type="button"
          onClick={onResetAll}
          className="text-xs text-blue-700 underline hover:text-blue-900"
        >
          Reset
        </button>
      </div>

      <FieldSection title="Search">
        <label className="block">
          <span className="sr-only">Search make, model, trim, or lot</span>
          <input
            type="search"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Make, model, trim, or lot"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </FieldSection>

      <FieldSection title="Price (current bid)">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-xs text-zinc-500">Min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={value.priceMin ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  priceMin: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-zinc-500">Max</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={value.priceMax ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  priceMax: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Any"
            />
          </label>
        </div>
      </FieldSection>

      <FieldSection title="Min condition grade">
        <label className="block">
          <span className="sr-only">Minimum condition grade (0 to 5)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={value.minConditionGrade ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...value, minConditionGrade: n === 0 ? null : n });
              }}
              className="w-full"
            />
            <span className="w-10 text-right text-xs tabular-nums text-zinc-700">
              {(value.minConditionGrade ?? 0).toFixed(1)}
            </span>
          </div>
        </label>
      </FieldSection>

      <FieldSection title="Auction status">
        <CheckboxGroup
          options={ALL_AUCTION_STATUSES.map((s) => ({
            value: s,
            label: AUCTION_STATUS_LABEL[s],
          }))}
          selected={value.auctionStatuses}
          onToggle={(v, checked) =>
            onChange({
              ...value,
              auctionStatuses: toggleIn(value.auctionStatuses, v, checked),
            })
          }
        />
      </FieldSection>

      <FieldSection title="Title status">
        <CheckboxGroup
          options={ALL_TITLE_STATUSES.map((s) => ({
            value: s,
            label:
              s === 'clean'
                ? 'Clean'
                : s === 'rebuilt'
                  ? 'Rebuilt'
                  : 'Salvage (off by default)',
          }))}
          selected={value.titleStatuses}
          onToggle={(v, checked) =>
            onChange({
              ...value,
              titleStatuses: toggleIn(value.titleStatuses, v, checked),
            })
          }
        />
      </FieldSection>

      <FieldSection title="Body style">
        <CheckboxGroup
          options={facets.bodyStyles.map((s) => ({ value: s, label: s }))}
          selected={value.bodyStyles}
          onToggle={(v, checked) =>
            onChange({ ...value, bodyStyles: toggleIn(value.bodyStyles, v, checked) })
          }
        />
      </FieldSection>

      <FieldSection title="Fuel type">
        <CheckboxGroup
          options={facets.fuelTypes.map((s) => ({ value: s, label: s }))}
          selected={value.fuelTypes}
          onToggle={(v, checked) =>
            onChange({ ...value, fuelTypes: toggleIn(value.fuelTypes, v, checked) })
          }
        />
      </FieldSection>

      <FieldSection title="Drivetrain">
        <CheckboxGroup
          options={facets.drivetrains.map((s) => ({ value: s, label: s }))}
          selected={value.drivetrains}
          onToggle={(v, checked) =>
            onChange({ ...value, drivetrains: toggleIn(value.drivetrains, v, checked) })
          }
        />
      </FieldSection>

      <FieldSection title="Make">
        <CheckboxGroup
          options={facets.makes.map((s) => ({ value: s, label: s }))}
          selected={value.makes}
          onToggle={(v, checked) =>
            onChange({ ...value, makes: toggleIn(value.makes, v, checked) })
          }
        />
      </FieldSection>
    </div>
  );
}

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface CheckboxGroupProps<T extends string> {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T, checked: boolean) => void;
}

function CheckboxGroup<T extends string>({ options, selected, onToggle }: CheckboxGroupProps<T>) {
  return (
    <ul className="space-y-1">
      {options.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <li key={opt.value}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(opt.value, e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-700 capitalize">{opt.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
