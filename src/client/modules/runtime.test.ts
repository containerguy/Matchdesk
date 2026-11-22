import { describe, expect, it } from "vitest";
import { moduleMenuEntries, resolveModuleMenuEntry } from "./runtime";
import type { RuntimeModuleInfo } from "./types";

function demoModule(menu: RuntimeModuleInfo["menu"]): RuntimeModuleInfo {
  return {
    id: "demo",
    version: "1.0.0",
    name: "Demo",
    clientUrl: "/modules/demo/1.0.0/client.mjs",
    adminPage: false,
    permissions: [],
    menu,
    i18n: { de: {}, en: {} }
  };
}

describe("moduleMenuEntries", () => {
  it("baut Slugs unter mitmachen/<id>[/<pfad>] und sortiert nach order", () => {
    const infos = [
      demoModule([
        { path: "liste", label: "Liste", icon: null, order: 41 },
        { path: "", label: "Demo", icon: null, order: 40 }
      ])
    ];
    expect(moduleMenuEntries(infos).map((candidate) => [candidate.slug, candidate.entry.order])).toEqual([
      ["demo", 40],
      ["demo/liste", 41]
    ]);
  });

  it("ist leer ohne aktive Module", () => {
    expect(moduleMenuEntries([])).toEqual([]);
  });

  it("trennt Einträge nach Sammelseite: ohne Angabe Mitmachen, sonst Spiele", () => {
    const infos = [
      demoModule([
        { path: "", label: "Demo", icon: null, order: 40 },
        { path: "billard", label: "Billard", icon: null, order: 10, section: "games" }
      ])
    ];
    expect(moduleMenuEntries(infos).map((candidate) => candidate.slug)).toEqual(["demo"]);
    expect(moduleMenuEntries(infos, "games").map((candidate) => candidate.slug)).toEqual(["demo/billard"]);
    expect(resolveModuleMenuEntry(infos, "demo/billard/match/7", "games")).toMatchObject({ innerSubPath: "match/7" });
    expect(resolveModuleMenuEntry(infos, "demo/billard")).toMatchObject({ match: { slug: "demo" }, innerSubPath: "billard" });
  });
});

describe("resolveModuleMenuEntry", () => {
  const infos = [
    demoModule([
      { path: "", label: "Demo", icon: null, order: 40 },
      { path: "verwaltung", label: "Verwaltung", icon: null, order: 41 }
    ])
  ];

  it("findet den Basis-Eintrag ohne Unterpfad", () => {
    expect(resolveModuleMenuEntry(infos, "demo")).toMatchObject({ innerSubPath: "" });
  });

  it("gibt eigene Unterpfade des Basis-Eintrags ans Modul weiter, auch wenn sie wie ein weiterer Menüpunkt aussehen", () => {
    const resolved = resolveModuleMenuEntry(infos, "demo/liste/7");
    expect(resolved?.match.slug).toBe("demo");
    expect(resolved?.innerSubPath).toBe("liste/7");
  });

  it("wählt den längeren Treffer, wenn ein zweiter Menüpunkt existiert", () => {
    const resolved = resolveModuleMenuEntry(infos, "demo/verwaltung/x");
    expect(resolved?.match.slug).toBe("demo/verwaltung");
    expect(resolved?.innerSubPath).toBe("x");
  });

  it("findet nichts außerhalb der registrierten Module", () => {
    expect(resolveModuleMenuEntry(infos, "andere")).toBeUndefined();
    expect(resolveModuleMenuEntry([], "demo")).toBeUndefined();
  });
});
