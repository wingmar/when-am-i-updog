import type { GVizCell, GVizTable } from "../types";

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const m = timeStr.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10) || 0;
  if (h >= 7 && h <= 11) {
    // AM
  } else if (h === 12) {
    // 12 PM
  } else if (h < 7) {
    h += 12; // PM
  }
  return h * 60 + mins;
}

export function formatMinutesToTime(totalMin: number): { formatted: string; period: string; raw: string } {
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const mPadded = m < 10 ? `0${m}` : `${m}`;
  return {
    formatted: `${h12}:${mPadded}`,
    period,
    raw: `${h12}:${mPadded} ${period}`
  };
}

export function formatBlockTimeWindow(timeStr: string): { start: { formatted: string; period: string }; end: { formatted: string; period: string }; range: string } {
  const min = parseTimeToMinutes(timeStr);
  const start = formatMinutesToTime(min);
  const end = formatMinutesToTime(min + 30);
  return {
    start,
    end,
    range: `${start.formatted} ${start.period} &ndash; ${end.formatted} ${end.period}`
  };
}

export function getCellText(cell: GVizCell | null | undefined): string {
  if (!cell) return "";
  if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
  if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
  return "";
}

export function fetchGvizJsonp(sheetId: string, queryParam: string, id: string): Promise<{ id: string; table: GVizTable | null }> {
  return new Promise((resolve) => {
    const callbackName = `gvizCallback_${id}`;

    // Attach to global window
    (window as unknown as Record<string, unknown>)[callbackName] = function (resp: { status?: string; table?: GVizTable }) {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      const s = document.getElementById(`script_${id}`);
      if (s) {
        if (s.parentNode) s.parentNode.removeChild(s);
        else if (typeof s.remove === "function") s.remove();
      }
      if (resp && resp.status === "ok" && resp.table) {
        resolve({ id, table: resp.table });
      } else {
        console.warn(`GViz query failed for ${id}`, resp);
        resolve({ id, table: null });
      }
    };

    const oldScript = document.getElementById(`script_${id}`);
    if (oldScript) {
      if (oldScript.parentNode) oldScript.parentNode.removeChild(oldScript);
      else if (typeof oldScript.remove === "function") oldScript.remove();
    }

    const script = document.createElement("script");
    script.id = `script_${id}`;
    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${queryParam}&tqx=responseHandler:${callbackName}&_t=${Date.now()}`;
    script.onerror = function () {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve({ id, table: null });
    };
    document.head.appendChild(script);
  });
}
