# When Am I UpDog?

A modern, mobile-first web application for dog handlers to view and track their scheduled block times, block running orders, and fields for UpDog Challenge disc dog competitions.

Built with **Vue 3**, **TypeScript**, **Vite**, and an **Adapter Architecture**, continuously verified and deployed via **GitHub Actions**.

---

## Architectural Principles

### 1. Composition Over Inheritance (`src/types.ts`)
Instead of subclassing or shoehorning volunteer shifts into a dog run type with dummy properties, activities are modeled as pure compositions:

```typescript
// Specific Dog Competition Run
export interface DogRun {
  dog: string;
  ordinalInBlock: number;
  totalInBlock: number;
}

// Specific Volunteer Duty (No dog, no run ordinal)
export interface VolunteerShift {
  role: string;         // e.g. "Line Judge", "Timer", "Head Judge"
  timeWindow: string;   // e.g. "2:30 PM – 3:30 PM"
}

// Composed Activity
export type Activity =
  | { kind: "run"; run: DogRun }
  | { kind: "volunteer"; shift: VolunteerShift };

// The Unified Scheduled Item
export interface ScheduleItem {
  id: string;
  handler: string;
  game: string;
  field: string;
  day: string;
  dayOrder: number;
  blockTime: string;      // e.g. "9:00 AM"
  blockMinutes: number;   // Minutes from midnight for sorting
  activity: Activity;     // <-- Composed here!
}
```

### 2. Polymorphic Rendering: Zero `v-if` Checks (`src/components/activityRegistry.ts`)
In accordance with the **Open/Closed Principle**, the UI renders cards polymorphically using Vue's native `<component :is="...">` mapped through a clean Strategy Registry:

```typescript
export const activityCardMap: Record<string, Component> = {
  run: RunCard,
  volunteer: VolunteerCard
};
```
```html
<!-- Inside template: Zero v-if checks! -->
<component
  :is="activityCardMap[entry.item.activity.kind]"
  :item="entry.item"
  :tight-turnaround-notice="entry.conflictNotice"
  :conflict-notice="entry.conflictNotice"
/>
```

### 3. Cross-Duty Conflict Detection
The engine automatically detects and flags:
- **Dog-to-Dog Tight Turnarounds:** Multiple dogs handled by the same handler in the same block.
- **Dog-to-Volunteer Conflicts:** An alert if a handler is scheduled to run a dog while assigned to be a `Line Judge` or `Timer` in the same hour window.

---

## Unit Testing & CI/CD

```bash
# Run strict TypeScript compiler checks:
npm run typecheck

# Run unit tests against golden competition fixtures:
npm test

# Build production bundle:
npm run build
```

Every push to `main` triggers automated GitHub Actions CI/CD to verify typecheck, tests, and deployment to GitHub Pages.

---

## Live Deployment

👉 **[https://wingmar.github.io/when-am-i-updog/](https://wingmar.github.io/when-am-i-updog/)**
