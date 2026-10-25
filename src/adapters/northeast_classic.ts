import type { GVizTable, IEventAdapter, NormalizedRun } from "../types";
import { fetchGvizJsonp, formatMinutesToTime, getCellText, parseTimeToMinutes } from "./base";

interface TabMeta {
  id: string;
  name: string;
  mapKey: string;
  gid: string;
  day: string;
  dayOrder: number;
}

export class NortheastClassicAdapter implements IEventAdapter {
  private masterGid = "1990171013";
  private tabs: TabMeta[] = [
    { id: "farout", name: "Far Out", mapKey: "far out", gid: "0", day: "Thursday", dayOrder: 0 },
    { id: "fireball", name: "Fireball", mapKey: "fireball", gid: "306313736", day: "Thursday", dayOrder: 0 },
    { id: "boom", name: "Boom!", mapKey: "boom", gid: "919833849", day: "Friday", dayOrder: 1 },
    { id: "timewarp", name: "TimeWarp", mapKey: "timewarp", gid: "698159220", day: "Friday", dayOrder: 1 },
    { id: "fs_fri", name: "Freestyle Performance", mapKey: "fs performance", gid: "1789212166", day: "Friday", dayOrder: 1 },
    { id: "sevenup", name: "7Up", mapKey: "7up", gid: "1717217507", day: "Friday", dayOrder: 1 },
    { id: "spacedout", name: "Spaced Out", mapKey: "spaced out", gid: "1732980814", day: "Saturday", dayOrder: 2 },
    { id: "fourway", name: "Four Way Play", mapKey: "four way play", gid: "159025477", day: "Saturday", dayOrder: 2 },
    { id: "fs_sat", name: "Freestyle Criterion", mapKey: "fs criterion", gid: "1374816905", day: "Saturday", dayOrder: 2 },
    { id: "funkey", name: "FunKey", mapKey: "funkey", gid: "1289351842", day: "Saturday", dayOrder: 2 },
    { id: "throwngo", name: "Throw N Go", mapKey: "throw n go", gid: "1968227423", day: "Sunday", dayOrder: 3 },
    { id: "frizgility", name: "Frizgility", mapKey: "frizgility", gid: "2097815225", day: "Sunday", dayOrder: 3 },
    { id: "greedy", name: "Greedy", mapKey: "greedy", gid: "291836125", day: "Sunday", dayOrder: 3 }
  ];

  async fetchSchedule(
    sheetId: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<NormalizedRun[]> {
    const queries = [
      fetchGvizJsonp(sheetId, `gid=${this.masterGid}`, "master_grid"),
      ...this.tabs.map((t) => fetchGvizJsonp(sheetId, `gid=${t.gid}`, t.id))
    ];

    let count = 0;
    queries.forEach((p) =>
      p.then(() => {
        count++;
        if (onProgress) onProgress(count, queries.length);
      })
    );

    const results = await Promise.all(queries);
    const masterRes = results.find((r) => r.id === "master_grid");
    const eventRes = results.filter((r) => r.id !== "master_grid" && r.table !== null);

    return this.parseAll(masterRes ? masterRes.table : null, eventRes);
  }

  parseAll(
    masterTable: GVizTable | null,
    eventResults: { id: string; table: GVizTable | null }[]
  ): NormalizedRun[] {
    const timeMap = new Map<string, string>();
    if (masterTable && masterTable.rows) {
      const mHeader = (masterTable.rows[0].c || []).map((c) => getCellText(c).toLowerCase());
      const gameColMap = new Map<number, string>();
      for (let i = 2; i < mHeader.length; i++) {
        if (mHeader[i]) gameColMap.set(i, mHeader[i]);
      }

      for (let r = 1; r < masterTable.rows.length; r++) {
        const cells = masterTable.rows[r].c || [];
        const handler = getCellText(cells[0]).toLowerCase();
        const dog = getCellText(cells[1]).toLowerCase();
        if (!handler) continue;

        gameColMap.forEach((gKey, colIdx) => {
          const val = getCellText(cells[colIdx]);
          if (val && val.includes("-")) {
            const parts = val.split("-");
            timeMap.set(`${handler}_${dog}_${gKey}`, parts[1].trim());
          }
        });
      }
    }

    const allRuns: NormalizedRun[] = [];

    for (const evRes of eventResults) {
      if (!evRes.table) continue;
      const tab = this.tabs.find((t) => t.id === evRes.id);
      if (!tab) continue;

      const cols = evRes.table.cols || [];
      const rows = evRes.table.rows || [];

      const handlerCols: number[] = [];
      for (let i = 0; i < cols.length; i++) {
        if ((cols[i].label || "").toLowerCase().includes("handler")) {
          handlerCols.push(i);
        }
      }

      for (let gIdx = 0; gIdx < handlerCols.length; gIdx++) {
        const hIdx = handlerCols[gIdx];
        const nextHIdx = gIdx + 1 < handlerCols.length ? handlerCols[gIdx + 1] : cols.length;
        const headerLabel = cols[hIdx].label || "";
        const fieldMatch = headerLabel.match(/Field\s+[\d\/]+/i);
        const fieldName = fieldMatch ? fieldMatch[0] : "Field 1";

        let dogIdx = hIdx + 1;
        for (let c = hIdx + 1; c < nextHIdx; c++) {
          const lbl = (cols[c].label || "").toLowerCase();
          if (lbl.includes("dog")) dogIdx = c;
        }

        const fieldRuns: { handler: string; dog: string; time: string | null }[] = [];
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const cells = rows[rIdx].c || [];
          const handler = getCellText(cells[hIdx]);
          const dog = getCellText(cells[dogIdx]);
          if (!handler || handler.toLowerCase() === "handler" || handler.toLowerCase() === "lunch") {
            continue;
          }

          const assignedTime = timeMap.get(`${handler.toLowerCase()}_${dog.toLowerCase()}_${tab.mapKey}`) || null;
          fieldRuns.push({ handler, dog, time: assignedTime });
        }

        // Fill down missing times from adjacent runs in the block
        let lastTime = "8:00";
        for (const fr of fieldRuns) {
          if (fr.time) lastTime = fr.time;
          else fr.time = lastTime;
        }

        const blocks = new Map<string, typeof fieldRuns>();
        for (const fr of fieldRuns) {
          const t = fr.time || "8:00";
          if (!blocks.has(t)) blocks.set(t, []);
          blocks.get(t)!.push(fr);
        }

        blocks.forEach((bRuns, bTime) => {
          const mins = parseTimeToMinutes(bTime);
          const fmt = formatMinutesToTime(mins);
          bRuns.forEach((fr, idx) => {
            allRuns.push({
              handler: fr.handler,
              dog: fr.dog,
              game: tab.name,
              day: tab.day,
              dayOrder: tab.dayOrder,
              field: fieldName,
              blockTime: fmt.raw,
              blockMinutes: mins,
              ordinalInBlock: idx + 1,
              totalInBlock: bRuns.length
            });
          });
        });
      }
    }

    return allRuns;
  }
}
