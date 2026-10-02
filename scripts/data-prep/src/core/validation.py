"""
Verificação automática da correção de um fluxo máximo.

Checa as propriedades que definem um fluxo válido e o certificado de
otimalidade (teorema fluxo máximo = corte mínimo). A comparação com o
NetworkX é opcional e serve APENAS para validação cruzada.
"""

from __future__ import annotations

from .flow_network import EPS, FlowNetwork
from .ford_fulkerson import MaxFlowResult, cut_capacity


def _close(a: float, b: float, tol: float = 1e-6) -> bool:
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def verify_max_flow(net: FlowNetwork, result: MaxFlowResult) -> list[str]:
    """Retorna a lista de problemas encontrados (vazia = fluxo correto)."""
    problems: list[str] = []
    s, t = net.index_of(result.source), net.index_of(result.sink)

    # 1. Restrição de capacidade: 0 <= f(e) <= c(e)
    for e in net.original_edges():
        if e.flow < -EPS or e.flow > e.capacity + EPS:
            problems.append(f"Capacidade violada em {net.describe_edge(e.id)}: f={e.flow}, c={e.capacity}")

    # 2. Conservação: entrada = saída em todo vértice exceto s e t
    balance = [0.0] * net.num_vertices
    for e in net.original_edges():
        balance[e.tail] -= e.flow
        balance[e.head] += e.flow
    for v, b in enumerate(balance):
        if v not in (s, t) and abs(b) > 1e-6:
            problems.append(f"Conservação violada em {net.labels[v]!r}: saldo {b}")

    # 3. Valor do fluxo = saída líquida da origem = entrada líquida no destino
    if not _close(-balance[s], result.value):
        problems.append(f"Saída líquida da origem ({-balance[s]}) difere do valor ({result.value})")
    if not _close(balance[t], result.value):
        problems.append(f"Entrada líquida no destino ({balance[t]}) difere do valor ({result.value})")

    # 4. Certificado de otimalidade: valor = capacidade do corte mínimo
    if result.sink in result.cut_source_side:
        problems.append("O destino ainda é alcançável na rede residual: o fluxo não é máximo.")
    cap = cut_capacity(net, result.cut_edge_ids)
    if not _close(cap, result.value):
        problems.append(f"Capacidade do corte ({cap}) difere do valor do fluxo ({result.value})")

    return problems


def compare_with_networkx(net: FlowNetwork, result: MaxFlowResult) -> tuple[bool, float]:
    """Validação cruzada com networkx.maximum_flow_value (somente teste).

    Arestas paralelas são somadas, pois o DiGraph do NetworkX não as aceita.
    Retorna (valores iguais?, valor do NetworkX).
    """
    import networkx as nx  # importado aqui: dependência apenas de validação

    g = nx.DiGraph()
    g.add_nodes_from(range(net.num_vertices))
    for e in net.original_edges():
        if g.has_edge(e.tail, e.head):
            g[e.tail][e.head]["capacity"] += e.capacity
        else:
            g.add_edge(e.tail, e.head, capacity=e.capacity)
    value = nx.maximum_flow_value(g, net.index_of(result.source), net.index_of(result.sink))
    return _close(value, result.value), value
