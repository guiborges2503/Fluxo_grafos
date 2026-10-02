import type { Instance, Iteration, SolveResult } from "@/types";
import { toNumber } from "@/types";
import { fmt, fmtMs } from "@/utils/format";

interface Props {
  instance: Instance;
  step: number;
  local: SolveResult;
  server: SolveResult | null;
  diffs: string[];
  serverError: string | null;
}

export function StepPanel({ instance, step, local, server, diffs, serverError }: Props) {
  const n = local.numIterations;
  const it: Iteration | undefined = step >= 1 && step <= n ? local.iterations?.[step - 1] : undefined;
  const official = server ?? local;

  return (
    <aside className="step-panel">
      <div className="headline">
        <span className="headline-number">{fmt(official.value)}</span>
        <span className="headline-label">
          fluxo máximo de {String(official.source)} a {String(official.sink)}
          {instance.edges.some((e) => e.highway || e.artificial) ? " (veículos por hora)" : ""}
        </span>
      </div>

      <div className="step-detail">
        {step === 0 && <p>A rede começa sem fluxo. Avance para ver o primeiro caminho aumentante encontrado na rede residual.</p>}
        {it && <IterationDetail it={it} instance={instance} />}
        {step === n + 1 && (
          <>
            <h3>Resultado</h3>
            <p>
              Não há mais caminho da origem ao destino na rede residual, então o fluxo de {fmt(local.value)} é máximo.
              O corte mínimo, em vermelho no desenho, tem {local.cut.edges.length}{" "}
              {local.cut.edges.length === 1 ? "aresta" : "arestas"} e capacidade {fmt(local.cut.capacity)}, igual ao fluxo.
            </p>
          </>
        )}
      </div>

      <dl className="metrics">
        <div><dt>Estratégia</dt><dd>{official.strategy === "bfs" ? "Edmonds-Karp (BFS)" : "Ford-Fulkerson (DFS)"}</dd></div>
        <div><dt>Caminhos aumentantes</dt><dd>{fmt(official.numIterations)}</dd></div>
        <div><dt>Tempo no servidor PHP</dt><dd>{server ? fmtMs(server.elapsedMs) : "não executado"}</dd></div>
        <div><dt>Tempo no navegador</dt><dd>{fmtMs(local.elapsedMs)}</dd></div>
        <div><dt>Vértices visitados nas buscas</dt><dd>{fmt(official.verticesVisited)}</dd></div>
        <div><dt>Instância</dt><dd>{fmt(instance.vertices?.length ?? 0)} vértices, {fmt(instance.edges.length)} arestas</dd></div>
      </dl>

      <Consistency server={server} diffs={diffs} serverError={serverError} local={local} />
    </aside>
  );
}

function IterationDetail({ it, instance }: { it: Iteration; instance: Instance }) {
  const reversed = it.edges.filter((e) => e.reverse);
  return (
    <>
      <h3>Caminho aumentante {it.index}</h3>
      <ol className="path-chips" aria-label="Vértices do caminho">
        {it.vertices.map((v, j) => {
          const long = it.vertices.length > 14;
          if (long && j === 6) return <li key="gap" className="gap">{it.vertices.length - 12} vértices</li>;
          if (long && j > 6 && j < it.vertices.length - 6) return null;
          return <li key={j} className={j > 0 && it.edges[j - 1].reverse ? "via-reverse" : ""}>{String(v)}</li>;
        })}
      </ol>
      <p>
        O caminho tem {it.edges.length} {it.edges.length === 1 ? "aresta" : "arestas"} e gargalo {fmt(it.bottleneck)}:
        esse valor é somado ao fluxo, que passa a {fmt(it.flowAfter)}.
      </p>
      {reversed.length > 0 && (
        <p className="reverse-note">
          {reversed.length === 1 ? "Uma aresta é percorrida" : `${reversed.length} arestas são percorridas`} no sentido
          contrário (tracejado verde-azulado), cancelando fluxo enviado antes por{" "}
          {reversed.map((r) => `${String(instance.edges[r.edge].from)}→${String(instance.edges[r.edge].to)}`).join(", ")}.
        </p>
      )}
    </>
  );
}

function Consistency({ server, diffs, serverError, local }: { server: SolveResult | null; diffs: string[]; serverError: string | null; local: SolveResult }) {
  if (serverError) return <div className="notice warn">{serverError} O resultado mostrado foi calculado só no navegador.</div>;
  if (!server) return null;
  const problems = server.validation ?? [];
  return (
    <div className={`notice ${diffs.length || problems.length ? "warn" : "ok"}`}>
      {diffs.length === 0
        ? <p>Servidor PHP e navegador encontraram os mesmos {fmt(local.numIterations)} caminhos aumentantes e o mesmo fluxo de {fmt(toNumber(server.value))}.</p>
        : <p>{diffs.join(" ")}</p>}
      {problems.length === 0
        ? <p>Validação do servidor: capacidades respeitadas, fluxo conservado e corte mínimo igual ao fluxo.</p>
        : <p>Validação do servidor encontrou problemas: {problems.join(" ")}</p>}
    </div>
  );
}
