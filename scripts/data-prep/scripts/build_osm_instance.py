"""
Gera uma instância de evacuação a partir do OpenStreetMap e salva em JSON.

Exemplo (download num raio de 1,5 km, evacuando os 300 m centrais
para a zona a mais de 1,3 km do centro):
    python -m scripts.build_osm_instance --lat -25.4284 --lon -49.2733 \
        --dist 1500 --evac-radius 300 --safe-dist 1300 \
        --out ../../database/data/curitiba_centro.json

O GraphML bruto fica em database/data/osm_cache/ e o JSON final pode ser
carregado sem internet e sem OSMnx.
"""

import argparse

from src.data.json_io import save_instance
from src.data.osm_loader import build_evacuation_instance, download_graph


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--dist", type=float, required=True, help="raio do download (m)")
    p.add_argument("--evac-radius", type=float, required=True, help="raio da área a evacuar (m)")
    p.add_argument("--safe-dist", type=float, required=True, help="distância mínima da zona segura (m)")
    p.add_argument("--out", required=True)
    p.add_argument("--name", default="evacuacao")
    a = p.parse_args()

    center = (a.lat, a.lon)
    G = download_graph(center=center, dist=a.dist)
    net, s, t, stats = build_evacuation_instance(G, center, a.evac_radius, a.safe_dist, a.name)
    desc = (f"OSM, centro {center}, download {a.dist} m, evacuação {a.evac_radius} m, "
            f"zona segura >= {a.safe_dist} m. Estatísticas: {stats.as_dict()}")
    save_instance(a.out, net, s, t, desc)
    print(f"{net} salvo em {a.out}")
    print(f"Arestas com faixas estimadas: {stats.lanes_estimated} de {stats.osm_edges}")


if __name__ == "__main__":
    main()
