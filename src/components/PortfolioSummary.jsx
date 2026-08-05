import { Layers3 } from "lucide-react";
import { money, num, pct } from "../lib/formatting.js";

function sum(locations, selector) {
  return locations.reduce((total, location) => total + selector(location), 0);
}

export function getPortfolioSummary(locations) {
  if (locations.length === 0) {
    return {
      locationCount: 0,
      entityName: "Hart Fitness, Inc.",
      totalInitialInvestment: 0,
      ownerInjection: 0,
      loanAmount: 0,
      month36Revenue: 0,
      month36Profit: 0,
      month36DebtService: 0,
      month36NetCash: 0,
      preOpenMonthlyOutlay: 0,
      month36Members: 0,
      year3CashFlow: 0,
      margin: 0,
    };
  }

  const month36Revenue = sum(locations, (location) => location.outputs.month36.operatingRevenue);
  const month36Profit = sum(locations, (location) => location.outputs.month36.grossOperatingProfit);
  const month36DebtService = sum(
    locations,
    (location) => location.outputs.month36.corporateDebtService ?? location.outputs.month36.debtService ?? 0,
  );
  return {
    locationCount: locations.length,
    entityName: "Hart Fitness, Inc.",
    totalInitialInvestment: sum(locations, (location) => location.outputs.totalInitialInvestment),
    ownerInjection: sum(locations, (location) => location.outputs.ownerInjection),
    loanAmount: sum(locations, (location) => location.outputs.loanAmount),
    month36Revenue,
    month36Profit,
    month36DebtService,
    month36NetCash: month36Profit - month36DebtService,
    preOpenMonthlyOutlay: sum(
      locations,
      (location) => location.outputs.preOpeningSummary?.[0]?.initialInvestmentOutlay ?? 0,
    ),
    month36Members: sum(locations, (location) => location.outputs.month36.totalMembers),
    year3CashFlow: sum(
      locations,
      (location) =>
        location.outputs.annualSummary[2]?.cashFlowAfterCorporateDebt ??
        location.outputs.annualSummary[2]?.cashFlow ??
        0,
    ),
    margin: month36Revenue ? month36Profit / month36Revenue : 0,
  };
}

export function PortfolioSummary({ locations }) {
  const summary = getPortfolioSummary(locations);

  return (
    <section className="portfolioPanel">
      <div className="panelTitle">
        <Layers3 size={18} />
        <h2>Hart Fitness, Inc. Rollup</h2>
      </div>
      <div className="portfolioGrid">
        <article>
          <span>Rollup Locations</span>
          <strong>{num.format(summary.locationCount)}</strong>
        </article>
        <article>
          <span>Initial Investment</span>
          <strong>{money.format(summary.totalInitialInvestment)}</strong>
        </article>
        <article>
          <span>6-Mo Pre-Open / Mo.</span>
          <strong>{money.format(summary.preOpenMonthlyOutlay)}</strong>
        </article>
        <article>
          <span>M36 Revenue</span>
          <strong>{money.format(summary.month36Revenue)}</strong>
        </article>
        <article>
          <span>M36 Operating Profit</span>
          <strong>{money.format(summary.month36Profit)}</strong>
        </article>
        <article>
          <span>M36 Debt Service</span>
          <strong>{money.format(summary.month36DebtService)}</strong>
        </article>
        <article>
          <span>M36 Cash Flow</span>
          <strong>{money.format(summary.month36NetCash)}</strong>
        </article>
        <article>
          <span>M36 Margin</span>
          <strong>{pct.format(summary.margin)}</strong>
        </article>
      </div>
    </section>
  );
}
