# Fluxo máximo com Ford-Fulkerson — capacidade de evacuação urbana

Tema 7 — Fluxo em Grafos. A aplicação calcula quantos veículos por hora conseguem sair
de uma região pela malha viária e mostra quais ruas são o gargalo (corte mínimo).

**Integrantes:** [Nome 1], [Nome 2], [Nome 3], [Nome 4]

## Arquitetura

```
api/         PHP 7.4+  endpoints e implementação PRINCIPAL do Ford-Fulkerson
src/         React + TypeScript (Vite)  interface; repete o algoritmo no navegador
database/    instâncias JSON em database/data
scripts/     servidor de desenvolvimento e preparação de dados (Python, offline)
public/      arquivos estáticos publicados com o build
docs/        documentação
uploads/     arquivos enviados
```

| Onde | Arquivo | Papel |
| --- | --- | --- |
| PHP | `api/app/Services/FordFulkerson.php` | Algoritmo oficial: DFS (Ford-Fulkerson) e BFS (Edmonds-Karp), corte mínimo |
| PHP | `api/app/Services/FlowNetwork.php` | Rede residual (aresta 2i e reversa 2i+1) |
| PHP | `api/app/Validators/Validation.php` | Capacidade, conservação e corte = fluxo |
| TS | `src/utils/fordFulkerson.ts` | Mesmo algoritmo, mesma ordem de visita; passo a passo e rede residual |
| Python | `scripts/data-prep/src/data/osm_loader.py` | OpenStreetMap -> instância de evacuação |

Servidor e navegador seguem a mesma ordem de visita dos vizinhos, então produzem os
mesmos caminhos aumentantes. A interface compara os dois a cada execução.

## Requisitos

- PHP 7.4 ou superior (só a CLI ou o Apache do WAMP; sem Composer, sem banco de dados, sem extensões além das padrão).
  Testado no PHP 7.4.33 e no 8.3.
- Node.js 18 ou superior
- Python 3.10+ apenas se for gerar novas instâncias do OpenStreetMap

## Como executar

Na raiz do projeto:

```
npm install
npm run dev
```

Esse comando sobe os dois processos: a API PHP em `http://127.0.0.1:8000` e o frontend
em `http://127.0.0.1:5173`. O Vite encaminha `/api` para o PHP. Ctrl+C encerra os dois.

Para a apresentação, gerem o build uma vez:

```
npm run build
npm run preview    # http://127.0.0.1:4173
```

O prefixo da API fica em `.env.development` e `.env.production` (`VITE_API_BASE_URL=/api`).
Se o PHP cair durante a demo, a interface avisa e calcula só no navegador.

## Instâncias

A pasta `database/data/` já traz casos de teste: o exemplo do Cormen (fluxo 23), o caso
patológico, origem e destino desconectados, um grafo aleatório de 300 vértices e malhas
viárias sintéticas de 50 e 2.402 vértices. A interface também gera malhas e grafos
aleatórios, carrega JSON e permite editar arestas e capacidades.

Para criar uma instância real do OpenStreetMap (requer internet só nesse passo):

```
cd scripts/data-prep
pip install -r requirements.txt
python -m scripts.build_osm_instance --lat -25.4284 --lon -49.2733 --dist 1500 \
    --evac-radius 300 --safe-dist 1300 --out ../../database/data/regiao_real.json
```

## Testes

```
php api/tests/run.php                 # testes da API
npm test                              # testes da versão TypeScript
cd scripts/data-prep && python -m pytest -q
php scripts/benchmark.php > benchmark.csv   # tempo DFS × BFS por tamanho
```

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health.php` | Saúde da API |
| GET | `/api/instances.php` | Lista resumida |
| GET | `/api/instances.php?file={arquivo}` | Instância completa |
| POST | `/api/instances.php` | Grava a instância enviada |
| DELETE | `/api/instances.php?file={arquivo}` | Exclui |
| POST | `/api/generate.php` | `{"type":"grid"\|"random", ...}` gera instância sintética |
| POST | `/api/solve.php` | `{"instance", "source", "sink", "strategy":"dfs"\|"bfs", "record"}` |

## Bibliotecas (declaração exigida pelo enunciado)

O fluxo máximo, a rede residual e o corte mínimo são implementação própria, em PHP e em
TypeScript, sem biblioteca de grafos. Bibliotecas auxiliares: **Cytoscape.js** (só desenho
do grafo), **React** e **Vite** (interface), fontes **Barlow** (empacotadas, funcionam offline).
Na preparação de dados: **OSMnx** (download do OpenStreetMap) e **NetworkX** (formato do
grafo do OSMnx e validação cruzada nos testes).

## Limitações conhecidas

- Capacidades por faixa em `osm_loader.py` são estimativas; justificar com a fonte no relatório.
- Modelo estático: não considera tempo de viagem nem congestionamento.
- A rede residual só é desenhada até 800 arestas; acima disso fica disponível na tabela.
- A DFS fica lenta em grafos grandes (1.000 vértices aleatórios: ~0,7 s contra ~5 ms da BFS no PHP).
