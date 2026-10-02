# Preparação de dados (Python)

Usado só offline, para gerar instâncias a partir do OpenStreetMap. A implementação
principal do algoritmo está em `api/` (PHP). A versão Python aqui serve de
referência e de validação cruzada com o NetworkX.

## Estrutura

```
src/core/flow_network.py    rede de fluxo com rede residual (aresta + gêmea reversa)
src/core/ford_fulkerson.py  Ford-Fulkerson (DFS) e Edmonds-Karp (BFS), registro das
                            iterações, corte mínimo, reconstrução passo a passo
src/core/validation.py      verificação de capacidade, conservação e corte = fluxo
src/data/json_io.py         leitura/gravação de instâncias em JSON
src/data/osm_loader.py      OpenStreetMap -> rede de fluxo de evacuação
scripts/                    demo, geração de instâncias de teste e de instâncias OSM
tests/                      testes automatizados (pytest)
```

## Instalação e uso

```
pip install -r requirements.txt
python -m scripts.make_test_instances
python -m scripts.demo ../../database/data/cormen.json --strategy dfs
python -m scripts.build_osm_instance --lat -25.4284 --lon -49.2733 --dist 1500 \
    --evac-radius 300 --safe-dist 1300 --out ../../database/data/regiao.json
python -m scripts.demo ../../database/data/regiao.json --strategy bfs --quiet
python -m pytest -q
```

## Bibliotecas de grafos (declaração exigida pelo enunciado)

O fluxo máximo, a rede residual e o corte mínimo são implementação própria e não
usam biblioteca de grafos. O **OSMnx** é usado só para baixar e salvar em cache a
malha viária. O **NetworkX** aparece só como formato do grafo entregue pelo OSMnx
e, nos testes, para validação cruzada do valor do fluxo.

## Uso pela interface

```python
r = ford_fulkerson(net, s, t, strategy="dfs")   # ou "bfs"
r.value, r.num_iterations, r.elapsed_seconds
r.iterations[k].vertices / .bottleneck / .uses_reverse   # caminhos aumentantes
flows = flows_after(net, r, k)        # estado após a k-ésima iteração
residual_snapshot(net, flows)         # rede residual nesse passo
edge_flow_table(net)                  # fluxo / capacidade final por aresta
r.cut_edge_ids                        # arestas do corte mínimo (gargalos)
```

## Limitações conhecidas

- Capacidades por faixa e faixas padrão em `osm_loader.py` são estimativas; justificar com a fonte.
- Em vias de mão dupla, a tag `lanes` é dividida igualmente entre os sentidos.
- A DFS com ordem fixa não reproduz o pior caso de 2M iterações; ele exige escolha adversária.
- A DFS fica lenta em grafos de milhares de vértices (ex.: 5.000 vértices, ~10 s contra ~0,15 s da BFS).
