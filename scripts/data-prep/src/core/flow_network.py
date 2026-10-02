"""
Rede de fluxo com representação residual implícita.

Cada aresta original u->v com capacidade c é armazenada junto com uma
aresta reversa v->u de capacidade 0 ("gêmea"). O fluxo da reversa é
sempre o oposto do fluxo da original, de modo que:

    capacidade residual(e) = e.capacity - e.flow

vale para as duas. Empurrar d unidades por e significa
    e.flow += d   e   gêmea(e).flow -= d.

Arestas antiparalelas (u->v e v->u, como numa rua de mão dupla) NÃO são
fundidas: cada uma tem sua própria gêmea. Isso mantém a correção da rede
residual sem nenhum tratamento especial.

Nenhuma biblioteca de grafos é usada neste módulo.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Hashable, Iterator

EPS = 1e-9
INF = math.inf


@dataclass(slots=True)
class Edge:
    """Aresta da rede residual (original ou reversa)."""

    id: int
    tail: int               # índice interno do vértice de origem
    head: int               # índice interno do vértice de destino
    capacity: float         # capacidade (0 para arestas reversas)
    flow: float = 0.0
    twin: int = -1          # id da aresta gêmea
    is_reverse: bool = False
    attrs: dict[str, Any] = field(default_factory=dict)

    @property
    def residual(self) -> float:
        return self.capacity - self.flow


class FlowNetwork:
    """Grafo direcionado com capacidades, pronto para algoritmos de fluxo."""

    def __init__(self, name: str = "") -> None:
        self.name = name
        self.edges: list[Edge] = []
        self.adj: list[list[int]] = []          # vértice -> ids de arestas que saem dele
        self._index: dict[Hashable, int] = {}   # rótulo -> índice interno
        self.labels: list[Hashable] = []        # índice interno -> rótulo
        self.vertex_attrs: list[dict[str, Any]] = []
        self.original_edge_ids: list[int] = []

    # ------------------------------------------------------------------ vértices
    def add_vertex(self, label: Hashable, **attrs: Any) -> int:
        if label in self._index:
            idx = self._index[label]
            self.vertex_attrs[idx].update(attrs)
            return idx
        idx = len(self.labels)
        self._index[label] = idx
        self.labels.append(label)
        self.adj.append([])
        self.vertex_attrs.append(dict(attrs))
        return idx

    def index_of(self, label: Hashable) -> int:
        try:
            return self._index[label]
        except KeyError:
            raise KeyError(f"Vértice inexistente: {label!r}") from None

    def has_vertex(self, label: Hashable) -> bool:
        return label in self._index

    @property
    def num_vertices(self) -> int:
        return len(self.labels)

    @property
    def num_edges(self) -> int:
        """Número de arestas originais (sem contar as reversas)."""
        return len(self.original_edge_ids)

    # ------------------------------------------------------------------ arestas
    def add_edge(self, u: Hashable, v: Hashable, capacity: float, **attrs: Any) -> int:
        """Adiciona u->v e sua reversa. Retorna o id da aresta original."""
        if capacity < 0:
            raise ValueError(f"Capacidade negativa em {u!r}->{v!r}: {capacity}")
        if u == v:
            raise ValueError(f"Laço não permitido em {u!r}")
        ui, vi = self.add_vertex(u), self.add_vertex(v)

        fwd_id, rev_id = len(self.edges), len(self.edges) + 1
        self.edges.append(Edge(fwd_id, ui, vi, float(capacity), twin=rev_id, attrs=dict(attrs)))
        self.edges.append(Edge(rev_id, vi, ui, 0.0, twin=fwd_id, is_reverse=True))
        self.adj[ui].append(fwd_id)
        self.adj[vi].append(rev_id)
        self.original_edge_ids.append(fwd_id)
        return fwd_id

    def push(self, edge_id: int, amount: float) -> None:
        """Empurra `amount` unidades de fluxo pela aresta residual `edge_id`."""
        e = self.edges[edge_id]
        e.flow += amount
        self.edges[e.twin].flow -= amount

    def reset_flow(self) -> None:
        for e in self.edges:
            e.flow = 0.0

    def original_edges(self) -> Iterator[Edge]:
        for eid in self.original_edge_ids:
            yield self.edges[eid]

    def residual_edges(self) -> Iterator[Edge]:
        """Arestas com capacidade residual positiva (inclui reversas)."""
        for e in self.edges:
            if e.residual > EPS:
                yield e

    # ------------------------------------------------------------------ utilidades
    def describe_edge(self, edge_id: int) -> str:
        e = self.edges[edge_id]
        arrow = "<-(rev)-" if e.is_reverse else "->"
        return f"{self.labels[e.tail]} {arrow} {self.labels[e.head]}"

    def copy_structure(self) -> "FlowNetwork":
        """Cópia sem fluxo (útil para rodar outro algoritmo na mesma instância)."""
        other = FlowNetwork(self.name)
        for label, attrs in zip(self.labels, self.vertex_attrs):
            other.add_vertex(label, **attrs)
        for e in self.original_edges():
            other.add_edge(self.labels[e.tail], self.labels[e.head], e.capacity, **e.attrs)
        return other

    def __repr__(self) -> str:
        return f"FlowNetwork(name={self.name!r}, V={self.num_vertices}, E={self.num_edges})"
