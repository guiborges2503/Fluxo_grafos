"""Testa a conversão OSM -> rede de fluxo com um grafo no formato do OSMnx
(MultiDiGraph com atributos x, y, highway, lanes, oneway), sem internet."""

import math

import networkx as nx
import pytest

from src.core.ford_fulkerson import ford_fulkerson
from src.core.validation import verify_max_flow
from src.data.osm_loader import (
    SUPER_SINK, SUPER_SOURCE, add_super_terminals, build_evacuation_instance,
    build_flow_network, edge_capacity, haversine_m,
)


def test_capacity_oneway_uses_all_lanes():
    cap, h, est = edge_capacity({"highway": "primary", "lanes": "3", "oneway": True})
    assert (cap, h, est) == (3 * 1500, "primary", False)


def test_capacity_twoway_splits_lanes():
    cap, _, _ = edge_capacity({"highway": "secondary", "lanes": "4", "oneway": False})
    assert cap == 2 * 1200
    cap, _, _ = edge_capacity({"highway": "secondary", "lanes": "3", "oneway": False})
    assert cap == 2 * 1200   # ceil(3/2)


def test_capacity_missing_lanes_is_estimated():
    cap, _, est = edge_capacity({"highway": "residential", "oneway": False})
    assert est and cap == 600


def test_capacity_lists_use_most_restrictive():
    cap, h, _ = edge_capacity({"highway": ["primary", "residential"], "lanes": ["2", "1"], "oneway": True})
    assert h == "residential" and cap == 600


def test_capacity_list_as_text_from_graphml():
    cap, h, _ = edge_capacity({"highway": "['tertiary', 'primary']", "lanes": "2", "oneway": "True"})
    assert h == "tertiary" and cap == 2 * 900


def _grid(n=6, step=0.002, lat0=-25.43, lon0=-49.27):
    """Malha n×n de ruas residenciais de mão dupla com uma avenida no meio."""
    G = nx.MultiDiGraph()
    for i in range(n):
        for j in range(n):
            G.add_node((i, j), y=lat0 + i * step, x=lon0 + j * step)
    for i in range(n):
        for j in range(n):
            for di, dj in ((0, 1), (1, 0)):
                a, b = (i, j), (i + di, j + dj)
                if b in G:
                    hw = "primary" if i == n // 2 and di == 0 else "residential"
                    attrs = dict(highway=hw, oneway=False, length=200.0)
                    G.add_edge(a, b, **attrs)
                    G.add_edge(b, a, **attrs)
    return G


def test_parallel_edges_are_merged():
    G = nx.MultiDiGraph()
    G.add_node(1, x=0, y=0)
    G.add_node(2, x=0.001, y=0)
    G.add_edge(1, 2, highway="residential", oneway=True)
    G.add_edge(1, 2, highway="residential", oneway=True)
    net, stats = build_flow_network(G)
    assert net.num_edges == 1 and stats.merged_parallel == 1
    assert next(net.original_edges()).capacity == 1200


def test_evacuation_instance_end_to_end():
    G = _grid()
    center = (-25.43 + 0.005, -49.27 + 0.005)
    net, s, t, stats = build_evacuation_instance(G, center, evacuation_radius_m=250, safe_distance_m=600)
    assert (s, t) == (SUPER_SOURCE, SUPER_SINK)
    r = ford_fulkerson(net, s, t, strategy="bfs")
    assert r.value > 0 and not math.isinf(r.value)
    assert verify_max_flow(net, r) == []
    # o corte nunca deve conter arestas artificiais de capacidade infinita
    assert all(not math.isinf(net.edges[e].capacity) for e in r.cut_edge_ids)


def test_overlapping_terminals_rejected():
    net, _ = build_flow_network(_grid(3))
    with pytest.raises(ValueError):
        add_super_terminals(net, [(0, 0)], [(0, 0)])


def test_haversine_known_distance():
    # 0,01° de latitude ≈ 1,11 km
    assert abs(haversine_m(0, 0, 0.01, 0) - 1112) < 5
