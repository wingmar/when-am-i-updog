# When Am I UpDog?

A modern, minimalist web application for dog handlers to view and track their scheduled block times and running orders for UpDog Challenge disc dog competitions.

## Block-Based Running Orders

Competitors are scheduled into 30-minute block windows (e.g. 8:00 AM – 8:30 AM, 11:00 AM – 11:30 AM). Instead of showing broad all-day windows or large overall numbers, this app displays the exact actionable information needed at the field:

- **Scheduled Block Time:** The specific 30-minute block (e.g., `08:30 AM`).
- **Ordinal in Block:** Exactly which order the dog steps to the line within that block (e.g. `#3 of 10 in block`).
- **Field & Division Badges:** Clear Field badges (`Field 1`, `Field 2`, `Field 3`, `Field 2/3`), competition division (`Maxi`, `Midi`, `Mini`, `Mega`), Jump Height, and UTN.
- **Tight Turnaround Warnings:** Alerts handlers running multiple dogs in the same block.
- **Multi-Filter Engine:** Filter by Day (`Thu`, `Fri`, `Sat`, `Sun`), Dog, or Field.
- **Zero-CORS Live Sync:** Ingests live data across all event sheets in parallel via JSONP.
- **Auto-Sync:** Background polling every 60 seconds and on tab focus.

## Live Deployment

Hosted directly via GitHub Pages:
[https://wingmar.github.io/when-am-i-updog/](https://wingmar.github.io/when-am-i-updog/)
