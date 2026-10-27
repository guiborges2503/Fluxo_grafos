import { useState } from "react";
import type { EdgeDef, Instance, Label } from "@/types";
import { addSuperTerminals, vertexLabels } from "@/utils/fordFulkerson";

const MAX_ROWS = 300;

interface Props {
  instance: Instance;
  source?: Label;
  sink?: Label;
  onChange: (inst: Instance) => void;
  /** troca a instância inteira, inclusive origem e destino (usado pela super-origem) */
  onReplace: (inst: Instance) => void;
  onSource: (v: Label) => void;
  onSink: (v: Label) => void;
  onSave: () => void;
  /** só para redes criadas pelo usuário */
  onDelete?: () => void;
  saving: boolean;
  serverOnline: boolean;
}

/** Edição da rede: origem, destino, arestas e capacidades. Depois de editar, é só calcular de novo. */
export function Editor({ instance, source, sink, onChange, onReplace, onSource, onSink, onSave, onDelete, saving, serverOnline }: Props) {
  const [draft, setDraft] = useState({ from: "", to: "", capacity: "" });
  const [error, setError] = useState<string | null>(null);
  const [terminals, setTerminals] = useState({ sources: "", sinks: "" });
  const [terminalError, setTerminalError] = useState<string | null>(null);

  const setEdges = (edges: EdgeDef[]) => onChange({ ...instance, edges });

  const updateEdge = (i: number, patch: Partial<EdgeDef>) =>
    setEdges(instance.edges.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const parseLabel = (s: string): Label => (/^\d+$/.test(s) ? Number(s) : s.trim());

  const addEdge = () => {
    const cap = draft.capacity.trim().toLowerCase() === "inf" ? "inf" : Number(draft.capacity.replace(",", "."));
    if (!draft.from.trim() || !draft.to.trim()) return setError("Informe os dois vértices da aresta.");
    if (draft.from.trim() === draft.to.trim()) return setError("A aresta precisa ligar dois vértices diferentes.");
    if (cap !== "inf" && !(cap >= 0)) return setError("A capacidade deve ser um número maior ou igual a zero, ou inf.");
    const from = parseLabel(draft.from), to = parseLabel(draft.to);
    const vertices = [...(instance.vertices ?? [])];
    for (const id of [from, to]) if (!vertices.some((v) => String(v.id) === String(id))) vertices.push({ id });
    onChange({ ...instance, vertices, edges: [...instance.edges, { from, to, capacity: cap }] });
    setDraft({ from: draft.to, to: "", capacity: draft.capacity });
    setError(null);
  };

  /** Várias fontes ou destinos: liga todas a uma super-origem S* e/ou a um super-destino T*. */
  const superTerminals = () => {
    const known = new Map(vertexLabels(instance).map((v) => [String(v), v]));
    const read = (text: string) => text.split(",").map((x) => x.trim()).filter(Boolean);
    const srcs = read(terminals.sources), snks = read(terminals.sinks);
    const missing = [...srcs, ...snks].filter((x) => !known.has(x));
    if (missing.length) return setTerminalError(`Vértice inexistente: ${missing.join(", ")}.`);
    if (srcs.length < 2 && snks.length < 2) return setTerminalError("Informe pelo menos duas origens ou dois destinos.");
    if ((srcs.length >= 2 && known.has("S*")) || (snks.length >= 2 && known.has("T*"))) return setTerminalError("A rede já tem S* ou T*.");
    setTerminalError(null);
    setTerminals({ sources: "", sinks: "" });
    onReplace(addSuperTerminals(
      { ...instance, source, sink },
      srcs.length >= 2 ? srcs.map((x) => known.get(x)!) : [],
      snks.length >= 2 ? snks.map((x) => known.get(x)!) : [],
    ));
  };

  const vertices = vertexLabels(instance);
  const pick = (value: string) => vertices.find((v) => String(v) === value) ?? value;
  const terminal = (label: string, value: Label | undefined, set: (v: Label) => void) => (
    <label>{label}
      <select value={value !== undefined ? String(value) : ""} onChange={(e) => set(pick(e.target.value))}>
        <option value="" disabled>escolha</option>
        {vertices.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="editor">
      <div className="editor-meta">
        <label>Nome<input value={instance.name} onChange={(e) => onChange({ ...instance, name: e.target.value })} /></label>
        <label className="grow">Descrição<input value={instance.description ?? ""} onChange={(e) => onChange({ ...instance, description: e.target.value })} /></label>
        {terminal("Origem (s)", source, onSource)}
        {terminal("Destino (t)", sink, onSink)}
        <button onClick={onSave} disabled={saving || !serverOnline} title={serverOnline ? "" : "Servidor PHP indisponível"}>
          {saving ? "Salvando…" : "Salvar rede"}
        </button>
        {onDelete && <button className="link" onClick={onDelete}>Excluir rede</button>}
      </div>

      <form className="add-edge" onSubmit={(e) => { e.preventDefault(); addEdge(); }}>
        <span>Nova ligação</span>
        <input placeholder="de" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="Vértice de origem da aresta" />
        <input placeholder="para" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="Vértice de destino da aresta" />
        <input placeholder="capacidade" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} aria-label="Capacidade" />
        <button type="submit">Adicionar</button>
        {error && <span className="error">{error}</span>}
      </form>

      <form className="add-edge" onSubmit={(e) => { e.preventDefault(); superTerminals(); }}>
        <span title="Cria uma super-origem S* e/ou um super-destino T* com capacidade infinita">Várias origens ou destinos</span>
        <input placeholder="origens: F1, F2" value={terminals.sources} onChange={(e) => setTerminals({ ...terminals, sources: e.target.value })} aria-label="Origens separadas por vírgula" />
        <input placeholder="destinos: D1, D2" value={terminals.sinks} onChange={(e) => setTerminals({ ...terminals, sinks: e.target.value })} aria-label="Destinos separados por vírgula" />
        <button type="submit">Criar super-origem / super-destino</button>
        {terminalError && <span className="error">{terminalError}</span>}
      </form>

      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>De</th><th>Para</th><th className="num">Capacidade</th><th /></tr></thead>
          <tbody>
            {instance.edges.slice(0, MAX_ROWS).map((e, i) => (
              <tr key={i}>
                <td className="muted">{i}</td>
                <td>{String(e.from)}</td>
                <td>{String(e.to)}</td>
                <td className="num">
                  <input className="cap-input" key={`${i}-${String(e.capacity)}`} defaultValue={String(e.capacity)} aria-label={`Capacidade da aresta ${i}`}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim().toLowerCase();
                      const n = Number(v.replace(",", "."));
                      if (v === "inf") updateEdge(i, { capacity: "inf" });
                      else if (v !== "" && n >= 0) updateEdge(i, { capacity: n });
                      else ev.target.value = String(e.capacity);
                    }}
                    onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
                </td>
                <td><button className="link" onClick={() => setEdges(instance.edges.filter((_, j) => j !== i))}>Remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {instance.edges.length > MAX_ROWS && (
          <p className="muted">Mostrando {MAX_ROWS} de {instance.edges.length} arestas. Para editar instâncias grandes, baixe o JSON.</p>
        )}
      </div>
    </div>
  );
}
