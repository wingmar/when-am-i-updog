#!/usr/bin/env python3
"""
Unit Test Suite for When Am I UpDog? Event Adapters.
Tests specific tab structure adapters against golden test fixtures.
"""

import json
import os
import re
import unittest

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def parse_time_to_minutes(time_str: str) -> int:
    """Standard UpDog time converter with AM/PM inference."""
    if not time_str:
        return 0
    # Clean e.g. "8:00-8:30" -> "8:00"
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", time_str)
    if not m:
        return 0
    h = int(m.group(1))
    mins = int(m.group(2))
    if 7 <= h <= 11:
        pass  # AM
    elif h == 12:
        pass  # 12 PM
    elif h < 7:
        h += 12  # PM
    return h * 60 + mins


def format_minutes_to_time(total_min: int) -> dict:
    h24 = total_min // 60
    m = total_min % 60
    period = "PM" if h24 >= 12 else "AM"
    h12 = h24 % 12
    if h12 == 0:
        h12 = 12
    m_padded = f"0{m}" if m < 10 else f"{m}"
    return {
        "formatted": f"{h12}:{m_padded}",
        "period": period,
        "raw": f"{h12}:{m_padded} {period}",
    }


def get_cell_text(cells, idx):
    if idx < 0 or idx >= len(cells):
        return ""
    c = cells[idx]
    if c is None:
        return ""
    if isinstance(c, dict):
        if "f" in c and c["f"] is not None:
            return str(c["f"]).strip()
        if "v" in c and c["v"] is not None:
            return str(c["v"]).strip()
        return ""
    return str(c).strip()


# ==============================================================================
# Adapter 1: NortheastClassicAdapter (Divider-Row Subheaders & Multi-Field Cols)
# ==============================================================================
class NortheastClassicAdapter:
    """Adapter for Northeast Classic 2026 format."""

    @staticmethod
    def parse_master_time_map(master_table):
        """Builds (handler, dog, game_key) -> block_time map from master grid."""
        time_map = {}
        rows = master_table.get("rows", [])
        if not rows:
            return time_map

        header = [get_cell_text(rows[0].get("c", []), i).lower() for i in range(len(rows[0].get("c", [])))]
        game_cols = {}
        for i in range(2, len(header)):
            t = header[i].strip()
            if t:
                game_cols[i] = t

        for r in rows[1:]:
            cells = r.get("c", [])
            h = get_cell_text(cells, 0).lower()
            d = get_cell_text(cells, 1).lower()
            if not h:
                continue

            for col_idx, g_key in game_cols.items():
                val = get_cell_text(cells, col_idx)
                if val and "-" in val:
                    parts = val.split("-")
                    time_map[(h, d, g_key)] = parts[1].strip()
        return time_map

    @classmethod
    def parse_event_tab(cls, table, tab_meta, master_time_map):
        cols = table.get("cols", [])
        rows = table.get("rows", [])

        # Find handler columns
        handler_cols = []
        for i, c in enumerate(cols):
            lbl = (c.get("label") or "").lower()
            if "handler" in lbl:
                handler_cols.push(i) if hasattr(handler_cols, "push") else handler_cols.append(i)

        runs = []
        for g_idx, h_idx in enumerate(handler_cols):
            next_h_idx = handler_cols[g_idx + 1] if g_idx + 1 < len(handler_cols) else len(cols)
            header_label = cols[h_idx].get("label") or ""

            f_match = re.search(r"Field\s+[\d\/]+", header_label, re.IGNORECASE)
            field_name = f_match.group(0) if f_match else "Field 1"

            dog_idx = h_idx + 1
            utn_idx = -1
            div_idx = -1
            for c in range(h_idx + 1, next_h_idx):
                lbl = (cols[c].get("label") or "").lower()
                if "dog" in lbl:
                    dog_idx = c
                elif "utn" in lbl:
                    utn_idx = c
                elif "division" in lbl:
                    div_idx = c

            field_runs = []
            for r in rows:
                cells = r.get("c", [])
                handler = get_cell_text(cells, h_idx)
                dog = get_cell_text(cells, dog_idx)
                if not handler or handler.lower() in ["handler", "lunch"]:
                    continue

                utn = get_cell_text(cells, utn_idx) if utn_idx != -1 else ""
                division = get_cell_text(cells, div_idx) if div_idx != -1 else ""
                key = (handler.lower(), dog.lower(), tab_meta["mapKey"])
                t = master_time_map.get(key, None)

                field_runs.append({
                    "handler": handler,
                    "dog": dog,
                    "utn": utn,
                    "division": division,
                    "time": t,
                })

            # Fill down missing times from adjacent runs in block
            last_t = "8:00"
            for fr in field_runs:
                if fr["time"]:
                    last_t = fr["time"]
                else:
                    fr["time"] = last_t

            # Group by block time
            blocks = {}
            for fr in field_runs:
                bt = fr["time"]
                if bt not in blocks:
                    blocks[bt] = []
                blocks[bt].append(fr)

            for bt, b_runs in blocks.items():
                for idx, fr in enumerate(b_runs, start=1):
                    mins = parse_time_to_minutes(bt)
                    formatted_time = format_minutes_to_time(mins)
                    runs.append({
                        "handler": fr["handler"],
                        "dog": fr["dog"],
                        "game": tab_meta["name"],
                        "field": field_name,
                        "day": tab_meta["day"],
                        "dayOrder": tab_meta["dayOrder"],
                        "blockTime": formatted_time["raw"],
                        "blockMinutes": mins,
                        "ordinalInBlock": idx,
                        "totalInBlock": len(b_runs),
                        "division": fr["division"],
                        "utn": fr["utn"],
                    })

        return runs


# ==============================================================================
# Adapter 2: FallClassicAdapter (Dedicated Time Block Column in Event Sheets)
# ==============================================================================
class FallClassicAdapter:
    """Adapter for Fall Classic format (Time Block column in Col 0)."""

    @classmethod
    def parse_event_tab(cls, table, tab_meta):
        rows = table.get("rows", [])
        if len(rows) < 2:
            return []

        # Find header row containing 'Handler'
        h_row_idx = 1
        for i in range(min(5, len(rows))):
            row_texts = [get_cell_text(rows[i].get("c", []), j).lower() for j in range(len(rows[i].get("c", [])))]
            if "handler" in row_texts:
                h_row_idx = i
                break

        h_cells = [get_cell_text(rows[h_row_idx].get("c", []), j).lower() for j in range(len(rows[h_row_idx].get("c", [])))]
        handler_col = h_cells.index("handler") if "handler" in h_cells else 2
        dog_col = h_cells.index("dog") if "dog" in h_cells else 3
        utn_col = h_cells.index("utn") if "utn" in h_cells else 4

        # Read title row to infer date/day if available
        title_text = get_cell_text(rows[0].get("c", []), 2) if rows else ""
        day = tab_meta.get("day", "Friday")
        if "9/20" in title_text:
            day = "Friday (9/20)"
        elif "9/21" in title_text:
            day = "Saturday (9/21)"
        elif "9/22" in title_text:
            day = "Sunday (9/22)"

        runs_raw = []
        last_block = "8:00-8:30"

        for r in rows[h_row_idx + 1 :]:
            cells = r.get("c", [])
            col0_text = get_cell_text(cells, 0)
            handler = get_cell_text(cells, handler_col)
            dog = get_cell_text(cells, dog_col)

            # Skip separator rows like 'Do not start again until 8:30'
            if not handler or handler.lower() in ["handler", "lunch", "none", ""]:
                if col0_text and re.search(r"\d{1,2}:\d{2}", col0_text):
                    last_block = col0_text
                continue

            if col0_text and re.search(r"\d{1,2}:\d{2}", col0_text):
                last_block = col0_text

            utn = get_cell_text(cells, utn_col) if utn_col < len(cells) else ""
            runs_raw.append({
                "handler": handler,
                "dog": dog,
                "utn": utn,
                "block": last_block,
            })

        # Group by block to compute ordinal in block
        blocks = {}
        for r in runs_raw:
            b = r["block"]
            if b not in blocks:
                blocks[b] = []
            blocks[b].append(r)

        normalized_runs = []
        for b, b_runs in blocks.items():
            mins = parse_time_to_minutes(b)
            formatted_time = format_minutes_to_time(mins)
            for idx, r in enumerate(b_runs, start=1):
                normalized_runs.append({
                    "handler": r["handler"],
                    "dog": r["dog"],
                    "game": tab_meta["name"],
                    "field": tab_meta.get("field", "Field 1"),
                    "day": day,
                    "dayOrder": tab_meta.get("dayOrder", 0),
                    "blockTime": formatted_time["raw"],
                    "blockMinutes": mins,
                    "ordinalInBlock": idx,
                    "totalInBlock": len(b_runs),
                    "division": "",
                    "utn": r["utn"],
                })

        return normalized_runs


# ==============================================================================
# Unit Tests
# ==============================================================================
class TestEventAdapters(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load fixtures
        with open(os.path.join(FIXTURES_DIR, "northeast", "master_grid.json")) as f:
            cls.ne_master = json.load(f)
        with open(os.path.join(FIXTURES_DIR, "northeast", "far_out.json")) as f:
            cls.ne_far_out = json.load(f)
        with open(os.path.join(FIXTURES_DIR, "northeast", "boom.json")) as f:
            cls.ne_boom = json.load(f)

        with open(os.path.join(FIXTURES_DIR, "fall_classic", "far_out.json")) as f:
            cls.fc_far_out = json.load(f)
        with open(os.path.join(FIXTURES_DIR, "fall_classic", "sevenup.json")) as f:
            cls.fc_7up = json.load(f)
        with open(os.path.join(FIXTURES_DIR, "fall_classic", "boom.json")) as f:
            cls.fc_boom = json.load(f)

    def test_northeast_master_grid_parsing(self):
        """Verifies master grid extracts time assignments for Northeast Classic."""
        time_map = NortheastClassicAdapter.parse_master_time_map(self.ne_master)
        self.assertGreater(len(time_map), 1500)
        # Check Aaron Dagres & Yzma in Far Out
        t = time_map.get(("aaron dagres", "yzma", "far out"))
        self.assertEqual(t, "8:00")

    def test_northeast_far_out(self):
        """Verifies Northeast Classic Far Out parses correct block ordinals."""
        time_map = NortheastClassicAdapter.parse_master_time_map(self.ne_master)
        meta = {"name": "Far Out", "mapKey": "far out", "day": "Thursday", "dayOrder": 0}
        runs = NortheastClassicAdapter.parse_event_tab(self.ne_far_out, meta, time_map)

        self.assertGreater(len(runs), 130)
        self.assertEqual(runs[0]["handler"], "Evan Beatty")
        self.assertEqual(runs[0]["dog"], "Lasso")
        self.assertEqual(runs[0]["ordinalInBlock"], 1)
        self.assertEqual(runs[0]["blockTime"], "8:00 AM")

        # 4th runner: Aaron Dagres & Yzma
        self.assertEqual(runs[3]["handler"], "Aaron Dagres")
        self.assertEqual(runs[3]["dog"], "Yzma")
        self.assertEqual(runs[3]["ordinalInBlock"], 4)
        self.assertEqual(runs[3]["blockTime"], "8:00 AM")

        # 11th runner: Kate Castiglia & Sailor -> Resets to #1 in 8:30 block
        self.assertEqual(runs[10]["handler"], "Kate Castiglia")
        self.assertEqual(runs[10]["dog"], "Sailor")
        self.assertEqual(runs[10]["ordinalInBlock"], 1)
        self.assertEqual(runs[10]["blockTime"], "8:30 AM")

        # Verify all block ordinals are valid
        for r in runs:
            self.assertGreaterEqual(r["ordinalInBlock"], 1)
            self.assertLessEqual(r["ordinalInBlock"], r["totalInBlock"])

    def test_northeast_boom_multifield(self):
        """Verifies Northeast Classic Boom parses both Field 3 and Field 2."""
        time_map = NortheastClassicAdapter.parse_master_time_map(self.ne_master)
        meta = {"name": "Boom!", "mapKey": "boom", "day": "Friday", "dayOrder": 1}
        runs = NortheastClassicAdapter.parse_event_tab(self.ne_boom, meta, time_map)

        fields = set(r["field"] for r in runs)
        self.assertIn("Field 3", fields)
        self.assertIn("Field 2", fields)

    def test_fall_classic_far_out(self):
        """Verifies Fall Classic Far Out extracts Column 0 time blocks correctly."""
        meta = {"name": "Far Out", "field": "Field 1", "day": "Friday", "dayOrder": 0}
        runs = FallClassicAdapter.parse_event_tab(self.fc_far_out, meta)

        self.assertGreaterEqual(len(runs), 60)
        # Runner 1 in 8:00 block
        self.assertEqual(runs[0]["handler"], "Chandler Leiby")
        self.assertEqual(runs[0]["dog"], "Maple")
        self.assertEqual(runs[0]["ordinalInBlock"], 1)
        self.assertEqual(runs[0]["blockTime"], "8:00 AM")

        # Runner 11 in 8:30 block (Bre Famoso & Finn-Again)
        r11 = runs[10]
        self.assertEqual(r11["handler"], "Bre Famoso")
        self.assertEqual(r11["dog"], "Finn-Again")
        self.assertEqual(r11["ordinalInBlock"], 1)
        self.assertEqual(r11["blockTime"], "8:30 AM")

        # Verify separator string was filtered out
        handlers = [r["handler"].lower() for r in runs]
        self.assertNotIn("do not start again until 8:30", handlers)

    def test_fall_classic_sevenup(self):
        """Verifies Fall Classic 7Up parses cleanly."""
        meta = {"name": "7Up", "field": "Field 2", "day": "Friday", "dayOrder": 0}
        runs = FallClassicAdapter.parse_event_tab(self.fc_7up, meta)

        self.assertGreaterEqual(len(runs), 35)
        self.assertEqual(runs[0]["handler"], "Evan Beatty")
        self.assertEqual(runs[0]["dog"], "Lasso")
        self.assertEqual(runs[0]["ordinalInBlock"], 1)
        self.assertEqual(runs[0]["blockTime"], "8:00 AM")

    def test_normalized_contract_schema(self):
        """Verifies that both adapters produce identical normalized run contracts."""
        required_keys = {
            "handler", "dog", "game", "field", "day", "dayOrder",
            "blockTime", "blockMinutes", "ordinalInBlock", "totalInBlock",
            "division", "utn"
        }
        meta_ne = {"name": "Far Out", "mapKey": "far out", "day": "Thursday", "dayOrder": 0}
        time_map = NortheastClassicAdapter.parse_master_time_map(self.ne_master)
        runs_ne = NortheastClassicAdapter.parse_event_tab(self.ne_far_out, meta_ne, time_map)

        meta_fc = {"name": "Far Out", "field": "Field 1", "day": "Friday", "dayOrder": 0}
        runs_fc = FallClassicAdapter.parse_event_tab(self.fc_far_out, meta_fc)

        for r in runs_ne[:5] + runs_fc[:5]:
            self.assertTrue(required_keys.issubset(r.keys()), f"Missing keys in {r}")


if __name__ == "__main__":
    unittest.main()
