# UpDog Challenge - Personal Schedule UI

A modern, minimalist, and responsive web application for dog handlers to view and track their personal run schedule at UpDog Challenge disc dog competitions.

## Features

- **Live Google Sheet Sync:** Automatically fetches real-time updates directly from the official Google Sheet, with local caching and offline fallback.
- **Instant Search & Autocomplete:** Search by handler name or dog name. Remembers your selection across reloads via `localStorage`.
- **Direct Share Links:** Deep linking via URL hash (e.g. `#handler=Aaron%20Dagres`) allows handlers to bookmark or share their direct schedule link.
- **Chronological Timeline:** All runs ordered across the day with standardized AM/PM time calculation, ring indicators, and break interval highlights.
- **Multi-Dog Filtering:** Quick-toggle filter pills to view all dogs or isolate runs for a specific dog.
- **Conflict / Tight Turnaround Warnings:** Automatically flags runs occurring at the same time or with 0-minute turnaround.
- **Dark / Light Theme:** Modern minimalist aesthetic inspired by industry design systems (Linear, Vercel), with automatic system preference detection and manual toggle.
- **Print & PDF Ready:** Optimized print stylesheet for clean physical paper schedules.

## Running Locally

Simply open `index.html` in any web browser:

```bash
open index.html
```

Or serve with Python:

```bash
python3 -m http.server 8000
```
