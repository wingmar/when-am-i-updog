# When Am I UpDog?

A modern, mobile-first web application for dog handlers to view and track their scheduled block times, block running orders, and fields for UpDog Challenge disc dog competitions.

## Multi-Event Support & Adapter Architecture

Different UpDog tournaments format their Google Sheets differently (e.g. some put time blocks in dedicated columns, others in divider rows; some run side-by-side fields, others run sequential fields). 

To ensure 100% stability without heuristic guessing, the app uses an **Adapter Architecture**:

- **`NortheastClassicAdapter`**:
  - Handles the 4-day Northeast Classic layout (`11zydir3gG2eQOFpk_N9yVxEW6iRYmbRtJAdeS1R9feI`).
  - Supports side-by-side multi-field columns and subheader divider rows.
- **`FallClassicAdapter`**:
  - Handles the Fall Classic layout (`1eDBrcZdUCiIg9hSWnGC0LP0Rds1bVTpNSnE2mjAInE8`).
  - Supports dedicated Time Block columns, clean event sheet names, and date-in-title detection.

Both adapters output the exact same **`NormalizedRun` contract**:
```javascript
{
  handler: "Evan Beatty",
  dog: "Lasso",
  game: "Far Out",
  field: "Field 2/3",
  day: "Thursday",
  blockTime: "8:00 AM",
  ordinalInBlock: 1,
  totalInBlock: 10,
  division: "Mega",
  utn: "T29543238"
}
```

### Switching Events
- **In the UI:** Tap the event badge at the top (`📍 Northeast Classic 2026 ▾`) to switch to `Fall Classic` or another event.
- **Via URL:** Deep-link directly to an event using `?event=fall-classic` or `?event=northeast-classic`:
  - `https://wingmar.github.io/when-am-i-updog/?event=fall-classic#handler=Chandler%20Leiby`

---

## Unit Testing

The repository includes a comprehensive unit test suite with golden fixtures from real competitions:

```bash
# Run the adapter unit tests:
python3 test_adapters.py
```

Tests verify:
- Accurate extraction of handlers, dogs, and UTNs.
- Correct block time parsing and AM/PM calculation.
- Block ordinal accuracy (ensuring ordinals strictly adhere to `1 <= ordinalInBlock <= totalInBlock`).
- Multi-field separation and non-runner text filtering.

---

## Performance & Load Testing

The repository includes a load testing suite to verify Google Sheets concurrency and rate limits:

```bash
# Run all 4 stepped concurrency tiers (1, 10, 25, 50 users):
./test_load.py --all

# Run sustained traffic simulation:
./test_load.py --sustained
```

---

## Live Deployment

Hosted directly via GitHub Pages:
👉 **[https://wingmar.github.io/when-am-i-updog/](https://wingmar.github.io/when-am-i-updog/)**
