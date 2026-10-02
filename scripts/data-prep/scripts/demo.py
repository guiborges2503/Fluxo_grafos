"""
Executa Ford-Fulkerson numa instância JSON e imprime cada iteração.

    python -m scripts.demo ../../database/data/cormen.json --strategy dfs
"""

import argparse

from src.core.ford_fulkerson import edge_flow_table, ford_fulkerson
from src.core.validation import verify_max_flow
from src.data.json_io import load_instance


def fmt(x: float) -> str:
    return f"{x:g}"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("instance")
    p.add_argument("--strategy", choices=["dfs", "bfs"], default="dfs")
    p.add_argument("--seed", type=int, default=None, help="DFS com vizinhos embaralhados")
    p.add_argument("--quiet", action="store_true", help="não lista iterações nem arestas")
    a = p.parse_args()

    net, s, t = load_instance(a.instance)
    print(f"{net}  origem={s}  destino={t}  estratégia={a.strategy}\n")
    r = ford_fulkerson(net, s, t, strategy=a.strategy, seed=a.seed)

    if not a.quiet:
        for it in r.iterations:
            path = " -> ".join(str(v) for v in it.vertices)
            rev = sum(it.uses_reverse)
            extra = f"  ({rev} aresta(s) reversa(s))" if rev else ""
            print(f"#{it.index:>3}  gargalo={fmt(it.bottleneck):>6}  total={fmt(it.flow_value_after):>6}  {path}{extra}")
        print("\nAresta              fluxo / capacidade")
        for row in edge_flow_table(net):
            mark = "  (saturada)" if row["saturated"] else ""
            print(f"{str(row['from']):>6} -> {str(row['to']):<6}   {fmt(row['flow']):>6} / {fmt(row['capacity'])}{mark}")

    print(f"\nFluxo máximo: {fmt(r.value)}   iterações: {r.num_iterations}   tempo: {r.elapsed_seconds*1000:.2f} ms")
    cut = [net.describe_edge(e) for e in r.cut_edge_ids]
    print(f"Corte mínimo ({len(cut)} arestas): {', '.join(cut[:20])}{' ...' if len(cut) > 20 else ''}")
    problems = verify_max_flow(net, r)
    print("Validação: OK" if not problems else "Validação: FALHOU\n  " + "\n  ".join(problems))


if __name__ == "__main__":
    main()
