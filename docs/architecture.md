# The Yard Gym App Architecture

This app is now structured so the model engine, UI, and persistence boundary are separate.

## Current Shape

- `src/components/` contains React UI components.
- `src/lib/model/` contains the financial model defaults, input schema, and calculation engine.
- `src/lib/storage/` contains the persistence boundary for saved location models.
- `src/lib/formatting.js` centralizes currency, number, and percent formatting.

## Persistence Strategy

Saved location models currently use `localStorage` through `src/lib/storage/locationStore.js`.

The location model record shape is intentionally close to what a future database table or API resource would use:

```json
{
  "id": "uuid",
  "entityType": "location",
  "locationName": "Location 1",
  "scenarioName": "Base Case",
  "projectedOpenDate": "2027-01-01",
  "projectName": "The Yard Gym Opportunity",
  "modelName": "Financial & Operations Model",
  "createdAt": "2026-07-22T00:00:00.000Z",
  "updatedAt": "2026-07-22T00:00:00.000Z",
  "assumptions": {},
  "outputs": {}
}
```

When the app moves to a real backend, replace the functions in `locationStore.js` with API calls while keeping the UI and model code mostly unchanged.

Location records are autosaved. Creating a new location or editing location fields/assumptions creates or updates the active location record after a short debounce.

## Entity And Portfolio Modeling

The app models Hart Fitness, Inc. as the parent/financing entity. Each saved location represents an operating LLC underneath the parent.

Operating revenue and operating expenses belong to each location LLC. Debt principal, interest, and debt service are tracked separately as Hart Fitness, Inc. financing tied to the location buildout.

The active model remains a single-location LLC operating model with allocated corporate financing. Saved location models can be rolled up into a Hart Fitness, Inc. portfolio summary.

The current rollup is not fully calendarized; it sums each location's month-36 and annual outputs as if each location is viewed on its own operating timeline. The next step for a four-location buildout is a calendarized portfolio model that offsets each location by `projectedOpenDate` and then sums pre-opening investment, monthly revenue, expense, cash flow, and debt service by portfolio month.

Each location has a `projectedOpenDate`. The model starts operating Month 1 in that projected-open month. Initial investment outlays are scheduled evenly across the six months before opening, with owner-funded and debt-funded portions split according to the owner injection percentage.

## Likely Future Backend

Use Postgres once location models need to persist across devices, support users, compare histories, or link to analysis documents.

Likely tables:

- `projects`
- `models`
- `locations`
- `location_model_versions`
- `portfolio_models`
- `analysis_sources`
- `analysis_artifacts`

The `assumptions` and `outputs` fields can start as JSON columns, then specific values can be promoted to typed columns when reporting or querying needs become clearer.
