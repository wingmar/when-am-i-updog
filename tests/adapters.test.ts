import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { FallClassicAdapter } from "../src/adapters/fall_classic";
import { NortheastClassicAdapter } from "../src/adapters/northeast_classic";
import type { GVizTable, ScheduleItem } from "../src/types";

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

function loadFixture(relPath: string): GVizTable {
  const fullPath = path.join(FIXTURES_DIR, relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

test("NortheastClassicAdapter parses master grid and Far Out correctly with composed DogRun", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const farOutTable = loadFixture("northeast/far_out.json");

  const adapter = new NortheastClassicAdapter();
  const items = adapter.parseAll(masterTable, [{ id: "farout", table: farOutTable }]);

  assert.ok(items.length >= 130, `Expected at least 130 items, got ${items.length}`);

  // Runner 1: Evan Beatty & Lasso in 8:00 AM block
  const i1 = items[0];
  assert.equal(i1.handler, "Evan Beatty");
  assert.equal(i1.field, "Field 2/3");
  assert.equal(i1.blockTime, "8:00 AM");
  assert.equal(i1.activity.kind, "run");
  if (i1.activity.kind === "run") {
    assert.equal(i1.activity.run.dog, "Lasso");
    assert.equal(i1.activity.run.ordinalInBlock, 1);
    assert.equal(i1.activity.run.totalInBlock, 10);
  }

  // Runner 4: Aaron Dagres & Yzma in 8:00 AM block
  const i4 = items[3];
  assert.equal(i4.handler, "Aaron Dagres");
  assert.equal(i4.blockTime, "8:00 AM");
  assert.equal(i4.activity.kind, "run");
  if (i4.activity.kind === "run") {
    assert.equal(i4.activity.run.dog, "Yzma");
    assert.equal(i4.activity.run.ordinalInBlock, 4);
  }

  // Runner 11: Kate Castiglia & Sailor resets to #1 in 8:30 AM block
  const i11 = items[10];
  assert.equal(i11.handler, "Kate Castiglia");
  assert.equal(i11.blockTime, "8:30 AM");
  assert.equal(i11.activity.kind, "run");
  if (i11.activity.kind === "run") {
    assert.equal(i11.activity.run.dog, "Sailor");
    assert.equal(i11.activity.run.ordinalInBlock, 1);
    assert.equal(i11.activity.run.totalInBlock, 10);
  }

  // Ordinal invariants for all runs
  items.forEach((item) => {
    if (item.activity.kind === "run") {
      assert.ok(item.activity.run.ordinalInBlock >= 1);
      assert.ok(item.activity.run.ordinalInBlock <= item.activity.run.totalInBlock);
    }
  });
});

test("NortheastClassicAdapter handles multi-field tables (Boom! Field 3 and Field 2)", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const boomTable = loadFixture("northeast/boom.json");

  const adapter = new NortheastClassicAdapter();
  const items = adapter.parseAll(masterTable, [{ id: "boom", table: boomTable }]);

  const fields = new Set(items.map((i) => i.field));
  assert.ok(fields.has("Field 3"), "Expected Field 3");
  assert.ok(fields.has("Field 2"), "Expected Field 2");
});

test("FallClassicAdapter parses Column 0 Time Blocks correctly in Far Out", () => {
  const farOutTable = loadFixture("fall_classic/far_out.json");

  const adapter = new FallClassicAdapter();
  const items = adapter.parseDogRuns([{ id: "fc_0", table: farOutTable }]);

  assert.ok(items.length >= 60, `Expected at least 60 items, got ${items.length}`);

  // Runner 1: Chandler Leiby & Maple in 8:00 AM block
  const i1 = items[0];
  assert.equal(i1.handler, "Chandler Leiby");
  assert.equal(i1.blockTime, "8:00 AM");
  assert.equal(i1.activity.kind, "run");
  if (i1.activity.kind === "run") {
    assert.equal(i1.activity.run.dog, "Maple");
    assert.equal(i1.activity.run.ordinalInBlock, 1);
    assert.equal(i1.activity.run.totalInBlock, 10);
  }

  // Runner 11: Bre Famoso & Finn-Again in 8:30 AM block
  const i11 = items[10];
  assert.equal(i11.handler, "Bre Famoso");
  assert.equal(i11.blockTime, "8:30 AM");
  assert.equal(i11.activity.kind, "run");
  if (i11.activity.kind === "run") {
    assert.equal(i11.activity.run.dog, "Finn-Again");
    assert.equal(i11.activity.run.ordinalInBlock, 1);
  }
});

test("FallClassicAdapter extracts volunteer shifts correctly", () => {
  const volTable = loadFixture("fall_classic/volunteers.json");

  const adapter = new FallClassicAdapter();
  const shifts = adapter.parseVolunteerShifts(volTable);

  assert.ok(shifts.length >= 100, `Expected at least 100 volunteer shifts, got ${shifts.length}`);

  // Check Abby House Line Judge shift
  const abbyShift = shifts.find((s) => s.handler === "Abby House" && s.game === "Spaced Out");
  assert.ok(abbyShift, "Expected Abby House volunteer shift in Spaced Out");
  assert.equal(abbyShift.activity.kind, "volunteer");
  if (abbyShift.activity.kind === "volunteer") {
    assert.equal(abbyShift.activity.shift.role, "Line Judge");
    assert.equal(abbyShift.activity.shift.timeWindow, "2:30-3:30");
  }
});

test("Contract schema enforcement: strict ScheduleItem composition", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const farOutTable = loadFixture("northeast/far_out.json");
  const fcFarOutTable = loadFixture("fall_classic/far_out.json");
  const fcVolTable = loadFixture("fall_classic/volunteers.json");

  const itemsNe = new NortheastClassicAdapter().parseAll(masterTable, [{ id: "farout", table: farOutTable }]);
  const itemsFcRuns = new FallClassicAdapter().parseDogRuns([{ id: "fc_0", table: fcFarOutTable }]);
  const itemsFcVol = new FallClassicAdapter().parseVolunteerShifts(fcVolTable);

  const expectedBaseKeys = new Set([
    "id",
    "handler",
    "game",
    "field",
    "day",
    "dayOrder",
    "blockTime",
    "blockMinutes",
    "activity"
  ]);

  [...itemsNe.slice(0, 5), ...itemsFcRuns.slice(0, 5), ...itemsFcVol.slice(0, 5)].forEach((item: ScheduleItem) => {
    const keys = Object.keys(item);
    assert.equal(keys.length, expectedBaseKeys.size, `Unexpected key count in item: ${JSON.stringify(keys)}`);
    keys.forEach((k) => assert.ok(expectedBaseKeys.has(k), `Unexpected key: ${k}`));

    if (item.activity.kind === "run") {
      const runKeys = Object.keys(item.activity.run);
      assert.deepEqual(runKeys.sort(), ["dog", "ordinalInBlock", "totalInBlock"]);
    } else if (item.activity.kind === "volunteer") {
      const shiftKeys = Object.keys(item.activity.shift);
      assert.deepEqual(shiftKeys.sort(), ["role", "timeWindow"]);
    }
  });
});
