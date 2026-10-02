/**
 * Posições dos vértices para desenho, sem depender de serviços externos (funciona offline):
 *   - instâncias do OSM (lat/lon): projeção equiretangular simples
 *   - instâncias com x/y (malhas geradas): posição direta
 *   - demais: camadas pela distância (BFS) a partir da origem, da esquerda para a direita
 */

import type { Instance, Label } from "@/types";

export type Positions = Map<string, { x: number; y: number }>;
export type LayoutKind = "geo" | "xy" | "camadas";

export const isArtificialVertex = (id: Label) => id === "S*" || id === "T*";

export function computeLayout(inst: Instance, source?: Label): { kind: LayoutKind; positions: Positions } {
  const vs = inst.vertices ?? [];
  const pos: Positions = new Map();

  const geo = vs.filter((v) => typeof v.lat === "number" && typeof v.lon === "number");
  if (geo.length > vs.length / 2) {
    const lat0 = geo.reduce((a, v) => a + v.lat!, 0) / geo.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    // 1 grau de latitude ~ 111 km; escala para ~1 px a cada 2 m
    for (const v of geo) pos.set(String(v.id), { x: v.lon! * k * 55_500, y: -v.lat! * 55_500 });
    return { kind: "geo", positions: pos };
  }

  const xy = vs.filter((v) => typeof v.x === "number" && typeof v.y === "number");
  if (xy.length > vs.length / 2) {
    for (const v of xy) pos.set(String(v.id), { x: v.x! * 90, y: v.y! * 90 });
    return { kind: "xy", positions: pos };
  }

  // Camadas por BFS a partir da origem
  const ids = new Set<string>(vs.map((v) => String(v.id)));
  const out = new Map<string, string[]>();
  for (const e of inst.edges) {
    ids.add(String(e.from));
    ids.add(String(e.to));
    const k = String(e.from);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(String(e.to));
  }
  const level = new Map<string, number>();
  const start = source !== undefined ? String(source) : [...ids][0];
  if (start !== undefined) {
    level.set(start, 0);
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      for (const w of out.get(q[h]) ?? []) {
        if (!level.has(w)) {
          level.set(w, level.get(q[h])! + 1);
          q.push(w);
        }
      }
    }
  }
  const maxLevel = Math.max(0, ...level.values());
  // destino sempre na última coluna; não alcançáveis numa coluna extra
  if (inst.sink !== undefined && level.has(String(inst.sink))) level.set(String(inst.sink), maxLevel + 1);
  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const l = level.get(id) ?? maxLevel + 2;
    if (!columns.has(l)) columns.set(l, []);
    columns.get(l)!.push(id);
  }
  const gapX = 170;
  const gapY = ids.size > 60 ? 40 : 110;
  for (const [l, col] of columns) {
    col.forEach((id, i) => pos.set(id, { x: l * gapX, y: (i - (col.length - 1) / 2) * gapY }));
  }
  return { kind: "camadas", positions: pos };
}
