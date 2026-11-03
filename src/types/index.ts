/** Tipos compartilhados entre a API PHP e a implementação TypeScript. */

export type Label = string | number;
/** Capacidade como vem do JSON: número ou "inf". */
export type JsonCapacity = number | "inf";

export interface VertexDef {
  id: Label;
  lat?: number;
  lon?: number;
  x?: number;
  y?: number;
  role?: string;
  [key: string]: unknown;
}

export interface EdgeDef {
  from: Label;
  to: Label;
  capacity: JsonCapacity;
  artificial?: boolean;
  name?: string;
  highway?: string;
  [key: string]: unknown;
}

export interface Instance {
  name: string;
  description?: string;
  /** unidade da capacidade, mostrada junto do fluxo máximo (ex.: "caminhões/dia") */
  unit?: string;
  source?: Label;
  sink?: Label;
  vertices?: VertexDef[];
  edges: EdgeDef[];
}

export interface InstanceSummary {
  file: string;
  name: string;
  description: string;
  vertices: number;
  edges: number;
  geo: boolean;
  sizeKb: number;
}

/** Uma aresta usada num caminho aumentante: índice da aresta original + se foi percorrida ao contrário. */
export interface PathEdge {
  edge: number;
  reverse: boolean;
}

export interface Iteration {
  index: number;
  vertices: Label[];
  edges: PathEdge[];
  bottleneck: number;
  flowAfter: number;
}

export interface EdgeFlow {
  edge: number;
  from: Label;
  to: Label;
  capacity: number | "inf";
  flow: number;
  saturated: boolean;
}

export interface SolveResult {
  source: Label;
  sink: Label;
  /** busca usada no 1º passo (só a API devolve; o navegador usa sempre "dfs") */
  search?: "dfs" | "bfs";
  value: number;
  numIterations: number;
  elapsedMs: number;
  verticesVisited: number;
  bottlenecks: number[];
  iterations: Iteration[] | null;
  edgeFlows: EdgeFlow[];
  cut: { sourceSide: Label[]; edges: number[]; capacity: number | "inf" };
  validation?: string[];
  engine?: string;
}

export const toNumber = (c: number | "inf" | string): number =>
  c === "inf" || c === "Infinity" ? Infinity : Number(c);
