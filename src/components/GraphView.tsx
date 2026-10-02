import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef } from "react";
import { residualEdges } from "@/utils/fordFulkerson";
import { computeLayout, isArtificialVertex } from "@/utils/layout";
import { type Instance, type Label, type PathEdge, toNumber } from "@/types";
import { fmt } from "@/utils/format";

export type ViewMode = "rede" | "residual";

/** Acima disso a rede residual não é desenhada (fica ilegível); a tabela continua disponível. */
export const RESIDUAL_MAX_EDGES = 800;
const LABEL_MAX_EDGES = 120;
const ARTIFICIAL_HIDE_ABOVE = 150;

interface Props {
  instance: Instance;
  source?: Label;
  sink?: Label;
  mode: ViewMode;
  /** fluxo em cada aresta original no estado mostrado */
  flows: Float64Array;
  /** caminho aumentante destacado (ou null) */
  path: PathEdge[] | null;
  /** fluxo ANTES do caminho, usado para desenhar a residual onde o caminho foi encontrado */
  residualFlows: Float64Array;
  cutEdges: Set<number> | null;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function GraphView({ instance, source, sink, mode, flows, path, residualFlows, cutEdges }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  /** fator para manter espessuras legíveis quando o grafo é grande e o zoom inicial é pequeno */
  const scale = useRef(1);
  const m = instance.edges.length;
  const small = m <= LABEL_MAX_EDGES;
  const hideArtificial = (instance.vertices?.length ?? 0) > ARTIFICIAL_HIDE_ABOVE;

  const caps = useMemo(() => instance.edges.map((e) => toNumber(e.capacity)), [instance]);
  const maxCap = useMemo(() => Math.max(1, ...caps.filter(Number.isFinite)), [caps]);

  /* ---------- montagem: uma vez por instância ---------- */
  useEffect(() => {
    if (!box.current) return;
    const { positions } = computeLayout(instance, source);
    const evacSources = new Set<string>();
    const evacSinks = new Set<string>();
    instance.edges.forEach((e) => {
      if (String(e.from) === "S*") evacSources.add(String(e.to));
      if (String(e.to) === "T*") evacSinks.add(String(e.from));
    });

    const ids = new Set<string>((instance.vertices ?? []).map((v) => String(v.id)));
    instance.edges.forEach((e) => { ids.add(String(e.from)); ids.add(String(e.to)); });

    const els: ElementDefinition[] = [];
    for (const id of ids) {
      const hidden = hideArtificial && isArtificialVertex(id);
      const cls = [
        hidden ? "hidden" : "",
        evacSources.has(id) ? "evac-origem" : "",
        evacSinks.has(id) ? "evac-saida" : "",
      ].join(" ");
      els.push({ group: "nodes", data: { id, label: small ? id : "" }, position: positions.get(id) ?? { x: 0, y: 0 }, classes: cls });
    }
    instance.edges.forEach((e, i) => {
      const c = caps[i];
      const hidden = hideArtificial && (isArtificialVertex(e.from) || isArtificialVertex(e.to));
      els.push({
        group: "edges",
        data: { id: `e${i}`, source: String(e.from), target: String(e.to), w: Number.isFinite(c) ? 1 + 4 * Math.sqrt(c / maxCap) : 1.5, label: "" },
        classes: `orig${hidden ? " hidden" : ""}${e.artificial ? " artificial" : ""}`,
      });
    });

    const curve = m <= 300 ? "bezier" : m <= 4000 ? "straight" : "haystack";
    const ink = css("--ink"), rule = css("--rule-strong"), amber = css("--flow"), amberDeep = css("--flow-deep"),
      red = css("--cut"), teal = css("--reverse"), safe = css("--safe"), paper = css("--panel");

    const cy = cytoscape({
      container: box.current,
      elements: els,
      layout: { name: "preset", fit: true, padding: 30 },
      minZoom: 0.02,
      maxZoom: 6,
      wheelSensitivity: 0.25,
      textureOnViewport: m > 4000,
      hideEdgesOnViewport: m > 8000,
      style: [
        { selector: "node", style: {
          "background-color": ink, width: () => (small ? 26 : 6 * scale.current), height: () => (small ? 26 : 6 * scale.current),
          label: "data(label)", color: paper, "font-family": "Barlow", "font-size": 11, "font-weight": 600,
          "text-valign": "center", "text-halign": "center",
        } },
        { selector: "node.evac-origem", style: { "background-color": amber, width: () => (small ? 26 : 9 * scale.current), height: () => (small ? 26 : 9 * scale.current) } },
        { selector: "node.evac-saida", style: { "background-color": safe, width: () => (small ? 26 : 9 * scale.current), height: () => (small ? 26 : 9 * scale.current) } },
        { selector: "node.terminal-origem", style: { "background-color": amber, color: ink, width: () => (small ? 34 : 14 * scale.current), height: () => (small ? 34 : 14 * scale.current), "border-width": 2, "border-color": ink } },
        { selector: "node.terminal-destino", style: { "background-color": safe, width: () => (small ? 34 : 14 * scale.current), height: () => (small ? 34 : 14 * scale.current), "border-width": 2, "border-color": ink } },
        { selector: "edge", style: {
          "curve-style": curve, width: (e: cytoscape.EdgeSingular) => e.data("w") * scale.current, "line-color": rule, "target-arrow-color": rule,
          "target-arrow-shape": curve === "haystack" ? "none" : "triangle", "arrow-scale": small ? 0.9 : 0.5,
          label: "data(label)", "font-family": "Barlow", "font-size": 11, color: ink,
          "text-background-color": paper, "text-background-opacity": 0.9, "text-background-padding": "2px",
          "text-rotation": "autorotate",
        } },
        { selector: "edge.artificial", style: { "line-style": "dotted", opacity: 0.5 } },
        { selector: "edge.flowing", style: { "line-color": amber, "target-arrow-color": amber, width: (e: cytoscape.EdgeSingular) => e.data("fw") * scale.current } },
        { selector: "edge.saturated", style: { "line-color": amberDeep, "target-arrow-color": amberDeep } },
        { selector: "edge.res-fwd", style: { "line-color": rule, "target-arrow-color": rule, width: () => 1.5 * scale.current } },
        { selector: "edge.res-rev", style: { "line-color": teal, "target-arrow-color": teal, "line-style": "dashed", width: () => 1.5 * scale.current } },
        { selector: "edge.path", style: { "line-color": ink, "target-arrow-color": ink, width: () => (small ? 5 : 4 * scale.current), "z-index": 10 } },
        { selector: "edge.path-rev", style: { "line-color": teal, "target-arrow-color": teal, "line-style": "dashed", width: () => (small ? 5 : 4 * scale.current), "z-index": 10 } },
        { selector: "edge.cut", style: { "line-color": red, "target-arrow-color": red, width: () => (small ? 5 : 5 * scale.current), "z-index": 11 } },
        { selector: ".hidden, .off", style: { display: "none" } },
      ],
    });
    // após o enquadramento, compensa o zoom pequeno de grafos grandes
    scale.current = small ? 1 : Math.min(12, Math.max(1, 0.9 / cy.zoom()));
    cy.style().update();
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [instance]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- terminais escolhidos ---------- */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("terminal-origem terminal-destino");
    if (source !== undefined) cy.getElementById(String(source)).addClass("terminal-origem");
    if (sink !== undefined) cy.getElementById(String(sink)).addClass("terminal-destino");
  }, [source, sink, instance]);

  /* ---------- estado do passo atual ---------- */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const residualMode = mode === "residual" && m <= RESIDUAL_MAX_EDGES;
    const onPath = new Map<number, boolean>(); // aresta original -> percorrida ao contrário?
    path?.forEach((pe) => onPath.set(pe.edge, pe.reverse));

    cy.batch(() => {
      cy.edges(".res").remove();
      const orig = cy.edges(".orig");
      orig.removeClass("flowing saturated path path-rev cut");

      if (residualMode) {
        orig.addClass("off");
        const res = residualEdges(instance, residualFlows);
        cy.add(res.map((r) => {
          const usedHere = onPath.has(r.edge) && onPath.get(r.edge) === r.reverse;
          const hidden = hideArtificial && (isArtificialVertex(r.from) || isArtificialVertex(r.to));
          return {
            group: "edges" as const,
            data: { id: `r${r.edge}${r.reverse ? "b" : "f"}`, source: String(r.from), target: String(r.to), w: 1.5, label: small ? fmt(r.residual) : "" },
            classes: `res ${r.reverse ? "res-rev" : "res-fwd"}${usedHere ? (r.reverse ? " path-rev" : " path") : ""}${hidden ? " hidden" : ""}`,
          };
        }));
        return;
      }

      orig.removeClass("off");
      orig.forEach((edge) => {
        const i = Number(edge.id().slice(1));
        const f = flows[i];
        const c = caps[i];
        if (f > 1e-9) {
          const util = Number.isFinite(c) ? f / c : 0.3;
          edge.data("fw", 1.5 + 5 * Math.min(1, util));
          edge.addClass(util >= 1 - 1e-9 ? "flowing saturated" : "flowing");
        }
        if (onPath.has(i)) edge.addClass(onPath.get(i) ? "path-rev" : "path");
        if (cutEdges?.has(i)) edge.addClass("cut");
        if (small) edge.data("label", `${fmt(f)}/${fmt(c)}`);
      });
    });
  }, [mode, flows, path, residualFlows, cutEdges, instance, caps, m, small, hideArtificial]);

  return <div className="graph-canvas" ref={box} role="img" aria-label="Desenho da rede de fluxo" />;
}
