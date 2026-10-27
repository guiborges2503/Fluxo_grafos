import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ServerOfflineError } from "@/config/api";
import { CutsTable } from "@/components/CutsTable";
import { Editor } from "@/components/Editor";
import { GraphView } from "@/components/GraphView";
import { StepControls } from "@/components/StepControls";
import { StepPanel } from "@/components/StepPanel";
import { type Cut, FlowNetwork, antiparallelPairs, compareResults, flowsAfter, fordFulkerson, splitAntiparallel } from "@/utils/fordFulkerson";
import type { Instance, InstanceSummary, Label, SolveResult } from "@/types";
import { fmt } from "@/utils/format";

/** Cenários da enchente, na ordem em que aparecem na tela. O primeiro abre automaticamente. */
const SCENARIOS: [file: string, label: string][] = [
  ["enchente_rs", "Situação atual"],
  ["enchente_ponte_interditada", "Ponte interditada"],
  ["enchente_rota_liberada", "Nova rota liberada"],
  ["enchente_abrigos_lotados", "Abrigos lotados"],
];
const APPLICATION = SCENARIOS[0][0];
/** Instâncias usadas só nos testes automáticos: ficam no servidor, mas não aparecem na tela. */
const HIDDEN = new Set(["cormen", "patologico", "sem_caminho", "aleatorio_300", "malha_bairro_pequeno", "malha_cidade_40x60"]);

export default function HomePage() {
  const [serverOnline, setServerOnline] = useState(true);
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [source, setSource] = useState<Label | undefined>();
  const [sink, setSink] = useState<Label | undefined>();

  const [local, setLocal] = useState<SolveResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"cortes" | "editar" | null>(null);
  const [cutPreview, setCutPreview] = useState<Cut | null>(null);

  /* ---------------- visualização: quais grafos, explicação e tela cheia ---------------- */
  const [show, setShow] = useState<"ambos" | "residual" | "fluxo">("ambos");
  const [explain, setExplain] = useState(true);
  const [full, setFull] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);

  const toggleFull = async () => {
    if (full) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setFull(false);
      return;
    }
    setFull(true);
    // tela cheia de verdade quando o navegador permite; senão a área só ocupa a janela inteira
    await workspace.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("fullscreenchange", onChange); window.removeEventListener("keydown", onKey); };
  }, []);

  /* ---------------- carga inicial ---------------- */
  const refreshList = useCallback(async () => {
    try {
      setInstances(await api.listInstances());
      setServerOnline(true);
    } catch (e) {
      setServerOnline(false);
      if (!(e instanceof ServerOfflineError)) setError((e as Error).message);
    }
  }, []);
  useEffect(() => { refreshList(); }, [refreshList]);
  // abre direto no problema da aplicação
  useEffect(() => {
    if (!instance && instances.some((i) => i.file === APPLICATION)) pick(APPLICATION);
  }, [instances]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearResults = () => { setLocal(null); setWarning(null); setStep(0); setCutPreview(null); };

  /** Roda o Ford-Fulkerson no navegador (passo a passo) e confere com a API PHP em segundo plano. */
  const solve = async (inst: Instance, s: Label | undefined, t: Label | undefined) => {
    clearResults();
    if (s === undefined || t === undefined || !inst.edges.length) return;
    const full = { ...inst, source: s, sink: t };
    try {
      const result = fordFulkerson(FlowNetwork.fromInstance(full), s, t, true);
      setLocal(result);
      setError(null);
      try {
        const server = await api.solve(full, s, t, true);
        const problems = [...compareResults(server, result), ...(server.validation ?? [])];
        if (problems.length) setWarning(`A conferência com o servidor PHP encontrou diferenças: ${problems.join(" ")}`);
      } catch (e) {
        if (e instanceof ServerOfflineError) setServerOnline(false);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const applyInstance = (inst: Instance, file: string | null) => {
    setInstance(inst);
    setCurrentFile(file);
    setSource(inst.source);
    setSink(inst.sink);
    setError(null);
    solve(inst, inst.source, inst.sink);
  };

  /* ---------------- ações ---------------- */
  const pick = async (file: string) => {
    try {
      applyInstance(await api.getInstance(file), file);
      if (tab === "editar") setTab(null);
    } catch (e) { setError((e as Error).message); }
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

  const remove = async () => {
    if (!currentFile || !confirm(`Excluir a rede ${instance?.name ?? currentFile}?`)) return;
    try {
      await api.deleteInstance(currentFile);
      setInstance(null);
      setCurrentFile(null);
      clearResults();
      await refreshList();
    } catch (e) { setError((e as Error).message); }
  };

  const edit = (inst: Instance) => { setInstance(inst); clearResults(); };

  /* ---------------- estado do passo ---------------- */
  const m = instance?.edges.length ?? 0;
  const n = local?.numIterations ?? 0;
  const iters = local?.iterations ?? [];
  const zero = useMemo(() => new Float64Array(m), [m, instance]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    if (!local || step === 0) return { flows: zero, residualFlows: zero, path: null, cut: null };
    if (step <= n) {
      return { flows: flowsAfter(m, iters, step), residualFlows: flowsAfter(m, iters, step - 1), path: iters[step - 1].edges, cut: null };
    }
    const final = flowsAfter(m, iters, n);
    return { flows: final, residualFlows: final, path: null, cut: new Set(local.cut.edges) };
  }, [local, step, n, m, iters, zero]);

  const shownCut = useMemo(() => (cutPreview ? new Set(cutPreview.edges) : view.cut), [cutPreview, view.cut]);
  const antiparallel = useMemo(() => (instance ? antiparallelPairs(instance) : []), [instance]);

  const known = new Set(SCENARIOS.map(([f]) => f));
  const mine = instances.filter((i) => !known.has(i.file) && !HIDDEN.has(i.file));
  const available = new Set(instances.map((i) => i.file));
  const isMine = currentFile !== null && !known.has(currentFile);

  const residualTitle = step === 0 ? "Rede residual (no início é igual à rede original)"
    : step > n ? "Rede residual final: não há mais caminho de s até t"
    : "Rede residual: onde o caminho foi escolhido (1º passo)";
  const flowTitle = step === 0 ? "Fluxo / capacidade: tudo começa em 0"
    : step > n ? "Fluxo / capacidade final, com o corte mínimo"
    : "Fluxo / capacidade depois de atualizar (3º passo)";

  return (
    <div className="app">
      <header className="topbar">
        <h1>Doações na enchente: fluxo máximo com Ford-Fulkerson</h1>
        <p>
          Quantos caminhões de doações por dia conseguem chegar aos abrigos pelas estradas que ainda estão abertas,
          e qual estrada é o <b>gargalo</b>?
        </p>
      </header>

      <nav className="examples" aria-label="Escolher rede">
        <span className="examples-label">Cenários da enchente:</span>
        {SCENARIOS.filter(([f]) => available.has(f) || !serverOnline).map(([file, label]) => (
          <button key={file} className={currentFile === file ? "on" : ""} onClick={() => pick(file)} disabled={!serverOnline}>{label}</button>
        ))}
        {mine.map((i) => (
          <button key={i.file} className={currentFile === i.file ? "on" : ""} onClick={() => pick(i.file)}>{i.name}</button>
        ))}
        <button className="new" onClick={() => { applyInstance({ name: "minha_rede", vertices: [], edges: [] }, null); setTab("editar"); }}>
          + Criar minha rede
        </button>
      </nav>

      {!serverOnline && (
        <div className="notice warn page-notice">
          O servidor PHP não respondeu, então as redes salvas não foram carregadas. Rode <code>npm run dev</code> na pasta do projeto,
          ou use "Criar minha rede" para montar uma rede direto no navegador.
        </div>
      )}
      {error && <div className="notice error-banner page-notice" role="alert">{error}</div>}

      {instance ? (
        <>
          <div ref={workspace} className={`workspace${full ? " is-full" : ""}${explain ? "" : " no-panel"}`}>
          <main className="stage">
            <div className="stage-head">
              <div>
                <h2>{SCENARIOS.find(([f]) => f === currentFile)?.[1] ?? instance.name}</h2>
                {instance.description && <p className="muted">{instance.description}</p>}
              </div>
              <div className="view-tools">
                <div className="segmented" role="radiogroup" aria-label="Quais desenhos mostrar">
                  {([["ambos", "Ambos"], ["residual", "Só rede residual"], ["fluxo", "Só fluxo"]] as const).map(([k, l]) => (
                    <button key={k} role="radio" aria-checked={show === k} className={show === k ? "on" : ""} onClick={() => setShow(k)}>{l}</button>
                  ))}
                </div>
                <button onClick={() => setExplain((v) => !v)}>{explain ? "Ocultar explicação" : "Mostrar explicação"}</button>
                <button className="primary" onClick={toggleFull} title="Esc também sai da tela cheia">{full ? "✕ Sair da tela cheia" : "⛶ Tela cheia"}</button>
              </div>
            </div>

            {antiparallel.length > 0 && (
              <div className="notice warn">
                Há ligações nos dois sentidos entre os mesmos vértices
                ({antiparallel.map(([i, j]) => `${String(instance.edges[i].from)}→${String(instance.edges[i].to)} e ${String(instance.edges[j].from)}→${String(instance.edges[j].to)}`).join("; ")}).
                O modelo de rede de fluxo usado aqui não permite isso, mas dá para corrigir sem mudar o resultado.
                <button onClick={() => { const fixed = splitAntiparallel({ ...instance, source, sink }); setInstance(fixed); solve(fixed, source, sink); }}>
                  Corrigir com vértice auxiliar v'
                </button>
              </div>
            )}

            {instance.edges.length === 0 ? (
              <div className="empty-graph">Adicione as ligações da sua rede na aba "Editar rede", logo abaixo.</div>
            ) : (
              <div className={`graphs${show === "ambos" ? "" : " one"}`}>
                {show !== "fluxo" && (
                <figure>
                  <figcaption>{residualTitle}</figcaption>
                  <div className="canvas-wrap">
                    <GraphView instance={instance} source={source} sink={sink} mode="residual"
                      flows={view.flows} residualFlows={view.residualFlows} path={view.path} cutEdges={null} />
                  </div>
                  <Legend items={[["sw-res", "Quanto ainda cabe"], ["sw-rev", "Seta inversa (desfaz fluxo)"], ["sw-path", "Caminho escolhido"]]} />
                </figure>
                )}
                {show !== "residual" && (
                <figure>
                  <figcaption>{cutPreview ? `Corte S = {${cutPreview.sourceSide.map(String).join(", ")}}: capacidade ${fmt(cutPreview.capacity)}` : flowTitle}</figcaption>
                  <div className="canvas-wrap">
                    <GraphView instance={instance} source={source} sink={sink} mode="rede"
                      flows={view.flows} residualFlows={view.residualFlows} path={view.path} cutEdges={shownCut} />
                  </div>
                  <Legend items={[["sw-flow", "Com fluxo"], ["sw-sat", "Cheia (saturada)"], ["sw-path", "Caminho usado"], ["sw-cut", "Corte mínimo"]]} />
                </figure>
                )}
              </div>
            )}

            {local ? (
              <StepControls total={n} step={step} onStep={(k) => { setStep(k); setCutPreview(null); }} />
            ) : instance.edges.length > 0 && (
              <div className="controls">
                <button className="big primary" onClick={() => solve(instance, source, sink)} disabled={source === undefined || sink === undefined}>
                  Calcular fluxo máximo
                </button>
                {(source === undefined || sink === undefined) && <span className="muted">Escolha a origem e o destino em "Editar rede".</span>}
              </div>
            )}
          </main>

          {explain && (
          <div className="side-panel">
            {local ? (
              <StepPanel instance={instance} step={step} local={local} />
            ) : (
              <aside className="step-panel"><p className="muted">A explicação de cada passo aparece aqui depois do cálculo.</p></aside>
            )}
            {warning && <div className="notice warn">{warning}</div>}
          </div>
          )}
          </div>

          <section className="bottom">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "cortes"} className={tab === "cortes" ? "on" : ""} onClick={() => setTab(tab === "cortes" ? null : "cortes")}>
                Todos os cortes (S,T)
              </button>
              <button role="tab" aria-selected={tab === "editar"} className={tab === "editar" ? "on" : ""} onClick={() => setTab(tab === "editar" ? null : "editar")}>
                Editar rede
              </button>
            </div>
            {tab === "cortes" && (
              <CutsTable instance={instance} source={source} sink={sink} maxFlow={local?.value ?? null}
                selected={cutPreview} onSelect={setCutPreview} />
            )}
            {tab === "editar" && (
              <Editor instance={instance} source={source} sink={sink} onChange={edit} onReplace={(i) => applyInstance(i, null)}
                onSource={(v) => { setSource(v); clearResults(); }} onSink={(v) => { setSink(v); clearResults(); }}
                onSave={save} onDelete={isMine ? remove : undefined} saving={saving} serverOnline={serverOnline} />
            )}
          </section>
        </>
      ) : (
        <main className="welcome">
          <h2>Como usar</h2>
          <ol>
            <li>Escolha um cenário da enchente acima, ou monte a sua rede em <b>+ Criar minha rede</b>.</li>
            <li>Clique em <b>Próximo ▶</b> para ver o algoritmo uma iteração por vez.</li>
            <li>Em cada iteração, o painel da direita explica o 1º, o 2º e o 3º passo do método.</li>
            <li>No <b>Resultado</b> aparece o fluxo máximo e o corte mínimo, que é o gargalo da rede.</li>
          </ol>
        </main>
      )}
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <ul className="legend">
      {items.map(([c, l]) => <li key={c}><span className={`swatch ${c}`} />{l}</li>)}
      <li><span className="dot dot-src" />Origem</li>
      <li><span className="dot dot-snk" />Destino</li>
    </ul>
  );
}
