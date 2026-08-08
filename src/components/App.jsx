import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Dumbbell, RotateCcw } from "lucide-react";
import { Dashboard } from "./Dashboard.jsx";
import { AssumptionsPanel } from "./AssumptionsPanel.jsx";
import { money, num, pct } from "../lib/formatting.js";
import { calculateModel } from "../lib/model/calculateModel.js";
import { DEFAULT_ASSUMPTIONS } from "../lib/model/defaults.js";
import {
  FIXED_LOCATIONS,
  loadLocationSchedule,
  loadSharedLocationAssumptions,
  saveLocationSchedule,
} from "../lib/storage/locationStore.js";

const ROLLUP_STORAGE_KEY = "the-yard-gym.rollupInputs.v1";
const SHARED_ASSUMPTIONS_STORAGE_KEY = "the-yard-gym.sharedLocationAssumptions.v1";

const DEFAULT_ROLLUP_INPUTS = {
  entityName: "Hart Fitness, Inc.",
  modelStartDate: "2026-07-01",
  roth401kContribution: 450000,
  personalContribution: 0,
  traditionalIraStartingBalance: 450000,
  robsConversionTaxRate: 0.35,
  minimumWorkingCapital: 100000,
  annualOwnerSalary: 100000,
  ownerSalaryInflation: 0.03,
  federalTaxRate: 0.21,
  stateTaxRate: 0.0884,
  ebitdaMultiple: 5,
  saleDate: "2036-01-01",
  saleType: "stock",
  transactionCostRate: 0.03,
  assetTaxBasis: 0,
  rothBirthDate: "1984-01-01",
  downsideReturn: 0.06,
  baseReturn: 0.1,
  upsideReturn: 0.12,
  rothDownsideReturn: 0.06,
  rothAnnualReturn: 0.1,
  rothUpsideReturn: 0.12,
  personalStartingBalance: 0,
  personalCashBalance: 0,
  personalAnnualSpending: 180000,
  householdSpendingInflation: 0.03,
  personalCapitalGainsTaxRate: 0.25,
  personalStockAppreciation: 1,
  personalDownsideReturn: 0.06,
  personalAnnualReturn: 0.1,
  personalUpsideReturn: 0.12,
  wealthSourceStructure: "robs-stock",
  safeWithdrawalRate: 0.05,
  portfolioLoanLtvLimit: 0.5,
};

const FIXED_ROLLUP_INPUTS = {
  entityName: "Hart Fitness, Inc.",
  modelStartDate: "2026-07-01",
  roth401kContribution: 450000,
  personalContribution: 0,
  traditionalIraStartingBalance: 450000,
  federalTaxRate: 0.21,
  stateTaxRate: 0.0884,
};

function normalizeRollupInputs(inputs) {
  const normalized = { ...DEFAULT_ROLLUP_INPUTS, ...inputs, ...FIXED_ROLLUP_INPUTS };
  normalized.downsideReturn = Number(normalized.downsideReturn ?? normalized.rothDownsideReturn ?? normalized.personalDownsideReturn) || 0;
  normalized.baseReturn = Number(normalized.baseReturn ?? normalized.rothAnnualReturn ?? normalized.personalAnnualReturn) || 0;
  normalized.upsideReturn = Number(normalized.upsideReturn ?? normalized.rothUpsideReturn ?? normalized.personalUpsideReturn) || 0;
  normalized.rothDownsideReturn = normalized.downsideReturn;
  normalized.rothAnnualReturn = normalized.baseReturn;
  normalized.rothUpsideReturn = normalized.upsideReturn;
  normalized.personalDownsideReturn = normalized.downsideReturn;
  normalized.personalAnnualReturn = normalized.baseReturn;
  normalized.personalUpsideReturn = normalized.upsideReturn;
  normalized.minimumWorkingCapital = Number(normalized.minimumWorkingCapital) || 0;
  normalized.distributionCashFloor = normalized.minimumWorkingCapital;
  return normalized;
}

function getWealthSource(value) {
  if (value === "robs-asset") return "robs-asset";
  return "robs-stock";
}

function getWealthSourceLabel(source) {
  if (source === "robs-asset") return "ROBS + Asset Sale";
  return "ROBS + Stock Sale";
}

function getActiveLocations(locations) {
  return locations.filter((location) => location.isActive !== false);
}

function getRobsSaleTypeForSource(source) {
  return source === "robs-asset" ? "asset" : "stock";
}

function getOwnershipSplit(inputs) {
  const rothContribution = Number(inputs.roth401kContribution) || 0;
  const personalContribution = Number(inputs.personalContribution) || 0;
  const totalContribution = rothContribution + personalContribution;
  if (totalContribution <= 0) return { roth401kPct: 0, personalPct: 0 };
  return {
    roth401kPct: rothContribution / totalContribution,
    personalPct: personalContribution / totalContribution,
  };
}

function parseLocalDate(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date("2026-07-01T00:00:00");
  return Number.isNaN(date.getTime()) ? new Date("2026-07-01T00:00:00") : date;
}

function addMonths(date, offset) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  return next;
}

function addYears(date, offset) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + offset);
  return next;
}

function toMonthKey(value) {
  return value?.slice(0, 7);
}

function monthDiff(startValue, endValue) {
  const start = parseLocalDate(startValue);
  const end = parseLocalDate(endValue);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function getLastProjectedOpenDate(locations) {
  if (locations.length === 0) return null;
  return locations.reduce((latest, location) => {
    if (!latest) return location.projectedOpenDate;
    return monthDiff(latest, location.projectedOpenDate) > 0 ? location.projectedOpenDate : latest;
  }, null);
}

function getFirstProjectedOpenDate(locations) {
  if (locations.length === 0) return null;
  return locations.reduce((earliest, location) => {
    if (!earliest) return location.projectedOpenDate;
    return monthDiff(location.projectedOpenDate, earliest) > 0 ? location.projectedOpenDate : earliest;
  }, null);
}

function formatMonthLabel(value) {
  return parseLocalDate(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getAgeAtDate(birthDateValue, dateValue) {
  const birthDate = parseLocalDate(birthDateValue);
  const date = parseLocalDate(dateValue);
  let age = date.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    date.getMonth() > birthDate.getMonth() ||
    (date.getMonth() === birthDate.getMonth() && date.getDate() >= birthDate.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function getMonthlyLivingNeed(inputs, monthIndex) {
  const startingMonthlySpending = (Number(inputs.personalAnnualSpending) || 0) / 12;
  const householdSpendingInflation = Number(inputs.householdSpendingInflation) || 0;
  return startingMonthlySpending * Math.pow(1 + householdSpendingInflation, monthIndex / 12);
}

function getInflationFactor(rate, elapsedMonths) {
  return Math.pow(1 + (Number(rate) || 0), Math.max(0, elapsedMonths) / 12);
}

function loadRollupInputs() {
  try {
    const raw = window.localStorage.getItem(ROLLUP_STORAGE_KEY);
    if (!raw) return normalizeRollupInputs();
    return normalizeRollupInputs(JSON.parse(raw));
  } catch {
    return normalizeRollupInputs();
  }
}

function loadSharedAssumptions() {
  try {
    const raw = window.localStorage.getItem(SHARED_ASSUMPTIONS_STORAGE_KEY);
    if (!raw) return loadSharedLocationAssumptions(DEFAULT_ASSUMPTIONS);
    return { ...DEFAULT_ASSUMPTIONS, ...JSON.parse(raw) };
  } catch {
    return loadSharedLocationAssumptions(DEFAULT_ASSUMPTIONS);
  }
}

function buildLocationRecords({ assumptions, modelEndDate, modelStartDate, schedule }) {
  return schedule.map((location) => {
    const operatingMonths = modelEndDate ? monthDiff(location.projectedOpenDate, modelEndDate) + 1 : 1;
    const model = calculateModel(assumptions, {
      projectedOpenDate: location.projectedOpenDate,
      modelStartDate,
      operatingMonths,
    });

    return {
      id: location.id,
      entityType: "location",
      isActive: true,
      locationName: location.locationName,
      scenarioName: "Shared Base Case",
      projectedOpenDate: location.projectedOpenDate,
      projectName: "The Yard Gym Opportunity",
      modelName: "Single-Location Financial & Operations Model",
      assumptions,
      outputs: {
        totalInitialInvestment: model.totalInitialInvestment,
        ownerInjection: model.ownerInjection,
        loanAmount: model.loanAmount,
        monthlyLoanPayment: model.monthlyLoanPayment,
        preOpeningSummary: model.preOpeningMonths,
        monthlySummary: model.months,
        annualSummary: model.years,
        corporateFinancing: {
          entityName: "Hart Fitness, Inc.",
          loanAmount: model.loanAmount,
          monthlyLoanPayment: model.monthlyLoanPayment,
        },
      },
    };
  });
}

function buildLocationSetModel(locations) {
  const dates = Array.from(
    new Set(
      locations.flatMap((location) => [
        ...(location.outputs.preOpeningSummary?.map((row) => row.date) ?? []),
        ...(location.outputs.monthlySummary?.map((row) => row.date) ?? []),
      ]),
    ),
  ).sort((a, b) => parseLocalDate(a) - parseLocalDate(b));

  const months = dates
    .map((date) =>
      locations.reduce(
        (total, location) => {
          const monthlySummary = location.outputs.monthlySummary ?? [];
          const operatingMonthIndex = monthDiff(location.projectedOpenDate, date);
          const preOpenInvestment =
            location.outputs.preOpeningSummary?.find((row) => row.date === date)?.initialInvestmentOutlay ?? 0;
          if (operatingMonthIndex < 0 || monthlySummary.length === 0) {
            return {
              ...total,
              preOpenInvestment: total.preOpenInvestment + preOpenInvestment,
            };
          }
          const row = monthlySummary[Math.min(operatingMonthIndex, monthlySummary.length - 1)];
          return {
            ...total,
            preOpenInvestment: total.preOpenInvestment + preOpenInvestment,
            totalMembers: total.totalMembers + (row.totalMembers ?? 0),
            operatingRevenue: total.operatingRevenue + (row.operatingRevenue ?? 0),
            totalExpenses: total.totalExpenses + (row.totalExpenses ?? 0),
            grossOperatingProfit: total.grossOperatingProfit + (row.grossOperatingProfit ?? 0),
            monthlySlots: total.monthlySlots + (row.monthlySlots ?? 0),
            labor: total.labor + (row.labor ?? 0),
            rent: total.rent + (row.rent ?? 0),
          };
        },
        {
          date,
          monthLabel: formatMonthLabel(date),
          preOpenInvestment: 0,
          totalMembers: 0,
          operatingRevenue: 0,
          totalExpenses: 0,
          grossOperatingProfit: 0,
          monthlySlots: 0,
          labor: 0,
          rent: 0,
        },
      ),
    )
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))
    .reduce((rows, row, index) => {
      const priorCapitalAssets = rows.at(-1)?.capitalAssets ?? 0;
      const capitalAssets = priorCapitalAssets + (row.preOpenInvestment ?? 0);
      rows.push({
        ...row,
        month: index + 1,
        capitalAssets,
        totalAssets: capitalAssets,
        totalLiabilities: 0,
        bookEquity: capitalAssets,
        operatingMargin: row.operatingRevenue ? row.grossOperatingProfit / row.operatingRevenue : 0,
      });
      return rows;
    }, []);

  const yearGroups = months.reduce((groups, row) => {
    const calendarYear = parseLocalDate(row.date).getFullYear();
    const group = groups.get(calendarYear) ?? [];
    group.push(row);
    groups.set(calendarYear, group);
    return groups;
  }, new Map());

  const years = Array.from(yearGroups, ([calendarYear, rows]) => {
    const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
    const operatingRevenue = sum("operatingRevenue");
    const grossOperatingProfit = sum("grossOperatingProfit");
    return {
      year: calendarYear,
      operatingRevenue,
      totalExpenses: sum("totalExpenses"),
      grossOperatingProfit,
      preOpenInvestment: sum("preOpenInvestment"),
      monthlySlots: sum("monthlySlots"),
      labor: sum("labor"),
      rent: sum("rent"),
      capitalAssets: rows.at(-1)?.capitalAssets ?? 0,
      totalAssets: rows.at(-1)?.totalAssets ?? 0,
      totalLiabilities: rows.at(-1)?.totalLiabilities ?? 0,
      bookEquity: rows.at(-1)?.bookEquity ?? 0,
      totalMembers: rows.at(-1)?.totalMembers ?? 0,
      operatingMargin: operatingRevenue ? grossOperatingProfit / operatingRevenue : 0,
    };
  });

  return {
    months,
    years,
    totalInitialInvestment: locations.reduce((total, location) => total + (location.outputs.totalInitialInvestment ?? 0), 0),
  };
}

function calculateRollupModel(locations, inputs, options = {}) {
  locations = getActiveLocations(locations);
  const startDate = parseLocalDate(inputs.modelStartDate);
  const saleDate = inputs.saleDate || DEFAULT_ROLLUP_INPUTS.saleDate;
  const horizonMonths = Math.max(1, Math.min(180, monthDiff(inputs.modelStartDate, saleDate) + 1));
  const startingCash = (Number(inputs.roth401kContribution) || 0) + (Number(inputs.personalContribution) || 0);
  let brokerageCashAvailable = Number(inputs.personalCashBalance) || 0;
  const cCorpCashReserve = Number(inputs.minimumWorkingCapital) || 0;
  const startingMonthlyOwnerSalaryPerLocation = (Number(inputs.annualOwnerSalary) || 0) / 12;
  const ownerSalaryInflation = Number(inputs.ownerSalaryInflation) || 0;
  const combinedTaxRate = (Number(inputs.federalTaxRate) || 0) + (Number(inputs.stateTaxRate) || 0);
  const ebitdaMultiple = Number(inputs.ebitdaMultiple) || 0;
  const saleType = options.saleType ?? (inputs.saleType === "asset" ? "asset" : "stock");
  const transactionCostRate = Number(inputs.transactionCostRate) || 0;
  const assetTaxBasis = Number(inputs.assetTaxBasis) || 0;
  const ownershipSplit = getOwnershipSplit(inputs);
  const salaryStartDate = getFirstProjectedOpenDate(locations);
  const distributionStartDate = getLastProjectedOpenDate(locations);
  const emptyMonth = (index) => {
    const date = addMonths(startDate, index);
    return {
      month: index + 1,
      date: toDateInputValue(date),
      monthLabel: formatMonthLabel(toDateInputValue(date)),
      activeLocations: 0,
      preOpenInvestment: 0,
      ownerFundedOutlay: 0,
      debtFundedOutlay: 0,
      totalMembers: 0,
      operatingRevenue: 0,
      totalExpenses: 0,
      grossOperatingProfit: 0,
      locationExpenses: 0,
      locationOperatingProfit: 0,
      corporateTotalExpenses: 0,
      corporateOperatingProfit: 0,
      ownerSalary: 0,
      corporateDebtService: 0,
      debtInterest: 0,
      taxableIncome: 0,
      corporateTaxes: 0,
      netIncome: 0,
      netCash: 0,
      beginningCash: 0,
      totalDistributions: 0,
      roth401kDistribution: 0,
      personalDistribution: 0,
      beginningBrokerageCash: 0,
      brokerageCashFromSalary: 0,
      brokerageCashUsedForLiving: 0,
      cCorpCashUsed: 0,
      brokerageCashUsed: 0,
      endingBrokerageCash: 0,
      newDebt: 0,
      endingCash: 0,
      debtBalance: 0,
      ttmOperatingProfit: 0,
      saleEnterpriseValue: 0,
      saleDebtPayoff: 0,
      saleCashAtClose: 0,
      saleCorporateTaxes: 0,
      saleTransactionCosts: 0,
      saleNetProceeds: 0,
      roth401kSaleProceeds: 0,
      personalSaleProceeds: 0,
      valuationEnterpriseValue: 0,
      valuationEquityValue: 0,
      valuationTransactionCosts: 0,
      valuationSaleTaxes: 0,
      valuationNetProceeds: 0,
    };
  };
  const months = Array.from({ length: horizonMonths }, (_, index) => emptyMonth(index));
  const byMonth = new Map(months.map((month) => [toMonthKey(month.date), month]));
  const fundingByLocation = new Map();
  const activeLoans = [];
  let cCorpCash = startingCash;
  let capitalAssets = 0;

  locations.forEach((location) => {
    location.outputs.preOpeningSummary?.forEach((row) => {
      const month = byMonth.get(toMonthKey(row.date));
      if (!month) return;
      month.preOpenInvestment += row.initialInvestmentOutlay ?? 0;
    });

    months.forEach((month) => {
      const monthlySummary = location.outputs.monthlySummary ?? [];
      const operatingMonthIndex = monthDiff(location.projectedOpenDate, month.date);
      if (operatingMonthIndex < 0 || monthlySummary.length === 0) return;
      const row = monthlySummary[Math.min(operatingMonthIndex, monthlySummary.length - 1)];
      month.activeLocations += 1;
      month.totalMembers += row.totalMembers ?? 0;
      month.operatingRevenue += row.operatingRevenue ?? 0;
      month.totalExpenses += row.totalExpenses ?? 0;
      month.grossOperatingProfit += row.grossOperatingProfit ?? 0;
    });
  });

  months.forEach((month) => {
    month.beginningCash = cCorpCash;
    month.beginningBrokerageCash = brokerageCashAvailable;
    cCorpCash += month.grossOperatingProfit;
    const salaryAllowed = salaryStartDate && monthDiff(salaryStartDate, month.date) >= 0;
    if (salaryAllowed) {
      const ownerSalaryFactor = getInflationFactor(ownerSalaryInflation, month.month - 1);
      month.ownerSalary = startingMonthlyOwnerSalaryPerLocation * ownerSalaryFactor * month.activeLocations;
      cCorpCash -= month.ownerSalary;
      month.brokerageCashFromSalary = month.ownerSalary;
      brokerageCashAvailable += month.ownerSalary;
    }
    month.locationExpenses = month.totalExpenses;
    month.locationOperatingProfit = month.grossOperatingProfit;
    month.corporateTotalExpenses = month.totalExpenses + month.ownerSalary;
    month.corporateOperatingProfit = month.grossOperatingProfit - month.ownerSalary;
    month.totalExpenses = month.corporateTotalExpenses;
    month.grossOperatingProfit = month.corporateOperatingProfit;
    const livingNeed = getMonthlyLivingNeed(inputs, month.month - 1);
    month.brokerageCashUsedForLiving = Math.min(livingNeed, brokerageCashAvailable);
    brokerageCashAvailable -= month.brokerageCashUsedForLiving;
    activeLoans.forEach((loan) => {
      if (loan.balance <= 0) return;
      const interest = loan.balance * loan.monthlyRate;
      month.corporateDebtService += interest;
      month.debtInterest += interest;
    });
    month.taxableIncome = Math.max(0, month.corporateOperatingProfit - month.debtInterest);
    month.corporateTaxes = month.taxableIncome * combinedTaxRate;
    cCorpCash -= month.corporateTaxes;
    cCorpCash -= month.corporateDebtService;

    const fundingRequests = locations
      .map((location) => ({
        location,
        outlay:
          location.outputs.preOpeningSummary?.find((row) => toMonthKey(row.date) === toMonthKey(month.date))
            ?.initialInvestmentOutlay ?? 0,
      }))
      .filter((request) => request.outlay > 0);

    fundingRequests.forEach(({ location, outlay }) => {
      const availableCash = Math.max(0, cCorpCash - cCorpCashReserve);
      const cCorpCashUsed = Math.min(outlay, availableCash);
      const remainingAfterCorpCash = outlay - cCorpCashUsed;
      const brokerageCashUsed = Math.min(remainingAfterCorpCash, brokerageCashAvailable);
      const newDebt = remainingAfterCorpCash - brokerageCashUsed;
      cCorpCash -= cCorpCashUsed;
      brokerageCashAvailable -= brokerageCashUsed;
      month.cCorpCashUsed += cCorpCashUsed;
      month.brokerageCashUsed += brokerageCashUsed;
      month.ownerFundedOutlay += cCorpCashUsed + brokerageCashUsed;
      month.newDebt += newDebt;
      month.debtFundedOutlay += newDebt;
      const current = fundingByLocation.get(location.id) ?? { cCorpCashUsed: 0, brokerageCashUsed: 0, newDebt: 0 };
      fundingByLocation.set(location.id, {
        cCorpCashUsed: current.cCorpCashUsed + cCorpCashUsed,
        brokerageCashUsed: current.brokerageCashUsed + brokerageCashUsed,
        newDebt: current.newDebt + newDebt,
      });
      if (newDebt > 0) {
        const monthlyRate = (location.assumptions?.loanRate ?? DEFAULT_ASSUMPTIONS.loanRate) / 12;
        activeLoans.push({
          locationId: location.id,
          balance: newDebt,
          monthlyRate,
        });
      }
    });

    capitalAssets += month.preOpenInvestment;
    month.netIncome = month.corporateOperatingProfit - month.debtInterest - month.corporateTaxes;
    month.netCash =
      month.corporateOperatingProfit -
      month.corporateTaxes -
      month.corporateDebtService -
      month.cCorpCashUsed;
    const distributionsAllowed = distributionStartDate && monthDiff(distributionStartDate, month.date) >= 0;
    if (distributionsAllowed) {
      const cashAvailableForDistribution = Math.max(0, cCorpCash - cCorpCashReserve);
      month.totalDistributions = cashAvailableForDistribution;
      month.roth401kDistribution = month.totalDistributions * ownershipSplit.roth401kPct;
      month.personalDistribution = month.totalDistributions * ownershipSplit.personalPct;
      cCorpCash -= month.totalDistributions;
      brokerageCashAvailable += month.personalDistribution;
    }
    month.endingCash = cCorpCash;
    month.endingBrokerageCash = brokerageCashAvailable;
    month.debtBalance = activeLoans.reduce((total, loan) => total + loan.balance, 0);
    month.capitalAssets = capitalAssets;
    month.totalAssets = month.endingCash + month.capitalAssets;
    month.totalLiabilities = month.debtBalance;
    month.bookEquity = month.totalAssets - month.totalLiabilities;
    month.operatingMargin = month.operatingRevenue ? month.corporateOperatingProfit / month.operatingRevenue : 0;
  });

  months.forEach((month, index) => {
    const trailingMonths = months.slice(Math.max(0, index - 11), index + 1);
    month.ttmOperatingProfit = trailingMonths.reduce((total, row) => total + row.corporateOperatingProfit, 0);
    month.valuationEnterpriseValue = Math.max(0, month.ttmOperatingProfit * ebitdaMultiple);
    month.valuationEquityValue = month.valuationEnterpriseValue - month.debtBalance;
    month.valuationTransactionCosts = Math.max(0, month.valuationEnterpriseValue * transactionCostRate);
    if (saleType === "asset") {
      const assetSaleGain = Math.max(0, month.valuationEnterpriseValue - month.valuationTransactionCosts - assetTaxBasis);
      month.valuationSaleTaxes = assetSaleGain * combinedTaxRate;
    }
    month.valuationNetProceeds =
      month.valuationEnterpriseValue - month.debtBalance - month.valuationTransactionCosts - month.valuationSaleTaxes;
    if (!saleDate || toMonthKey(month.date) !== toMonthKey(saleDate)) return;
    month.saleEnterpriseValue = month.valuationEnterpriseValue;
    month.saleDebtPayoff = month.debtBalance;
    month.saleCashAtClose = month.endingCash;
    month.saleTransactionCosts = Math.max(0, month.saleEnterpriseValue * transactionCostRate);
    if (saleType === "asset") {
      const assetSaleGain = Math.max(0, month.saleEnterpriseValue - month.saleTransactionCosts - assetTaxBasis);
      month.saleCorporateTaxes = assetSaleGain * combinedTaxRate;
    }
    month.saleNetProceeds =
      month.saleEnterpriseValue - month.saleDebtPayoff + month.saleCashAtClose - month.saleCorporateTaxes - month.saleTransactionCosts;
    month.roth401kSaleProceeds = month.saleNetProceeds * ownershipSplit.roth401kPct;
    month.personalSaleProceeds = month.saleNetProceeds * ownershipSplit.personalPct;
  });

  const yearGroups = months.reduce((groups, month) => {
    const calendarYear = parseLocalDate(month.date).getFullYear();
    const group = groups.get(calendarYear) ?? [];
    group.push(month);
    groups.set(calendarYear, group);
    return groups;
  }, new Map());
  const years = Array.from(yearGroups, ([calendarYear, slice]) => {
    const sum = (key) => slice.reduce((total, row) => total + row[key], 0);
    const end = slice.at(-1);
    const operatingRevenue = sum("operatingRevenue");
    const totalExpenses = sum("corporateTotalExpenses");
    const grossOperatingProfit = sum("corporateOperatingProfit");
    const endingCash = end?.endingCash ?? startingCash;
    const debtBalance = end?.debtBalance ?? 0;
    const enterpriseValue = end?.valuationEnterpriseValue ?? 0;
    const equityValue = end?.valuationEquityValue ?? enterpriseValue - debtBalance;
    const valuationTransactionCosts = end?.valuationTransactionCosts ?? 0;
    const valuationSaleTaxes = end?.valuationSaleTaxes ?? 0;
    const valuationNetProceeds = end?.valuationNetProceeds ?? equityValue - valuationTransactionCosts - valuationSaleTaxes;
    return {
      calendarYear,
      preOpenInvestment: sum("preOpenInvestment"),
      operatingRevenue,
      totalExpenses,
      grossOperatingProfit,
      ownerSalary: sum("ownerSalary"),
      brokerageCashFromSalary: sum("brokerageCashFromSalary"),
      brokerageCashUsedForLiving: sum("brokerageCashUsedForLiving"),
      corporateDebtService: sum("corporateDebtService"),
      debtInterest: sum("debtInterest"),
      taxableIncome: sum("taxableIncome"),
      corporateTaxes: sum("corporateTaxes"),
      netIncome: sum("netIncome"),
      netCash: sum("netCash"),
      beginningCash: slice[0]?.beginningCash ?? startingCash,
      totalDistributions: sum("totalDistributions"),
      roth401kDistribution: sum("roth401kDistribution"),
      personalDistribution: sum("personalDistribution"),
      ttmOperatingProfit: end?.ttmOperatingProfit ?? 0,
      saleEnterpriseValue: sum("saleEnterpriseValue"),
      saleDebtPayoff: sum("saleDebtPayoff"),
      saleCashAtClose: sum("saleCashAtClose"),
      saleCorporateTaxes: sum("saleCorporateTaxes"),
      saleTransactionCosts: sum("saleTransactionCosts"),
      saleNetProceeds: sum("saleNetProceeds"),
      roth401kSaleProceeds: sum("roth401kSaleProceeds"),
      personalSaleProceeds: sum("personalSaleProceeds"),
      valuationEnterpriseValue: enterpriseValue,
      valuationEquityValue: equityValue,
      valuationTransactionCosts,
      valuationSaleTaxes,
      valuationNetProceeds,
      cCorpCashUsed: sum("cCorpCashUsed"),
      brokerageCashUsed: sum("brokerageCashUsed"),
      newDebt: sum("newDebt"),
      endingCash,
      debtBalance,
      capitalAssets: end?.capitalAssets ?? 0,
      totalAssets: end?.totalAssets ?? endingCash,
      totalLiabilities: end?.totalLiabilities ?? debtBalance,
      bookEquity: end?.bookEquity ?? endingCash - debtBalance,
      enterpriseValue,
      equityValue,
      totalMembers: end?.totalMembers ?? 0,
      operatingMargin: operatingRevenue ? grossOperatingProfit / operatingRevenue : 0,
    };
  });

  return {
    months,
    years,
    fundingByLocation: Object.fromEntries(fundingByLocation),
    startingCash,
    minimumWorkingCapital: cCorpCashReserve,
    monthlyOwnerSalary: startingMonthlyOwnerSalaryPerLocation,
    ownerSalaryInflation,
    salaryStartDate,
    distributionCashFloor: cCorpCashReserve,
    distributionStartDate,
    combinedTaxRate,
    ebitdaMultiple,
    saleType,
    saleDate,
    transactionCostRate,
    assetTaxBasis,
    ownershipSplit,
  };
}

function calculateRothModel(rollupModel, inputs, options = {}) {
  const enabled = options.enabled !== false;
  const startDate = parseLocalDate(inputs.modelStartDate);
  const birthDate = inputs.rothBirthDate || DEFAULT_ROLLUP_INPUTS.rothBirthDate;
  const endDate = toDateInputValue(addYears(parseLocalDate(birthDate), 60));
  const horizonMonths = Math.max(1, monthDiff(inputs.modelStartDate, endDate) + 1);
  const startingBalance = enabled ? Number(inputs.roth401kContribution) || 0 : 0;
  const distributionStartDate = rollupModel.distributionStartDate;
  const rollupByMonth = new Map(rollupModel.months.map((month) => [toMonthKey(month.date), month]));
  const scenarioInputs = [
    { key: "downside", label: "Downside", annualReturn: Number(inputs.downsideReturn) || 0 },
    { key: "base", label: "Base", annualReturn: Number(inputs.baseReturn) || 0 },
    { key: "upside", label: "Upside", annualReturn: Number(inputs.upsideReturn) || 0 },
  ];

  const projectScenario = (scenario) => {
    const monthlyReturn = Math.pow(1 + scenario.annualReturn, 1 / 12) - 1;
    let rothBalance = startingBalance;
    let undeployedRothCash = startingBalance;
    const months = Array.from({ length: horizonMonths }, (_, index) => {
      const date = toDateInputValue(addMonths(startDate, index));
      const rollupMonth = rollupByMonth.get(toMonthKey(date));
      const beginningBalance = rothBalance;
      const deployedToCorp = enabled && index === 0 ? undeployedRothCash : 0;
      undeployedRothCash -= deployedToCorp;
      const distributions = enabled ? rollupMonth?.roth401kDistribution ?? 0 : 0;
      const saleProceeds = enabled ? rollupMonth?.roth401kSaleProceeds ?? 0 : 0;
      const balanceBeforeGrowth = beginningBalance - deployedToCorp + distributions + saleProceeds;
      const growthAllowed = distributionStartDate && monthDiff(distributionStartDate, date) >= 0;
      const investmentReturn = enabled && growthAllowed ? Math.max(0, balanceBeforeGrowth) * monthlyReturn : 0;
      rothBalance = balanceBeforeGrowth + investmentReturn;

      return {
        month: index + 1,
        date,
        monthLabel: formatMonthLabel(date),
        age: getAgeAtDate(birthDate, date),
        beginningBalance,
        deployedToCorp,
        distributions,
        saleProceeds,
        investmentReturn,
        endingBalance: rothBalance,
      };
    });

    const yearGroups = months.reduce((groups, month) => {
      const calendarYear = parseLocalDate(month.date).getFullYear();
      const group = groups.get(calendarYear) ?? [];
      group.push(month);
      groups.set(calendarYear, group);
      return groups;
    }, new Map());
    const years = Array.from(yearGroups, ([calendarYear, slice]) => {
      const sum = (key) => slice.reduce((total, row) => total + row[key], 0);
      const end = slice.at(-1);
      return {
        calendarYear,
        age: end?.age ?? 0,
        deployedToCorp: sum("deployedToCorp"),
        distributions: sum("distributions"),
        saleProceeds: sum("saleProceeds"),
        investmentReturn: sum("investmentReturn"),
        endingBalance: end?.endingBalance ?? 0,
      };
    });

    return {
      ...scenario,
      monthlyReturn,
      months,
      years,
      endingBalance: months.at(-1)?.endingBalance ?? startingBalance,
    };
  };

  const scenarios = scenarioInputs.map(projectScenario);
  const baseScenario = scenarios.find((scenario) => scenario.key === "base") ?? scenarios[0];
  const months = baseScenario.months;
  const years = baseScenario.years;

  return {
    months,
    years,
    scenarios,
    endDate,
    birthDate,
    ageAtEnd: getAgeAtDate(birthDate, endDate),
    startingBalance,
    endingBalance: baseScenario.endingBalance,
    monthlyReturn: baseScenario.monthlyReturn,
  };
}

function buildPersonalWealthStatement({ businessModel, companyRothModel, inputs, personalModel }) {
  const businessByMonth = new Map(businessModel.months.map((month) => [toMonthKey(month.date), month]));
  const afterTaxBrokerage = (value) => value - Math.max(0, value) * personalModel.effectiveWithdrawalTaxRate;
  const safeWithdrawalRate = Number(inputs.safeWithdrawalRate) || 0;

  const months = personalModel.months.map((personalMonth, index) => {
    const companyRothMonth = companyRothModel.months[index] ?? {};
    const businessMonth = businessByMonth.get(toMonthKey(personalMonth.date));
    const cash = personalMonth.endingCashBalance ?? 0;
    const taxableBrokerage = personalMonth.endingInvestedBalance ?? 0;
    const marginDebt = personalMonth.endingMarginDebt ?? 0;
    const robsRoth401k = companyRothMonth.endingBalance ?? 0;
    const totalWealth = cash + taxableBrokerage + robsRoth401k - marginDebt;
    const afterTaxWealth = cash + afterTaxBrokerage(taxableBrokerage) + robsRoth401k - marginDebt;
    const withdrawalCapacity = afterTaxWealth * safeWithdrawalRate;
    const businessDebt = businessMonth?.debtBalance ?? 0;
    const totalPortfolioDebt = businessDebt + marginDebt;
    const brokerageCollateral = Math.max(0, cash + taxableBrokerage);
    const portfolioLtv = brokerageCollateral > 0 ? totalPortfolioDebt / brokerageCollateral : totalPortfolioDebt > 0 ? Infinity : 0;

    return {
      month: personalMonth.month,
      date: personalMonth.date,
      monthLabel: personalMonth.monthLabel,
      age: personalMonth.age,
      cash,
      taxableBrokerage,
      marginDebt,
      robsRoth401k,
      totalWealth,
      afterTaxWealth,
      withdrawalCapacity,
      businessDebt,
      totalPortfolioDebt,
      portfolioLtv,
    };
  });

  const years = Array.from(
    months.reduce((groups, row) => {
      const calendarYear = parseLocalDate(row.date).getFullYear();
      const group = groups.get(calendarYear) ?? [];
      group.push(row);
      groups.set(calendarYear, group);
      return groups;
    }, new Map()),
    ([calendarYear, rows]) => {
      const last = rows.at(-1);
      return {
        ...last,
        calendarYear,
        year: calendarYear,
      };
    },
  );

  return { months, years };
}

function calculatePersonalModel(businessModel, inputs) {
  const startDate = parseLocalDate(inputs.modelStartDate);
  const birthDate = inputs.rothBirthDate || DEFAULT_ROLLUP_INPUTS.rothBirthDate;
  const endDate = toDateInputValue(addYears(parseLocalDate(birthDate), 60));
  const horizonMonths = Math.max(1, monthDiff(inputs.modelStartDate, endDate) + 1);
  const startingInvestedBalance = Number(inputs.personalStartingBalance) || 0;
  const startingCashBalance = Number(inputs.personalCashBalance) || 0;
  const startingBalance = startingInvestedBalance + startingCashBalance;
  const startingMonthlySpending = (Number(inputs.personalAnnualSpending) || 0) / 12;
  const householdSpendingInflation = Number(inputs.householdSpendingInflation) || 0;
  const capitalGainsTaxRate = Number(inputs.personalCapitalGainsTaxRate) || 0;
  const stockAppreciation = Math.max(0, Number(inputs.personalStockAppreciation) || 0);
  const taxableGainShare = stockAppreciation / (1 + stockAppreciation);
  const effectiveWithdrawalTaxRate = taxableGainShare * capitalGainsTaxRate;
  const businessContribution = Number(inputs.personalContribution) || 0;
  const robsConversionTax =
    (Number(inputs.traditionalIraStartingBalance) || 0) * (Number(inputs.robsConversionTaxRate) || 0);
  const businessByMonth = new Map(businessModel.months.map((month) => [toMonthKey(month.date), month]));
  const scenarioInputs = [
    { key: "downside", label: "Downside", annualReturn: Number(inputs.downsideReturn) || 0 },
    { key: "base", label: "Base", annualReturn: Number(inputs.baseReturn) || 0 },
    { key: "upside", label: "Upside", annualReturn: Number(inputs.upsideReturn) || 0 },
  ];

  const projectScenario = (scenario) => {
    const monthlyReturn = Math.pow(1 + scenario.annualReturn, 1 / 12) - 1;
    let investedBalance = startingInvestedBalance;
    let cashBalance = startingCashBalance;
    let marginDebt = 0;
    const months = Array.from({ length: horizonMonths }, (_, index) => {
      const date = toDateInputValue(addMonths(startDate, index));
      const businessMonth = businessByMonth.get(toMonthKey(date));
      const beginningInvestedBalance = investedBalance;
      const beginningCashBalance = cashBalance;
      const beginningMarginDebt = marginDebt;
      const beginningBalance = beginningInvestedBalance + beginningCashBalance - beginningMarginDebt;
      const deployedToCorp = index === 0 ? businessContribution : 0;
      const brokerageCashUsedForBusiness = businessMonth?.brokerageCashUsed ?? 0;
      const conversionTaxes = index === 0 ? robsConversionTax : 0;
      const salary = businessMonth?.ownerSalary ?? 0;
      const distributions = businessMonth?.personalDistribution ?? 0;
      const saleProceeds = businessMonth?.personalSaleProceeds ?? 0;
      const cashBeforeUses = beginningCashBalance + salary;
      const livingWithdrawals = getMonthlyLivingNeed(inputs, index);
      const cashUsedForLiving = Math.min(livingWithdrawals, cashBeforeUses);
      const livingNeedsFromMargin = livingWithdrawals - cashUsedForLiving;
      const cashAfterLiving = cashBeforeUses - cashUsedForLiving;
      const cashUsedForConversionTax = Math.min(conversionTaxes, cashAfterLiving);
      const conversionTaxFromMargin = conversionTaxes - cashUsedForConversionTax;
      const stockSalesForLiving = 0;
      const stockSalesForConversionTax = 0;
      const capitalGainsTaxes = 0;
      const cashAfterConversionTax = cashAfterLiving - cashUsedForConversionTax;
      const cashUsedForBusiness = Math.min(cashAfterConversionTax, brokerageCashUsedForBusiness);
      cashBalance = cashAfterConversionTax - cashUsedForBusiness + distributions + saleProceeds;
      marginDebt = beginningMarginDebt + livingNeedsFromMargin + conversionTaxFromMargin;
      const investedBalanceBeforeGrowth = beginningInvestedBalance;
      const investmentReturn = investedBalanceBeforeGrowth * monthlyReturn;
      investedBalance = investedBalanceBeforeGrowth + investmentReturn;
      const endingBalance = investedBalance + cashBalance - marginDebt;

      return {
        month: index + 1,
        date,
        monthLabel: formatMonthLabel(date),
        age: getAgeAtDate(birthDate, date),
        beginningBalance,
        beginningInvestedBalance,
        beginningCashBalance,
        beginningMarginDebt,
        deployedToCorp,
        brokerageCashUsedForBusiness: cashUsedForBusiness,
        conversionTaxes,
        cashUsedForConversionTax,
        conversionTaxFromStock: 0,
        conversionTaxFromMargin,
        salary,
        distributions,
        saleProceeds,
        livingWithdrawals,
        cashUsedForLiving,
        livingNeedsFromStock: 0,
        livingNeedsFromMargin,
        stockSalesForLiving,
        stockSalesForConversionTax,
        capitalGainsTaxes,
        investmentReturn,
        endingInvestedBalance: investedBalance,
        endingCashBalance: cashBalance,
        endingMarginDebt: marginDebt,
        endingBalance,
      };
    });

    const yearGroups = months.reduce((groups, month) => {
      const calendarYear = parseLocalDate(month.date).getFullYear();
      const group = groups.get(calendarYear) ?? [];
      group.push(month);
      groups.set(calendarYear, group);
      return groups;
    }, new Map());
    const years = Array.from(yearGroups, ([calendarYear, slice]) => {
      const sum = (key) => slice.reduce((total, row) => total + row[key], 0);
      const end = slice.at(-1);
      return {
        calendarYear,
        age: end?.age ?? 0,
        deployedToCorp: sum("deployedToCorp"),
        brokerageCashUsedForBusiness: sum("brokerageCashUsedForBusiness"),
        conversionTaxes: sum("conversionTaxes"),
        cashUsedForConversionTax: sum("cashUsedForConversionTax"),
        conversionTaxFromStock: sum("conversionTaxFromStock"),
        conversionTaxFromMargin: sum("conversionTaxFromMargin"),
        salary: sum("salary"),
        distributions: sum("distributions"),
        saleProceeds: sum("saleProceeds"),
        livingWithdrawals: sum("livingWithdrawals"),
        cashUsedForLiving: sum("cashUsedForLiving"),
        livingNeedsFromStock: sum("livingNeedsFromStock"),
        livingNeedsFromMargin: sum("livingNeedsFromMargin"),
        stockSalesForLiving: sum("stockSalesForLiving"),
        stockSalesForConversionTax: sum("stockSalesForConversionTax"),
        capitalGainsTaxes: sum("capitalGainsTaxes"),
        investmentReturn: sum("investmentReturn"),
        endingInvestedBalance: end?.endingInvestedBalance ?? 0,
        endingCashBalance: end?.endingCashBalance ?? 0,
        endingMarginDebt: end?.endingMarginDebt ?? 0,
        endingBalance: end?.endingBalance ?? 0,
      };
    });

    return {
      ...scenario,
      monthlyReturn,
      months,
      years,
      endingBalance: months.at(-1)?.endingBalance ?? startingBalance,
    };
  };

  const scenarios = scenarioInputs.map(projectScenario);
  const baseScenario = scenarios.find((scenario) => scenario.key === "base") ?? scenarios[0];
  const endingMonthlySpending = baseScenario.months.at(-1)?.livingWithdrawals ?? startingMonthlySpending;
  return {
    months: baseScenario.months,
    years: baseScenario.years,
    scenarios,
    endDate,
    birthDate,
    ageAtEnd: getAgeAtDate(birthDate, endDate),
    startingBalance,
    startingInvestedBalance,
    startingCashBalance,
    endingBalance: baseScenario.endingBalance,
    endingInvestedBalance: baseScenario.months.at(-1)?.endingInvestedBalance ?? 0,
    endingCashBalance: baseScenario.months.at(-1)?.endingCashBalance ?? 0,
    endingMarginDebt: baseScenario.months.at(-1)?.endingMarginDebt ?? 0,
    monthlyReturn: baseScenario.monthlyReturn,
    monthlySpending: startingMonthlySpending,
    startingMonthlySpending,
    endingMonthlySpending,
    endingAnnualSpending: endingMonthlySpending * 12,
    householdSpendingInflation,
    capitalGainsTaxRate,
    stockAppreciation,
    taxableGainShare,
    effectiveWithdrawalTaxRate,
    robsConversionTax,
  };
}

function PercentInput({ value, onChange }) {
  const [draft, setDraft] = useState(() => String((Number(value) || 0) * 100));

  useEffect(() => {
    setDraft(String((Number(value) || 0) * 100));
  }, [value]);

  function updateDraft(nextDraft) {
    setDraft(nextDraft);
    if (nextDraft === "" || nextDraft === "-" || nextDraft === ".") return;
    const parsed = Number(nextDraft);
    if (Number.isFinite(parsed)) onChange(parsed / 100);
  }

  return <input type="number" step="0.1" value={draft} onChange={(event) => updateDraft(event.target.value)} />;
}

function CorporateInputsPanel({ assumptions, inputs, updateAssumption, updateInput, openGroup, setOpenGroup }) {
  const toggleGroup = (group) => setOpenGroup(openGroup === group ? "" : group);

  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Corporate</h2>
      </div>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Policy")} type="button">
          Policy
          <ChevronDown size={16} className={openGroup === "Policy" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Policy" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Minimum cash reserves</span>
              <input
                type="number"
                step="1000"
                value={inputs.minimumWorkingCapital}
                onChange={(event) => updateInput("minimumWorkingCapital", Number(event.target.value))}
              />
            </label>
            <label className="inputRow">
              <span>Owner salary / location</span>
              <input
                type="number"
                step="1000"
                value={inputs.annualOwnerSalary}
                onChange={(event) => updateInput("annualOwnerSalary", Number(event.target.value))}
              />
            </label>
            <label className="inputRow">
              <span>Owner salary inflation</span>
              <PercentInput
                value={inputs.ownerSalaryInflation}
                onChange={(value) => updateInput("ownerSalaryInflation", value)}
              />
            </label>
            <label className="inputRow">
              <span>Loan rate</span>
              <PercentInput value={assumptions.loanRate} onChange={(value) => updateAssumption("loanRate", value)} />
            </label>
          </div>
        )}
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Valuation")} type="button">
          Valuation
          <ChevronDown size={16} className={openGroup === "Valuation" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Valuation" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Sale type</span>
              <select value={inputs.saleType ?? "stock"} onChange={(event) => updateInput("saleType", event.target.value)}>
                <option value="stock">Stock sale</option>
                <option value="asset">Asset sale</option>
              </select>
            </label>
            <label className="inputRow">
              <span>Sale date</span>
              <input type="date" value={inputs.saleDate} onChange={(event) => updateInput("saleDate", event.target.value)} />
            </label>
            <label className="inputRow">
              <span>EBITDA multiple</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={inputs.ebitdaMultiple}
                onChange={(event) => updateInput("ebitdaMultiple", Number(event.target.value))}
              />
            </label>
            <label className="inputRow">
              <span>Transaction cost</span>
              <PercentInput value={inputs.transactionCostRate} onChange={(value) => updateInput("transactionCostRate", value)} />
            </label>
            <label className="inputRow">
              <span>Tax basis</span>
              <input
                type="number"
                step="1000"
                value={inputs.assetTaxBasis}
                onChange={(event) => updateInput("assetTaxBasis", Number(event.target.value))}
              />
            </label>
          </div>
        )}
      </section>
    </aside>
  );
}

function PersonalWealthInputsPanel({ inputs, updateInput, openGroup, setOpenGroup }) {
  const toggleGroup = (group) => setOpenGroup(openGroup === group ? "" : group);

  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Personal Wealth</h2>
      </div>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Current Assets")} type="button">
          Current Assets
          <ChevronDown size={16} className={openGroup === "Current Assets" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Current Assets" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Cash</span>
              <input
                type="number"
                step="1000"
                value={inputs.personalCashBalance}
                onChange={(event) => updateInput("personalCashBalance", Number(event.target.value))}
              />
            </label>
            <label className="inputRow">
              <span>VOO balance</span>
              <input
                type="number"
                step="1000"
                value={inputs.personalStartingBalance}
                onChange={(event) => updateInput("personalStartingBalance", Number(event.target.value))}
              />
            </label>
          </div>
        )}
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Household")} type="button">
          Household
          <ChevronDown size={16} className={openGroup === "Household" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Household" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Birthday</span>
              <input type="date" value={inputs.rothBirthDate} onChange={(event) => updateInput("rothBirthDate", event.target.value)} />
            </label>
            <label className="inputRow">
              <span>Annual living needs</span>
              <input
                type="number"
                step="1000"
                value={inputs.personalAnnualSpending}
                onChange={(event) => updateInput("personalAnnualSpending", Number(event.target.value))}
              />
            </label>
            <label className="inputRow">
              <span>Spending inflation</span>
              <PercentInput
                value={inputs.householdSpendingInflation}
                onChange={(value) => updateInput("householdSpendingInflation", value)}
              />
            </label>
          </div>
        )}
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Taxable Brokerage")} type="button">
          Taxable Brokerage
          <ChevronDown size={16} className={openGroup === "Taxable Brokerage" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Taxable Brokerage" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Cap gains tax</span>
              <PercentInput
                value={inputs.personalCapitalGainsTaxRate}
                onChange={(value) => updateInput("personalCapitalGainsTaxRate", value)}
              />
            </label>
            <label className="inputRow">
              <span>Stock appreciation</span>
              <PercentInput
                value={inputs.personalStockAppreciation}
                onChange={(value) => updateInput("personalStockAppreciation", value)}
              />
            </label>
          </div>
        )}
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Retirement Accounts")} type="button">
          Retirement Accounts
          <ChevronDown size={16} className={openGroup === "Retirement Accounts" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Retirement Accounts" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>ROBS conversion tax</span>
              <PercentInput value={inputs.robsConversionTaxRate} onChange={(value) => updateInput("robsConversionTaxRate", value)} />
            </label>
          </div>
        )}
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" onClick={() => toggleGroup("Planning")} type="button">
          Planning
          <ChevronDown size={16} className={openGroup === "Planning" ? "chevron open" : "chevron"} />
        </button>
        {openGroup === "Planning" && (
          <div className="groupFields">
            <label className="inputRow">
              <span>Downside return</span>
              <PercentInput value={inputs.downsideReturn} onChange={(value) => updateInput("downsideReturn", value)} />
            </label>
            <label className="inputRow">
              <span>Base return</span>
              <PercentInput value={inputs.baseReturn} onChange={(value) => updateInput("baseReturn", value)} />
            </label>
            <label className="inputRow">
              <span>Upside return</span>
              <PercentInput value={inputs.upsideReturn} onChange={(value) => updateInput("upsideReturn", value)} />
            </label>
            <label className="inputRow">
              <span>Safe withdrawal rate</span>
              <PercentInput value={inputs.safeWithdrawalRate} onChange={(value) => updateInput("safeWithdrawalRate", value)} />
            </label>
            <label className="inputRow">
              <span>Portfolio loan LTV limit</span>
              <PercentInput value={inputs.portfolioLoanLtvLimit} onChange={(value) => updateInput("portfolioLoanLtvLimit", value)} />
            </label>
          </div>
        )}
      </section>
    </aside>
  );
}

function RollupInputsPanel({ assumptions, inputs, updateAssumption, updateInput }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Corporate Policy</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <label className="inputRow">
            <span>Minimum cash reserves</span>
            <input
              type="number"
              step="1000"
              value={inputs.minimumWorkingCapital}
              onChange={(event) => updateInput("minimumWorkingCapital", Number(event.target.value))}
            />
          </label>
          <label className="inputRow">
            <span>Owner salary / location</span>
            <input
              type="number"
              step="1000"
              value={inputs.annualOwnerSalary}
              onChange={(event) => updateInput("annualOwnerSalary", Number(event.target.value))}
            />
          </label>
          <label className="inputRow">
            <span>Owner salary inflation</span>
            <PercentInput
              value={inputs.ownerSalaryInflation}
              onChange={(value) => updateInput("ownerSalaryInflation", value)}
            />
          </label>
          <label className="inputRow">
            <span>Loan rate</span>
            <PercentInput value={assumptions.loanRate} onChange={(value) => updateAssumption("loanRate", value)} />
          </label>
        </div>
      </section>
    </aside>
  );
}

const ROLLUP_CHART_METRICS = {
  operatingIncome: {
    label: "Operating Income",
    title: "Annual Operating Income",
    valueKey: "grossOperatingProfit",
    ariaLabel: "Annual operating income",
  },
  netIncome: {
    label: "Net Income",
    title: "Annual Net Income",
    valueKey: "netIncome",
    ariaLabel: "Annual net income after interest and corporate taxes",
  },
  cashFlow: {
    label: "Cash Flow",
    title: "Annual Cash Flow",
    valueKey: "netCash",
    ariaLabel: "Annual cash flow after taxes, interest expense, and C-Corp cash used",
  },
  corporateTaxes: {
    label: "Corp Taxes",
    title: "Annual Corporate Taxes",
    valueKey: "corporateTaxes",
    ariaLabel: "Annual corporate taxes",
  },
  ownerSalary: {
    label: "Owner Salary",
    title: "Annual Owner Salary",
    valueKey: "ownerSalary",
    ariaLabel: "Annual owner salary paid by Hart Fitness",
  },
  debtBalance: {
    label: "Debt Balance",
    title: "Year-End Debt Balance",
    valueKey: "debtBalance",
    ariaLabel: "Year-end debt balance",
  },
  enterpriseValue: {
    label: "Enterprise Value",
    title: "Annual Enterprise Value",
    valueKey: "enterpriseValue",
    ariaLabel: "Annual enterprise value based on EBITDA proxy multiple",
  },
  equityValue: {
    label: "Equity Value",
    title: "Annual Equity Value",
    valueKey: "equityValue",
    ariaLabel: "Annual equity value based on EBITDA proxy multiple minus debt",
  },
  saleProceeds: {
    label: "Sale Proceeds",
    title: "Annual Sale Proceeds",
    valueKey: "saleNetProceeds",
    ariaLabel: "Annual net sale proceeds split by shareholder",
    stackedKeys: [
      ["roth401kSaleProceeds", "Roth 401k"],
      ["personalSaleProceeds", "Personal"],
    ],
  },
  debtService: {
    label: "Interest Expense",
    title: "Annual Interest Expense",
    valueKey: "corporateDebtService",
    ariaLabel: "Annual interest expense paid",
  },
  distributions: {
    label: "Distributions",
    title: "Annual Shareholder Distributions",
    valueKey: "totalDistributions",
    ariaLabel: "Annual shareholder distributions",
    stackedKeys: [
      ["roth401kDistribution", "Roth 401k"],
      ["personalDistribution", "Personal"],
    ],
  },
};

function AnnualRollupChart({ metric, years, metricConfigMap = ROLLUP_CHART_METRICS }) {
  const metricConfig = metricConfigMap[metric];
  const values = years.map((year) => year[metricConfig.valueKey]);
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const range = maxValue - minValue || 1;
  const compact = years.length > 8;
  const width = Math.max(760, years.length * (compact ? 104 : 128));
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 44, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const zeroY = padding.top + ((maxValue - 0) / range) * chartHeight;
  const barGap = compact ? 18 : 22;
  const barWidth = Math.max(46, (chartWidth - barGap * (years.length - 1)) / Math.max(years.length, 1));
  const formatChartValue = (value) => {
    if (!compact) return money.format(value);
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
    if (absValue >= 1000) return `${sign}$${Math.round(absValue / 1000)}K`;
    return money.format(value);
  };

  return (
    <div className="profitChartWrap">
      <svg className="profitChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={metricConfig.ariaLabel}>
        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} className="chartZeroLine" />
        {years.map((year, index) => {
          const value = year[metricConfig.valueKey];
          const x = padding.left + index * (barWidth + barGap);
          const y = padding.top + ((maxValue - Math.max(value, 0)) / range) * chartHeight;
          const negativeY = zeroY;
          const barHeight = Math.max(2, (Math.abs(value) / range) * chartHeight);
          const isNegative = value < 0;
          const labelY = isNegative ? Math.min(height - padding.bottom - 8, negativeY + barHeight + 16) : Math.max(16, y - 8);
          const stackedSegments = metricConfig.stackedKeys ?? [];
          let segmentOffset = 0;
          return (
            <g key={year.calendarYear}>
              {stackedSegments.length > 0 ? (
                stackedSegments.map(([key, label], segmentIndex) => {
                  const segmentValue = year[key] ?? 0;
                  const segmentHeight = value ? (Math.abs(segmentValue) / Math.abs(value)) * barHeight : 0;
                  const segmentY = y + barHeight - segmentOffset - segmentHeight;
                  segmentOffset += segmentHeight;
                  if (segmentHeight <= 0) return null;
                  return (
                    <g key={key}>
                      <rect
                      className={`chartBar ${segmentIndex === 0 ? "principalBar" : "interestBar"}`}
                        data-label={label}
                        x={x}
                        y={segmentY}
                        width={barWidth}
                        height={Math.max(1, segmentHeight)}
                        rx={segmentIndex === stackedSegments.length - 1 ? 4 : 0}
                      />
                      {segmentHeight >= 24 && (
                        <text
                          className={segmentIndex === 0 ? "stackLabel principalStackLabel" : "stackLabel interestStackLabel"}
                          x={x + barWidth / 2}
                          y={segmentY + segmentHeight / 2 + 4}
                          textAnchor="middle"
                        >
                          {formatChartValue(segmentValue)}
                        </text>
                      )}
                    </g>
                  );
                })
              ) : (
                <rect
                  className={isNegative ? "chartBar negativeBar" : "chartBar positiveBar"}
                  x={x}
                  y={isNegative ? negativeY : y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                />
              )}
              <text
                className={compact ? "chartValue compactChartValue" : "chartValue"}
                x={x + barWidth / 2}
                y={labelY}
                textAnchor="middle"
              >
                {formatChartValue(value)}
              </text>
              <text className="chartYear" x={x + barWidth / 2} y={height - 18} textAnchor="middle">
                {year.calendarYear}
              </text>
            </g>
          );
        })}
      </svg>
      {metricConfig.stackedKeys && (
        <div className="chartLegend">
          {metricConfig.stackedKeys.map(([, label], index) => (
            <span key={label}>
              <i className={`legendSwatch ${index === 0 ? "principalSwatch" : "interestSwatch"}`} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RollupDashboard({ inputs, locations, rollupModel }) {
  const totalInitialInvestment = locations.reduce(
    (total, location) => total + (location.outputs.totalInitialInvestment ?? 0),
    0,
  );
  const finalMonth = rollupModel.months.at(-1);
  const [chartMetric, setChartMetric] = useState("operatingIncome");
  const chartMetricConfig = ROLLUP_CHART_METRICS[chartMetric];

  return (
    <section className="dashboard">
      <div className="locationSnapshot">
        <div>
          <p className="eyebrow">C-Corp Rollup</p>
          <h2>{inputs.entityName}</h2>
          <p>
            {num.format(locations.length)} locations · Starts {inputs.modelStartDate}
          </p>
        </div>
        <div className="locationKpis">
          <article>
            <span>Starting Cash</span>
            <strong>{money.format(rollupModel.startingCash)}</strong>
            <small>{money.format(rollupModel.minimumWorkingCapital)} minimum cash reserves</small>
          </article>
          <article>
            <span>Total Investment</span>
            <strong>{money.format(totalInitialInvestment)}</strong>
            <small>All location startup capital</small>
          </article>
          <article>
            <span>Ending Revenue</span>
            <strong>{money.format(finalMonth?.operatingRevenue ?? 0)}</strong>
            <small>{num.format(finalMonth?.totalMembers ?? 0)} members</small>
          </article>
          <article>
            <span>Ending Debt Balance</span>
            <strong>{money.format(finalMonth?.debtBalance ?? 0)}</strong>
            <small>{money.format(finalMonth?.totalDistributions ?? 0)} monthly distributions</small>
          </article>
        </div>
      </div>
      <section className="annualPanel">
        <div className="chartHeader">
          <div className="panelTitle">
            <h2>{chartMetricConfig.title}</h2>
          </div>
          <div className="segmentedControl" aria-label="Rollup chart metric">
            {Object.entries(ROLLUP_CHART_METRICS).map(([key, option]) => (
              <button
                className={chartMetric === key ? "active" : ""}
                key={key}
                onClick={() => setChartMetric(key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <AnnualRollupChart metric={chartMetric} years={rollupModel.years} />
      </section>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Monthly Portfolio Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Calendar</th>
                <th>Active Locations</th>
                <th>Members</th>
	                <th>Beginning Cash</th>
	                <th>Beginning Brokerage Cash</th>
	                <th>Brokerage Cash For Living</th>
	                <th>Pre-Open Capex</th>
	                <th>C-Corp Cash Used</th>
	                <th>Brokerage Cash Used</th>
	                <th>New Debt</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Operating Income</th>
                <th>Owner Salary</th>
                <th>Interest Expense</th>
                <th>Interest</th>
                <th>Taxable Income</th>
                <th>Corp Taxes</th>
                <th>Net Income</th>
                <th>Cash Flow</th>
                <th>Distributions</th>
                <th>Roth 401k Dist.</th>
                <th>Personal Dist.</th>
                <th>TTM EBITDA Proxy</th>
                <th>Sale EV</th>
                <th>Debt Payoff</th>
                <th>Cash at Close</th>
                <th>Sale Taxes</th>
                <th>Sale Costs</th>
                <th>Net Sale Proceeds</th>
	                <th>Ending Cash</th>
	                <th>Ending Brokerage Cash</th>
	                <th>Debt Balance</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {rollupModel.months.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{month.monthLabel}</td>
                  <td>{num.format(month.activeLocations)}</td>
                  <td>{num.format(month.totalMembers)}</td>
	                  <td>{money.format(month.beginningCash)}</td>
	                  <td>{money.format(month.beginningBrokerageCash)}</td>
	                  <td>{money.format(month.brokerageCashUsedForLiving)}</td>
	                  <td>{money.format(month.preOpenInvestment)}</td>
	                  <td>{money.format(month.cCorpCashUsed)}</td>
	                  <td>{money.format(month.brokerageCashUsed)}</td>
	                  <td>{money.format(month.newDebt)}</td>
                  <td>{money.format(month.operatingRevenue)}</td>
                  <td>{money.format(month.totalExpenses)}</td>
                  <td className={month.grossOperatingProfit < 0 ? "negative" : "positive"}>
                    {money.format(month.grossOperatingProfit)}
                  </td>
                  <td>{money.format(month.ownerSalary)}</td>
                  <td>{money.format(month.corporateDebtService)}</td>
                  <td>{money.format(month.debtInterest)}</td>
                  <td>{money.format(month.taxableIncome)}</td>
                  <td>{money.format(month.corporateTaxes)}</td>
                  <td className={month.netIncome < 0 ? "negative" : "positive"}>{money.format(month.netIncome)}</td>
                  <td className={month.netCash < 0 ? "negative" : "positive"}>{money.format(month.netCash)}</td>
                  <td>{money.format(month.totalDistributions)}</td>
                  <td>{money.format(month.roth401kDistribution)}</td>
                  <td>{money.format(month.personalDistribution)}</td>
                  <td>{money.format(month.ttmOperatingProfit)}</td>
                  <td>{money.format(month.saleEnterpriseValue)}</td>
                  <td>{money.format(month.saleDebtPayoff)}</td>
                  <td>{money.format(month.saleCashAtClose)}</td>
                  <td>{money.format(month.saleCorporateTaxes)}</td>
                  <td>{money.format(month.saleTransactionCosts)}</td>
                  <td className={month.saleNetProceeds < 0 ? "negative" : "positive"}>
                    {money.format(month.saleNetProceeds)}
                  </td>
	                  <td>{money.format(month.endingCash)}</td>
	                  <td>{money.format(month.endingBrokerageCash)}</td>
	                  <td>{money.format(month.debtBalance)}</td>
                  <td>{pct.format(month.operatingMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function RollupPage({ assumptions, locations, inputs, updateAssumption, updateInput }) {
  const rollupModel = useMemo(() => calculateRollupModel(locations, inputs), [locations, inputs]);

  return (
    <section className="workspace">
      <div className="leftRail">
        <RollupInputsPanel
          assumptions={assumptions}
          inputs={inputs}
          updateAssumption={updateAssumption}
          updateInput={updateInput}
        />
        <ExitInputsPanel inputs={inputs} updateInput={updateInput} />
      </div>
      <div>
        <RollupDashboard inputs={inputs} locations={locations} rollupModel={rollupModel} />
      </div>
    </section>
  );
}

function ScenarioLineChart({ scenarios, ariaLabel }) {
  const allPoints = scenarios.flatMap((scenario) =>
    scenario.years.map((year) => ({ ...year, scenarioKey: scenario.key })),
  );
  const maxValue = Math.max(1, ...allPoints.map((point) => point.endingBalance));
  const minValue = Math.min(0, ...allPoints.map((point) => point.endingBalance));
  const range = maxValue - minValue || 1;
  const years = scenarios[0]?.years ?? [];
  const compact = years.length > 8;
  const width = Math.max(760, years.length * (compact ? 76 : 96));
  const height = 300;
  const padding = { top: 24, right: 34, bottom: 48, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const colors = {
    downside: "#b4432d",
    base: "#1d6f67",
    upside: "#e0ad3f",
  };
  const xForIndex = (index) => padding.left + (years.length <= 1 ? 0 : (index / (years.length - 1)) * chartWidth);
  const yForValue = (value) => padding.top + ((maxValue - value) / range) * chartHeight;
  const formatChartValue = (value) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
    if (absValue >= 1000) return `${sign}$${Math.round(absValue / 1000)}K`;
    return money.format(value);
  };

  return (
    <div className="profitChartWrap">
      <svg className="profitChart rothLineChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={yForValue(0)}
          y2={yForValue(0)}
          className="chartZeroLine"
        />
        {scenarios.map((scenario) => {
          const points = scenario.years.map((year, index) => `${xForIndex(index)},${yForValue(year.endingBalance)}`);
          const lastYear = scenario.years.at(-1);
          const lastIndex = Math.max(0, scenario.years.length - 1);
          return (
            <g key={scenario.key}>
              <polyline className="scenarioLine" points={points.join(" ")} stroke={colors[scenario.key]} />
              {scenario.years.map((year, index) => (
                <circle
                  className="scenarioPoint"
                  cx={xForIndex(index)}
                  cy={yForValue(year.endingBalance)}
                  fill={colors[scenario.key]}
                  key={`${scenario.key}-${year.calendarYear}`}
                  r="3.5"
                />
              ))}
              {lastYear && (
                <text
                  className="scenarioEndLabel"
                  fill={colors[scenario.key]}
                  x={width - padding.right - 4}
                  y={yForValue(lastYear.endingBalance) + 4}
                  textAnchor="end"
                >
                  {scenario.label} {formatChartValue(lastYear.endingBalance)}
                </text>
              )}
            </g>
          );
        })}
        {years.map((year, index) => (
          <text className="chartYear" x={xForIndex(index)} y={height - 18} textAnchor="middle" key={year.calendarYear}>
            {year.age}
          </text>
        ))}
      </svg>
      <div className="chartLegend">
        {scenarios.map((scenario) => (
          <span key={scenario.key}>
            <i className="legendSwatch" style={{ background: colors[scenario.key] }} />
            {scenario.label} ({pct.format(scenario.annualReturn)})
          </span>
        ))}
      </div>
    </div>
  );
}

function RothInputsPanel({ inputs, updateInput }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>ROBS Roth 401k Inputs</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <p className="emptyState">
            Return scenarios are shared across accounts from Personal Wealth &gt; Planning.
          </p>
        </div>
      </section>
    </aside>
  );
}

function RothDashboard({ rothModel, inputs }) {
  const totalDeployed = rothModel.months.reduce((total, month) => total + month.deployedToCorp, 0);
  const totalDistributions = rothModel.months.reduce((total, month) => total + month.distributions, 0);
  const totalSaleProceeds = rothModel.months.reduce((total, month) => total + month.saleProceeds, 0);
  const totalGrowth = rothModel.months.reduce((total, month) => total + month.investmentReturn, 0);

  return (
    <section className="dashboard">
      <div className="locationSnapshot">
        <div>
          <p className="eyebrow">Roth 401k</p>
          <h2>ROBS Roth 401k Projection</h2>
          <p>Through age {num.format(rothModel.ageAtEnd)} · {formatMonthLabel(rothModel.endDate)}</p>
        </div>
        <div className="locationKpis">
          <article>
            <span>Starting Balance</span>
            <strong>{money.format(rothModel.startingBalance)}</strong>
            <small>Converted IRA cash inside company plan</small>
          </article>
          <article>
            <span>Deployed to C-Corp</span>
            <strong>{money.format(totalDeployed)}</strong>
            <small>Roth 401k purchase of Hart Fitness stock</small>
          </article>
          <article>
            <span>Business Cash Back</span>
            <strong>{money.format(totalDistributions + totalSaleProceeds)}</strong>
            <small>Distributions plus sale proceeds</small>
          </article>
          <article>
            <span>Ending Balance</span>
            <strong>{money.format(rothModel.endingBalance)}</strong>
            <small>{money.format(totalGrowth)} investment growth</small>
          </article>
        </div>
      </div>
      <section className="annualPanel">
        <div className="chartHeader">
          <div className="panelTitle">
            <h2>Roth Balance Scenarios</h2>
          </div>
        </div>
        <ScenarioLineChart ariaLabel="ROBS Roth 401k balance scenarios through age 60" scenarios={rothModel.scenarios} />
      </section>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Monthly Roth Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Calendar</th>
                <th>Age</th>
                <th>Beginning Balance</th>
                <th>Deployed to C-Corp</th>
                <th>Distributions</th>
                <th>Sale Proceeds</th>
                <th>Investment Growth</th>
                <th>Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {rothModel.months.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{month.monthLabel}</td>
                  <td>{num.format(month.age)}</td>
                  <td>{money.format(month.beginningBalance)}</td>
                  <td>{money.format(month.deployedToCorp)}</td>
                  <td>{money.format(month.distributions)}</td>
                  <td>{money.format(month.saleProceeds)}</td>
                  <td>{money.format(month.investmentReturn)}</td>
                  <td>{money.format(month.endingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function RothPage({ locations, inputs, updateInput }) {
  const sourceStructure = getWealthSource(inputs.wealthSourceStructure);
  const saleType = getRobsSaleTypeForSource(sourceStructure);
  const rollupModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType }), [locations, inputs, saleType]);
  const rothModel = useMemo(() => calculateRothModel(rollupModel, inputs), [rollupModel, inputs]);

  return (
    <section className="workspace">
      <div className="leftRail">
        <RothInputsPanel inputs={inputs} updateInput={updateInput} />
      </div>
      <div>
        <RothDashboard rothModel={rothModel} inputs={inputs} />
      </div>
    </section>
  );
}

function CashInputsPanel({ inputs, updateInput, personalModel }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Cash Inputs</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <label className="inputRow">
            <span>Starting cash</span>
            <input
              type="number"
              step="1000"
              value={inputs.personalCashBalance}
              onChange={(event) => updateInput("personalCashBalance", Number(event.target.value))}
            />
          </label>
          <div className="rollupLocationRow">
            <strong>Ending cash</strong>
            <span>{money.format(personalModel.months.at(-1)?.endingCashBalance ?? 0)}</span>
          </div>
          <p className="emptyState">
            Cash receives owner salary, pays living expenses first, then funds gym capital before portfolio-loan debt.
          </p>
        </div>
      </section>
    </aside>
  );
}

function CashDashboard({ personalModel, sourceStructure = "robs" }) {
  const sourceLabel = getWealthSourceLabel(sourceStructure);
  const totalSalary = personalModel.months.reduce((total, month) => total + month.salary, 0);
  const totalDistributions = personalModel.months.reduce((total, month) => total + month.distributions, 0);
  const totalSaleProceeds = personalModel.months.reduce((total, month) => total + month.saleProceeds, 0);
  const totalCashForLiving = personalModel.months.reduce((total, month) => total + month.cashUsedForLiving, 0);
  const totalCashForConversionTax = personalModel.months.reduce((total, month) => total + month.cashUsedForConversionTax, 0);
  const totalCashForGyms = personalModel.months.reduce((total, month) => total + month.brokerageCashUsedForBusiness, 0);
  const totalMarginBorrowing =
    personalModel.months.reduce((total, month) => total + month.livingNeedsFromMargin + month.conversionTaxFromMargin, 0);
  const endingCash = personalModel.months.at(-1)?.endingCashBalance ?? 0;

  return (
    <section className="dashboard">
      <div className="locationSnapshot">
        <div>
          <p className="eyebrow">Cash</p>
          <h2>Household Cash Projection</h2>
          <p>
            Source: {sourceLabel} · Through age {num.format(personalModel.ageAtEnd)} · {formatMonthLabel(personalModel.endDate)}
          </p>
        </div>
        <div className="locationKpis">
          <article>
            <span>Starting Cash</span>
            <strong>{money.format(personalModel.startingCashBalance)}</strong>
            <small>Held outside VOO</small>
          </article>
          <article>
            <span>Salary Received</span>
            <strong>{money.format(totalSalary)}</strong>
            <small>Added to cash before monthly uses</small>
          </article>
          <article>
            <span>Business Cash Back</span>
            <strong>{money.format(totalDistributions + totalSaleProceeds)}</strong>
            <small>Distributions plus sale proceeds</small>
          </article>
          <article>
            <span>Cash Used</span>
            <strong>{money.format(totalCashForLiving + totalCashForConversionTax + totalCashForGyms)}</strong>
            <small>
              {money.format(totalCashForLiving)} living · {money.format(totalCashForConversionTax)} conversion ·{" "}
              {money.format(totalCashForGyms)} gyms
            </small>
          </article>
          <article>
            <span>Margin Borrowing</span>
            <strong>{money.format(totalMarginBorrowing)}</strong>
            <small>Personal living needs and conversion tax shortfalls</small>
          </article>
          <article>
            <span>Ending Cash</span>
            <strong>{money.format(endingCash)}</strong>
            <small>Remaining cash balance</small>
          </article>
        </div>
      </div>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Monthly Cash Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Calendar</th>
                <th>Age</th>
                <th>Beginning Cash</th>
                <th>Salary</th>
                <th>Distributions</th>
                <th>Sale Proceeds</th>
                <th>Living Needs</th>
                <th>Cash For Living</th>
                <th>Margin For Living</th>
                <th>Cash For Conversion Tax</th>
                <th>Margin For Conversion Tax</th>
                <th>Cash Used For Gyms</th>
                <th>Margin Debt</th>
                <th>Ending Cash</th>
              </tr>
            </thead>
            <tbody>
              {personalModel.months.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{month.monthLabel}</td>
                  <td>{num.format(month.age)}</td>
                  <td>{money.format(month.beginningCashBalance)}</td>
                  <td>{money.format(month.salary)}</td>
                  <td>{money.format(month.distributions)}</td>
                  <td>{money.format(month.saleProceeds)}</td>
                  <td>{money.format(month.livingWithdrawals)}</td>
                  <td>{money.format(month.cashUsedForLiving)}</td>
                  <td>{money.format(month.livingNeedsFromMargin)}</td>
                  <td>{money.format(month.cashUsedForConversionTax)}</td>
                  <td>{money.format(month.conversionTaxFromMargin)}</td>
                  <td>{money.format(month.brokerageCashUsedForBusiness)}</td>
                  <td>{money.format(month.endingMarginDebt)}</td>
                  <td className={month.endingCashBalance < 0 ? "negative" : "positive"}>
                    {money.format(month.endingCashBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function CashPage({ locations, inputs, updateInput }) {
  const sourceStructure = getWealthSource(inputs.wealthSourceStructure);
  const saleType = getRobsSaleTypeForSource(sourceStructure);
  const rollupModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType }), [locations, inputs, saleType]);
  const personalModel = useMemo(
    () => calculatePersonalModel(rollupModel, inputs),
    [rollupModel, inputs],
  );

  return (
    <section className="workspace">
      <div className="leftRail">
        <CashInputsPanel inputs={inputs} updateInput={updateInput} personalModel={personalModel} />
      </div>
      <div>
        <CashDashboard personalModel={personalModel} sourceStructure={sourceStructure} />
      </div>
    </section>
  );
}

function PersonalInputsPanel({ inputs, updateInput, personalModel }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Personal Brokerage Inputs</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <label className="inputRow">
            <span>Starting VOO balance</span>
            <input
              type="number"
              step="1000"
              value={inputs.personalStartingBalance}
              onChange={(event) => updateInput("personalStartingBalance", Number(event.target.value))}
            />
          </label>
          <label className="inputRow">
            <span>Cap gains tax</span>
            <PercentInput
              value={inputs.personalCapitalGainsTaxRate}
              onChange={(value) => updateInput("personalCapitalGainsTaxRate", value)}
            />
          </label>
          <label className="inputRow">
            <span>Stock appreciation</span>
            <PercentInput
              value={inputs.personalStockAppreciation}
              onChange={(value) => updateInput("personalStockAppreciation", value)}
            />
          </label>
          <p className="emptyState">
            VOO stays invested. Cash is modeled separately in the Cash tab, and personal shortfalls are funded with
            margin debt instead of stock sales.
          </p>
        </div>
      </section>
      <section className="assumptionGroup">
        <button className="groupToggle" type="button">
          After-Tax Reference
        </button>
        <div className="groupFields">
          <div className="rollupLocationRow">
            <strong>Embedded gain share</strong>
            <span>{pct.format(personalModel.taxableGainShare)}</span>
          </div>
          <div className="rollupLocationRow">
            <strong>Liquidation tax estimate</strong>
            <span>{pct.format(personalModel.effectiveWithdrawalTaxRate)}</span>
          </div>
          <div className="rollupLocationRow">
            <strong>Base monthly return</strong>
            <span>{pct.format(personalModel.monthlyReturn)}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

function PersonalDashboard({ personalModel, sourceStructure = "robs-stock" }) {
  const businessContributionLabel = "C-Corp Contribution";
  const sourceLabel = getWealthSourceLabel(sourceStructure);
  const totalConversionTaxes = personalModel.months.reduce((total, month) => total + month.conversionTaxes, 0);
  const endingMarginDebt = personalModel.months.at(-1)?.endingMarginDebt ?? 0;
  const totalGrowth = personalModel.months.reduce((total, month) => total + month.investmentReturn, 0);
  const vooScenarios = personalModel.scenarios.map((scenario) => ({
    ...scenario,
    endingBalance: scenario.months.at(-1)?.endingInvestedBalance ?? 0,
    years: scenario.years.map((year) => ({
      ...year,
      endingBalance: year.endingInvestedBalance ?? 0,
    })),
  }));

  return (
    <section className="dashboard">
      <div className="locationSnapshot">
        <div>
          <p className="eyebrow">Personal Brokerage</p>
          <h2>Taxable Investment Projection</h2>
          <p>
            Source: {sourceLabel} · Through age {num.format(personalModel.ageAtEnd)} · {formatMonthLabel(personalModel.endDate)}
          </p>
        </div>
        <div className="locationKpis">
	          <article>
	            <span>Starting VOO</span>
	            <strong>{money.format(personalModel.startingInvestedBalance)}</strong>
	            <small>Invested brokerage balance</small>
	          </article>
	          <article>
	            <span>Ending VOO</span>
	            <strong>{money.format(personalModel.months.at(-1)?.endingInvestedBalance ?? 0)}</strong>
	            <small>{money.format(totalGrowth)} investment growth</small>
          </article>
          <article>
            <span>Margin Debt</span>
            <strong>{money.format(endingMarginDebt)}</strong>
            <small>Personal shortfalls funded without selling VOO</small>
          </article>
          <article>
            <span>ROBS Conversion Tax</span>
            <strong>{money.format(totalConversionTaxes)}</strong>
            <small>Personal tax paid on IRA conversion</small>
          </article>
        </div>
      </div>
      <section className="annualPanel">
        <div className="chartHeader">
          <div className="panelTitle">
          <h2>Personal Brokerage Balance Scenarios</h2>
          </div>
        </div>
        <ScenarioLineChart ariaLabel="Personal VOO balance scenarios through age 60" scenarios={vooScenarios} />
      </section>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Monthly Personal Brokerage Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
	                <th>Calendar</th>
		                <th>Age</th>
		                <th>Beginning VOO</th>
		                <th>{businessContributionLabel}</th>
		                <th>ROBS Conversion Tax</th>
		                <th>Margin For Living</th>
		                <th>Margin For Conversion Tax</th>
		                <th>Margin Debt</th>
		                <th>Investment Growth</th>
		                <th>Ending VOO</th>
	              </tr>
            </thead>
            <tbody>
              {personalModel.months.map((month) => (
                <tr key={month.month}>
	                  <td>{month.month}</td>
	                  <td>{month.monthLabel}</td>
		                  <td>{num.format(month.age)}</td>
		                  <td>{money.format(month.beginningInvestedBalance)}</td>
		                  <td>{money.format(month.deployedToCorp)}</td>
		                  <td>{money.format(month.conversionTaxes)}</td>
		                  <td>{money.format(month.livingNeedsFromMargin)}</td>
		                  <td>{money.format(month.conversionTaxFromMargin)}</td>
		                  <td>{money.format(month.endingMarginDebt)}</td>
		                  <td>{money.format(month.investmentReturn)}</td>
		                  <td>{money.format(month.endingInvestedBalance)}</td>
	                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function PersonalPage({ locations, inputs, updateInput }) {
  const sourceStructure = getWealthSource(inputs.wealthSourceStructure);
  const saleType = getRobsSaleTypeForSource(sourceStructure);
  const rollupModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType }), [locations, inputs, saleType]);
  const personalModel = useMemo(
    () => calculatePersonalModel(rollupModel, inputs),
    [rollupModel, inputs],
  );

  return (
    <section className="workspace">
      <div className="leftRail">
        <PersonalInputsPanel inputs={inputs} updateInput={updateInput} personalModel={personalModel} />
      </div>
      <div>
        <PersonalDashboard personalModel={personalModel} sourceStructure={sourceStructure} />
      </div>
    </section>
  );
}

function WealthOverviewInputsPanel({ inputs, updateInput }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Wealth Inputs</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <label className="inputRow">
            <span>Birthday</span>
            <input type="date" value={inputs.rothBirthDate} onChange={(event) => updateInput("rothBirthDate", event.target.value)} />
          </label>
          <label className="inputRow">
            <span>Annual living needs</span>
            <input
              type="number"
              step="1000"
              value={inputs.personalAnnualSpending}
              onChange={(event) => updateInput("personalAnnualSpending", Number(event.target.value))}
            />
          </label>
          <label className="inputRow">
            <span>Household spending inflation</span>
            <PercentInput
              value={inputs.householdSpendingInflation}
              onChange={(value) => updateInput("householdSpendingInflation", value)}
            />
          </label>
          <label className="inputRow">
            <span>Safe withdrawal rate</span>
            <PercentInput value={inputs.safeWithdrawalRate} onChange={(value) => updateInput("safeWithdrawalRate", value)} />
          </label>
          <label className="inputRow">
            <span>Portfolio loan LTV limit</span>
            <PercentInput value={inputs.portfolioLoanLtvLimit} onChange={(value) => updateInput("portfolioLoanLtvLimit", value)} />
          </label>
        </div>
      </section>
    </aside>
  );
}

function WealthOverviewDashboard({
  companyRothModel,
  personalModel,
  businessModel,
  inputs,
  sourceStructure,
}) {
  const structureAccountModel = companyRothModel;
  const structureAccountLabel = "ROBS Roth 401k";
  const endingPersonalVoo = personalModel.endingInvestedBalance ?? 0;
  const endingPersonalCash = personalModel.endingCashBalance ?? 0;
  const endingPersonalMarginDebt = personalModel.endingMarginDebt ?? 0;
  const totalWealth = structureAccountModel.endingBalance + endingPersonalVoo + endingPersonalCash - endingPersonalMarginDebt;
  const afterTaxBrokerage = (value) => value - Math.max(0, value) * personalModel.effectiveWithdrawalTaxRate;
  const endingBalanceFor = (model, key) =>
    model.scenarios.find((scenario) => scenario.key === key)?.endingBalance ?? model.endingBalance;
  const personalScenarioFor = (key) => personalModel.scenarios.find((scenario) => scenario.key === key) ?? personalModel.scenarios[0];
  const personalVooFor = (key) => personalScenarioFor(key)?.months.at(-1)?.endingInvestedBalance ?? endingPersonalVoo;
  const personalCashFor = (key) => personalScenarioFor(key)?.months.at(-1)?.endingCashBalance ?? endingPersonalCash;
  const personalMarginDebtFor = (key) => personalScenarioFor(key)?.months.at(-1)?.endingMarginDebt ?? endingPersonalMarginDebt;
  const structureAccountAfterTaxFor = (key) => {
    const value = endingBalanceFor(structureAccountModel, key);
    return value;
  };
  const scenarioAfterTaxTotal = (key) =>
    personalCashFor(key) +
    afterTaxBrokerage(personalVooFor(key)) +
    structureAccountAfterTaxFor(key) -
    personalMarginDebtFor(key);
  const rangeLabel = (model) =>
    `${money.format(endingBalanceFor(model, "downside"))} to ${money.format(endingBalanceFor(model, "upside"))}`;
  const personalCashRange = `${money.format(personalCashFor("downside"))} to ${money.format(personalCashFor("upside"))}`;
  const personalVooRange = `${money.format(personalVooFor("downside"))} to ${money.format(personalVooFor("upside"))}`;
  const marginDebtRange = `${money.format(personalMarginDebtFor("downside"))} to ${money.format(personalMarginDebtFor("upside"))}`;
  const afterTaxPersonalVoo = afterTaxBrokerage(endingPersonalVoo);
  const structureAccountAfterTax = structureAccountAfterTaxFor("base");
  const afterTaxWealth = endingPersonalCash + afterTaxPersonalVoo + structureAccountAfterTax - endingPersonalMarginDebt;
  const afterTaxRange = `${money.format(scenarioAfterTaxTotal("downside"))} to ${money.format(
    scenarioAfterTaxTotal("upside"),
  )}`;
  const safeWithdrawalRate = Number(inputs.safeWithdrawalRate) || 0;
  const annualSafeWithdrawal = afterTaxWealth * safeWithdrawalRate;
  const monthlySafeWithdrawal = annualSafeWithdrawal / 12;
  const annualLivingNeeds = personalModel.endingAnnualSpending;
  const annualLifestyleSurplus = annualSafeWithdrawal - annualLivingNeeds;
  const monthlyLifestyleSurplus = annualLifestyleSurplus / 12;
  const portfolioLoanLtvLimit = Number(inputs.portfolioLoanLtvLimit) || 0;
  const businessByMonth = new Map(businessModel.months.map((month) => [toMonthKey(month.date), month]));
  const afterTaxStructureAccount = (value) => {
    return value;
  };
  const monthlyWealthRows = personalModel.months.map((personalMonth, index) => {
    const structureMonth = structureAccountModel.months[index] ?? {};
    const businessMonth = businessByMonth.get(toMonthKey(personalMonth.date));
    const businessDebtBalance = businessMonth?.debtBalance ?? 0;
    const marginDebtBalance = personalMonth.endingMarginDebt ?? 0;
    const totalPortfolioDebt = businessDebtBalance + marginDebtBalance;
    const brokerageCollateralValue = Math.max(0, (personalMonth.endingInvestedBalance ?? 0) + (personalMonth.endingCashBalance ?? 0));
    const portfolioLoanLtv = brokerageCollateralValue > 0 ? totalPortfolioDebt / brokerageCollateralValue : totalPortfolioDebt > 0 ? Infinity : 0;
    const ltvHeadroom = brokerageCollateralValue * portfolioLoanLtvLimit - totalPortfolioDebt;
    const beginningWealth = personalMonth.beginningBalance + (structureMonth.beginningBalance ?? 0);
    const accountDeployments =
      personalMonth.deployedToCorp + personalMonth.brokerageCashUsedForBusiness + (structureMonth.deployedToCorp ?? 0);
    const businessCashIn =
      personalMonth.salary +
      personalMonth.distributions +
      personalMonth.saleProceeds +
      (structureMonth.distributions ?? 0) +
      (structureMonth.saleProceeds ?? 0);
    const personalTaxes = personalMonth.capitalGainsTaxes + personalMonth.conversionTaxes;
    const investmentGrowth = personalMonth.investmentReturn + (structureMonth.investmentReturn ?? 0);
    const endingWealth = personalMonth.endingBalance + (structureMonth.endingBalance ?? 0);
    const afterTaxEndingWealth =
      (personalMonth.endingCashBalance ?? 0) +
      afterTaxBrokerage(personalMonth.endingInvestedBalance ?? 0) +
      afterTaxStructureAccount(structureMonth.endingBalance ?? 0);

    return {
      month: personalMonth.month,
      date: personalMonth.date,
      monthLabel: personalMonth.monthLabel,
      age: personalMonth.age,
      beginningWealth,
      accountDeployments,
      businessCashIn,
      livingNeeds: personalMonth.livingWithdrawals,
      personalTaxes,
      investmentGrowth,
      endingWealth,
      afterTaxEndingWealth,
      businessDebtBalance,
      marginDebtBalance,
      totalPortfolioDebt,
      brokerageCollateralValue,
      portfolioLoanLtv,
      ltvHeadroom,
    };
  });
  const annualWealthRows = Array.from(
    monthlyWealthRows.reduce((groups, row) => {
      const calendarYear = parseLocalDate(row.date).getFullYear();
      const group = groups.get(calendarYear) ?? [];
      group.push(row);
      groups.set(calendarYear, group);
      return groups;
    }, new Map()),
    ([calendarYear, rows]) => {
      const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
      const first = rows[0];
      const last = rows.at(-1);
      return {
        calendarYear,
        age: last?.age ?? 0,
        beginningWealth: first?.beginningWealth ?? 0,
        accountDeployments: sum("accountDeployments"),
        businessCashIn: sum("businessCashIn"),
        livingNeeds: sum("livingNeeds"),
        personalTaxes: sum("personalTaxes"),
        investmentGrowth: sum("investmentGrowth"),
        endingWealth: last?.endingWealth ?? 0,
        afterTaxEndingWealth: last?.afterTaxEndingWealth ?? 0,
        businessDebtBalance: last?.businessDebtBalance ?? 0,
        marginDebtBalance: last?.marginDebtBalance ?? 0,
        totalPortfolioDebt: last?.totalPortfolioDebt ?? 0,
        brokerageCollateralValue: last?.brokerageCollateralValue ?? 0,
        portfolioLoanLtv: last?.portfolioLoanLtv ?? 0,
        peakPortfolioLoanLtv: rows.reduce((peak, row) => Math.max(peak, Number.isFinite(row.portfolioLoanLtv) ? row.portfolioLoanLtv : Infinity), 0),
        ltvHeadroom: last?.ltvHeadroom ?? 0,
      };
    },
  );
  const peakPortfolioLoanLtv = monthlyWealthRows.reduce(
    (peak, row) => Math.max(peak, Number.isFinite(row.portfolioLoanLtv) ? row.portfolioLoanLtv : Infinity),
    0,
  );
  const minimumLtvHeadroom = monthlyWealthRows.reduce((minimum, row) => Math.min(minimum, row.ltvHeadroom), Infinity);
  const ltvStatusClass = (value) => (value > portfolioLoanLtvLimit ? "negative" : "positive");

  return (
    <section className="dashboard">
      <section className="wealthOverviewPanel">
        <header className="wealthHero">
          <div>
          <p className="eyebrow">Wealth Overview</p>
          <h2>Household Wealth</h2>
          <p>Source scenario: {getWealthSourceLabel(sourceStructure)}</p>
          </div>
          <div className="wealthHeroValue">
            <span>After-Tax Wealth</span>
            <strong>{money.format(afterTaxWealth)}</strong>
            <small>Base case through age {num.format(personalModel.ageAtEnd)} · Range: {afterTaxRange}</small>
          </div>
        </header>

        <div className="wealthMetricStrip">
          <div>
            <span>Annual Lifestyle Capacity</span>
            <strong>{money.format(annualSafeWithdrawal)}</strong>
            <small>{pct.format(safeWithdrawalRate)} of after-tax wealth</small>
          </div>
          <div>
            <span>Monthly Capacity</span>
            <strong>{money.format(monthlySafeWithdrawal)}</strong>
            <small>After-tax spending capacity</small>
          </div>
          <div>
            <span>Surplus / Shortfall</span>
            <strong className={annualLifestyleSurplus < 0 ? "negative" : "positive"}>
              {money.format(annualLifestyleSurplus)}
            </strong>
            <small>{money.format(monthlyLifestyleSurplus)} monthly vs inflated living needs</small>
          </div>
          <div>
            <span>Peak Portfolio LTV</span>
            <strong className={ltvStatusClass(peakPortfolioLoanLtv)}>{pct.format(peakPortfolioLoanLtv)}</strong>
            <small>{pct.format(portfolioLoanLtvLimit)} limit</small>
          </div>
          <div>
            <span>Lowest LTV Headroom</span>
            <strong className={minimumLtvHeadroom < 0 ? "negative" : "positive"}>{money.format(minimumLtvHeadroom)}</strong>
            <small>Allowed debt less modeled debt</small>
          </div>
        </div>

        <div className="wealthAccountList" aria-label="Wealth account breakdown">
          <div className="wealthAccountHeader">
            <span>Account</span>
            <span>Base</span>
            <span>After Tax</span>
            <span>Range</span>
          </div>
          <div>
            <span>Cash</span>
            <strong>{money.format(endingPersonalCash)}</strong>
            <strong>{money.format(endingPersonalCash)}</strong>
            <small>{personalCashRange}</small>
          </div>
          <div>
            <span>Personal Brokerage</span>
            <strong>{money.format(endingPersonalVoo)}</strong>
            <strong>{money.format(afterTaxPersonalVoo)}</strong>
            <small>{personalVooRange}</small>
          </div>
          <div>
            <span>Margin Debt</span>
            <strong>{money.format(endingPersonalMarginDebt)}</strong>
            <strong>{money.format(endingPersonalMarginDebt)}</strong>
            <small>{marginDebtRange}</small>
          </div>
          <div>
            <span>{structureAccountLabel}</span>
            <strong>{money.format(structureAccountModel.endingBalance)}</strong>
            <strong>{money.format(structureAccountAfterTax)}</strong>
            <small>{rangeLabel(structureAccountModel)}</small>
          </div>
          <div className="wealthTotalRow">
            <span>Total</span>
            <strong>{money.format(totalWealth)}</strong>
            <strong>{money.format(afterTaxWealth)}</strong>
            <small>{afterTaxRange}</small>
          </div>
        </div>

        <p className="wealthNote">
          Wealth accounts sit outside the ROBS structure tab. Use the source scenario selector to compare stock-sale and
          asset-sale exit treatment with the same household account assumptions.
        </p>
      </section>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Annual Household Wealth Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Age</th>
                <th>Beginning Wealth</th>
                <th>Account Deployments</th>
                <th>Business Cash In</th>
                <th>Living Needs</th>
                <th>Personal Taxes</th>
                <th>Investment Growth</th>
                <th>Business Debt</th>
                <th>Margin Debt</th>
                <th>Total Portfolio Debt</th>
                <th>Brokerage Collateral</th>
                <th>Portfolio LTV</th>
                <th>LTV Headroom</th>
                <th>Ending Wealth</th>
                <th>After-Tax Ending Wealth</th>
              </tr>
            </thead>
            <tbody>
              {annualWealthRows.map((row) => (
                <tr key={row.calendarYear}>
                  <td>{row.calendarYear}</td>
                  <td>{num.format(row.age)}</td>
                  <td>{money.format(row.beginningWealth)}</td>
                  <td>{money.format(row.accountDeployments)}</td>
                  <td>{money.format(row.businessCashIn)}</td>
                  <td>{money.format(row.livingNeeds)}</td>
                  <td>{money.format(row.personalTaxes)}</td>
                  <td>{money.format(row.investmentGrowth)}</td>
                  <td>{money.format(row.businessDebtBalance)}</td>
                  <td>{money.format(row.marginDebtBalance)}</td>
                  <td>{money.format(row.totalPortfolioDebt)}</td>
                  <td>{money.format(row.brokerageCollateralValue)}</td>
                  <td className={ltvStatusClass(row.portfolioLoanLtv)}>{pct.format(row.portfolioLoanLtv)}</td>
                  <td className={row.ltvHeadroom < 0 ? "negative" : "positive"}>{money.format(row.ltvHeadroom)}</td>
                  <td className={row.endingWealth < 0 ? "negative" : "positive"}>{money.format(row.endingWealth)}</td>
                  <td className={row.afterTaxEndingWealth < 0 ? "negative" : "positive"}>
                    {money.format(row.afterTaxEndingWealth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Monthly Household Wealth Model</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Calendar</th>
                <th>Age</th>
                <th>Beginning Wealth</th>
                <th>Account Deployments</th>
                <th>Business Cash In</th>
                <th>Living Needs</th>
                <th>Personal Taxes</th>
                <th>Investment Growth</th>
                <th>Business Debt</th>
                <th>Margin Debt</th>
                <th>Total Portfolio Debt</th>
                <th>Brokerage Collateral</th>
                <th>Portfolio LTV</th>
                <th>LTV Headroom</th>
                <th>Ending Wealth</th>
                <th>After-Tax Ending Wealth</th>
              </tr>
            </thead>
            <tbody>
              {monthlyWealthRows.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{row.monthLabel}</td>
                  <td>{num.format(row.age)}</td>
                  <td>{money.format(row.beginningWealth)}</td>
                  <td>{money.format(row.accountDeployments)}</td>
                  <td>{money.format(row.businessCashIn)}</td>
                  <td>{money.format(row.livingNeeds)}</td>
                  <td>{money.format(row.personalTaxes)}</td>
                  <td>{money.format(row.investmentGrowth)}</td>
                  <td>{money.format(row.businessDebtBalance)}</td>
                  <td>{money.format(row.marginDebtBalance)}</td>
                  <td>{money.format(row.totalPortfolioDebt)}</td>
                  <td>{money.format(row.brokerageCollateralValue)}</td>
                  <td className={ltvStatusClass(row.portfolioLoanLtv)}>{pct.format(row.portfolioLoanLtv)}</td>
                  <td className={row.ltvHeadroom < 0 ? "negative" : "positive"}>{money.format(row.ltvHeadroom)}</td>
                  <td className={row.endingWealth < 0 ? "negative" : "positive"}>{money.format(row.endingWealth)}</td>
                  <td className={row.afterTaxEndingWealth < 0 ? "negative" : "positive"}>
                    {money.format(row.afterTaxEndingWealth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function WealthOverview({ locations, inputs, updateInput }) {
  const sourceStructure = getWealthSource(inputs.wealthSourceStructure);
  const saleType = getRobsSaleTypeForSource(sourceStructure);
  const rollupModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType }), [locations, inputs, saleType]);
  const companyRothModel = useMemo(() => calculateRothModel(rollupModel, inputs), [rollupModel, inputs]);
  const personalModel = useMemo(
    () => calculatePersonalModel(rollupModel, inputs),
    [rollupModel, inputs],
  );

  return (
    <section className="workspace">
      <div className="leftRail">
        <WealthOverviewInputsPanel inputs={inputs} updateInput={updateInput} personalModel={personalModel} />
      </div>
      <div>
        <WealthOverviewDashboard
          companyRothModel={companyRothModel}
          personalModel={personalModel}
          businessModel={rollupModel}
          inputs={inputs}
          sourceStructure={sourceStructure}
        />
      </div>
    </section>
  );
}

function IraPage({ inputs }) {
  const conversionTax =
    (Number(inputs.traditionalIraStartingBalance) || 0) * (Number(inputs.robsConversionTaxRate) || 0);

  return (
    <section className="workspace">
      <div className="leftRail">
        <aside className="assumptions rollupInputs">
          <div className="panelTitle">
            <h2>IRA Rollover</h2>
          </div>
          <section className="assumptionGroup">
            <div className="groupFields">
              <div className="rollupLocationRow">
                <strong>Traditional IRA rollover</strong>
                <span>{money.format(inputs.traditionalIraStartingBalance)}</span>
              </div>
              <div className="rollupLocationRow">
                <strong>Conversion tax</strong>
                <span>{money.format(conversionTax)}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
      <div className="dashboard scenarioPlaceholder">
        <div className="locationSnapshot">
        <div>
          <p className="eyebrow">IRA</p>
          <h2>Traditional IRA ROBS Conversion</h2>
          <p>Source of the company Roth 401k capitalization</p>
        </div>
        <div className="locationKpis">
          <article>
            <span>Starting Balance</span>
            <strong>{money.format(inputs.traditionalIraStartingBalance)}</strong>
            <small>Traditional IRA before ROBS</small>
          </article>
          <article>
            <span>Converted to Roth</span>
            <strong>{money.format(inputs.traditionalIraStartingBalance)}</strong>
            <small>Becomes ROBS Roth 401k cash</small>
          </article>
          <article>
            <span>Conversion Tax</span>
            <strong>{money.format(conversionTax)}</strong>
            <small>Modeled as personal cash outflow</small>
          </article>
          <article>
            <span>Ending IRA</span>
            <strong>{money.format(0)}</strong>
            <small>Traditional IRA depleted after rollover</small>
          </article>
        </div>
      </div>
      <section className="annualPanel">
        <div className="panelTitle">
          <h2>ROBS Flow</h2>
        </div>
        <p className="emptyState">
          Traditional IRA rollover to company 401k to Roth conversion to Roth 401k purchase of Hart Fitness stock. The
          ongoing investment account is tracked separately as the ROBS Roth 401k.
        </p>
      </section>
      </div>
    </section>
  );
}

function ScenarioShell({ activeSubView, setActiveSubView, tabs, children }) {
  return (
    <>
      <nav className="viewTabs subTabs" aria-label="Scenario views">
        {tabs.map((tab) => (
          <button
            className={activeSubView === tab.key ? "active" : ""}
            key={tab.key}
            onClick={() => setActiveSubView(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {children}
    </>
  );
}

function RobsStructurePage({ assumptions, locations, inputs, updateAssumption, updateInput }) {
  return (
    <RollupPage
      assumptions={assumptions}
      locations={locations}
      inputs={inputs}
      updateAssumption={updateAssumption}
      updateInput={updateInput}
    />
  );
}

function ExitInputsPanel({ inputs, updateInput }) {
  return (
    <aside className="assumptions rollupInputs">
      <div className="panelTitle">
        <h2>Exit Scenario</h2>
      </div>
      <section className="assumptionGroup">
        <div className="groupFields">
          <label className="inputRow">
            <span>Sale type</span>
            <select value={inputs.saleType ?? "stock"} onChange={(event) => updateInput("saleType", event.target.value)}>
              <option value="stock">Stock sale</option>
              <option value="asset">Asset sale</option>
            </select>
          </label>
          <label className="inputRow">
            <span>Sale date</span>
            <input type="date" value={inputs.saleDate} onChange={(event) => updateInput("saleDate", event.target.value)} />
          </label>
          <label className="inputRow">
            <span>EBITDA multiple</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputs.ebitdaMultiple}
              onChange={(event) => updateInput("ebitdaMultiple", Number(event.target.value))}
            />
          </label>
          <label className="inputRow">
            <span>Transaction cost</span>
            <PercentInput value={inputs.transactionCostRate} onChange={(value) => updateInput("transactionCostRate", value)} />
          </label>
          <label className="inputRow">
            <span>Tax basis</span>
            <input
              type="number"
              step="1000"
              value={inputs.assetTaxBasis}
              onChange={(event) => updateInput("assetTaxBasis", Number(event.target.value))}
            />
          </label>
        </div>
      </section>
    </aside>
  );
}

function ExitScenarioDashboard({ locations, robsStockModel, robsAssetModel, inputs }) {
  const scenarioRows = [
    {
      key: "robs-stock",
      label: "ROBS + Stock Sale",
      model: robsStockModel,
      taxKey: "saleCorporateTaxes",
      detailLabel: "Roth 401k / Personal",
      detailValue: (month) =>
        `${money.format(month?.roth401kSaleProceeds ?? 0)} / ${money.format(month?.personalSaleProceeds ?? 0)}`,
    },
    {
      key: "robs-asset",
      label: "ROBS + Asset Sale",
      model: robsAssetModel,
      taxKey: "saleCorporateTaxes",
      detailLabel: "Roth 401k / Personal",
      detailValue: (month) =>
        `${money.format(month?.roth401kSaleProceeds ?? 0)} / ${money.format(month?.personalSaleProceeds ?? 0)}`,
    },
  ].map((scenario) => {
    const saleMonth = scenario.model.months.find((month) => month.saleNetProceeds !== 0) ?? scenario.model.months.at(-1);
    const saleYear = scenario.model.years.find((year) => year.saleNetProceeds !== 0) ?? scenario.model.years.at(-1);
    return { ...scenario, saleMonth, saleYear };
  });

  return (
    <section className="dashboard">
      <div className="locationSnapshot">
        <div>
          <p className="eyebrow">Exit Scenario</p>
          <h2>Sale Assumptions</h2>
          <p>
            {num.format(locations.length)} locations · Sale in {formatMonthLabel(inputs.saleDate)}
          </p>
        </div>
        <div className="locationKpis">
          <article>
            <span>EBITDA Multiple</span>
            <strong>{num.format(inputs.ebitdaMultiple)}x</strong>
            <small>Applied to TTM operating profit proxy</small>
          </article>
          <article>
            <span>Transaction Cost</span>
            <strong>{pct.format(inputs.transactionCostRate)}</strong>
            <small>Deducted from enterprise value</small>
          </article>
          <article>
            <span>Tax Basis</span>
            <strong>{money.format(inputs.assetTaxBasis)}</strong>
            <small>Used for taxable sale gain estimates</small>
          </article>
          <article>
            <span>Sale Date</span>
            <strong>{formatMonthLabel(inputs.saleDate)}</strong>
            <small>Also controls model horizon</small>
          </article>
        </div>
      </div>

      <section className="annualPanel">
        <div className="panelTitle">
          <h2>Structure Sale Outcomes</h2>
        </div>
        <div className="annualGrid">
          {scenarioRows.map((scenario) => (
            <article key={scenario.key}>
              <span>{scenario.label}</span>
              <strong>{money.format(scenario.saleMonth?.saleNetProceeds ?? 0)}</strong>
              <dl>
                <dt>Enterprise value</dt>
                <dd>{money.format(scenario.saleMonth?.saleEnterpriseValue ?? 0)}</dd>
                <dt>Sale taxes</dt>
                <dd>{money.format(scenario.saleMonth?.[scenario.taxKey] ?? 0)}</dd>
                <dt>{scenario.detailLabel}</dt>
                <dd>{scenario.detailValue(scenario.saleMonth)}</dd>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="tablePanel">
        <div className="panelTitle">
          <h2>Sale Calculation</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Structure</th>
                <th>TTM EBITDA Proxy</th>
                <th>Enterprise Value</th>
                <th>Debt Payoff</th>
                <th>Cash at Close</th>
                <th>Transaction Costs</th>
                <th>Sale Taxes</th>
                <th>Net Proceeds</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((scenario) => (
                <tr key={scenario.key}>
                  <td>{scenario.label}</td>
                  <td>{money.format(scenario.saleMonth?.ttmOperatingProfit ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.saleEnterpriseValue ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.saleDebtPayoff ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.saleCashAtClose ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.saleTransactionCosts ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.[scenario.taxKey] ?? 0)}</td>
                  <td>{money.format(scenario.saleMonth?.saleNetProceeds ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ExitScenarioPage({ locations, inputs, updateInput }) {
  const robsStockModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType: "stock" }), [locations, inputs]);
  const robsAssetModel = useMemo(() => calculateRollupModel(locations, inputs, { saleType: "asset" }), [locations, inputs]);

  return (
    <section className="workspace">
      <div className="leftRail">
        <ExitInputsPanel inputs={inputs} updateInput={updateInput} />
      </div>
      <div>
        <ExitScenarioDashboard
          locations={locations}
          robsStockModel={robsStockModel}
          robsAssetModel={robsAssetModel}
          inputs={inputs}
        />
      </div>
    </section>
  );
}

function WealthPage({ activeSubView, setActiveSubView, locations, inputs, updateInput }) {
  const sourceStructure = getWealthSource(inputs.wealthSourceStructure);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "cash", label: "Cash" },
    { key: "brokerage", label: "Personal Brokerage" },
    { key: "roth401k", label: "ROBS Roth 401k" },
    { key: "ira", label: "IRA" },
  ];

  return (
    <>
      <div className="wealthSourceBar">
        <label>
          <span>Source scenario</span>
          <select value={sourceStructure} onChange={(event) => updateInput("wealthSourceStructure", event.target.value)}>
            <option value="robs-stock">ROBS + Stock Sale</option>
            <option value="robs-asset">ROBS + Asset Sale</option>
          </select>
        </label>
      </div>
      <ScenarioShell activeSubView={activeSubView} setActiveSubView={setActiveSubView} tabs={tabs}>
        {activeSubView === "cash" ? (
          <CashPage locations={locations} inputs={inputs} updateInput={updateInput} />
        ) : activeSubView === "brokerage" ? (
          <PersonalPage locations={locations} inputs={inputs} updateInput={updateInput} />
        ) : activeSubView === "roth401k" ? (
          <RothPage locations={locations} inputs={inputs} updateInput={updateInput} />
        ) : activeSubView === "ira" ? (
          <IraPage inputs={inputs} updateInput={updateInput} />
        ) : (
          <WealthOverview locations={locations} inputs={inputs} updateInput={updateInput} />
        )}
      </ScenarioShell>
    </>
  );
}

export function App() {
  const [assumptions, setAssumptions] = useState(loadSharedAssumptions);
  const [openGroup, setOpenGroup] = useState("Portfolio Locations");
  const [openCorporateGroup, setOpenCorporateGroup] = useState("Policy");
  const [openPersonalWealthGroup, setOpenPersonalWealthGroup] = useState("Current Assets");
  const [locationSchedule, setLocationSchedule] = useState(loadLocationSchedule);
  const [activeView, setActiveView] = useState("location");
  const [activeWealthView, setActiveWealthView] = useState("overview");
  const [rollupInputs, setRollupInputs] = useState(loadRollupInputs);
  const locations = useMemo(
    () =>
      buildLocationRecords({
        assumptions,
        modelEndDate: rollupInputs.saleDate,
        modelStartDate: rollupInputs.modelStartDate,
        schedule: locationSchedule,
      }),
    [assumptions, locationSchedule, rollupInputs.modelStartDate, rollupInputs.saleDate],
  );
  const locationSetModel = useMemo(() => buildLocationSetModel(locations), [locations]);
  const locationFinancialModel = useMemo(() => {
    const rollupModel = calculateRollupModel(locations, rollupInputs);
    const companyRothModel = calculateRothModel(rollupModel, rollupInputs);
    const personalModel = calculatePersonalModel(rollupModel, rollupInputs);
    const personalWealth = buildPersonalWealthStatement({
      businessModel: rollupModel,
      companyRothModel,
      inputs: rollupInputs,
      personalModel,
    });

    return {
      ...rollupModel,
      personalWealth,
      totalInitialInvestment: locationSetModel.totalInitialInvestment,
      years: rollupModel.years.map((year) => ({
        ...year,
        year: year.calendarYear,
      })),
    };
  }, [locationSetModel.totalInitialInvestment, locations, rollupInputs]);
  const activeScenarioLocations = locations;

  useEffect(() => {
    window.localStorage.setItem(SHARED_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(assumptions));
  }, [assumptions]);

  useEffect(() => {
    window.localStorage.setItem(ROLLUP_STORAGE_KEY, JSON.stringify(rollupInputs));
  }, [rollupInputs]);

  function updateAssumption(key, value) {
    setAssumptions((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  }

  function resetAssumptions() {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setLocationSchedule(FIXED_LOCATIONS);
    saveLocationSchedule(FIXED_LOCATIONS);
  }

  function updateRollupInput(key, value) {
    setRollupInputs((current) => normalizeRollupInputs({ ...current, [key]: value }));
  }

  function updateLocationOpenDate(id, projectedOpenDate) {
    setLocationSchedule((current) => {
      const next = current.map((location) => (location.id === id ? { ...location, projectedOpenDate } : location));
      saveLocationSchedule(next);
      return next;
    });
  }

  function exportCsv() {
    const headers = [
      "Month",
      "Calendar Month",
      "Members",
      "Operating Revenue",
      "Total Expenses",
      "Operating Income",
      "Interest Expense",
      "Cash Flow After Interest Expense",
      "Operating Margin",
    ];
    const rows = locationSetModel.months.map((m) => [
      m.month,
      m.monthLabel,
      m.totalMembers.toFixed(1),
      m.operatingRevenue.toFixed(2),
      m.totalExpenses.toFixed(2),
      m.grossOperatingProfit.toFixed(2),
      m.corporateDebtService.toFixed(2),
      m.cashFlowAfterCorporateDebt.toFixed(2),
      m.operatingMargin.toFixed(4),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "the-yard-gym-model.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const locationSetMeta = {
    locationName: "Portfolio Locations",
    scenarioName: `${locations.length} locations`,
    projectedOpenDate: rollupInputs.modelStartDate,
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">The Yard Gym Opportunity</p>
          <h1>Financial & Operations Model</h1>
          <p className="subtitle">
            Hart Fitness, Inc. parent model with location-level operating models.
          </p>
        </div>
        <div className="headerActions">
          <button onClick={resetAssumptions} title="Reset assumptions">
            <RotateCcw size={17} />
            Reset
          </button>
          <button onClick={exportCsv} title="Export monthly model">
            <Download size={17} />
            CSV
          </button>
        </div>
      </header>

      <nav className="viewTabs" aria-label="Model views">
        <button
          className={activeView === "location" ? "active" : ""}
          onClick={() => setActiveView("location")}
          type="button"
        >
          Location Model
        </button>
        <button
          className={activeView === "wealth" ? "active" : ""}
          onClick={() => setActiveView("wealth")}
          type="button"
        >
          Wealth
        </button>
      </nav>

      {activeView === "wealth" ? (
        <WealthPage
          activeSubView={activeWealthView}
          setActiveSubView={setActiveWealthView}
          locations={activeScenarioLocations}
          inputs={rollupInputs}
          updateInput={updateRollupInput}
        />
      ) : (
        <section className="workspace">
          <div className="leftRail">
            <AssumptionsPanel
              assumptions={assumptions}
              locations={locations}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              updateAssumption={updateAssumption}
              onUpdateOpenDate={updateLocationOpenDate}
            />
            <CorporateInputsPanel
              assumptions={assumptions}
              inputs={rollupInputs}
              updateAssumption={updateAssumption}
              updateInput={updateRollupInput}
              openGroup={openCorporateGroup}
              setOpenGroup={setOpenCorporateGroup}
            />
            <PersonalWealthInputsPanel
              inputs={rollupInputs}
              updateInput={updateRollupInput}
              openGroup={openPersonalWealthGroup}
              setOpenGroup={setOpenPersonalWealthGroup}
            />
          </div>
          <div>
            <Dashboard model={locationFinancialModel} locationMeta={locationSetMeta} />
          </div>
        </section>
      )}

      <footer>
        <Dumbbell size={17} />
        <span>Baseline assumptions imported from "TYG Financial & Operations Model".</span>
      </footer>
    </main>
  );
}
