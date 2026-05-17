// SmartPriceBadge: rendering rules, verdict→color mapping, tooltip a11y.

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CompPriceBand, ScoredVerdict } from '../lib/comps';
import SmartPriceBadge from './SmartPriceBadge';

function makeBand(overrides: Partial<CompPriceBand> = {}): CompPriceBand {
  return {
    comps: [],
    prices: [18_000, 20_000, 22_000],
    low: 18_000,
    median: 20_000,
    high: 22_000,
    ...overrides,
  };
}

afterEach(cleanup);

describe('SmartPriceBadge — rendering rules', () => {
  it('renders nothing for unknown verdicts', () => {
    const { container } = render(
      <SmartPriceBadge verdict="unknown" band={makeBand()} tooltipId="t" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the band is null', () => {
    const { container } = render(
      <SmartPriceBadge verdict="fair" band={null} tooltipId="t" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SmartPriceBadge — verdict → color mapping', () => {
  // Asserting on Tailwind ring class keeps the test independent of jsdom CSS support.
  const cases: ReadonlyArray<{ verdict: ScoredVerdict; ringClass: string; label: string }> = [
    { verdict: 'below', ringClass: 'ring-emerald-200', label: 'Below market' },
    { verdict: 'fair', ringClass: 'ring-blue-200', label: 'Fair price' },
    { verdict: 'above', ringClass: 'ring-red-200', label: 'Above market' },
  ];

  for (const { verdict, ringClass, label } of cases) {
    it(`maps ${verdict} → ${ringClass} and shows the "${label}" label`, () => {
      render(
        <SmartPriceBadge verdict={verdict} band={makeBand()} tooltipId={`t-${verdict}`} />,
      );
      const pill = screen.getByLabelText(/Smart Price:/);
      expect(pill).toHaveTextContent(label);
      expect(pill.className).toContain(ringClass);
    });
  }
});

describe('SmartPriceBadge — tooltip accessibility', () => {
  it('interactive badge is tab-reachable and links to a tooltip element', () => {
    render(
      <SmartPriceBadge verdict="fair" band={makeBand()} tooltipId="t-interactive" />,
    );
    const pill = screen.getByLabelText(/Smart Price:/);
    expect(pill).toHaveAttribute('tabindex', '0');
    const describedBy = pill.getAttribute('aria-describedby');
    expect(describedBy).toBe('t-interactive');
    const tooltip = document.getElementById(describedBy!);
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip!.textContent).toMatch(/Low/);
    expect(tooltip!.textContent).toMatch(/Median/);
    expect(tooltip!.textContent).toMatch(/High/);
  });

  it('decorative badge (interactive=false) drops the tab stop', () => {
    render(
      <SmartPriceBadge
        verdict="fair"
        band={makeBand()}
        tooltipId="t-decorative"
        interactive={false}
      />,
    );
    const pill = screen.getByLabelText(/Smart Price:/);
    expect(pill).not.toHaveAttribute('tabindex');
  });
});
