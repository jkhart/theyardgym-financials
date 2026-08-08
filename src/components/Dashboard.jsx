import { Fragment, useState } from "react";
import { BarChart3, Calculator } from "lucide-react";
import { money, pct } from "../lib/formatting.js";

export function Dashboard({ model, locationMeta }) {
  const [expandedYear, setExpandedYear] = useState(null);
  const [activeStatement, setActiveStatement] = useState("income");

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
      title: "Valuation",
      columns: [
        ["ttmOperatingProfit", "TTM Operating Profit", "money"],
        ["valuationEnterpriseValue", "Enterprise Value", "money"],
        ["debtBalance", "Debt", "money"],
        ["valuationEquityValue", "Estimated Sale Value", "money"],
        ["valuationTransactionCosts", "Transaction Costs", "money"],
        ["valuationSaleTaxes", "Sale Taxes", "money"],
        ["valuationNetProceeds", "Net Proceeds", "money"],
      ],
    },
    personalWealth: {
      title: "Personal Wealth",
      rowsKey: "personalWealth",
      columns: [
        ["cash", "Cash", "money"],
        ["taxableBrokerage", "Taxable Brokerage", "money"],
        ["rothIra", "Roth IRA", "money"],
        ["robsRoth401k", "ROBS Roth 401k", "money"],
        ["totalWealth", "Total Wealth", "money"],
        ["afterTaxWealth", "After-Tax Wealth", "money"],
        ["withdrawalCapacity", "Withdrawal Capacity", "money"],
        ["businessDebt", "Business Debt", "money"],
        ["portfolioLtv", "Portfolio LTV", "percent"],
      ],
    },
  };
  const activeConfig = statements[activeStatement];
  const activeRows = activeConfig.rowsKey ? model[activeConfig.rowsKey]?.years ?? [] : model.years;
  const activeMonths = activeConfig.rowsKey ? model[activeConfig.rowsKey]?.months ?? [] : model.months;
  const monthsByYear = activeMonths.reduce((groups, month) => {
    const year = Number(String(month.date).slice(0, 4));
    const yearMonths = groups.get(year) ?? [];
    yearMonths.push(month);
    groups.set(year, yearMonths);
    return groups;
  }, new Map());

  function formatCell(row, key, type) {
    const value = key === "cashChange" ? (row.endingCash ?? 0) - (row.beginningCash ?? 0) : getRowValue(row, key);
    if (!Number.isFinite(value)) return "n/a";
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
        "valuationNetProceeds",
        "totalWealth",
        "afterTaxWealth",
        "withdrawalCapacity",
        "cashChange",
        "endingCash",
        "businessDebt",
        "portfolioLtv",
      ].includes(key)
    ) {
      return "";
    }
    if (!Number.isFinite(value)) return "negative";
    return value < 0 ? "negative" : "positive";
  }

  function getRowValue(row, key) {
    if (key === "valuationEnterpriseValue") {
      return row.valuationEnterpriseValue ?? Math.max(0, (row.ttmOperatingProfit ?? 0) * (model.ebitdaMultiple ?? 0));
    }
    if (key === "valuationEquityValue") {
      return row.valuationEquityValue ?? getRowValue(row, "valuationEnterpriseValue") - (row.debtBalance ?? 0);
    }
    if (key === "valuationNetProceeds") {
      return (
        row.valuationNetProceeds ??
        getRowValue(row, "valuationEquityValue") -
          (row.valuationTransactionCosts ?? 0) -
          (row.valuationSaleTaxes ?? 0)
      );
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
              {activeRows.map((m) => {
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
