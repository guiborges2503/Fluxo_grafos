import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ServerOfflineError } from "@/config/api";
import { Editor } from "@/components/Editor";
import { FlowTable } from "@/components/FlowTable";
import { GraphView, RESIDUAL_MAX_EDGES, type ViewMode } from "@/components/GraphView";
import { Sidebar } from "@/components/Sidebar";
import { StepPanel } from "@/components/StepPanel";
import { Timeline } from "@/components/Timeline";
import { FlowNetwork, compareResults, flowsAfter, fordFulkerson } from "@/utils/fordFulkerson";
import type { Instance, InstanceSummary, Label, SolveResult, Strategy } from "@/types";

/** Acima disso o servidor não devolve os caminhos (resposta muito grande); o navegador continua registrando. */
const SERVER_RECORD_MAX_EDGES = 15000;

export default function HomePage() {
  const [serverOnline, setServerOnline] = useState(false);
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [source, setSource] = useState<Label | undefined>();
  const [sink, setSink] = useState<Label | undefined>();
  const [strategy, setStrategy] = useState<Strategy>("dfs");

  const [local, setLocal] = useState<SolveResult | null>(null);
  const [server, setServer] = useState<SolveResult | null>(null);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ViewMode>("rede");
  const [tab, setTab] = useState<"fluxos" | "editar">("fluxos");

  /* ---------------- carga inicial ---------------- */
  const refreshList = useCallback(async () => {
    try {
      await api.health();
      setServerOnline(true);
      setInstances(await api.listInstances());
    } catch (e) {
      setServerOnline(false);
      if (!(e instanceof ServerOfflineError)) setError((e as Error).message);
    }
  }, []);
  useEffect(() => { refreshList(); }, [refreshList]);

  const clearResults = () => { setLocal(null); setServer(null); setDiffs([]); setServerError(null); setStep(0); };

  const applyInstance = (inst: Instance, file: string | null) => {
    setInstance(inst);
    setCurrentFile(file);
    setSource(inst.source);
    setSink(inst.sink);
    setError(null);
    clearResults();
  };

  /* ---------------- ações ---------------- */
  const pick = async (file: string) => {
    try { applyInstance(await api.getInstance(file), file); } catch (e) { setError((e as Error).message); }
  };

  const generate = async (params: Record<string, string | number>) => {
    try { applyInstance(await api.generate(params), null); } catch (e) { setError((e as Error).message); }
  };

  const save = async () => {
    if (!instance) return;
    setSaving(true);
    try {
      const { file } = await api.saveInstance({ ...instance, source, sink });
      setCurrentFile(file);
      await refreshList();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const remove = async (file: string) => {
    try {
      await api.deleteInstance(file);
      if (file === currentFile) setCurrentFile(null);
      await refreshList();
    } catch (e) { setError((e as Error).message); }
  };

  const edit = (inst: Instance) => { setInstance(inst); clearResults(); };

  const run = async (where: "servidor" | "navegador") => {
    if (!instance || source === undefined || sink === undefined) return;
    setBusy(true);
    setError(null);
    clearResults();
    await new Promise((r) => setTimeout(r, 0)); // deixa a interface mostrar "Calculando…"
    const inst = { ...instance, source, sink };

    let localResult: SolveResult;
    try {
      localResult = fordFulkerson(FlowNetwork.fromInstance(inst), source, sink, strategy, true);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return;
    }

    if (where === "servidor") {
      try {
        const s = await api.solve(inst, source, sink, strategy, inst.edges.length <= SERVER_RECORD_MAX_EDGES);
        setServer(s);
        setDiffs(compareResults(s, localResult));
      } catch (e) {
        setServerError((e as Error).message);
        if (e instanceof ServerOfflineError) setServerOnline(false);
      }
    }
    setLocal(localResult);
    setStep(0);
    setBusy(false);
  };

  /* ---------------- estado do passo ---------------- */
  const m = instance?.edges.length ?? 0;
  const n = local?.numIterations ?? 0;
  const iters = local?.iterations ?? [];
  const zero = useMemo(() => new Float64Array(m), [m, instance]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    if (!local) return { flows: zero, residualFlows: zero, path: null, cut: null };
    if (step === 0) return { flows: zero, residualFlows: zero, path: null, cut: null };
    if (step <= n) {
      return {
        flows: flowsAfter(m, iters, step),
        residualFlows: flowsAfter(m, iters, step - 1),
        path: iters[step - 1].edges,
        cut: null,
      };
    }
    const final = flowsAfter(m, iters, n);
    return { flows: final, residualFlows: final, path: null, cut: new Set(local.cut.edges) };
  }, [local, step, n, m, iters, zero]);

  const pathSet = useMemo(() => new Set(view.path?.map((p) => p.edge) ?? []), [view.path]);
  const cutSet = useMemo(() => new Set(local?.cut.edges ?? []), [local]);
  const residualTooBig = m > RESIDUAL_MAX_EDGES;

  return (
    <div className="app">
      <Sidebar
        instances={instances} currentFile={currentFile} instance={instance} serverOnline={serverOnline}
        source={source} sink={sink} strategy={strategy} busy={busy}
        onPick={pick} onUpload={(i) => applyInstance(i, null)} onGenerate={generate}
        onNew={() => { applyInstance({ name: "nova_instancia", vertices: [], edges: [] }, null); setTab("editar"); }}
        onSource={(v) => { setSource(v); clearResults(); }} onSink={(v) => { setSink(v); clearResults(); }}
        onStrategy={(s) => { setStrategy(s); clearResults(); }} onRun={run} onDelete={remove}
      />

      <main className="stage">
        {error && <div className="notice error-banner" role="alert">{error}</div>}
        {instance ? (
          <>
            <div className="stage-head">
              <div>
                <h2>{instance.name}</h2>
                {instance.description && <p className="muted">{instance.description}</p>}
              </div>
              <div className="segmented" role="radiogroup" aria-label="O que desenhar">
                <button role="radio" aria-checked={mode === "rede"} className={mode === "rede" ? "on" : ""} onClick={() => setMode("rede")}>Fluxo na rede</button>
                <button role="radio" aria-checked={mode === "residual"} className={mode === "residual" ? "on" : ""} onClick={() => setMode("residual")}
                  disabled={residualTooBig} title={residualTooBig ? `Disponível para instâncias de até ${RESIDUAL_MAX_EDGES} arestas` : ""}>
                  Rede residual
                </button>
              </div>
            </div>
            {mode === "residual" && step >= 1 && step <= n && (
              <p className="mode-note">Rede residual antes deste aumento: o caminho destacado foi encontrado nela.</p>
            )}
            <div className="canvas-wrap">
              <GraphView instance={instance} source={source} sink={sink} mode={residualTooBig ? "rede" : mode}
                flows={view.flows} residualFlows={view.residualFlows} path={view.path} cutEdges={view.cut} />
            </div>
            <Legend mode={residualTooBig ? "rede" : mode} />
            {local && <Timeline bottlenecks={local.bottlenecks} step={step} onStep={setStep} />}
          </>
        ) : (
          <div className="empty-stage">
            <h2>Escolha uma instância</h2>
            <p>Selecione uma rede salva, carregue um JSON ou gere uma malha viária ao lado. Depois defina origem e destino e calcule o fluxo máximo.</p>
          </div>
        )}
      </main>

      <div className="side-panel">
        {local && instance ? (
          <StepPanel instance={instance} step={step} local={local} server={server} diffs={diffs} serverError={serverError} />
        ) : (
          <aside className="step-panel">
            <p className="muted">O valor do fluxo máximo, cada caminho aumentante e a comparação entre servidor e navegador aparecem aqui depois do cálculo.</p>
          </aside>
        )}
      </div>

      {instance && (
        <section className="bottom">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "fluxos"} className={tab === "fluxos" ? "on" : ""} onClick={() => setTab("fluxos")}>Fluxo por aresta</button>
            <button role="tab" aria-selected={tab === "editar"} className={tab === "editar" ? "on" : ""} onClick={() => setTab("editar")}>Editar instância</button>
          </div>
          {tab === "fluxos"
            ? <FlowTable instance={instance} flows={view.flows} cutEdges={local ? cutSet : new Set()} highlightCut={view.cut !== null} pathEdges={pathSet} />
            : <Editor instance={instance} onChange={edit} onSave={save} saving={saving} serverOnline={serverOnline} />}
        </section>
      )}
    </div>
  );
}

function Legend({ mode }: { mode: ViewMode }) {
  const items: [string, string][] = mode === "rede"
    ? [["sw-flow", "Com fluxo (espessura = uso)"], ["sw-sat", "Saturada"], ["sw-path", "Caminho aumentante"], ["sw-rev", "Cancela fluxo"], ["sw-cut", "Corte mínimo"]]
    : [["sw-res", "Capacidade restante"], ["sw-rev", "Aresta de retorno"], ["sw-path", "Caminho encontrado"]];
  return (
    <ul className="legend">
      {items.map(([c, l]) => <li key={c}><span className={`swatch ${c}`} />{l}</li>)}
      <li><span className="dot dot-src" />Origem</li>
      <li><span className="dot dot-snk" />Destino</li>
    </ul>
  );
}
