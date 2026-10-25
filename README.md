# When Am I UpDog?

A modern, mobile-first web application for dog handlers to view and track their scheduled block times, block running orders, and fields for UpDog Challenge disc dog competitions.

Built with **TypeScript**, **Vite**, and an **Adapter Architecture**, continuously verified and deployed via **GitHub Actions**.

---

## Architecture Overview

```
                      ┌──────────────────────────────┐
                      │        events.json           │
                      │ (Event Registry & Config)    │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │    Adapter Factory Router    │
                      └──────────────┬───────────────┘
                                     │
             ┌───────────────────────┴───────────────────────┐
             ▼                                               ▼
┌─────────────────────────┐                     ┌─────────────────────────┐
│ NortheastClassicAdapter │                     │   FallClassicAdapter    │
│ (Subheader Divider Rows)│                     │ (Dedicated Time Blocks) │
└────────────┬────────────┘                     └────────────┬────────────┘
             │                                               │
             └───────────────────────┬───────────────────────┘
                                     │ NormalizedRun[]
                                     ▼
                      ┌──────────────────────────────┐
                      │      Decoupled UI Layer      │
                      │  (Search, Filters, Timeline) │
                      └──────────────────────────────┘
```

### The Clean `NormalizedRun` Contract

All adapters strictly implement `IEventAdapter` and output identical `NormalizedRun` objects:

```typescript
export interface NormalizedRun {
  handler: string;
  dog: string;
  game: string;
  field: string;
  day: string;
  dayOrder: number;
  blockTime: string;        // e.g. "8:00 AM"
  blockMinutes: number;     // e.g. 480 (minutes from midnight)
  ordinalInBlock: number;   // e.g. 1
  totalInBlock: number;     // e.g. 10
}
```

No administrative clutter (`UTN`, `Division`, `Jump Height`), no synthetic keys (`sortKey`), and no `undefined` optional fields. Sorting is handled cleanly using natural chronological properties (`dayOrder`, `blockMinutes`, `ordinalInBlock`).

---

## Adding a New Event

To add a new competition, simply add an entry to **`events.json`**:

```json
{
  "id": "fall-classic",
  "name": "Fall Classic",
  "sheetId": "1eDBrcZdUCiIg9hSWnGC0LP0Rds1bVTpNSnE2mjAInE8",
  "adapterType": "FallClassic",
  "days": ["Friday (9/20)", "Saturday (9/21)", "Sunday (9/22)"]
}
```

---

## Local Development & Testing

```bash
# Install dependencies:
npm install

# Run local hot-reloading dev server:
npm run dev

# Run TypeScript typechecker:
npm run typecheck

# Run unit test suite:
npm test

# Build production bundle:
npm run build
```

---

## CI/CD Pipeline (GitHub Actions)

On every `git push origin main`, GitHub Actions automatically:
1. Installs clean dependencies (`npm ci`).
2. Runs static type checking (`tsc --noEmit`).
3. Runs the unit test suite (`npm test`) against golden fixtures.
4. Compiles and minifies the static production bundle with Vite.
5. Deploys directly to GitHub Pages via `actions/deploy-pages@v4`.

> **One-Time GitHub Setup:**
> In your repository, go to **Settings ➔ Pages ➔ Build and deployment ➔ Source**, and select **"GitHub Actions"**.

---

## Live Deployment

👉 **[https://wingmar.github.io/when-am-i-updog/](https://wingmar.github.io/when-am-i-updog/)**
