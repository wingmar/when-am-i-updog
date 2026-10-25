import type { GVizTable, IEventAdapter, NormalizedRun } from "../types";
import { fetchGvizJsonp, formatMinutesToTime, getCellText, parseTimeToMinutes } from "./base";

interface FallTabMeta {
  name: string;
  sheetName: string;
  field: string;
  day: string;
  dayOrder: number;
}

export class FallClassicAdapter implements IEventAdapter {
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
  ): Promise<NormalizedRun[]> {
    const queries = this.tabs.map((t, idx) => {
      const enc = encodeURIComponent(t.sheetName);
      return fetchGvizJsonp(sheetId, `sheet=${enc}&headers=0`, `fc_${idx}`);
    });

    let count = 0;
    queries.forEach((p) =>
      p.then(() => {
        count++;
        if (onProgress) onProgress(count, queries.length);
      })
    );

    const results = await Promise.all(queries);
    return this.parseAll(results);
  }

  parseAll(results: { id: string; table: GVizTable | null }[]): NormalizedRun[] {
    const allRuns: NormalizedRun[] = [];

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

        // Filter out divider / non-runner rows
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
          allRuns.push({
            handler: r.handler,
            dog: r.dog,
            game: tabMeta.name,
            field: tabMeta.field,
            day,
            dayOrder: tabMeta.dayOrder,
            blockTime: fmt.raw,
            blockMinutes: mins,
            ordinalInBlock: bIdx + 1,
            totalInBlock: bRuns.length
          });
        });
      });
    });

    return allRuns;
  }
}
