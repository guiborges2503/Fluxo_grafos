import { useMemo, useState } from "react";
import { type Instance, toNumber } from "@/types";
import { fmt } from "@/utils/format";

type Filter = "todas" | "com-fluxo" | "saturadas" | "corte";
const MAX_ROWS = 400;

interface Props {
  instance: Instance;
  flows: Float64Array;
  /** arestas do corte mínimo final (usadas no filtro) */
  cutEdges: Set<number>;
  /** destacar as linhas do corte (só no passo de resultado) */
  highlightCut: boolean;
  pathEdges: Set<number>;
}

/** Capacidade e fluxo de cada aresta no passo mostrado, com filtro e ordenação. */
export function FlowTable({ instance, flows, cutEdges, highlightCut, pathEdges }: Props) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [sortByUse, setSortByUse] = useState(false);
  const hasNames = instance.edges.some((e) => e.name);

  const rows = useMemo(() => {
    let r = instance.edges.map((e, i) => {
      const c = toNumber(e.capacity);
      const f = flows[i];
      return { i, e, c, f, util: Number.isFinite(c) && c > 0 ? f / c : 0 };
    });
    if (filter === "com-fluxo") r = r.filter((x) => x.f > 1e-9);
    if (filter === "saturadas") r = r.filter((x) => x.util >= 1 - 1e-9);
    if (filter === "corte") r = r.filter((x) => cutEdges.has(x.i));
    if (sortByUse) r = [...r].sort((a, b) => b.util - a.util || b.f - a.f);
    return r;
  }, [instance, flows, filter, sortByUse, cutEdges]);

  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div className="flow-table">
      <div className="table-tools">
        <div className="segmented" role="radiogroup" aria-label="Filtrar arestas">
          {([["todas", "Todas"], ["com-fluxo", "Com fluxo"], ["saturadas", "Saturadas"], ["corte", "No corte mínimo"]] as const).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={sortByUse} onChange={(e) => setSortByUse(e.target.checked)} /> Ordenar por uso da capacidade
        </label>
        <span className="muted">{fmt(rows.length)} {rows.length === 1 ? "aresta" : "arestas"}</span>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>De</th><th>Para</th>{hasNames && <th>Via</th>}
              <th className="num">Fluxo</th><th className="num">Capacidade</th><th>Uso</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ i, e, c, f, util }) => (
              <tr key={i} className={highlightCut && cutEdges.has(i) ? "row-cut" : pathEdges.has(i) ? "row-path" : ""}>
                <td className="muted">{i}</td>
                <td>{String(e.from)}</td>
                <td>{String(e.to)}</td>
                {hasNames && <td>{e.name || e.highway || (e.artificial ? "ligação artificial" : "")}</td>}
                <td className="num">{fmt(f)}</td>
                <td className="num">{fmt(c)}</td>
                <td><span className="usebar" title={`${Math.round(util * 100)}%`}><span style={{ width: `${Math.min(100, util * 100)}%` }} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > MAX_ROWS && <p className="muted">Mostrando as primeiras {MAX_ROWS} de {fmt(rows.length)}. Use os filtros para focar nos gargalos.</p>}
      </div>
    </div>
  );
}
