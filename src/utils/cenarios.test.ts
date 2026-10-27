import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FlowNetwork, addSuperTerminals, allCuts, antiparallelPairs, checkProperties, describeIteration, flowsAfter, fordFulkerson,
  splitAntiparallel,
} from "./fordFulkerson";
import type { Instance } from "@/types";

const load = (f: string): Instance => JSON.parse(readFileSync(new URL(`../../database/data/${f}.json`, import.meta.url), "utf-8"));
const solve = (inst: Instance) => fordFulkerson(FlowNetwork.fromInstance(inst), inst.source!, inst.sink!);

describe("cenários da enchente", () => {
  it.each([
    ["enchente_rs", 24],
    ["enchente_ponte_interditada", 15],
    ["enchente_rota_liberada", 27],
    ["enchente_abrigos_lotados", 19],
  ] as const)("%s: fluxo máximo %d igual ao menor corte da lista", (file, expected) => {
    const inst = load(file);
    expect(solve(inst).value).toBe(expected);
    expect(allCuts(inst, inst.source!, inst.sink!)![0].capacity).toBe(expected);
  });

  it("abrigos lotados: o gargalo passa a incluir os próprios abrigos", () => {
    const inst = load("enchente_abrigos_lotados");
    const cut = solve(inst).cut.edges.map((i) => inst.edges[i].to);
    expect(cut).toContain("T*");
  });

  it("3º passo: direto perde c, inverso ganha c; a seta de volta já existia quando é usada", () => {
    const inst = load("enchente_rs");
    const r = solve(inst);
    const c = r.iterations![0].bottleneck;
    const rows = describeIteration(inst, r.iterations!, 1);
    expect(rows.filter((x) => x.isBottleneck)).toHaveLength(1);
    for (const x of rows) {
      expect(x.after).toBe(x.before - c);
      expect(x.backAfter).toBe(x.backBefore + c);
      expect(x.created).toBe(true);
    }
    const k = r.iterations!.findIndex((it) => it.edges.some((e) => e.reverse)) + 1;
    expect(k).toBeGreaterThan(1);
    expect(describeIteration(inst, r.iterations!, k).find((x) => x.reverse)!.created).toBe(false);
  });

  it("capacidade e conservação valem no fluxo final", () => {
    const inst = load("enchente_rs");
    const r = solve(inst);
    const p = checkProperties(inst, flowsAfter(inst.edges.length, r.iterations!, r.numIterations), inst.source!, inst.sink!);
    expect(p).toEqual({ capacity: [], conservation: [] });
  });
});

describe("ajustes de modelo", () => {
  it("vértice auxiliar remove antiparalelas sem mudar o fluxo máximo", () => {
    const inst: Instance = { name: "x", source: "s", sink: "t", edges: [
      { from: "s", to: "a", capacity: 5 }, { from: "s", to: "b", capacity: 4 },
      { from: "a", to: "b", capacity: 3 }, { from: "b", to: "a", capacity: 2 },
      { from: "a", to: "t", capacity: 4 }, { from: "b", to: "t", capacity: 6 }] };
    expect(antiparallelPairs(inst)).toHaveLength(1);
    const split = splitAntiparallel(inst);
    expect(antiparallelPairs(split)).toHaveLength(0);
    expect(split.edges.length).toBe(inst.edges.length + 1);
    expect(solve(split).value).toBe(solve(inst).value);
  });

  it("super-origem liga várias fontes com capacidade infinita", () => {
    const base: Instance = { name: "x", edges: [
      { from: "F1", to: "A", capacity: 9 }, { from: "F2", to: "A", capacity: 4 }, { from: "A", to: "D", capacity: 20 }] };
    const inst = addSuperTerminals({ ...base, sink: "D" }, ["F1", "F2"], []);
    expect(inst.source).toBe("S*");
    expect(solve(inst).value).toBe(13);
  });
});
