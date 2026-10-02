import { useMemo, useState } from "react";
import type { Instance, InstanceSummary, Label, Strategy } from "@/types";
import { fmt } from "@/utils/format";

interface Props {
  instances: InstanceSummary[];
  currentFile: string | null;
  instance: Instance | null;
  serverOnline: boolean;
  source?: Label;
  sink?: Label;
  strategy: Strategy;
  busy: boolean;
  onPick: (file: string) => void;
  onUpload: (inst: Instance) => void;
  onGenerate: (params: Record<string, string | number>) => void;
  onNew: () => void;
  onSource: (v: Label) => void;
  onSink: (v: Label) => void;
  onStrategy: (s: Strategy) => void;
  onRun: (where: "servidor" | "navegador") => void;
  onDelete: (file: string) => void;
}

export function Sidebar(p: Props) {
  const [genType, setGenType] = useState<"grid" | "random">("grid");
  const [gen, setGen] = useState({ rows: 10, cols: 14, avenueEvery: 3, n: 200, degree: 3, maxCapacity: 100, seed: 1 });
  const [uploadError, setUploadError] = useState<string | null>(null);

  const vertexIds = useMemo(() => {
    if (!p.instance) return [] as Label[];
    const ids = new Map<string, Label>();
    (p.instance.vertices ?? []).forEach((v) => ids.set(String(v.id), v.id));
    p.instance.edges.forEach((e) => { ids.set(String(e.from), e.from); ids.set(String(e.to), e.to); });
    return [...ids.values()];
  }, [p.instance]);

  const upload = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.edges)) throw new Error("o arquivo não tem a lista \"edges\"");
      setUploadError(null);
      p.onUpload({ name: file.name.replace(/\.json$/i, ""), ...data });
    } catch (e) {
      setUploadError(`Não foi possível ler ${file.name}: ${(e as Error).message}.`);
    }
  };

  const num = (k: keyof typeof gen, label: string, min: number, max: number) => (
    <label>{label}
      <input type="number" min={min} max={max} value={gen[k]} onChange={(e) => setGen({ ...gen, [k]: Number(e.target.value) })} />
    </label>
  );

  const pickTerminal = (value: string) => vertexIds.find((v) => String(v) === value) ?? value;

  return (
    <nav className="sidebar" aria-label="Dados e execução">
      <header className="brand">
        <h1>Capacidade de evacuação</h1>
        <p>Fluxo máximo pela malha viária com Ford-Fulkerson</p>
      </header>

      <section>
        <h2>Instância</h2>
        {!p.serverOnline && <p className="notice warn">Servidor PHP fora do ar. Carregue um arquivo JSON para trabalhar só no navegador.</p>}
        <ul className="instance-list">
          {p.instances.map((i) => (
            <li key={i.file} className={p.currentFile === i.file ? "on" : ""}>
              <button onClick={() => p.onPick(i.file)} title={i.description}>
                <span className="inst-name">{i.name}</span>
                <span className="inst-size">{fmt(i.vertices)} vértices, {fmt(i.edges)} arestas{i.geo ? ", mapa" : ""}</span>
              </button>
              <button className="link small" onClick={() => { if (confirm(`Excluir a instância ${i.name} do servidor?`)) p.onDelete(i.file); }}
                aria-label={`Excluir ${i.name}`}>Excluir</button>
            </li>
          ))}
        </ul>
        <div className="row">
          <label className="button-like">
            Carregar arquivo JSON
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <button onClick={p.onNew}>Nova instância vazia</button>
        </div>
        {uploadError && <p className="error">{uploadError}</p>}
      </section>

      <section>
        <h2>Gerar instância</h2>
        <div className="segmented" role="radiogroup" aria-label="Tipo de instância gerada">
          <button role="radio" aria-checked={genType === "grid"} className={genType === "grid" ? "on" : ""} onClick={() => setGenType("grid")}>Malha viária</button>
          <button role="radio" aria-checked={genType === "random"} className={genType === "random" ? "on" : ""} onClick={() => setGenType("random")}>Grafo aleatório</button>
        </div>
        <div className="fields">
          {genType === "grid" ? (<>{num("rows", "Linhas", 2, 200)}{num("cols", "Colunas", 2, 200)}{num("avenueEvery", "Avenida a cada", 0, 50)}</>)
            : (<>{num("n", "Vértices", 2, 50000)}{num("degree", "Grau de saída", 1, 20)}{num("maxCapacity", "Capacidade máxima", 1, 1e6)}</>)}
          {num("seed", "Semente", 0, 1e9)}
        </div>
        <button onClick={() => p.onGenerate({ type: genType, ...gen })} disabled={!p.serverOnline}>Gerar</button>
      </section>

      <section>
        <h2>Execução</h2>
        {p.instance ? (
          <>
            <div className="fields">
              <label>Origem
                <select value={p.source !== undefined ? String(p.source) : ""} onChange={(e) => p.onSource(pickTerminal(e.target.value))}>
                  <option value="" disabled>escolha</option>
                  {vertexIds.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                </select>
              </label>
              <label>Destino
                <select value={p.sink !== undefined ? String(p.sink) : ""} onChange={(e) => p.onSink(pickTerminal(e.target.value))}>
                  <option value="" disabled>escolha</option>
                  {vertexIds.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                </select>
              </label>
            </div>
            <div className="segmented" role="radiogroup" aria-label="Busca do caminho aumentante">
              <button role="radio" aria-checked={p.strategy === "dfs"} className={p.strategy === "dfs" ? "on" : ""} onClick={() => p.onStrategy("dfs")}>DFS clássica</button>
              <button role="radio" aria-checked={p.strategy === "bfs"} className={p.strategy === "bfs" ? "on" : ""} onClick={() => p.onStrategy("bfs")}>Edmonds-Karp</button>
            </div>
            <button className="primary run" disabled={p.busy || p.source === undefined || p.sink === undefined}
              onClick={() => p.onRun(p.serverOnline ? "servidor" : "navegador")}>
              {p.busy ? "Calculando…" : "Calcular fluxo máximo"}
            </button>
            {p.serverOnline && (
              <button className="link" onClick={() => p.onRun("navegador")} disabled={p.busy}>Calcular só no navegador</button>
            )}
          </>
        ) : <p className="muted">Escolha, carregue ou gere uma instância para começar.</p>}
      </section>
    </nav>
  );
}
