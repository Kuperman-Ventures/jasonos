import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadResortCatalog, parseResortCatalog } from "./catalog.ts";

describe("loadResortCatalog", () => {
  it("loads the empty checked-in catalog", () => {
    const catalog = loadResortCatalog();
    assert.equal(catalog.version, 1);
    assert.equal(catalog.updatedAt, null);
    assert.deepEqual(catalog.resorts, []);
  });
});

describe("parseResortCatalog", () => {
  it("accepts a mountain with drive time and source links", () => {
    const catalog = parseResortCatalog({
      version: 1,
      updatedAt: "2026-10-10",
      resorts: [
        {
          id: "mountain-creek",
          slug: "mountain-creek",
          name: "Mountain Creek",
          pass: "independent",
          driveMinutes: 45,
          overnight: false,
          twoHour: true,
          christmasOpen: true,
          latitude: 41.181,
          longitude: -74.513,
          sourceLinks: {
            snowReport: "https://www.mountaincreek.com/snow-report",
          },
        },
      ],
    });
    assert.equal(catalog.resorts.length, 1);
    assert.equal(catalog.resorts[0]?.name, "Mountain Creek");
    assert.equal(catalog.resorts[0]?.driveMinutes, 45);
    assert.equal(
      catalog.resorts[0]?.sourceLinks.snowReport,
      "https://www.mountaincreek.com/snow-report"
    );
  });

  it("rejects a bad pass type", () => {
    assert.throws(
      () =>
        parseResortCatalog({
          version: 1,
          updatedAt: null,
          resorts: [
            {
              id: "x",
              slug: "x",
              name: "X",
              pass: "ikon",
            },
          ],
        }),
      /epic or independent/
    );
  });
});
