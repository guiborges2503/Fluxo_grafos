"""
Carregador da malha viária do OpenStreetMap para o problema de evacuação.

Bibliotecas usadas (declarar no README e no relatório):
    - OSMnx: SOMENTE para baixar e salvar em cache o grafo viário.
    - NetworkX: estrutura em que o OSMnx entrega o grafo; lida aqui apenas
      para extrair vértices e arestas. O fluxo máximo NÃO usa NetworkX.

Modelagem:
    vértice  = interseção (nó do OSM)
    aresta   = trecho de via dirigível; o OSMnx já cria 1 arco para mão
               única e 2 arcos opostos para mão dupla
    capacidade (veículos/h) = faixas no sentido × capacidade por faixa do tipo de via
    superorigem "S*" -> nós da área a evacuar (capacidade infinita)
    nós seguros (saídas) -> superdestino "T*" (capacidade infinita)

ATENÇÃO: os valores de CAPACITY_PER_LANE e DEFAULT_LANES são ESTIMATIVAS
de referência para o trabalho. Justifiquem/ajustem com a fonte usada
(ex.: Highway Capacity Manual) e citem no relatório.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from ..core.flow_network import INF, FlowNetwork

SUPER_SOURCE = "S*"
SUPER_SINK = "T*"

# Capacidade por faixa (veículos/hora/faixa) por tipo de via. ESTIMATIVA.
CAPACITY_PER_LANE: dict[str, float] = {
    "motorway": 2000, "motorway_link": 1500,
    "trunk": 1800, "trunk_link": 1400,
    "primary": 1500, "primary_link": 1200,
    "secondary": 1200, "secondary_link": 1000,
    "tertiary": 900, "tertiary_link": 800,
    "unclassified": 700, "residential": 600,
    "living_street": 300, "service": 400, "road": 600,
}
DEFAULT_CAPACITY_PER_LANE = 600.0

# Faixas por sentido quando a tag "lanes" não existe. ESTIMATIVA.
DEFAULT_LANES: dict[str, int] = {
    "motorway": 2, "trunk": 2, "primary": 2,
}
DEFAULT_LANES_FALLBACK = 1


@dataclass
class BuildStats:
    """Estatísticas da conversão, para documentar limitações dos dados."""
    osm_nodes: int = 0
    osm_edges: int = 0
    flow_edges: int = 0
    merged_parallel: int = 0
    lanes_estimated: int = 0          # arestas sem tag "lanes"
    highway_types: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


# ---------------------------------------------------------------------- download
def download_graph(
    place: str | None = None,
    center: tuple[float, float] | None = None,
    dist: float | None = None,
    cache_dir: str | Path | None = None,
    force: bool = False,
):
    """Baixa (ou lê do cache) o grafo dirigível de uma região.

    Use `place="Centro, Curitiba, Brasil"` OU `center=(lat, lon)` com `dist` em metros.
    O resultado fica salvo em GraphML: a apresentação não depende de internet.
    """
    import osmnx as ox  # dependência só deste módulo

    if cache_dir is None:
        cache_dir = Path(__file__).resolve().parents[4] / "database" / "data" / "osm_cache"

    if place:
        key = place
    elif center and dist:
        key = f"{center[0]:.5f}_{center[1]:.5f}_{int(dist)}m"
    else:
        raise ValueError("Informe `place` ou `center` + `dist`.")

    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / (re.sub(r"[^\w.-]+", "_", key).strip("_") + ".graphml")

    if path.exists() and not force:
        return ox.load_graphml(path)

    ox.settings.use_cache = True
    if place:
        G = ox.graph_from_place(place, network_type="drive")
    else:
        G = ox.graph_from_point(center, dist=dist, network_type="drive")
    ox.save_graphml(G, path)
    return G


# ---------------------------------------------------------------------- capacidade
def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    text = str(value)
    if text.startswith("[") and text.endswith("]"):   # listas salvas como texto no GraphML
        return [p.strip(" '\"") for p in text[1:-1].split(",") if p.strip(" '\"")]
    return [text]


def _parse_lanes(value: Any) -> int | None:
    """Converte a tag lanes ("2", ["2","3"], "2;3") no menor valor válido."""
    nums = []
    for item in _as_list(value):
        for part in str(item).split(";"):
            try:
                n = int(float(part))
                if n > 0:
                    nums.append(n)
            except ValueError:
                pass
    return min(nums) if nums else None   # menor = trecho mais restritivo


def _is_oneway(value: Any) -> bool:
    return str(value).strip().lower() in ("true", "1", "yes")


def edge_capacity(data: dict) -> tuple[float, str, bool]:
    """Capacidade (veículos/h) de um arco do OSMnx.

    Retorna (capacidade, tipo de via usado, faixas foram estimadas?).

    - Vários tipos de via no mesmo arco (trecho simplificado) -> usa o mais
      restritivo.
    - Em vias de mão dupla, a tag lanes conta os dois sentidos; usa-se
      ceil(lanes / 2) por sentido.
    """
    types = [str(h) for h in _as_list(data.get("highway"))] or ["road"]
    per_lane = min(CAPACITY_PER_LANE.get(h, DEFAULT_CAPACITY_PER_LANE) for h in types)
    htype = min(types, key=lambda h: CAPACITY_PER_LANE.get(h, DEFAULT_CAPACITY_PER_LANE))

    lanes = _parse_lanes(data.get("lanes"))
    estimated = lanes is None
    if estimated:
        lanes_dir = min(DEFAULT_LANES.get(h, DEFAULT_LANES_FALLBACK) for h in types)
    elif _is_oneway(data.get("oneway")):
        lanes_dir = lanes
    else:
        lanes_dir = max(1, math.ceil(lanes / 2))

    return float(lanes_dir * per_lane), htype, estimated


# ---------------------------------------------------------------------- conversão
def build_flow_network(G, name: str = "osm") -> tuple[FlowNetwork, BuildStats]:
    """Converte o MultiDiGraph do OSMnx em FlowNetwork (sem origem/destino ainda).

    Arcos paralelos u->v (vias diferentes ligando as mesmas interseções)
    são fundidos somando as capacidades.
    """
    stats = BuildStats(osm_nodes=G.number_of_nodes(), osm_edges=G.number_of_edges())
    net = FlowNetwork(name)
    for node, d in G.nodes(data=True):
        net.add_vertex(node, lat=float(d["y"]), lon=float(d["x"]))

    merged: dict[tuple, dict] = {}
    for u, v, d in G.edges(data=True):
        if u == v:
            continue  # laços (retornos) não transportam fluxo
        cap, htype, estimated = edge_capacity(d)
        stats.highway_types[htype] = stats.highway_types.get(htype, 0) + 1
        stats.lanes_estimated += int(estimated)
        key = (u, v)
        if key in merged:
            merged[key]["capacity"] += cap
            stats.merged_parallel += 1
        else:
            merged[key] = {
                "capacity": cap,
                "highway": htype,
                "name": str(d.get("name", "")),
                "length_m": float(d.get("length", 0.0)),
                "lanes_estimated": estimated,
            }

    for (u, v), attrs in merged.items():
        cap = attrs.pop("capacity")
        net.add_edge(u, v, cap, **attrs)
    stats.flow_edges = net.num_edges
    return net, stats


# ---------------------------------------------------------------------- origem/destino
def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nodes_within(net: FlowNetwork, center: tuple[float, float], radius_m: float) -> list:
    """Nós a até `radius_m` do centro: a área a evacuar."""
    lat, lon = center
    return [
        lbl for lbl, a in zip(net.labels, net.vertex_attrs)
        if "lat" in a and haversine_m(lat, lon, a["lat"], a["lon"]) <= radius_m
    ]


def nodes_beyond(net: FlowNetwork, center: tuple[float, float], min_dist_m: float) -> list:
    """Nós a pelo menos `min_dist_m` do centro: as saídas / zona segura."""
    lat, lon = center
    return [
        lbl for lbl, a in zip(net.labels, net.vertex_attrs)
        if "lat" in a and haversine_m(lat, lon, a["lat"], a["lon"]) >= min_dist_m
    ]


def nearest_node(net: FlowNetwork, lat: float, lon: float):
    """Nó mais próximo de um ponto (busca linear, suficiente para alguns milhares de nós)."""
    best, best_d = None, INF
    for lbl, a in zip(net.labels, net.vertex_attrs):
        if "lat" in a:
            d = haversine_m(lat, lon, a["lat"], a["lon"])
            if d < best_d:
                best, best_d = lbl, d
    return best


def add_super_terminals(net: FlowNetwork, sources: Iterable, sinks: Iterable) -> tuple[str, str]:
    """Liga S* às origens e os destinos a T*, com capacidade infinita."""
    sources, sinks = list(dict.fromkeys(sources)), list(dict.fromkeys(sinks))
    overlap = set(sources) & set(sinks)
    if overlap:
        raise ValueError(f"{len(overlap)} nós são ao mesmo tempo origem e destino.")
    if not sources or not sinks:
        raise ValueError("É preciso ao menos um nó de origem e um de destino.")
    net.add_vertex(SUPER_SOURCE, role="super_source")
    net.add_vertex(SUPER_SINK, role="super_sink")
    for v in sources:
        net.add_edge(SUPER_SOURCE, v, INF, artificial=True)
    for v in sinks:
        net.add_edge(v, SUPER_SINK, INF, artificial=True)
    return SUPER_SOURCE, SUPER_SINK


def build_evacuation_instance(
    G,
    center: tuple[float, float],
    evacuation_radius_m: float,
    safe_distance_m: float,
    name: str = "evacuacao",
) -> tuple[FlowNetwork, str, str, BuildStats]:
    """Instância completa em anel: evacuar o círculo central para a borda.

    Origens = nós a até `evacuation_radius_m` do centro.
    Destinos = nós a pelo menos `safe_distance_m` do centro.
    """
    if safe_distance_m <= evacuation_radius_m:
        raise ValueError("A distância segura deve ser maior que o raio de evacuação.")
    net, stats = build_flow_network(G, name)
    sources = nodes_within(net, center, evacuation_radius_m)
    sinks = nodes_beyond(net, center, safe_distance_m)
    s, t = add_super_terminals(net, sources, sinks)
    return net, s, t, stats
