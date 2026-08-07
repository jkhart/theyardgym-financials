import { Fragment, useState } from "react";
import { BarChart3, Calculator } from "lucide-react";
import { money, pct } from "../lib/formatting.js";

export function Dashboard({ model, locationMeta }) {
  const [expandedYear, setExpandedYear] = useState(null);
  const [activeStatement, setActiveStatement] = useState("income");

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

  const statements = {
    income: {
      title: "Income Statement",
      columns: [
        ["operatingRevenue", "Revenue", "money"],
        ["totalExpenses", "Expenses", "money"],
        ["grossOperatingProfit", "Operating Income", "money"],
        ["corporateDebtService", "Interest Expense", "money"],
        ["corporateTaxes", "Corp Taxes", "money"],
        ["netIncome", "Net Income", "money"],
        ["operatingMargin", "Margin", "percent"],
      ],
    },
    cashFlow: {
      title: "Cash Flow",
      columns: [
        ["beginningCash", "Beginning Cash", "money"],
        ["netIncome", "Net Income", "money"],
        ["cCorpCashUsed", "Capital Expenditures", "money"],
        ["totalDistributions", "Distributions", "money"],
        ["cashChange", "Net Change", "money"],
        ["endingCash", "Ending Cash", "money"],
      ],
    },
    exitValuation: {
      title: "Exit / Valuation",
      columns: [
        ["ttmOperatingProfit", "TTM EBITDA Proxy", "money"],
        ["valuationEnterpriseValue", "Business Assets (EV)", "money"],
        ["debtBalance", "Liabilities (Debt)", "money"],
        ["valuationEquityValue", "Estimated Sale Value", "money"],
      ],
    },
  };
  const activeConfig = statements[activeStatement];
  const isExitValuation = activeStatement === "exitValuation";

  function formatCell(row, key, type) {
    const value = key === "cashChange" ? (row.endingCash ?? 0) - (row.beginningCash ?? 0) : getRowValue(row, key);
    if (type === "percent") return pct.format(value);
    return money.format(value);
  }

  function cellClass(row, key, type) {
    if (type === "percent") return "";
    const value = key === "cashChange" ? (row.endingCash ?? 0) - (row.beginningCash ?? 0) : getRowValue(row, key);
    if (
      ![
        "grossOperatingProfit",
        "netIncome",
        "saleNetProceeds",
        "valuationEnterpriseValue",
        "valuationEquityValue",
        "cashChange",
        "endingCash",
      ].includes(key)
    ) {
      return "";
    }
    return value < 0 ? "negative" : "positive";
  }

  function getRowValue(row, key) {
    if (key === "valuationEnterpriseValue") {
      return row.valuationEnterpriseValue ?? Math.max(0, (row.ttmOperatingProfit ?? 0) * (model.ebitdaMultiple ?? 0));
    }
    if (key === "valuationEquityValue") {
      return row.valuationEquityValue ?? getRowValue(row, "valuationEnterpriseValue") - (row.debtBalance ?? 0);
    }
    return row[key] ?? 0;
  }

  function renderFinancialCells(row) {
    return activeConfig.columns.map(([key, , type]) => (
      <td className={cellClass(row, key, type)} key={key}>
        {formatCell(row, key, type)}
      </td>
    ));
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
        <div className="statementHeader">
          <div className="panelTitle">
            <Calculator size={18} />
            <h2>{activeConfig.title}</h2>
          </div>
          <div className="segmentedControl" aria-label="Financial statement">
            {Object.entries(statements).map(([key, statement]) => (
              <button
                className={activeStatement === key ? "active" : ""}
                key={key}
                onClick={() => setActiveStatement(key)}
                type="button"
              >
                {statement.title}
              </button>
            ))}
          </div>
        </div>
        {isExitValuation && <ValuationChart rows={model.years} getValue={getRowValue} />}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                {activeConfig.columns.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
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

function ValuationChart({ rows, getValue }) {
  const values = rows.map((row) => getValue(row, "valuationEnterpriseValue"));
  const maxValue = Math.max(1, ...values);
  const compact = rows.length > 8;
  const width = Math.max(760, rows.length * (compact ? 104 : 128));
  const height = 270;
  const padding = { top: 34, right: 30, bottom: 46, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barGap = compact ? 18 : 22;
  const barWidth = Math.max(46, (chartWidth - barGap * (rows.length - 1)) / Math.max(rows.length, 1));

  const formatChartValue = (value) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
    if (absValue >= 1000) return `${sign}$${Math.round(absValue / 1000)}K`;
    return money.format(value);
  };

  return (
    <div className="profitChartWrap valuationChartWrap">
      <svg
        aria-label="Estimated enterprise value by year"
        className="profitChart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="chartZeroLine"
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
        />
        {rows.map((row, index) => {
          const enterpriseValue = getValue(row, "valuationEnterpriseValue");
          const saleValue = getValue(row, "valuationEquityValue");
          const x = padding.left + index * (barWidth + barGap);
          const barHeight = Math.max(2, (enterpriseValue / maxValue) * chartHeight);
          const y = height - padding.bottom - barHeight;
          return (
            <g key={row.calendarYear ?? row.year}>
              <rect className="chartBar positiveBar" height={barHeight} rx="4" width={barWidth} x={x} y={y} />
              <text
                className={compact ? "chartValue compactChartValue" : "chartValue"}
                textAnchor="middle"
                x={x + barWidth / 2}
                y={Math.max(16, y - 8)}
              >
                {formatChartValue(enterpriseValue)}
              </text>
              <text className="valuationEquityLabel" textAnchor="middle" x={x + barWidth / 2} y={Math.min(height - 50, y + 22)}>
                {formatChartValue(saleValue)}
              </text>
              <text className="chartYear" textAnchor="middle" x={x + barWidth / 2} y={height - 18}>
                {row.calendarYear ?? row.year}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chartLegend">
        <span>
          <i className="legendSwatch valuationEnterpriseSwatch" />
          Enterprise value
        </span>
        <span>
          <i className="legendSwatch valuationEquitySwatch" />
          Estimated sale value shown inside each bar
        </span>
      </div>
    </div>
  );
}
