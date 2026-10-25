# When Am I UpDog?

A modern, minimalist web application for dog handlers to view and track their canonical run orders and field assignments for UpDog Challenge disc dog competitions.

## Canonical Run Orders

Unlike summary grids, this app ingests directly from all **13 individual event sheets**, which represent the official canonical running order on the field:

- **Thursday:** Far Out (Field 2/3), Fireball (Field 1)
- **Friday:** Boom! (Field 3 & 2), TimeWarp (Field 1), Freestyle Performance (Field 2), 7Up (Field 3 & 2)
- **Saturday:** Spaced Out (Field 3, 1, 2), Four Way Play (Field 1), Freestyle Criterion (Field 2), FunKey (Field 3 & 2)
- **Sunday:** Throw N Go (Field 2), Frizgility (Field 3), Greedy (Field 1)

## Key Features

- **Canonical Run Position:** See your exact stepping-to-the-line order (e.g. `Run #4 of 140`) for every event and field.
- **Field & Division Badges:** Displays Field assignment (`Field 1`, `Field 2`, `Field 3`, `Field 2/3`), competition division (`Maxi`, `Midi`, `Mini`, `Mega`), Jump Height, and UTN.
- **Session Windows:** Displays the scheduled session times (e.g. `8:00 AM – 12:00 PM`).
- **Tight Turnaround Detection:** Automatically alerts handlers running multiple dogs close together in the same event (e.g. `2 runs apart from Rover`).
- **Multi-Filter Engine:** Filter by Day (`Thu`, `Fri`, `Sat`, `Sun`), Dog, or Field.
- **Parallel Multi-Sheet Sync:** Concurrent JSONP ingestion across all 13 event tabs in ~300ms, with zero CORS limitations.
- **Auto-Sync:** Periodically checks for updates every 60 seconds and on tab focus.
- **Deep Linking:** Share your exact schedule URL (e.g. `https://wingmar.github.io/when-am-i-updog/#handler=Aaron%20Dagres`).

## Live Deployment

Hosted directly via GitHub Pages:
[https://wingmar.github.io/when-am-i-updog/](https://wingmar.github.io/when-am-i-updog/)
