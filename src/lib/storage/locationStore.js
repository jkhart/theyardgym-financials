const LOCATION_STORAGE_KEY = "the-yard-gym.locations.v1";
const LEGACY_SCENARIO_STORAGE_KEY = "the-yard-gym.scenarios.v1";
const LEGACY_MIGRATION_KEY = "the-yard-gym.locations.migratedLegacyScenarios";

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocations(locations) {
  window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locations));
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `location-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function migrateLegacyScenarios() {
  const existingLocations = readJson(LOCATION_STORAGE_KEY);
  if (existingLocations.length > 0) return existingLocations;
  if (window.localStorage.getItem(LEGACY_MIGRATION_KEY) === "true") return [];

  const legacyScenarios = readJson(LEGACY_SCENARIO_STORAGE_KEY);
  if (legacyScenarios.length === 0) return [];

  const migrated = legacyScenarios.map((scenario, index) => ({
    ...scenario,
    entityType: "location",
    isActive: true,
    locationName: scenario.name || `Location ${index + 1}`,
    scenarioName: "Base Case",
    projectedOpenDate: "2027-01-01",
  }));
  writeLocations(migrated);
  window.localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  return migrated;
}

export function loadLocations() {
  return migrateLegacyScenarios().sort((a, b) => {
    const dateDelta =
      new Date(a.projectedOpenDate ?? "9999-12-31") - new Date(b.projectedOpenDate ?? "9999-12-31");
    if (dateDelta !== 0) return dateDelta;
    return (a.locationName ?? "").localeCompare(b.locationName ?? "");
  });
}

export function saveLocationModel({ activeLocationId, locationMeta, assumptions, model }) {
  const now = new Date().toISOString();
  const locations = loadLocations();
  const existing = locations.find((location) => location.id === activeLocationId);
  const locationName = locationMeta.locationName.trim() || existing?.locationName || "Untitled Location";
  const record = {
    id: existing?.id ?? createId(),
    entityType: "location",
    isActive: existing?.isActive ?? true,
    locationName,
    scenarioName: locationMeta.scenarioName.trim() || existing?.scenarioName || "Base Case",
    projectedOpenDate: locationMeta.projectedOpenDate || existing?.projectedOpenDate || "2027-01-01",
    projectName: "The Yard Gym Opportunity",
    modelName: "Single-Location Financial & Operations Model",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    assumptions,
    outputs: {
      totalInitialInvestment: model.totalInitialInvestment,
      ownerInjection: model.ownerInjection,
      loanAmount: model.loanAmount,
      monthlyLoanPayment: model.monthlyLoanPayment,
      month36: model.months[35],
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
  const next = [record, ...locations.filter((location) => location.id !== record.id)];
  writeLocations(next);
  return record;
}

export function deleteLocation(id) {
  const next = loadLocations().filter((location) => location.id !== id);
  writeLocations(next);
  return next;
}

export function setLocationActive(id, isActive) {
  const next = loadLocations().map((location) => (location.id === id ? { ...location, isActive } : location));
  writeLocations(next);
  return next;
}
