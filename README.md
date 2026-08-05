# The Yard Gym Financials

Financial and wealth modeling app for The Yard Gym opportunity scenarios, including single-location operating models, ROBS and LLC structure comparisons, exit scenarios, and household wealth projections.

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

Vite writes the production build to `dist/`.

## Deploy

This app is configured for Vercel as a Vite/static app. Vercel should run:

```bash
npm run build
```

and serve:

```text
dist/
```

The deploy configuration lives in `vercel.json`.

## Project Layout

- `src/` - React app, financial models, storage helpers, and UI components.
- `docs/` - architecture notes.
- `dist/` - local production build output, ignored by Git.
- `vercel.json` - Vercel output directory configuration.
