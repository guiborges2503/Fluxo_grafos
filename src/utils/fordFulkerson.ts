/**
 * Ford-Fulkerson em TypeScript, executado no navegador.
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

import { type Instance, type Iteration, type Label, type SolveResult, type Strategy, toNumber } from "@/types";

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

function bfsPath(net: FlowNetwork, s: number, t: number): [number[] | null, number] {
  const n = net.numVertices;
  const parent = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  visited[s] = 1;
  let seen = 1;
  const queue = [s];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const e of net.adj[u]) {
      const v = net.head[e];
      if (!visited[v] && net.cap[e] - net.flow[e] > EPS) {
        visited[v] = 1;
        seen++;
        parent[v] = e;
        if (v === t) return [rebuild(net, parent, s, t), seen];
        queue.push(v);
      }
    }
  }
  return [null, seen];
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
  strategy: Strategy = "dfs",
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

  for (;;) {
    const [path, seen] = strategy === "bfs" ? bfsPath(net, s, t) : dfsPath(net, s, t);
    visitedTotal += seen;
    if (!path) break;

    let bottleneck = Infinity;
    for (const e of path) bottleneck = Math.min(bottleneck, net.residual(e));
    if (bottleneck === Infinity) {
      throw new UnboundedFlowError("Fluxo ilimitado: há um caminho da origem ao destino só com capacidades infinitas.");
    }
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
    strategy,
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
