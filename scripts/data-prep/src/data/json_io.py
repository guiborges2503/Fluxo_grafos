"""
Leitura e gravação de instâncias em JSON.

Formato:
{
  "name": "exemplo",
  "description": "texto livre",
  "source": "s",
  "sink": "t",
  "vertices": [{"id": "s", "lat": -23.5, "lon": -46.6}, ...],   # atributos opcionais
  "edges": [{"from": "s", "to": "a", "capacity": 10, ...}, ...]  # atributos extras opcionais
}

Capacidade infinita é gravada como a string "inf".
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from ..core.flow_network import FlowNetwork


def _cap_to_json(c: float) -> Any:
    return "inf" if math.isinf(c) else c


def _cap_from_json(c: Any) -> float:
    return math.inf if c in ("inf", "Infinity") else float(c)


def network_to_dict(net: FlowNetwork, source: Any, sink: Any, description: str = "") -> dict:
    return {
        "name": net.name,
        "description": description,
        "source": source,
        "sink": sink,
        "vertices": [{"id": lbl, **attrs} for lbl, attrs in zip(net.labels, net.vertex_attrs)],
        "edges": [
            {
                "from": net.labels[e.tail],
                "to": net.labels[e.head],
                "capacity": _cap_to_json(e.capacity),
                **e.attrs,
            }
            for e in net.original_edges()
        ],
    }


def network_from_dict(data: dict) -> tuple[FlowNetwork, Any, Any]:
    net = FlowNetwork(data.get("name", ""))
    for v in data.get("vertices", []):
        attrs = {k: val for k, val in v.items() if k != "id"}
        net.add_vertex(v["id"], **attrs)
    for e in data["edges"]:
        attrs = {k: val for k, val in e.items() if k not in ("from", "to", "capacity")}
        net.add_edge(e["from"], e["to"], _cap_from_json(e["capacity"]), **attrs)
    source, sink = data.get("source"), data.get("sink")
    for label in (source, sink):
        if label is not None and not net.has_vertex(label):
            raise ValueError(f"Origem/destino {label!r} não existe na instância.")
    return net, source, sink


def save_instance(path: str | Path, net: FlowNetwork, source: Any, sink: Any, description: str = "") -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(network_to_dict(net, source, sink, description), f, ensure_ascii=False, indent=1)


def load_instance(path: str | Path) -> tuple[FlowNetwork, Any, Any]:
    with open(path, encoding="utf-8") as f:
        return network_from_dict(json.load(f))
