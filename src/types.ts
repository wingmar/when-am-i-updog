export interface DogRun {
  dog: string;
  ordinalInBlock: number;
  totalInBlock: number;
}

export interface VolunteerShift {
  role: string;         // e.g. "Line Judge", "Timer", "Head Judge"
  timeWindow: string;   // e.g. "2:30 PM – 3:30 PM"
}

export type Activity =
  | { kind: "run"; run: DogRun }
  | { kind: "volunteer"; shift: VolunteerShift };

export interface ScheduleItem {
  id: string;
  handler: string;
  game: string;
  field: string;
  day: string;
  dayOrder: number;
  blockTime: string;      // e.g. "8:00 AM"
  blockMinutes: number;   // Minutes from midnight for natural chronological sorting
  activity: Activity;
}

export interface NormalizedSchedule {
  eventId: string;
  eventName: string;
  days: string[];
  items: ScheduleItem[];
}

export interface EventConfig {
  id: string;
  name: string;
  sheetId: string;
  adapterType: string;
  days: string[];
}

export interface IEventAdapter {
  fetchSchedule(
    sheetId: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<ScheduleItem[]>;
}

export interface GVizCell {
  v?: string | number | boolean | null;
  f?: string | null;
}

export interface GVizRow {
  c?: (GVizCell | null)[];
}

export interface GVizCol {
  id?: string;
  label?: string;
  type?: string;
}

export interface GVizTable {
  cols?: GVizCol[];
  rows?: GVizRow[];
}
