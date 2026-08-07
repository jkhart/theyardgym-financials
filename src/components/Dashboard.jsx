import { Fragment, useState } from "react";
import { BarChart3, Calculator } from "lucide-react";
import { money, pct } from "../lib/formatting.js";

export function Dashboard({ model, locationMeta }) {
  const [expandedYear, setExpandedYear] = useState(null);

  const monthsByYear = model.months.reduce((groups, month) => {
    const year = Number(String(month.date).slice(0, 4));
    const yearMonths = groups.get(year) ?? [];
    yearMonths.push(month);
    groups.set(year, yearMonths);
    return groups;
  }, new Map());

  function toggleYear(year) {
    setExpandedYear((current) => (current === year ? null : year));
  }

  function renderFinancialCells(row) {
    return (
      <>
        <td>{money.format(row.operatingRevenue)}</td>
        <td>{money.format(row.totalExpenses)}</td>
        <td className={row.grossOperatingProfit < 0 ? "negative" : "positive"}>
          {money.format(row.grossOperatingProfit)}
        </td>
        <td>{money.format(row.corporateDebtService ?? 0)}</td>
        <td>{money.format(row.corporateTaxes ?? 0)}</td>
        <td className={(row.netIncome ?? row.grossOperatingProfit) < 0 ? "negative" : "positive"}>
          {money.format(row.netIncome ?? row.grossOperatingProfit)}
        </td>
        <td>{pct.format(row.operatingMargin)}</td>
      </>
    );
  }

  return (
    <section className="dashboard">
      <div className="annualPanel">
        <div className="panelTitle">
          <BarChart3 size={18} />
          <div>
            <h2>{locationMeta.locationName}</h2>
            <p>
              {locationMeta.scenarioName} · Opens {locationMeta.projectedOpenDate}
            </p>
          </div>
        </div>
        <div className="annualGrid">
          <article>
            <span>Initial Investment</span>
            <strong>{money.format(model.totalInitialInvestment)}</strong>
            <dl>
              <dt>Timing</dt>
              <dd>6 months pre-open</dd>
              <dt>Funding</dt>
              <dd>Rollup model</dd>
            </dl>
          </article>
        </div>
      </div>

      <div className="tablePanel">
        <div className="panelTitle">
          <Calculator size={18} />
          <h2>Annual Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Op Profit</th>
                <th>Debt Service</th>
                <th>Corp Taxes</th>
                <th>Net Income</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {model.years.map((m) => {
                const isExpanded = expandedYear === m.year;
                return (
                  <Fragment key={m.year}>
                    <tr
                      aria-expanded={isExpanded}
                      className="expandableYearRow"
                      onClick={() => toggleYear(m.year)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") toggleYear(m.year);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td>{isExpanded ? "-" : "+"} {m.year}</td>
                      {renderFinancialCells(m)}
                    </tr>
                    {isExpanded &&
                      (monthsByYear.get(m.year) ?? []).map((month) => (
                        <tr className="expandedMonthRow" key={`${m.year}-${month.month}`}>
                          <td>{month.monthLabel}</td>
                          {renderFinancialCells(month)}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
