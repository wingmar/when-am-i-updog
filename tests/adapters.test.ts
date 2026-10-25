import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { FallClassicAdapter } from "../src/adapters/fall_classic";
import { NortheastClassicAdapter } from "../src/adapters/northeast_classic";
import type { GVizTable, NormalizedRun } from "../src/types";

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

function loadFixture(relPath: string): GVizTable {
  const fullPath = path.join(FIXTURES_DIR, relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

test("NortheastClassicAdapter parses master grid and Far Out correctly", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const farOutTable = loadFixture("northeast/far_out.json");

  const adapter = new NortheastClassicAdapter();
  const runs = adapter.parseAll(masterTable, [{ id: "farout", table: farOutTable }]);

  assert.ok(runs.length >= 130, `Expected at least 130 runs, got ${runs.length}`);

  // Runner 1: Evan Beatty & Lasso in 8:00 AM block
  const r1 = runs[0];
  assert.equal(r1.handler, "Evan Beatty");
  assert.equal(r1.dog, "Lasso");
  assert.equal(r1.field, "Field 2/3");
  assert.equal(r1.blockTime, "8:00 AM");
  assert.equal(r1.ordinalInBlock, 1);
  assert.equal(r1.totalInBlock, 10);

  // Runner 4: Aaron Dagres & Yzma in 8:00 AM block
  const r4 = runs[3];
  assert.equal(r4.handler, "Aaron Dagres");
  assert.equal(r4.dog, "Yzma");
  assert.equal(r4.blockTime, "8:00 AM");
  assert.equal(r4.ordinalInBlock, 4);

  // Runner 11: Kate Castiglia & Sailor resets to #1 in 8:30 AM block
  const r11 = runs[10];
  assert.equal(r11.handler, "Kate Castiglia");
  assert.equal(r11.dog, "Sailor");
  assert.equal(r11.blockTime, "8:30 AM");
  assert.equal(r11.ordinalInBlock, 1);
  assert.equal(r11.totalInBlock, 10);

  // Ordinal invariants
  runs.forEach((r) => {
    assert.ok(r.ordinalInBlock >= 1, `Invalid ordinalInBlock: ${r.ordinalInBlock}`);
    assert.ok(r.ordinalInBlock <= r.totalInBlock, `ordinalInBlock ${r.ordinalInBlock} > totalInBlock ${r.totalInBlock}`);
  });
});

test("NortheastClassicAdapter handles multi-field tables (Boom! Field 3 and Field 2)", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const boomTable = loadFixture("northeast/boom.json");

  const adapter = new NortheastClassicAdapter();
  const runs = adapter.parseAll(masterTable, [{ id: "boom", table: boomTable }]);

  const fields = new Set(runs.map((r) => r.field));
  assert.ok(fields.has("Field 3"), "Expected Field 3");
  assert.ok(fields.has("Field 2"), "Expected Field 2");
});

test("FallClassicAdapter parses Column 0 Time Blocks correctly in Far Out", () => {
  const farOutTable = loadFixture("fall_classic/far_out.json");

  const adapter = new FallClassicAdapter();
  const runs = adapter.parseAll([{ id: "fc_0", table: farOutTable }]);

  assert.ok(runs.length >= 60, `Expected at least 60 runs, got ${runs.length}`);

  // Runner 1: Chandler Leiby & Maple in 8:00 AM block
  const r1 = runs[0];
  assert.equal(r1.handler, "Chandler Leiby");
  assert.equal(r1.dog, "Maple");
  assert.equal(r1.blockTime, "8:00 AM");
  assert.equal(r1.ordinalInBlock, 1);
  assert.equal(r1.totalInBlock, 10);

  // Runner 11: Bre Famoso & Finn-Again in 8:30 AM block
  const r11 = runs[10];
  assert.equal(r11.handler, "Bre Famoso");
  assert.equal(r11.dog, "Finn-Again");
  assert.equal(r11.blockTime, "8:30 AM");
  assert.equal(r11.ordinalInBlock, 1);

  // Filtered separator row check
  const handlers = runs.map((r) => r.handler.toLowerCase());
  assert.ok(!handlers.includes("do not start again until 8:30"), "Separator row was not filtered");

  // Invariants
  runs.forEach((r) => {
    assert.ok(r.ordinalInBlock >= 1);
    assert.ok(r.ordinalInBlock <= r.totalInBlock);
  });
});

test("Contract schema enforcement: strict NormalizedRun keys", () => {
  const masterTable = loadFixture("northeast/master_grid.json");
  const farOutTable = loadFixture("northeast/far_out.json");
  const fcFarOutTable = loadFixture("fall_classic/far_out.json");

  const runsNe = new NortheastClassicAdapter().parseAll(masterTable, [{ id: "farout", table: farOutTable }]);
  const runsFc = new FallClassicAdapter().parseAll([{ id: "fc_0", table: fcFarOutTable }]);

  const expectedKeys = new Set([
    "handler",
    "dog",
    "game",
    "field",
    "day",
    "dayOrder",
    "blockTime",
    "blockMinutes",
    "ordinalInBlock",
    "totalInBlock"
  ]);

  [...runsNe.slice(0, 5), ...runsFc.slice(0, 5)].forEach((run: NormalizedRun) => {
    const keys = Object.keys(run);
    assert.equal(keys.length, expectedKeys.size, `Unexpected key count in run: ${JSON.stringify(keys)}`);
    keys.forEach((k) => assert.ok(expectedKeys.has(k), `Unexpected key: ${k}`));
  });
});
