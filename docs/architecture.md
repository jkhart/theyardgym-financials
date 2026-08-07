# The Yard Gym App Architecture

This app is now structured so the model engine, UI, and persistence boundary are separate.

## Current Shape

- `src/components/` contains React UI components.
- `src/lib/model/` contains the financial model defaults, input schema, and calculation engine.
- `src/lib/storage/` contains the persistence boundary for the fixed location schedule and browser-backed migrations.
- `src/lib/formatting.js` centralizes currency, number, and percent formatting.

## Persistence Strategy

The fixed location schedule and shared location assumptions currently use `localStorage` through `src/lib/storage/locationStore.js` and the app shell.

The portfolio has four hard-coded locations:

- Livermore
- Walnut Creek
- Pleasanton
- San Ramon

Each location shares the same operating assumptions. The only per-location input is `projectedOpenDate`.

When the app moves to a real backend, replace the storage functions with API calls while keeping the UI and model code mostly unchanged.

## Entity And Portfolio Modeling

The app models Hart Fitness, Inc. as the parent/financing entity. Each fixed location represents an operating location underneath the parent.

Operating revenue and operating expenses belong to each location. The Hart Fitness, Inc. financing is modeled as an interest-only portfolio line of credit tied to location buildout funding, with principal carried as outstanding debt until sale/payoff.

The active model remains a single-location operating view, but the assumption set is shared across all four locations. The Hart Fitness rollup calendarizes the four fixed locations by `projectedOpenDate` and sums pre-opening investment, monthly revenue, expense, cash flow, and interest expense by portfolio month.

Each location has a `projectedOpenDate`. The model starts operating Month 1 in that projected-open month. Initial investment outlays are scheduled evenly across the six months before opening, with owner-funded and debt-funded portions split according to the owner injection percentage.

## Likely Future Backend

Use Postgres once location models need to persist across devices, support users, compare histories, or link to analysis documents.

Likely tables:

- `projects`
- `models`
- `locations`
- `location_assumption_versions`
- `portfolio_models`
- `analysis_sources`
- `analysis_artifacts`

The `assumptions` and `outputs` fields can start as JSON columns, then specific values can be promoted to typed columns when reporting or querying needs become clearer.
