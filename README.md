# Northeast Classic - Personal UpDog Schedule

A modern, minimalist web application for dog handlers to view and track their personalized run orders and ring assignments for the Northeast Classic.

## Features

- **Direct Live Google Sheet Connection:** Fetches real-time running orders directly from the published Google Sheet export. Includes cache-busting so any spreadsheet updates show up immediately.
- **Auto-Sync & Polling:** Automatically refreshes in the background every 60 seconds and whenever the browser tab or phone screen regains focus.
- **Multi-Day Tournament Grouping:**
  - **Thursday:** Far Out, Fireball
  - **Friday:** Boom, FS Performance, TimeWarp, 7Up
  - **Saturday:** Spaced Out, FS Criterion, Four Way Play, FunKey
  - **Sunday:** Throw N Go, Frizgility, Greedy
- **Smart Chronological Timeline:** Accurate chronological ordering by day and time, accounting for morning/afternoon running schedules.
- **Break & Conflict Detection:**
  - Automatic break chips between distant runs (e.g. `1h 30m break`).
  - Concurrent run / double-booking alerts if a handler is scheduled with multiple dogs at the same time.
- **Handler & Dog Filtering:** Search by handler name or dog name with instant autocomplete. Toggle between all dogs or specific dogs.
- **Share & Bookmark Links:** Deep-linking via URL hash (e.g. `#handler=Aaron%20Dagres`) with a one-click share button to copy links to family or teammates.
- **Minimalist Aesthetic:** Clean, industry-standard interface with dark/light mode toggle and `@media print` support for physical schedules.

## Running Locally

Open `index.html` in your browser:

```bash
open index.html
```

Or serve with Python:

```bash
python3 -m http.server 8000
```
