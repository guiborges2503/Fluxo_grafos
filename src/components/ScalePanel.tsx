import { useState } from "react";
import { api, ServerOfflineError } from "@/config/api";
import type { Instance, InstanceSummary, SolveResult } from "@/types";
import { FlowNetwork, fordFulkerson } from "@/utils/fordFulkerson";
import { fmt, fmtMs } from "@/utils/format";

/** Até este tamanho a rede ainda cabe no desenho do passo a passo. */
export const STEP_MAX_EDGES = 200;

interface Row {
  key: number;
  instance: Instance;
  file: string | null;
  vertices: number;
  edges: number;
  dfs: SolveResult | null;
  bfs: SolveResult | null;
  browser: SolveResult;
  problems: string[];
}

interface Props {
  instances: InstanceSummary[];
  serverOnline: boolean;
  onOpen: (instance: Instance, file: string | null) => void;
}

/**
 * Testes em escala: roda o Ford-Fulkerson sem animação em redes grandes demais para resolver à mão
 * e mostra valor, iterações, tempo e a verificação automática do resultado.
 * A mesma rede é resolvida no servidor com busca em profundidade (método do projeto) e com busca
 * em largura (só para comparar o número de iterações), e também no navegador.
 */
export function ScalePanel({ instances, serverOnline, onOpen }: Props) {
  const [file, setFile] = useState("");
  const [kind, setKind] = useState<"grid" | "random">("grid");
  const [params, setParams] = useState({ rows: 30, cols: 40, avenueEvery: 3, n: 1000, degree: 4, maxCapacity: 100, seed: 1 });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (inst: Instance, fromFile: string | null) => {
    if (inst.source === undefined || inst.sink === undefined) throw new Error("A rede precisa de origem e destino.");
    const browser = fordFulkerson(FlowNetwork.fromInstance(inst), inst.source, inst.sink, false);
    let dfs: SolveResult | null = null;
    let bfs: SolveResult | null = null;
    try {
      dfs = await api.solve(inst, inst.source, inst.sink, false, "dfs");
      bfs = await api.solve(inst, inst.source, inst.sink, false, "bfs");
    } catch (e) {
      if (!(e instanceof ServerOfflineError)) throw e;
    }
    const problems = [...(dfs?.validation ?? []), ...(bfs?.validation ?? [])];
    if (dfs && Math.abs(dfs.value - browser.value) > 1e-6) problems.push("PHP e navegador chegaram a valores diferentes.");
    if (bfs && dfs && Math.abs(dfs.value - bfs.value) > 1e-6) problems.push("Busca em largura chegou a outro valor.");
    if (browser.cut.capacity !== browser.value) problems.push("Corte mínimo diferente do fluxo.");
    const vertices = new Set<string>();
    inst.edges.forEach((e) => { vertices.add(String(e.from)); vertices.add(String(e.to)); });
    setRows((old) => [{ key: Date.now(), instance: inst, file: fromFile, vertices: vertices.size, edges: inst.edges.length, dfs, bfs, browser, problems }, ...old]);
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const runSaved = () => guard(async () => { if (file) await run(await api.getInstance(file), file); });
  const runGenerated = () => guard(async () => {
    const p: Record<string, string | number> = kind === "grid"
      ? { type: "grid", rows: params.rows, cols: params.cols, avenueEvery: params.avenueEvery, seed: params.seed }
      : { type: "random", n: params.n, degree: params.degree, maxCapacity: params.maxCapacity, seed: params.seed };
    await run(await api.generate(p), null);
  });

  const num = (k: keyof typeof params, label: string, min: number, max: number) => (
    <label className="check">
      {label}
      <input type="number" className="cap-input" min={min} max={max} value={params[k]}
        onChange={(e) => setParams({ ...params, [k]: Number(e.target.value) })} />
    </label>
  );

  const sorted = [...instances].sort((a, b) => a.edges - b.edges);

  return (
    <main className="scale">
      <h2>Testes em escala</h2>
      <p className="muted">
        Redes grandes demais para resolver à mão. Aqui o Ford-Fulkerson roda sem animação e a tela mostra o fluxo máximo,
        o número de iterações, o tempo e a conferência automática (capacidade, conservação e fluxo = corte mínimo).
        A coluna "busca em largura" usa o mesmo método escolhendo sempre o caminho mais curto, só para comparar o número de iterações.
      </p>

      {!serverOnline && <div className="notice warn">Sem o servidor PHP, só dá para gerar redes e ver os tempos do servidor com <code>npm run dev</code> rodando.</div>}

      <div className="scale-forms">
        <fieldset>
          <legend>Rede salva</legend>
          <div className="table-tools">
            <select value={file} onChange={(e) => setFile(e.target.value)} disabled={!serverOnline}>
              <option value="">Escolha…</option>
              {sorted.map((i) => (
                <option key={i.file} value={i.file}>{i.name} — {fmt(i.vertices)} vértices, {fmt(i.edges)} arestas</option>
              ))}
            </select>
            <button className="primary" onClick={runSaved} disabled={busy || !file}>Rodar</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Gerar rede nova</legend>
          <div className="table-tools">
            <select value={kind} onChange={(e) => setKind(e.target.value as "grid" | "random")}>
              <option value="grid">Malha viária (ruas de mão dupla)</option>
              <option value="random">Grafo aleatório</option>
            </select>
            {kind === "grid" ? (
              <>{num("rows", "Linhas", 2, 200)}{num("cols", "Colunas", 2, 200)}{num("avenueEvery", "Avenida a cada", 0, 50)}</>
            ) : (
              <>{num("n", "Vértices", 2, 50000)}{num("degree", "Grau de saída", 1, 20)}{num("maxCapacity", "Capacidade máx.", 1, 100000)}</>
            )}
            {num("seed", "Semente", 1, 99999)}
            <button className="primary" onClick={runGenerated} disabled={busy || !serverOnline}>Gerar e rodar</button>
          </div>
        </fieldset>
      </div>

      {busy && <p className="muted">Calculando…</p>}
      {error && <div className="notice error-banner" role="alert">{error}</div>}

      {rows.length > 0 && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Rede</th><th className="num">Vértices</th><th className="num">Arestas</th><th className="num">Fluxo máximo</th>
                <th className="num">Iterações</th><th className="num">Tempo PHP</th>
                <th className="num">Iterações (busca em largura)</th><th className="num">Tempo (busca em largura)</th>
                <th className="num">Tempo navegador</th><th>Conferência</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.instance.name}</td>
                  <td className="num">{fmt(r.vertices)}</td>
                  <td className="num">{fmt(r.edges)}</td>
                  <td className="num"><b>{fmt(r.browser.value)}</b>{r.instance.unit ? ` ${r.instance.unit}` : ""}</td>
                  <td className="num">{fmt(r.browser.numIterations)}</td>
                  <td className="num">{r.dfs ? fmtMs(r.dfs.elapsedMs) : "—"}</td>
                  <td className="num">{r.bfs ? fmt(r.bfs.numIterations) : "—"}</td>
                  <td className="num">{r.bfs ? fmtMs(r.bfs.elapsedMs) : "—"}</td>
                  <td className="num">{fmtMs(r.browser.elapsedMs)}</td>
                  <td>
                    <ul className="checks">
                      <li className={r.problems.length ? "bad" : ""}>{r.problems.length ? r.problems.join(" ") : "correto"}</li>
                    </ul>
                  </td>
                  <td>
                    {r.edges <= STEP_MAX_EDGES
                      ? <button className="small" onClick={() => onOpen(r.instance, r.file)}>Ver passo a passo</button>
                      : <span className="muted small">grande demais para desenhar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
