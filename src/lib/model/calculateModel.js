function parseDate(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date("2027-01-01T00:00:00");
  return Number.isNaN(date.getTime()) ? new Date("2027-01-01T00:00:00") : date;
}

function addMonths(date, offset) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  return next;
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDiff(startDate, endDate) {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

function inflationFactor(rate, elapsedMonths) {
  return Math.pow(1 + (Number(rate) || 0), Math.max(0, elapsedMonths) / 12);
}

export function calculateModel(a, options = {}) {
  const projectedOpenDate = parseDate(options.projectedOpenDate);
  const modelStartDate = parseDate(options.modelStartDate);
  const operatingMonths = Math.max(1, Number(options.operatingMonths) || 1);
  const monthlyRentBase = a.squareFeet * a.rentPsfMonthly;
  const openingRentFactor = inflationFactor(a.annualRentIncrease, monthDiff(modelStartDate, projectedOpenDate));
  const rentalDeposit = monthlyRentBase * openingRentFactor * a.depositMonths;
  const totalInitialInvestment =
    a.franchiseFee +
    a.equipment +
    a.construction -
    a.tenantImprovement +
    a.preOpenMarketing +
    a.legalFees +
    a.otherStartupCosts +
    rentalDeposit;
  const ownerInjection = totalInitialInvestment * a.ownerInjectionPct;
  const loanAmount = totalInitialInvestment - ownerInjection;
  const monthlyLoanPayment = loanAmount * (a.loanRate / 12);
  const monthlyInitialInvestmentOutlay = totalInitialInvestment / 6;
  const preOpeningMonths = Array.from({ length: 6 }, (_, i) => {
    const relativeMonth = i - 6;
    const date = addMonths(projectedOpenDate, relativeMonth);
    return {
      phase: "Pre-opening",
      relativeMonth,
      monthLabel: formatMonth(date),
      date: toDateInputValue(date),
      initialInvestmentOutlay: monthlyInitialInvestmentOutlay,
      ownerFundedOutlay: monthlyInitialInvestmentOutlay * a.ownerInjectionPct,
      debtFundedOutlay: monthlyInitialInvestmentOutlay * (1 - a.ownerInjectionPct),
    };
  });
  let loanBalance = loanAmount;
  let regularMembers = 0;

  const months = Array.from({ length: operatingMonths }, (_, i) => {
    const month = i + 1;
    const operatingDate = addMonths(projectedOpenDate, i);
    const elapsedMonths = monthDiff(modelStartDate, operatingDate);
    const priceFactor = inflationFactor(a.membershipPriceInflation, elapsedMonths);
    const laborFactor = inflationFactor(a.laborInflation, elapsedMonths);
    const rentFactor = inflationFactor(a.annualRentIncrease, elapsedMonths);
    const generalExpenseFactor = inflationFactor(a.generalExpensesInflation, elapsedMonths);
    const totalMembers =
      month > a.monthsToPlateau
        ? a.plateauMembers
        : a.foundingMembers +
          (a.plateauMembers - a.foundingMembers) *
            (Math.log(1 + a.growthCurve * (month - 1)) /
              Math.log(1 + a.growthCurve * a.monthsToPlateau));
    const foundingMembers = a.foundingMembers * Math.pow(1 - a.attrition, month - 1);
    if (month === 1) {
      regularMembers = Math.max(0, Math.min(totalMembers, a.priceThreshold) - foundingMembers);
    } else if (totalMembers <= a.priceThreshold) {
      regularMembers = Math.max(0, totalMembers - foundingMembers);
    } else {
      regularMembers = regularMembers * (1 - a.attrition);
    }
    const postPriceMembers = Math.max(0, totalMembers - foundingMembers - regularMembers);
    const openingPrice = a.openingPrice * priceFactor;
    const increasedPrice = a.increasedPrice * priceFactor;
    const membershipRevenue =
      foundingMembers * openingPrice * (1 - a.foundingDiscount) +
      regularMembers * openingPrice +
      postPriceMembers * increasedPrice;
    const additionalRevenue = membershipRevenue * a.additionalRevenuePct;
    const operatingRevenue = membershipRevenue + additionalRevenue;
    const royaltiesCost = operatingRevenue * a.royalties;
    const brandFundCost = operatingRevenue * a.brandFund;
    const techFeeCost = operatingRevenue * a.techFee;
    const tygPayments = royaltiesCost + brandFundCost + techFeeCost;
    const rent =
      month <= a.freeRentMonths
        ? 0
        : monthlyRentBase * rentFactor;
    const addedWeekdaySlots = Math.max(
      0,
      Math.floor((totalMembers - a.foundingMembers) / a.membersPerWeekdaySlot),
    );
    const addedWeekendSlots = Math.max(
      0,
      Math.floor((totalMembers - a.foundingMembers) / a.membersPerWeekendSlot),
    );
    const weekdaySlots = a.weekdaySlotsOpening + addedWeekdaySlots;
    const weekendSlots = a.weekendSlotsOpening + addedWeekendSlots;
    const monthlySlots = (weekdaySlots * a.weekdaysPerYear + weekendSlots * a.weekendDaysPerYear) / 12;
    const trainerWage = a.trainerWage * laborFactor;
    const frontDeskWage = a.frontDeskWage * laborFactor;
    const managerSalary = a.managerSalary * laborFactor;
    const trainerWages = monthlySlots * a.trainersPerSlot * trainerWage;
    const frontDeskWages =
      totalMembers >= a.managerThreshold ? 0 : (a.frontDeskHours * frontDeskWage * 52) / 12;
    const managerCost = totalMembers >= a.managerThreshold ? managerSalary / 12 : 0;
    const labor = trainerWages + frontDeskWages + managerCost;
    const marketing = Math.max(operatingRevenue * a.marketingPct, a.minMarketing * generalExpenseFactor);
    const repairs = operatingRevenue * a.repairsPct;
    const waterElectricCost = a.waterElectric * generalExpenseFactor;
    const phoneInternetCost = a.phoneInternet * generalExpenseFactor;
    const cleaningCost = a.cleaning * generalExpenseFactor;
    const insuranceCost = a.insurance * generalExpenseFactor;
    const accountingCost = a.accounting * generalExpenseFactor;
    const otherExpensesCost = a.otherExpenses * generalExpenseFactor;
    const utilities = waterElectricCost + phoneInternetCost;
    const fixedOps =
      utilities +
      cleaningCost +
      insuranceCost +
      accountingCost +
      otherExpensesCost;
    const totalExpenses = tygPayments + rent + labor + marketing + repairs + fixedOps;
    const taxReceived = operatingRevenue * a.salesTax;
    const taxPaid = totalExpenses * a.salesTax;
    const netTaxPayable = taxReceived - taxPaid;
    const interest = loanBalance * (a.loanRate / 12);
    const grossOperatingProfit = operatingRevenue - totalExpenses - netTaxPayable;
    const corporateDebtService = interest;
    const locationOperatingCashFlow = grossOperatingProfit;
    const cashFlowAfterCorporateDebt = locationOperatingCashFlow - corporateDebtService;

    return {
      month,
      monthLabel: formatMonth(operatingDate),
      date: toDateInputValue(operatingDate),
      totalMembers,
      foundingMembers,
      regularMembers,
      postPriceMembers,
      avgRevenuePerMember: membershipRevenue / totalMembers,
      openingPrice,
      increasedPrice,
      membershipRevenue,
      additionalRevenue,
      operatingRevenue,
      royaltiesCost,
      brandFundCost,
      techFeeCost,
      tygPayments,
      rent,
      labor,
      weekdaySlots,
      weekendSlots,
      monthlySlots,
      trainerWage,
      frontDeskWage,
      managerSalary,
      trainerWages,
      frontDeskWages,
      managerCost,
      marketing,
      repairs,
      waterElectricCost,
      phoneInternetCost,
      utilities,
      cleaningCost,
      insuranceCost,
      accountingCost,
      otherExpensesCost,
      fixedOps,
      totalExpenses,
      taxReceived,
      taxPaid,
      netTaxPayable,
      interest,
      debtService: corporateDebtService,
      corporateDebtService,
      grossOperatingProfit,
      operatingMargin: grossOperatingProfit / operatingRevenue,
      locationOperatingCashFlow,
      cashFlowAfterCorporateDebt,
      cashFlow: cashFlowAfterCorporateDebt,
    };
  });

  const yearCount = Math.ceil(months.length / 12);
  const years = Array.from({ length: yearCount }, (_, yearIndex) => {
    const slice = months.slice(yearIndex * 12, yearIndex * 12 + 12);
    const sum = (key) => slice.reduce((acc, row) => acc + row[key], 0);
    const end = slice.at(-1);
    const operatingRevenue = sum("operatingRevenue");
    const grossOperatingProfit = sum("grossOperatingProfit");
    return {
      year: yearIndex + 1,
      membershipRevenue: sum("membershipRevenue"),
      operatingRevenue,
      totalExpenses: sum("totalExpenses"),
      grossOperatingProfit,
      locationOperatingCashFlow: sum("locationOperatingCashFlow"),
      corporateDebtService: sum("corporateDebtService"),
      cashFlowAfterCorporateDebt: sum("cashFlowAfterCorporateDebt"),
      cashFlow: sum("cashFlowAfterCorporateDebt"),
      operatingMargin: grossOperatingProfit / operatingRevenue,
      totalMembers: end.totalMembers,
      avgRevenuePerMember: end.avgRevenuePerMember,
      rent: sum("rent"),
      labor: sum("labor"),
      tygPayments: sum("tygPayments"),
      marketing: sum("marketing"),
      repairs: sum("repairs"),
    };
  });

  return {
    projectedOpenDate: toDateInputValue(projectedOpenDate),
    preOpeningMonths,
    months,
    years,
    totalInitialInvestment,
    ownerInjection,
    loanAmount,
    monthlyLoanPayment,
    monthlyInitialInvestmentOutlay,
  };
}
