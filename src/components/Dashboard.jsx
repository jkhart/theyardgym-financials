import { BarChart3, Calculator } from "lucide-react";
import { formatValue, money, pct } from "../lib/formatting.js";

export function Dashboard({ model, locationMeta }) {
  const firstThreeYears = model.years.slice(0, 3);

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
          {firstThreeYears.map((year) => (
            <article key={year.year}>
              <span>Year {year.year}</span>
              <strong>{money.format(year.grossOperatingProfit)}</strong>
              <dl>
                <dt>Revenue</dt>
                <dd>{money.format(year.operatingRevenue)}</dd>
                <dt>Expenses</dt>
                <dd>{money.format(year.totalExpenses)}</dd>
                <dt>Members</dt>
                <dd>{formatValue(year.totalMembers, "number")}</dd>
                <dt>Margin</dt>
                <dd>{pct.format(year.operatingMargin)}</dd>
              </dl>
            </article>
          ))}
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
              {model.years.map((m) => (
                <tr key={m.year}>
                  <td>{m.year}</td>
                  <td>{money.format(m.operatingRevenue)}</td>
                  <td>{money.format(m.totalExpenses)}</td>
                  <td className={m.grossOperatingProfit < 0 ? "negative" : "positive"}>
                    {money.format(m.grossOperatingProfit)}
                  </td>
                  <td>{money.format(m.corporateDebtService ?? 0)}</td>
                  <td>{money.format(m.corporateTaxes ?? 0)}</td>
                  <td className={(m.netIncome ?? m.grossOperatingProfit) < 0 ? "negative" : "positive"}>
                    {money.format(m.netIncome ?? m.grossOperatingProfit)}
                  </td>
                  <td>{pct.format(m.operatingMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
