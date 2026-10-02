"""Gera as instâncias pequenas de teste em database/data/."""

from pathlib import Path

from src.core.flow_network import FlowNetwork
from src.data.json_io import save_instance

OUT = Path(__file__).resolve().parents[3] / "database" / "data"


def cormen() -> FlowNetwork:
    # Exemplo da figura de fluxo máximo do Cormen (3ª ed.); fluxo máximo esperado: 23
    net = FlowNetwork("cormen")
    for u, v, c in [("s", "v1", 16), ("s", "v2", 13), ("v2", "v1", 4), ("v1", "v3", 12),
                    ("v3", "v2", 9), ("v2", "v4", 14), ("v4", "v3", 7), ("v3", "t", 20), ("v4", "t", 4)]:
        net.add_edge(u, v, c)
    return net


def pathological(m: int = 1000) -> FlowNetwork:
    # Caso clássico do pior caso: uma escolha ADVERSÁRIA de caminhos (sempre pela
    # aresta central a-b, alternando o sentido) exige 2M iterações. A DFS com ordem
    # fixa de vizinhos desta implementação não faz essa escolha e termina em 4;
    # a BFS (Edmonds-Karp) termina em 2. Discutir isso no relatório.
    net = FlowNetwork(f"patologico_M{m}")
    for u, v, c in [("s", "a", m), ("s", "b", m), ("a", "b", 1), ("a", "t", m), ("b", "t", m)]:
        net.add_edge(u, v, c)
    return net


def disconnected() -> FlowNetwork:
    net = FlowNetwork("sem_caminho")
    net.add_edge("s", "a", 5)
    net.add_edge("b", "t", 5)
    return net


if __name__ == "__main__":
    save_instance(OUT / "cormen.json", cormen(), "s", "t", "Cormen et al., fluxo máximo 23")
    save_instance(OUT / "patologico.json", pathological(), "s", "t", "Pior caso do Ford-Fulkerson, M=1000")
    save_instance(OUT / "sem_caminho.json", disconnected(), "s", "t", "Origem e destino desconectados")
    print(f"Instâncias gravadas em {OUT}")
