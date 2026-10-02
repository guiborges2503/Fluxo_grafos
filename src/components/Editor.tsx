import { useState } from "react";
import type { EdgeDef, Instance, Label } from "@/types";

const MAX_ROWS = 300;

interface Props {
  instance: Instance;
  onChange: (inst: Instance) => void;
  onSave: () => void;
  saving: boolean;
  serverOnline: boolean;
}

/** Edição da instância: arestas, capacidades, nome. As mudanças valem na próxima execução. */
export function Editor({ instance, onChange, onSave, saving, serverOnline }: Props) {
  const [draft, setDraft] = useState({ from: "", to: "", capacity: "" });
  const [error, setError] = useState<string | null>(null);

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

  const download = () => {
    const blob = new Blob([JSON.stringify(instance, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${instance.name || "instancia"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="editor">
      <div className="editor-meta">
        <label>Nome<input value={instance.name} onChange={(e) => onChange({ ...instance, name: e.target.value })} /></label>
        <label className="grow">Descrição<input value={instance.description ?? ""} onChange={(e) => onChange({ ...instance, description: e.target.value })} /></label>
        <button onClick={onSave} disabled={saving || !serverOnline} title={serverOnline ? "" : "Servidor PHP indisponível"}>
          {saving ? "Salvando…" : "Salvar no servidor"}
        </button>
        <button onClick={download}>Baixar JSON</button>
      </div>

      <form className="add-edge" onSubmit={(e) => { e.preventDefault(); addEdge(); }}>
        <span>Nova aresta</span>
        <input placeholder="de" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="Vértice de origem da aresta" />
        <input placeholder="para" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="Vértice de destino da aresta" />
        <input placeholder="capacidade" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} aria-label="Capacidade" />
        <button type="submit">Adicionar aresta</button>
        {error && <span className="error">{error}</span>}
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
