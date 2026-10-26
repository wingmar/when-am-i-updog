import type { GVizTable, IEventAdapter, ScheduleItem } from "../types";
import { fetchGvizJsonp, formatMinutesToTime, getCellText, parseTimeToMinutes } from "./base";

interface FallTabMeta {
  name: string;
  sheetName: string;
  field: string;
  day: string;
  dayOrder: number;
}

export class FallClassicAdapter implements IEventAdapter {
  private volunteerGid = "621553388"; // Individual Schedules tab contains volunteer assignments
  private tabs: FallTabMeta[] = [
    { name: "Far Out", sheetName: "Far Out", field: "Field 1", day: "Friday (9/20)", dayOrder: 0 },
    { name: "7Up", sheetName: "7Up", field: "Field 2", day: "Friday (9/20)", dayOrder: 0 },
    { name: "TimeWarp", sheetName: "TimeWarp", field: "Field 1", day: "Friday (9/20)", dayOrder: 0 },
    { name: "Spaced Out", sheetName: "Spaced Out", field: "Field 2", day: "Friday (9/20)", dayOrder: 0 },

    { name: "Freestyle Criterion", sheetName: "Freestyle Criterion", field: "Field 1", day: "Saturday (9/21)", dayOrder: 1 },
    { name: "FunKey", sheetName: "FunKey", field: "Field 2", day: "Saturday (9/21)", dayOrder: 1 },
    { name: "Throw N Go", sheetName: "Throw N Go", field: "Field 1", day: "Saturday (9/21)", dayOrder: 1 },
    { name: "Boom!", sheetName: "Boom!", field: "Field 2", day: "Saturday (9/21)", dayOrder: 1 },

    { name: "Freestyle Performance", sheetName: "Freestyle Performance", field: "Field 1", day: "Sunday (9/22)", dayOrder: 2 },
    { name: "Frizgility", sheetName: "Frizgility", field: "Field 2", day: "Sunday (9/22)", dayOrder: 2 },
    { name: "Four Way Play", sheetName: "Four Way Play", field: "Field 1", day: "Sunday (9/22)", dayOrder: 2 },
    { name: "Greedy", sheetName: "Greedy", field: "Field 2", day: "Sunday (9/22)", dayOrder: 2 }
  ];

  async fetchSchedule(
    sheetId: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<ScheduleItem[]> {
    const queries = [
      fetchGvizJsonp(sheetId, `gid=${this.volunteerGid}&headers=0`, "volunteers"),
      ...this.tabs.map((t, idx) => {
        const enc = encodeURIComponent(t.sheetName);
        return fetchGvizJsonp(sheetId, `sheet=${enc}&headers=0`, `fc_${idx}`);
      })
    ];

    let count = 0;
    queries.forEach((p) =>
      p.then(() => {
        count++;
        if (onProgress) onProgress(count, queries.length);
      })
    );

    const results = await Promise.all(queries);
    const volRes = results.find((r) => r.id === "volunteers");
    const eventRes = results.filter((r) => r.id !== "volunteers" && r.table !== null);

    const dogRuns = this.parseDogRuns(eventRes);
    const volunteerShifts = this.parseVolunteerShifts(volRes ? volRes.table : null);

    return [...dogRuns, ...volunteerShifts];
  }

  parseDogRuns(results: { id: string; table: GVizTable | null }[]): ScheduleItem[] {
    const items: ScheduleItem[] = [];

    results.forEach((res, idx) => {
      if (!res.table) return;
      const tabMeta = this.tabs[idx];
      const rows = res.table.rows || [];
      if (rows.length < 2) return;

      // Find header row containing 'Handler'
      let hRowIdx = 1;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const texts = (rows[i].c || []).map((c) => getCellText(c).toLowerCase());
        if (texts.includes("handler")) {
          hRowIdx = i;
          break;
        }
      }

      const hCells = (rows[hRowIdx].c || []).map((c) => getCellText(c).toLowerCase());
      const handlerCol = hCells.includes("handler") ? hCells.indexOf("handler") : 2;
      const dogCol = hCells.includes("dog") ? hCells.indexOf("dog") : 3;

      let day = tabMeta.day;
      const titleText = rows.length > 0 ? getCellText((rows[0].c || [])[2]) : "";
      if (titleText.includes("9/20")) day = "Friday (9/20)";
      else if (titleText.includes("9/21")) day = "Saturday (9/21)";
      else if (titleText.includes("9/22")) day = "Sunday (9/22)";

      const runsRaw: { handler: string; dog: string; block: string }[] = [];
      let lastBlock = "8:00-8:30";

      for (let r = hRowIdx + 1; r < rows.length; r++) {
        const cells = rows[r].c || [];
        const col0Text = getCellText(cells[0]);
        const handler = getCellText(cells[handlerCol]);
        const dog = getCellText(cells[dogCol]);

        // Filter out non-runner divider rows
        if (!handler || ["handler", "lunch", "none", ""].includes(handler.toLowerCase())) {
          if (col0Text && /\d{1,2}:\d{2}/.test(col0Text)) lastBlock = col0Text;
          continue;
        }

        if (col0Text && /\d{1,2}:\d{2}/.test(col0Text)) lastBlock = col0Text;

        runsRaw.push({
          handler,
          dog,
          block: lastBlock
        });
      }

      const blocks = new Map<string, typeof runsRaw>();
      runsRaw.forEach((r) => {
        if (!blocks.has(r.block)) blocks.set(r.block, []);
        blocks.get(r.block)!.push(r);
      });

      blocks.forEach((bRuns, bStr) => {
        const mins = parseTimeToMinutes(bStr);
        const fmt = formatMinutesToTime(mins);
        bRuns.forEach((r, bIdx) => {
          items.push({
            id: `fc_${tabMeta.name}_${bStr}_${bIdx + 1}_${r.handler}_${r.dog}`,
            handler: r.handler,
            game: tabMeta.name,
            field: tabMeta.field,
            day,
            dayOrder: tabMeta.dayOrder,
            blockTime: fmt.raw,
            blockMinutes: mins,
            activity: {
              kind: "run",
              run: {
                dog: r.dog,
                ordinalInBlock: bIdx + 1,
                totalInBlock: bRuns.length
              }
            }
          });
        });
      });
    });

    return items;
  }

  parseVolunteerShifts(volTable: GVizTable | null): ScheduleItem[] {
    const items: ScheduleItem[] = [];
    if (!volTable || !volTable.rows) return items;

    const volKeywords = ["judge", "timer", "scribe", "steward", "volunteer", "score", "gate", "field set"];

    for (const r of volTable.rows) {
      const cells = r.c || [];
      if (cells.length < 4) continue;
      const handler = getCellText(cells[0]);
      const role = getCellText(cells[1]);
      const timeStr = getCellText(cells[2]);
      const gameDay = getCellText(cells[3]);

      if (!handler || !role || !timeStr || !gameDay) continue;

      const isVol = volKeywords.some((k) => role.toLowerCase().includes(k));
      if (!isVol) continue;

      let day = "Friday (9/20)";
      let dayOrder = 0;
      if (gameDay.toLowerCase().includes("sat")) {
        day = "Saturday (9/21)";
        dayOrder = 1;
      } else if (gameDay.toLowerCase().includes("sun")) {
        day = "Sunday (9/22)";
        dayOrder = 2;
      }

      const game = gameDay.replace(/\s*-\s*(fri|sat|sun)\b/i, "").trim();
      const mins = parseTimeToMinutes(timeStr);
      const fmt = formatMinutesToTime(mins);

      items.push({
        id: `vol_${handler}_${role}_${dayOrder}_${mins}_${game}`,
        handler,
        game,
        field: "Field 1",
        day,
        dayOrder,
        blockTime: fmt.raw,
        blockMinutes: mins,
        activity: {
          kind: "volunteer",
          shift: {
            role,
            timeWindow: timeStr
          }
        }
      });
    }

    return items;
  }
}
