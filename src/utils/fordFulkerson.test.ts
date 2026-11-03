import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FlowNetwork, UnboundedFlowError, flowsAfter, fordFulkerson, residualEdges } from "./fordFulkerson";
import type { Instance } from "@/types";

const load = (f: string): Instance => JSON.parse(readFileSync(new URL(`../../database/data/${f}.json`, import.meta.url), "utf-8"));
const solve = (inst: Instance) => fordFulkerson(FlowNetwork.fromInstance(inst), inst.source!, inst.sink!);

describe("Ford-Fulkerson (TypeScript)", () => {
  it("Cormen dá 23", () => {
    const r = solve(load("cormen"));
    expect(r.value).toBe(23);
    expect(r.cut.capacity).toBe(23);
  });

  it("mesmos caminhos que o PHP no exemplo do Cormen", () => {
    const r = solve(load("cormen"));
    expect(r.iterations!.map((i) => i.vertices.join(">"))).toEqual([
      "s>v1>v3>v2>v4>t", "s>v1>v3>t", "s>v2>v3>t", "s>v2>v4>v3>t",
    ]);
    expect(r.iterations![2].edges[1].reverse).toBe(true);
  });

  it("sem caminho dá zero", () => {
    const r = solve(load("sem_caminho"));
    expect(r.value).toBe(0);
    expect(r.numIterations).toBe(0);
  });

  it("detecta fluxo ilimitado", () => {
    const inst: Instance = { name: "x", source: "s", sink: "t", edges: [
      { from: "s", to: "a", capacity: "inf" }, { from: "a", to: "t", capacity: "inf" }] };
    expect(() => solve(inst)).toThrow(UnboundedFlowError);
  });

  it("origem igual ao destino é rejeitada", () => {
    const inst = load("cormen");
    expect(() => fordFulkerson(FlowNetwork.fromInstance(inst), "s", "s")).toThrow();
  });

  it("reconstrução passo a passo bate com o estado final", () => {
    const inst = load("cormen");
    const r = solve(inst);
    const f = flowsAfter(inst.edges.length, r.iterations!, r.numIterations);
    expect(Array.from(f)).toEqual(r.edgeFlows.map((e) => e.flow));
    const res0 = residualEdges(inst, flowsAfter(inst.edges.length, r.iterations!, 0));
    expect(res0.every((e) => !e.reverse)).toBe(true);
    const resEnd = residualEdges(inst, f);
    expect(resEnd.some((e) => e.reverse)).toBe(true);
  });

  it.each(readdirSync(new URL("../../database/data/", import.meta.url)).filter((f) => f.endsWith(".json")))(
    "fluxo de %s igual à capacidade do corte mínimo", (file) => {
      const r = solve(load(file.replace(".json", "")));
      expect(r.cut.capacity).toBe(r.value);
    });
});
