export interface NormalizedRun {
  handler: string;
  dog: string;
  game: string;
  field: string;
  day: string;
  dayOrder: number;
  blockTime: string;        // e.g. "8:00 AM"
  blockMinutes: number;     // e.g. 480 (minutes from midnight for natural sorting)
  ordinalInBlock: number;   // e.g. 1
  totalInBlock: number;     // e.g. 10
}

export interface NormalizedSchedule {
  eventId: string;
  eventName: string;
  days: string[];
  runs: NormalizedRun[];
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
  ): Promise<NormalizedRun[]>;
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
