import { useMemo } from "react";
import { type Instance, type Label, toNumber } from "@/types";
import { ALL_CUTS_MAX_VERTICES, type Cut, allCuts } from "@/utils/fordFulkerson";
import { fmt } from "@/utils/format";

const MAX_ROWS = 60;

interface Props {
  instance: Instance;
  source?: Label;
  sink?: Label;
  /** fluxo máximo calculado (para marcar os cortes de mesma capacidade) */
  maxFlow: number | null;
  selected: Cut | null;
  onSelect: (cut: Cut | null) => void;
}

/**
 * Todos os cortes (S,T) da rede: S contém a origem, T contém o destino
 * e a capacidade é a soma das arestas que vão de S para T. O menor deles é o corte mínimo.
 */
export function CutsTable({ instance, source, sink, maxFlow, selected, onSelect }: Props) {
  const cuts = useMemo(
    () => (source !== undefined && sink !== undefined ? allCuts(instance, source, sink) : null),
    [instance, source, sink],
  );

  if (source === undefined || sink === undefined) return <p className="muted">Escolha a origem e o destino para listar os cortes.</p>;
  if (!cuts) {
    return (
      <p className="muted">
        A lista de todos os cortes só é montada para redes de até {ALL_CUTS_MAX_VERTICES} vértices, porque são 2<sup>n−2</sup> possibilidades.
        Para esta rede, o corte mínimo aparece no painel ao lado, no passo "Resultado".
      </p>
    );
  }

  const min = cuts[0]?.capacity ?? 0;
  const label = (c: Cut) => c.sourceSide.map(String).join(",");
  const edgeList = (c: Cut) =>
    c.edges.map((i) => `${String(instance.edges[i].from)}→${String(instance.edges[i].to)} (${fmt(toNumber(instance.edges[i].capacity))})`).join(" + ");

  return (
    <div className="cuts">
      <p className="muted">
        {fmt(cuts.length)} cortes possíveis, do menor para o maior. Clique em um corte para ver as arestas dele no desenho.
        {maxFlow !== null && ` O menor tem capacidade ${fmt(min)}, igual ao fluxo máximo de ${fmt(maxFlow)}.`}
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>S</th><th>T</th><th>Arestas de S para T</th><th className="num">c(S,T)</th><th /></tr>
          </thead>
          <tbody>
            {cuts.slice(0, MAX_ROWS).map((c) => {
              const isSel = selected !== null && label(selected) === label(c);
              return (
                <tr key={label(c)} className={`clickable${isSel ? " row-path" : ""}${c.capacity === min ? " row-cut" : ""}`}
                  onClick={() => onSelect(isSel ? null : c)}>
                  <td>{`{${c.sourceSide.map(String).join(", ")}}`}</td>
                  <td>{`{${c.sinkSide.map(String).join(", ")}}`}</td>
                  <td className="wrap">{edgeList(c) || "nenhuma"}</td>
                  <td className="num"><b>{fmt(c.capacity)}</b></td>
                  <td>{c.capacity === min ? "mínimo" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cuts.length > MAX_ROWS && <p className="muted">Mostrando os {MAX_ROWS} menores de {fmt(cuts.length)}.</p>}
      </div>
    </div>
  );
}
