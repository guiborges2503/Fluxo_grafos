"""
Ford-Fulkerson para fluxo máximo, com registro de cada iteração.

Estratégias de busca do caminho aumentante:
    "dfs"  -> Ford-Fulkerson clássico (busca em profundidade)
    "bfs"  -> Edmonds-Karp (busca em largura: caminho com menos arestas)

O registro guarda, por iteração, o caminho aumentante, as arestas
residuais usadas (incluindo reversas) e o gargalo. Não se guarda uma
cópia da rede residual a cada passo, o que seria O(E) de memória por
iteração; em vez disso, `flows_after(k)` reconstrói o estado após a
k-ésima iteração reaplicando os caminhos. Isso permite o modo
passo a passo da interface mesmo em instâncias grandes.

Nenhuma biblioteca de grafos é usada neste módulo.
"""

from __future__ import annotations

import random
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Hashable, Literal

from .flow_network import EPS, INF, FlowNetwork

Strategy = Literal["dfs", "bfs"]


class UnboundedFlowError(ValueError):
    """Existe caminho s->t formado só por arestas de capacidade infinita."""


@dataclass(slots=True)
class AugmentingPath:
    index: int                    # 1, 2, 3, ...
    vertices: list[Hashable]      # rótulos de s até t
    edge_ids: list[int]           # arestas residuais usadas, em ordem
    uses_reverse: list[bool]      # True se a aresta é reversa (cancela fluxo)
    bottleneck: float
    flow_value_after: float


@dataclass
class MaxFlowResult:
    source: Hashable
    sink: Hashable
    strategy: str
    value: float
    iterations: list[AugmentingPath] = field(default_factory=list)
    num_iterations: int = 0
    cut_source_side: set[Hashable] = field(default_factory=set)
    cut_edge_ids: list[int] = field(default_factory=list)
    elapsed_seconds: float = 0.0
    vertices_visited: int = 0     # soma dos vértices visitados em todas as buscas


# ---------------------------------------------------------------------- buscas
def _dfs_path(net: FlowNetwork, s: int, t: int, rng: random.Random | None) -> tuple[list[int] | None, int]:
    """DFS iterativa (sem recursão, para suportar grafos grandes).

    Retorna (lista de ids de arestas de s a t, nº de vértices visitados).
    Se `rng` for dado, a ordem dos vizinhos é embaralhada (DFS aleatória).
    """
    n = net.num_vertices
    parent_edge = [-1] * n
    visited = [False] * n
    visited[s] = True
    count = 1

    order = net.adj
    if rng is not None:
        order = [rng.sample(lst, len(lst)) for lst in net.adj]
    ptr = [0] * n
    stack = [s]
    edges = net.edges

    while stack:
        u = stack[-1]
        if u == t:
            break
        lst = order[u]
        advanced = False
        while ptr[u] < len(lst):
            eid = lst[ptr[u]]
            ptr[u] += 1
            e = edges[eid]
            if e.residual > EPS and not visited[e.head]:
                visited[e.head] = True
                count += 1
                parent_edge[e.head] = eid
                stack.append(e.head)
                advanced = True
                break
        if not advanced:
            stack.pop()

    if not visited[t]:
        return None, count
    return _rebuild(net, parent_edge, s, t), count


def _bfs_path(net: FlowNetwork, s: int, t: int) -> tuple[list[int] | None, int]:
    n = net.num_vertices
    parent_edge = [-1] * n
    visited = [False] * n
    visited[s] = True
    count = 1
    queue = deque([s])
    edges = net.edges

    while queue:
        u = queue.popleft()
        for eid in net.adj[u]:
            e = edges[eid]
            if e.residual > EPS and not visited[e.head]:
                visited[e.head] = True
                count += 1
                parent_edge[e.head] = eid
                if e.head == t:
                    return _rebuild(net, parent_edge, s, t), count
                queue.append(e.head)
    return None, count


def _rebuild(net: FlowNetwork, parent_edge: list[int], s: int, t: int) -> list[int]:
    path = []
    v = t
    while v != s:
        eid = parent_edge[v]
        path.append(eid)
        v = net.edges[eid].tail
    path.reverse()
    return path


# ---------------------------------------------------------------------- algoritmo
def ford_fulkerson(
    net: FlowNetwork,
    source: Hashable,
    sink: Hashable,
    strategy: Strategy = "dfs",
    record: bool = True,
    max_iterations: int | None = None,
    seed: int | None = None,
) -> MaxFlowResult:
    """Calcula o fluxo máximo de `source` a `sink`.

    Parâmetros
    ----------
    strategy : "dfs" (Ford-Fulkerson) ou "bfs" (Edmonds-Karp).
    record : se True, guarda cada caminho aumentante em `result.iterations`.
    max_iterations : interrompe após esse número de iterações (útil na
        demonstração do caso patológico). O resultado então NÃO é máximo.
    seed : se dado com strategy="dfs", embaralha a ordem dos vizinhos.

    A rede `net` termina com o fluxo final gravado em cada aresta.
    """
    if strategy not in ("dfs", "bfs"):
        raise ValueError(f"Estratégia desconhecida: {strategy!r}")
    s, t = net.index_of(source), net.index_of(sink)
    if s == t:
        raise ValueError("Origem e destino devem ser vértices diferentes.")

    net.reset_flow()
    rng = random.Random(seed) if (seed is not None and strategy == "dfs") else None
    result = MaxFlowResult(source, sink, strategy if rng is None else "dfs-aleatoria", 0.0)
    start = time.perf_counter()

    while max_iterations is None or result.num_iterations < max_iterations:
        if strategy == "bfs":
            path, visited = _bfs_path(net, s, t)
        else:
            path, visited = _dfs_path(net, s, t, rng)
        result.vertices_visited += visited
        if path is None:
            break

        bottleneck = min(net.edges[eid].residual for eid in path)
        if bottleneck == INF:
            raise UnboundedFlowError(
                "Fluxo ilimitado: há um caminho de origem a destino só com capacidades infinitas."
            )
        for eid in path:
            net.push(eid, bottleneck)

        result.value += bottleneck
        result.num_iterations += 1
        if record:
            result.iterations.append(
                AugmentingPath(
                    index=result.num_iterations,
                    vertices=[net.labels[s]] + [net.labels[net.edges[eid].head] for eid in path],
                    edge_ids=path,
                    uses_reverse=[net.edges[eid].is_reverse for eid in path],
                    bottleneck=bottleneck,
                    flow_value_after=result.value,
                )
            )

    result.elapsed_seconds = time.perf_counter() - start
    result.cut_source_side, result.cut_edge_ids = min_cut(net, source)
    return result


# ---------------------------------------------------------------------- corte mínimo
def min_cut(net: FlowNetwork, source: Hashable) -> tuple[set[Hashable], list[int]]:
    """Corte mínimo a partir da rede residual atual (deve estar com fluxo máximo).

    S = vértices alcançáveis a partir da origem na rede residual.
    Arestas do corte = arestas originais com cauda em S e cabeça fora de S.
    """
    s = net.index_of(source)
    reach = [False] * net.num_vertices
    reach[s] = True
    queue = deque([s])
    while queue:
        u = queue.popleft()
        for eid in net.adj[u]:
            e = net.edges[eid]
            if e.residual > EPS and not reach[e.head]:
                reach[e.head] = True
                queue.append(e.head)

    side = {net.labels[i] for i, r in enumerate(reach) if r}
    cut = [e.id for e in net.original_edges() if reach[e.tail] and not reach[e.head]]
    return side, cut


def cut_capacity(net: FlowNetwork, cut_edge_ids: list[int]) -> float:
    return sum(net.edges[eid].capacity for eid in cut_edge_ids)


# ---------------------------------------------------------------------- passo a passo
def flows_after(net: FlowNetwork, result: MaxFlowResult, k: int) -> list[float]:
    """Fluxo em cada aresta (indexado por id) após as k primeiras iterações.

    k = 0 é a rede sem fluxo; k = result.num_iterations é o estado final.
    Não altera `net`. Requer que a execução tenha sido feita com record=True.
    """
    if k > len(result.iterations):
        raise ValueError("Iteração não registrada (execute com record=True).")
    flows = [0.0] * len(net.edges)
    for it in result.iterations[:k]:
        for eid in it.edge_ids:
            flows[eid] += it.bottleneck
            flows[net.edges[eid].twin] -= it.bottleneck
    return flows


def residual_snapshot(net: FlowNetwork, flows: list[float]) -> list[dict]:
    """Lista as arestas da rede residual para um vetor de fluxos.

    Cada item: {"id", "from", "to", "residual", "reverse"}. Pronto para a
    interface desenhar (reversas em outra cor, por exemplo).
    """
    out = []
    for e in net.edges:
        r = e.capacity - flows[e.id]
        if r > EPS:
            out.append({
                "id": e.id,
                "from": net.labels[e.tail],
                "to": net.labels[e.head],
                "residual": r,
                "reverse": e.is_reverse,
            })
    return out


def edge_flow_table(net: FlowNetwork) -> list[dict]:
    """Capacidade e fluxo final de cada aresta original."""
    return [
        {
            "id": e.id,
            "from": net.labels[e.tail],
            "to": net.labels[e.head],
            "capacity": e.capacity,
            "flow": e.flow,
            "saturated": e.residual <= EPS,
        }
        for e in net.original_edges()
    ]
