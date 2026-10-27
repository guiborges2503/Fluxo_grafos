# Doações na enchente: fluxo máximo com Ford-Fulkerson

Tema 7 — Fluxo em Grafos. Numa enchente, como a do Rio Grande do Sul em 2024, várias estradas
ficam bloqueadas e as doações precisam chegar aos abrigos pelas rotas que sobraram. O projeto usa o
método de Ford-Fulkerson para responder:

1. **Quantos caminhões de doações por dia** conseguem chegar aos abrigos?
2. **Qual é o gargalo**, ou seja, quais estradas (ou abrigos) limitam a entrega?
3. **E se** uma ponte cair ou uma rota nova for liberada, o que muda?

**Integrantes:** [Nome 1], [Nome 2], [Nome 3], [Nome 4]

## O problema como rede de fluxo

| Elemento da rede | Na enchente |
| --- | --- |
| Vértices | Cidades: centros de doação (Santa Maria, Passo Fundo, Caxias do Sul), cidades de passagem (Santa Cruz do Sul, Novo Hamburgo, Gravataí) e abrigos (Porto Alegre, São Leopoldo, Canoas) |
| Arestas | Rotas que continuam abertas |
| Capacidade | Caminhões por dia que a rota suporta. Rota bloqueada = 0 |
| Origem `S*` | Super-origem: representa os três centros de doação juntos (ligações de capacidade infinita) |
| Destino `T*` | Super-destino: representa os três abrigos juntos |

As cidades são reais, mas as capacidades são **valores ilustrativos** criados para o projeto,
não dados oficiais.

## Cenários

| Cenário | Arquivo | O que muda | Fluxo máximo (caminhões/dia) | Gargalo |
| --- | --- | --- | --- | --- |
| Situação atual | `enchente_rs.json` | — | 24 | Rotas que saem de Novo Hamburgo, Caxias → Gravataí e Santa Cruz → Porto Alegre |
| Ponte interditada | `enchente_ponte_interditada.json` | Caxias do Sul → Novo Hamburgo = 0 | 15 | Rotas que saem de Caxias e de Santa Cruz |
| Nova rota liberada | `enchente_rota_liberada.json` | Novo Hamburgo → São Leopoldo: 4 → 8 | 27 | Rotas que saem de Caxias e de Santa Cruz |
| Abrigos lotados | `enchente_abrigos_lotados.json` | Abrigos recebem no máximo 8, 5 e 7 | 19 | Os próprios abrigos de Porto Alegre e Canoas, mais Novo Hamburgo → São Leopoldo |

Leitura dos resultados: perder uma ponte derruba a entrega de 24 para 15; liberar uma faixa
no lugar certo sobe para 27; e, se os abrigos não dão conta de descarregar, não adianta abrir
estradas, porque o gargalo muda de lugar.

## Como usar a tela

1. A tela abre no cenário **Situação atual**. No topo dá para trocar de cenário ou montar outra rede em **+ Criar minha rede**.
2. Clique em **Próximo ▶** para ver uma iteração por vez (as setas do teclado também funcionam).
3. À esquerda fica a **rede residual**, onde o caminho de cada iteração é escolhido. À direita fica o
   **fluxo/capacidade** depois da atualização.
4. O painel da direita explica o **1º**, o **2º** e o **3º** passo daquela iteração.
5. No **Resultado** aparecem o fluxo máximo, o corte mínimo (em vermelho) e o que isso quer dizer na prática.
6. Na aba **Editar rede** dá para mudar capacidades e calcular de novo.

## Como o método aparece no site

Cada iteração do Ford-Fulkerson tem três passos:

1. **Escolher um caminho** de `S*` até `T*` em que todas as rotas ainda têm espaço (capacidade residual > 0).
   Qualquer caminho serve; aqui ele é encontrado com busca em profundidade.
2. **Achar o gargalo** *c*: o menor espaço livre do caminho.
3. **Atualizar a rede residual**: cada rota do caminho perde *c* no sentido direto e ganha *c* na seta de volta.

O algoritmo para quando não existe mais caminho com espaço. O fluxo máximo é o que sai de `S*`
(igual ao que chega em `T*`), e os vértices que ainda dá para alcançar a partir de `S*` formam o
lado S do corte mínimo.

| Conceito | Onde aparece no site | Onde está no código |
| --- | --- | --- |
| Fluxo/capacidade em cada rota | Desenho da direita (rótulo `f/c`) | `GraphView.tsx` |
| Rede residual e seta de volta | Desenho da esquerda (setas de volta tracejadas) | `FlowNetwork.push` (aresta `e` e inversa `e ^ 1`) |
| 1º passo: caminho aumentante | Painel e caminho destacado | `dfsPath` |
| 2º passo: gargalo | Painel, "c = min{...}" | cálculo do `bottleneck` em `fordFulkerson` |
| 3º passo: direto − c, inverso + c | Painel, tabela com a marca "criada" | `describeIteration` |
| Pseudocódigo | Painel, "Pseudocódigo do método", com as linhas do passo atual destacadas | laço principal de `fordFulkerson` (comentado com 1º/2º/3º) |
| Fluxo máximo = corte mínimo | Painel "Resultado" e rotas em vermelho | `minCut` |
| Lista de todos os cortes (S,T) | Aba "Todos os cortes (S,T)" | `allCuts` / `cutOf` |
| Capacidade e conservação | Painel "Resultado", "Conferência do fluxo encontrado" | `checkProperties`, `Validation.php` |
| Várias origens/destinos | `S*` e `T*`; aba "Editar rede", campo "Várias origens ou destinos" | `addSuperTerminals` |
| Rotas nos dois sentidos | Aviso com o botão "Corrigir com vértice auxiliar v'" | `splitAntiparallel` |

### Roteiro curto para apresentar

1. **O problema.** Leia a pergunta do topo e a descrição do cenário **Situação atual**. Mostre `S*`
   (centros de doação) e `T*` (abrigos).
2. **Início.** Leia o quadro "Como o algoritmo pensa": o fluxo começa em zero e os 3 passos se repetem.
3. **Iterações.** Clique em **Próximo ▶**. Mostre o caminho na rede residual (esquerda) e o fluxo
   atualizado (direita). No painel: **1º** caminho, **2º** gargalo *c*, **3º** direto − c / inverso + c.
4. **Iteração 2.** Explique a seta de volta: Novo Hamburgo deixa de mandar parte da carga para
   Porto Alegre e manda para São Leopoldo, e com isso abre espaço para Santa Cruz chegar a Porto Alegre.
5. **Resultado.** 24 caminhões/dia. O que sai de `S*` é igual ao que chega em `T*` e ao corte mínimo.
   As rotas em vermelho são o gargalo.
6. **Cenários.** Clique em **Ponte interditada** (15), **Nova rota liberada** (27) e **Abrigos lotados** (19)
   e mostre como o gargalo muda de lugar.

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
| PHP | `api/app/Services/FordFulkerson.php` | Algoritmo oficial: Ford-Fulkerson e corte mínimo |
| PHP | `api/app/Services/FlowNetwork.php` | Rede residual (aresta 2i e reversa 2i+1) |
| PHP | `api/app/Validators/Validation.php` | Capacidade, conservação e corte = fluxo |
| TS | `src/utils/fordFulkerson.ts` | Mesmo algoritmo, mesma ordem de visita; passo a passo e rede residual |
| Python | `scripts/data-prep/src/data/osm_loader.py` | OpenStreetMap -> instância de evacuação |

Servidor e navegador seguem a mesma ordem de visita dos vizinhos, então produzem os
mesmos caminhos aumentantes. A interface confere os dois em segundo plano e só avisa se divergirem.

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

A tela mostra os cenários da enchente e as redes salvas pelo usuário. A pasta `database/data/` também
traz casos usados só nos testes (exemplo clássico de livro-texto, caso patológico, origem e destino desconectados, grafo aleatório
de 300 vértices e malhas viárias de 50 e 2.402 vértices). Eles ficam escondidos da tela para não
poluir a apresentação.

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
php scripts/benchmark.php > benchmark.csv   # tempo do Ford-Fulkerson por tamanho
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
| POST | `/api/solve.php` | `{"instance", "source", "sink", "record"}` |

## Bibliotecas (declaração exigida pelo enunciado)

O fluxo máximo, a rede residual e o corte mínimo são implementação própria, em PHP e em
TypeScript, sem biblioteca de grafos. Bibliotecas auxiliares: **Cytoscape.js** (só desenho
do grafo), **React** e **Vite** (interface), fontes **Barlow** (empacotadas, funcionam offline).
Na preparação de dados: **OSMnx** (download do OpenStreetMap) e **NetworkX** (formato do
grafo do OSMnx e validação cruzada nos testes).

## Limitações conhecidas

- Capacidades por faixa em `osm_loader.py` são estimativas; justificar com a fonte no relatório.
- Modelo estático: não considera tempo de viagem nem congestionamento.
- O Ford-Fulkerson com "um caminho qualquer" pode precisar de muitas iterações quando as capacidades são grandes
  (caso `patologico.json`: 2.000 iterações). Por isso a tela mostra só redes pequenas.
