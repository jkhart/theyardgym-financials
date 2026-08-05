const LOCATION_STORAGE_KEY = "the-yard-gym.locations.v1";
const LEGACY_SCENARIO_STORAGE_KEY = "the-yard-gym.scenarios.v1";
const LEGACY_MIGRATION_KEY = "the-yard-gym.locations.migratedLegacyScenarios";
const LOCATION_SCHEDULE_STORAGE_KEY = "the-yard-gym.locationSchedule.v1";

export const FIXED_LOCATIONS = [
  { id: "livermore", locationName: "Livermore", projectedOpenDate: "2027-06-01" },
  { id: "walnut-creek", locationName: "Walnut Creek", projectedOpenDate: "2028-06-01" },
  { id: "pleasanton", locationName: "Pleasanton", projectedOpenDate: "2029-03-01" },
  { id: "san-ramon", locationName: "San Ramon", projectedOpenDate: "2029-09-01" },
];

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

function normalizeLocationName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function loadLocations() {
  return migrateLegacyScenarios().sort((a, b) => {
    const dateDelta =
      new Date(a.projectedOpenDate ?? "9999-12-31") - new Date(b.projectedOpenDate ?? "9999-12-31");
    if (dateDelta !== 0) return dateDelta;
    return (a.locationName ?? "").localeCompare(b.locationName ?? "");
  });
}

export function loadLocationSchedule() {
  const savedSchedule = readJson(LOCATION_SCHEDULE_STORAGE_KEY);
  const savedById = new Map(savedSchedule.map((location) => [location.id, location.projectedOpenDate]));
  const legacyByName = new Map(
    loadLocations().map((location) => [normalizeLocationName(location.locationName), location.projectedOpenDate]),
  );

  return FIXED_LOCATIONS.map((location) => ({
    ...location,
    projectedOpenDate:
      savedById.get(location.id) ??
      legacyByName.get(normalizeLocationName(location.locationName)) ??
      location.projectedOpenDate,
  }));
}

export function saveLocationSchedule(locations) {
  const schedule = FIXED_LOCATIONS.map((fixedLocation) => {
    const location = locations.find((candidate) => candidate.id === fixedLocation.id);
    return {
      id: fixedLocation.id,
      projectedOpenDate: location?.projectedOpenDate ?? fixedLocation.projectedOpenDate,
    };
  });
  window.localStorage.setItem(LOCATION_SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  return loadLocationSchedule();
}

export function loadSharedLocationAssumptions(defaultAssumptions) {
  const legacyLocations = loadLocations();
  const matchingLegacyLocation =
    legacyLocations.find((location) => normalizeLocationName(location.locationName) === "livermore") ??
    legacyLocations[0];
  return {
    ...defaultAssumptions,
    ...(matchingLegacyLocation?.assumptions ?? {}),
  };
}
