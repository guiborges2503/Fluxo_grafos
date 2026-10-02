import math
import random

import pytest

from scripts.make_test_instances import cormen, disconnected, pathological
from src.core.flow_network import FlowNetwork
from src.core.ford_fulkerson import (
    UnboundedFlowError, cut_capacity, flows_after, ford_fulkerson, residual_snapshot,
)
from src.core.validation import compare_with_networkx, verify_max_flow
from src.data.json_io import network_from_dict, network_to_dict

STRATEGIES = ["dfs", "bfs"]


@pytest.mark.parametrize("strategy", STRATEGIES)
def test_cormen_value_23(strategy):
    net = cormen()
    r = ford_fulkerson(net, "s", "t", strategy=strategy)
    assert r.value == 23
    assert verify_max_flow(net, r) == []
    assert cut_capacity(net, r.cut_edge_ids) == 23


@pytest.mark.parametrize("strategy", STRATEGIES)
def test_no_path_gives_zero(strategy):
    net = disconnected()
    r = ford_fulkerson(net, "s", "t", strategy=strategy)
    assert r.value == 0 and r.num_iterations == 0 and r.cut_edge_ids == []


def test_source_equals_sink_rejected():
    with pytest.raises(ValueError):
        ford_fulkerson(cormen(), "s", "s")


def test_single_edge():
    net = FlowNetwork()
    net.add_edge("s", "t", 7)
    assert ford_fulkerson(net, "s", "t").value == 7


def test_zero_capacity_path():
    net = FlowNetwork()
    net.add_edge("s", "a", 5)
    net.add_edge("a", "t", 0)
    assert ford_fulkerson(net, "s", "t").value == 0


@pytest.mark.parametrize("strategy", STRATEGIES)
def test_parallel_and_antiparallel_edges(strategy):
    net = FlowNetwork()
    net.add_edge("s", "a", 3)
    net.add_edge("s", "a", 2)        # paralela
    net.add_edge("a", "b", 4)
    net.add_edge("b", "a", 6)        # antiparalela (mão dupla)
    net.add_edge("b", "t", 10)
    net.add_edge("a", "t", 1)
    r = ford_fulkerson(net, "s", "t", strategy=strategy)
    assert r.value == 5
    assert verify_max_flow(net, r) == []


def test_negative_capacity_rejected():
    with pytest.raises(ValueError):
        FlowNetwork().add_edge("s", "t", -1)


def test_unbounded_detected():
    net = FlowNetwork()
    net.add_edge("s", "a", math.inf)
    net.add_edge("a", "t", math.inf)
    with pytest.raises(UnboundedFlowError):
        ford_fulkerson(net, "s", "t")


def test_infinite_terminal_edges_are_fine():
    net = FlowNetwork()
    net.add_edge("S*", "x", math.inf)
    net.add_edge("x", "y", 1800)
    net.add_edge("y", "T*", math.inf)
    r = ford_fulkerson(net, "S*", "T*")
    assert r.value == 1800 and verify_max_flow(net, r) == []


def test_pathological_bfs_two_iterations():
    net = pathological(1000)
    r = ford_fulkerson(net, "s", "t", strategy="bfs")
    assert r.value == 2000 and r.num_iterations == 2


def test_step_by_step_replay_matches_final_state():
    net = cormen()
    r = ford_fulkerson(net, "s", "t")
    final = flows_after(net, r, r.num_iterations)
    assert final == [e.flow for e in net.edges]
    assert flows_after(net, r, 0) == [0.0] * len(net.edges)
    # na rede residual inicial só há arestas originais
    assert all(not e["reverse"] for e in residual_snapshot(net, flows_after(net, r, 0)))


def test_paths_are_valid_and_values_increase():
    net = cormen()
    r = ford_fulkerson(net, "s", "t")
    total = 0
    for it in r.iterations:
        assert it.vertices[0] == "s" and it.vertices[-1] == "t"
        assert it.bottleneck > 0
        total += it.bottleneck
        assert it.flow_value_after == total


def test_json_roundtrip_keeps_result():
    net = cormen()
    net2, s, t = network_from_dict(network_to_dict(net, "s", "t"))
    assert ford_fulkerson(net2, s, t).value == 23


@pytest.mark.parametrize("seed", range(20))
def test_random_graphs_against_networkx(seed):
    rng = random.Random(seed)
    n = rng.randint(5, 60)
    net = FlowNetwork()
    for v in range(n):
        net.add_vertex(v)
    for _ in range(n * 3):
        u, v = rng.randrange(n), rng.randrange(n)
        if u != v:
            net.add_edge(u, v, rng.randint(0, 50))
    for strategy in STRATEGIES:
        r = ford_fulkerson(net, 0, n - 1, strategy=strategy)
        assert verify_max_flow(net, r) == []
        same, _ = compare_with_networkx(net, r)
        assert same
