/**
 * Método de Ford-Fulkerson em TypeScript, executado no navegador.
 * O caminho aumentante é "um caminho qualquer" com capacidades positivas (busca em profundidade).
 *
 * O resultado oficial vem da API PHP (api/app/Services/FordFulkerson.php).
 * Esta versão segue a MESMA estrutura e a MESMA ordem de visita, para:
 *   1. dar o passo a passo instantâneo na interface (rede residual em cada iteração);
 *   2. conferir, a cada execução, que servidor e navegador chegam aos mesmos caminhos.
 *
 * Rede residual: a aresta original i vira as arestas residuais 2i (u->v, capacidade c)
 * e 2i+1 (v->u, capacidade 0). A gêmea de e é e ^ 1 e o fluxo da reversa é o
 * oposto do da original, logo residual(e) = cap[e] - flow[e] para as duas.
 */

import { type EdgeDef, type Instance, type Iteration, type Label, type SolveResult, toNumber } from "@/types";

const EPS = 1e-9;

export class UnboundedFlowError extends Error {}

export class FlowNetwork {
  labels: Label[] = [];
  adj: number[][] = [];
  tail: number[] = [];
  head: number[] = [];
  cap: number[] = [];
  flow: number[] = [];
  private index = new Map<string, number>();

  static fromInstance(inst: Instance): FlowNetwork {
    const net = new FlowNetwork();
    for (const v of inst.vertices ?? []) net.addVertex(v.id);
    for (const e of inst.edges) net.addEdge(e.from, e.to, toNumber(e.capacity));
    return net;
  }

  addVertex(label: Label): number {
    const key = String(label);
    const found = this.index.get(key);
    if (found !== undefined) return found;
    const v = this.labels.length;
    this.index.set(key, v);
    this.labels.push(label);
    this.adj.push([]);
    return v;
  }

  indexOf(label: Label): number {
    const v = this.index.get(String(label));
    if (v === undefined) throw new Error(`Vértice inexistente: ${label}`);
    return v;
  }

  addEdge(u: Label, v: Label, capacity: number): number {
    if (!(capacity >= 0)) throw new Error(`Capacidade inválida em ${u}->${v}: ${capacity}`);
    if (String(u) === String(v)) throw new Error(`Laço não permitido em ${u}`);
    const ui = this.addVertex(u);
    const vi = this.addVertex(v);
    const fwd = this.tail.length;
    this.tail.push(ui, vi);
    this.head.push(vi, ui);
    this.cap.push(capacity, 0);
    this.flow.push(0, 0);
    this.adj[ui].push(fwd);
    this.adj[vi].push(fwd + 1);
    return fwd >> 1;
  }

  get numVertices() { return this.labels.length; }
  get numEdges() { return this.tail.length >> 1; }

  residual(e: number) { return this.cap[e] - this.flow[e]; }

  /** Envia amount por e: o residual de e cai amount e o da inversa e^1 sobe amount (antissimetria). */
  push(e: number, amount: number) {
    this.flow[e] += amount;
    this.flow[e ^ 1] -= amount;
  }
}

/* ------------------------------------------------------------------ buscas */

function dfsPath(net: FlowNetwork, s: number, t: number): [number[] | null, number] {
  const n = net.numVertices;
  const parent = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  const ptr = new Int32Array(n);
  visited[s] = 1;
  let seen = 1;
  const stack = [s];

  while (stack.length) {
    const u = stack[stack.length - 1];
    if (u === t) break;
    const adj = net.adj[u];
    let advanced = false;
    while (ptr[u] < adj.length) {
      const e = adj[ptr[u]++];
      const v = net.head[e];
      if (!visited[v] && net.cap[e] - net.flow[e] > EPS) {
        visited[v] = 1;
        seen++;
        parent[v] = e;
        stack.push(v);
        advanced = true;
        break;
      }
    }
    if (!advanced) stack.pop();
  }
  return [visited[t] ? rebuild(net, parent, s, t) : null, seen];
}

function rebuild(net: FlowNetwork, parent: Int32Array, s: number, t: number): number[] {
  const path: number[] = [];
  for (let v = t; v !== s; ) {
    const e = parent[v];
    path.push(e);
    v = net.tail[e];
  }
  return path.reverse();
}

/* ------------------------------------------------------------------ algoritmo */

export function fordFulkerson(
  net: FlowNetwork,
  source: Label,
  sink: Label,
  record = true,
): SolveResult {
  const s = net.indexOf(source);
  const t = net.indexOf(sink);
  if (s === t) throw new Error("Origem e destino devem ser vértices diferentes.");

  net.flow.fill(0);
  let value = 0;
  let visitedTotal = 0;
  const bottlenecks: number[] = [];
  const iterations: Iteration[] = [];
  const start = performance.now();

  // Começo: fluxo zero em todas as arestas (net.flow.fill(0) acima).
  for (;;) {
    // 1º passo: escolher um caminho de s até t só com capacidades residuais positivas (> 0).
    const [path, seen] = dfsPath(net, s, t);
    visitedTotal += seen;
    // Se não existe mais caminho, o fluxo máximo já está determinado.
    if (!path) break;

    // 2º passo: a aresta de menor capacidade residual do caminho é o gargalo c.
    let bottleneck = Infinity;
    for (const e of path) bottleneck = Math.min(bottleneck, net.residual(e));
    if (bottleneck === Infinity) {
      throw new UnboundedFlowError("Fluxo ilimitado: há um caminho da origem ao destino só com capacidades infinitas.");
    }
    // 3º passo: diminuir c no sentido direto e aumentar c no sentido inverso (push faz os dois).
    for (const e of path) net.push(e, bottleneck);
    value += bottleneck;
    bottlenecks.push(bottleneck);

    if (record) {
      iterations.push({
        index: bottlenecks.length,
        vertices: [net.labels[s], ...path.map((e) => net.labels[net.head[e]])],
        edges: path.map((e) => ({ edge: e >> 1, reverse: (e & 1) === 1 })),
        bottleneck,
        flowAfter: value,
      });
    }
  }

  const elapsedMs = performance.now() - start;
  return {
    source,
    sink,
    value,
    numIterations: bottlenecks.length,
    elapsedMs,
    verticesVisited: visitedTotal,
    bottlenecks,
    iterations: record ? iterations : null,
    edgeFlows: Array.from({ length: net.numEdges }, (_, i) => ({
      edge: i,
      from: net.labels[net.tail[2 * i]],
      to: net.labels[net.head[2 * i]],
      capacity: net.cap[2 * i],
      flow: net.flow[2 * i],
      saturated: net.residual(2 * i) <= EPS,
    })),
    cut: minCut(net, s),
    engine: "typescript",
  };
}

/** Corte mínimo: vértices alcançáveis da origem na rede residual e arestas que saem desse conjunto. */
export function minCut(net: FlowNetwork, s: number) {
  const reach = new Uint8Array(net.numVertices);
  reach[s] = 1;
  const queue = [s];
  for (let h = 0; h < queue.length; h++) {
    for (const e of net.adj[queue[h]]) {
      const v = net.head[e];
      if (!reach[v] && net.residual(e) > EPS) {
        reach[v] = 1;
        queue.push(v);
      }
    }
  }
  const edges: number[] = [];
  let capacity = 0;
  for (let i = 0; i < net.numEdges; i++) {
    if (reach[net.tail[2 * i]] && !reach[net.head[2 * i]]) {
      edges.push(i);
      capacity += net.cap[2 * i];
    }
  }
  return { sourceSide: net.labels.filter((_, v) => reach[v]), edges, capacity };
}

/* ------------------------------------------------------------------ passo a passo */

/** Fluxo em cada aresta ORIGINAL após as k primeiras iterações (k = 0: rede vazia). */
export function flowsAfter(numEdges: number, iterations: Iteration[], k: number): Float64Array {
  const f = new Float64Array(numEdges);
  for (let j = 0; j < k && j < iterations.length; j++) {
    const it = iterations[j];
    for (const pe of it.edges) f[pe.edge] += pe.reverse ? -it.bottleneck : it.bottleneck;
  }
  return f;
}

export interface ResidualEdge {
  edge: number;       // aresta original de onde vem
  reverse: boolean;   // true = aresta de retorno (permite cancelar fluxo)
  from: Label;
  to: Label;
  residual: number;
}

/** Arestas da rede residual com capacidade positiva, para um vetor de fluxos. */
export function residualEdges(inst: Instance, flows: Float64Array): ResidualEdge[] {
  const out: ResidualEdge[] = [];
  inst.edges.forEach((e, i) => {
    const c = toNumber(e.capacity);
    const f = flows[i];
    if (c - f > EPS) out.push({ edge: i, reverse: false, from: e.from, to: e.to, residual: c - f });
    if (f > EPS) out.push({ edge: i, reverse: true, from: e.to, to: e.from, residual: f });
  });
  return out;
}

/** Compara o resultado do servidor com o do navegador. Retorna as diferenças encontradas. */
export function compareResults(server: SolveResult, local: SolveResult): string[] {
  const diffs: string[] = [];
  if (Math.abs(toNumber(server.value) - local.value) > 1e-6) {
    diffs.push(`Fluxo máximo diferente: servidor ${server.value}, navegador ${local.value}.`);
  }
  if (server.numIterations !== local.numIterations) {
    diffs.push(`Número de iterações diferente: servidor ${server.numIterations}, navegador ${local.numIterations}.`);
  }
  if (server.iterations && local.iterations) {
    const i = server.iterations.findIndex(
      (it, j) => it.vertices.map(String).join(",") !== local.iterations![j]?.vertices.map(String).join(","),
    );
    if (i >= 0) diffs.push(`Os caminhos aumentantes divergem a partir da iteração ${i + 1}.`);
  }
  return diffs;
}

/* ------------------------------------------------------------------ explicação passo a passo */

/**
 * O que acontece com uma aresta do caminho no 3º passo do método:
 * no sentido direto a capacidade residual DIMINUI c; no sentido inverso AUMENTA c
 * (se a inversa ainda não existia na rede residual, ela é "criada").
 */
export interface EdgeUpdate {
  edge: number;
  from: Label;          // sentido em que o caminho percorre a aresta
  to: Label;
  reverse: boolean;     // true = o caminho usou uma aresta inversa (desfaz fluxo)
  before: number;       // capacidade residual de from->to antes do aumento
  after: number;        // before - c
  backBefore: number;   // capacidade residual de to->from antes do aumento
  backAfter: number;    // backBefore + c
  created: boolean;     // a aresta inversa não existia (residual 0) e foi criada
  isBottleneck: boolean;
}

/** Detalha a iteração k (1..N): residual antes/depois de cada aresta do caminho. */
export function describeIteration(inst: Instance, iterations: Iteration[], k: number): EdgeUpdate[] {
  const it = iterations[k - 1];
  const before = flowsAfter(inst.edges.length, iterations, k - 1);
  const c = it.bottleneck;
  const rows = it.edges.map((pe) => {
    const e = inst.edges[pe.edge];
    const cap = toNumber(e.capacity);
    const f = before[pe.edge];
    const fwd = pe.reverse ? f : cap - f;
    const back = pe.reverse ? cap - f : f;
    return {
      edge: pe.edge,
      from: pe.reverse ? e.to : e.from,
      to: pe.reverse ? e.from : e.to,
      reverse: pe.reverse,
      before: fwd,
      after: fwd - c,
      backBefore: back,
      backAfter: back + c,
      created: back <= EPS,
      isBottleneck: false,
    };
  });
  const i = rows.findIndex((r) => Math.abs(r.before - c) <= EPS);
  if (i >= 0) rows[i].isBottleneck = true;
  return rows;
}

export interface Cut {
  sourceSide: Label[];
  sinkSide: Label[];
  edges: number[];      // arestas originais que vão de S para T
  capacity: number;
}

/** Capacidade de um corte (S,T): soma das arestas de S para T (as de T para S não contam). */
export function cutOf(inst: Instance, sourceSide: Set<string>): Cut {
  const all = vertexLabels(inst);
  const edges: number[] = [];
  let capacity = 0;
  inst.edges.forEach((e, i) => {
    if (sourceSide.has(String(e.from)) && !sourceSide.has(String(e.to))) {
      edges.push(i);
      capacity += toNumber(e.capacity);
    }
  });
  return {
    sourceSide: all.filter((v) => sourceSide.has(String(v))),
    sinkSide: all.filter((v) => !sourceSide.has(String(v))),
    edges,
    capacity,
  };
}

/** Acima disso não listamos todos os cortes (são 2^(n-2) possibilidades). */
export const ALL_CUTS_MAX_VERTICES = 14;

/** Todos os cortes (S,T) com s em S e t em T, do menor para o maior. */
export function allCuts(inst: Instance, source: Label, sink: Label): Cut[] | null {
  const others = vertexLabels(inst).filter((v) => String(v) !== String(source) && String(v) !== String(sink));
  if (others.length + 2 > ALL_CUTS_MAX_VERTICES) return null;
  const cuts: Cut[] = [];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const side = new Set<string>([String(source)]);
    others.forEach((v, j) => { if (mask & (1 << j)) side.add(String(v)); });
    cuts.push(cutOf(inst, side));
  }
  return cuts.sort((a, b) => a.capacity - b.capacity || a.sourceSide.length - b.sourceSide.length);
}

export function vertexLabels(inst: Instance): Label[] {
  const ids = new Map<string, Label>();
  (inst.vertices ?? []).forEach((v) => ids.set(String(v.id), v.id));
  inst.edges.forEach((e) => { ids.set(String(e.from), e.from); ids.set(String(e.to), e.to); });
  return [...ids.values()];
}

/** Propriedades de fluxo (capacidade e conservação), conferidas no fluxo final. Retorna os problemas (vazio = ok). */
export function checkProperties(inst: Instance, flows: Float64Array, source: Label, sink: Label) {
  const capacity: string[] = [];
  const conservation: string[] = [];
  const balance = new Map<string, number>();
  inst.edges.forEach((e, i) => {
    const c = toNumber(e.capacity);
    const f = flows[i];
    if (f < -EPS || f > c + EPS) capacity.push(`${String(e.from)}→${String(e.to)}: ${f} > ${c}`);
    balance.set(String(e.from), (balance.get(String(e.from)) ?? 0) - f);
    balance.set(String(e.to), (balance.get(String(e.to)) ?? 0) + f);
  });
  for (const [v, b] of balance) {
    if (v !== String(source) && v !== String(sink) && Math.abs(b) > 1e-6) conservation.push(`${v}: entra − sai = ${b}`);
  }
  return { capacity, conservation };
}

/** Arestas pares u->v e v->u (antiparalelas), que o modelo de rede de fluxo não permite. */
export function antiparallelPairs(inst: Instance): [number, number][] {
  const index = new Map<string, number>();
  inst.edges.forEach((e, i) => index.set(`${String(e.from)}\u0000${String(e.to)}`, i));
  const pairs: [number, number][] = [];
  inst.edges.forEach((e, i) => {
    const j = index.get(`${String(e.to)}\u0000${String(e.from)}`);
    if (j !== undefined && i < j) pairs.push([i, j]);
  });
  return pairs;
}

/**
 * Remove arestas antiparalelas: para cada par, a aresta (v1,v2) vira
 * (v1,v') e (v',v2), ambas com a capacidade original. O fluxo máximo não muda.
 */
export function splitAntiparallel(inst: Instance): Instance {
  const taken = new Set(vertexLabels(inst).map(String));
  const split = new Set(antiparallelPairs(inst).map(([i]) => i));
  const vertices = [...(inst.vertices ?? [])];
  const edges: EdgeDef[] = [];
  inst.edges.forEach((e, i) => {
    if (!split.has(i)) { edges.push(e); return; }
    let aux = `${String(e.to)}'`;
    while (taken.has(aux)) aux += "'";
    taken.add(aux);
    const a = vertices.find((v) => String(v.id) === String(e.from));
    const b = vertices.find((v) => String(v.id) === String(e.to));
    const mid = a?.x !== undefined && b?.x !== undefined && a.y !== undefined && b.y !== undefined
      ? { x: (a.x + b.x) / 2 + 0.4, y: (a.y + b.y) / 2 } : {};
    vertices.push({ id: aux, role: "auxiliar", ...mid });
    edges.push({ ...e, to: aux }, { ...e, from: aux });
  });
  return { ...inst, vertices, edges };
}

/** Super-origem e/ou super-destino: ligações de capacidade infinita. */
export function addSuperTerminals(inst: Instance, sources: Label[], sinks: Label[]): Instance {
  const vertices = [...(inst.vertices ?? [])];
  const edges = [...inst.edges];
  let source = inst.source;
  let sink = inst.sink;
  if (sources.length) {
    vertices.push({ id: "S*", role: "super_source" });
    sources.forEach((v) => edges.push({ from: "S*", to: v, capacity: "inf", artificial: true }));
    source = "S*";
  }
  if (sinks.length) {
    vertices.push({ id: "T*", role: "super_sink" });
    sinks.forEach((v) => edges.push({ from: v, to: "T*", capacity: "inf", artificial: true }));
    sink = "T*";
  }
  return { ...inst, vertices, edges, source, sink };
}
