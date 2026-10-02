<?php
declare(strict_types=1);

namespace Fluxo;

final class UnboundedFlowException extends \RuntimeException {}

/**
 * Ford-Fulkerson para fluxo máximo (implementação principal do projeto).
 *
 * Estratégias de busca do caminho aumentante:
 *   "dfs" -> Ford-Fulkerson clássico (busca em profundidade)
 *   "bfs" -> Edmonds-Karp (busca em largura)
 *
 * A versão TypeScript (src/utils/fordFulkerson.ts) segue
 * exatamente a mesma ordem de visita, então as duas produzem os mesmos
 * caminhos aumentantes. A interface compara os dois resultados.
 */
final class FordFulkerson
{
    /**
     * @param bool $record guarda os caminhos aumentantes (vértices e arestas) de cada iteração
     * @param int|null $maxIterations interrompe antes do fim (o resultado deixa de ser máximo)
     * @param int|string $source
     * @param int|string $sink
     * @return array<string, mixed>
     */
    public static function solve(
        FlowNetwork $net,
        $source,
        $sink,
        string $strategy = 'dfs',
        bool $record = true,
        ?int $maxIterations = null
    ): array {
        if (!in_array($strategy, ['dfs', 'bfs'], true)) {
            throw new \InvalidArgumentException("Estratégia desconhecida: {$strategy}");
        }
        $s = $net->indexOf($source);
        $t = $net->indexOf($sink);
        if ($s === $t) {
            throw new \InvalidArgumentException('Origem e destino devem ser vértices diferentes.');
        }

        $net->resetFlow();
        $value = 0.0;
        $count = 0;
        $visitedTotal = 0;
        $bottlenecks = [];
        $iterations = [];
        $start = hrtime(true);

        while ($maxIterations === null || $count < $maxIterations) {
            [$path, $visited] = $strategy === 'bfs'
                ? self::bfsPath($net, $s, $t)
                : self::dfsPath($net, $s, $t);
            $visitedTotal += $visited;
            if ($path === null) {
                break;
            }

            $bottleneck = INF;
            foreach ($path as $e) {
                $r = $net->residual($e);
                if ($r < $bottleneck) {
                    $bottleneck = $r;
                }
            }
            if (is_infinite($bottleneck)) {
                throw new UnboundedFlowException(
                    'Fluxo ilimitado: há um caminho da origem ao destino só com capacidades infinitas.'
                );
            }
            foreach ($path as $e) {
                $net->push($e, $bottleneck);
            }

            $value += $bottleneck;
            $count++;
            $bottlenecks[] = $bottleneck;

            if ($record) {
                $vertices = [$net->labels[$s]];
                $edges = [];
                foreach ($path as $e) {
                    $vertices[] = $net->labels[$net->head[$e]];
                    $edges[] = ['edge' => FlowNetwork::originalIndex($e), 'reverse' => FlowNetwork::isReverse($e)];
                }
                $iterations[] = [
                    'index' => $count,
                    'vertices' => $vertices,
                    'edges' => $edges,
                    'bottleneck' => $bottleneck,
                    'flowAfter' => $value,
                ];
            }
        }

        $elapsedMs = (hrtime(true) - $start) / 1e6;
        $cut = self::minCut($net, $s);

        return [
            'source' => $source,
            'sink' => $sink,
            'strategy' => $strategy,
            'value' => $value,
            'numIterations' => $count,
            'elapsedMs' => $elapsedMs,
            'verticesVisited' => $visitedTotal,
            'bottlenecks' => $bottlenecks,
            'iterations' => $record ? $iterations : null,
            'edgeFlows' => self::edgeFlows($net),
            'cut' => $cut,
        ];
    }

    /** DFS iterativa (sem recursão). Visita os vizinhos na ordem de inserção. */
    private static function dfsPath(FlowNetwork $net, int $s, int $t): array
    {
        $n = $net->numVertices();
        $parent = array_fill(0, $n, -1);
        $visited = array_fill(0, $n, false);
        $ptr = array_fill(0, $n, 0);
        $visited[$s] = true;
        $seen = 1;
        $stack = [$s];

        while ($stack) {
            $u = $stack[count($stack) - 1];
            if ($u === $t) {
                break;
            }
            $adj = $net->adj[$u];
            $len = count($adj);
            $advanced = false;
            while ($ptr[$u] < $len) {
                $e = $adj[$ptr[$u]++];
                $v = $net->head[$e];
                if (!$visited[$v] && $net->cap[$e] - $net->flow[$e] > FlowNetwork::EPS) {
                    $visited[$v] = true;
                    $seen++;
                    $parent[$v] = $e;
                    $stack[] = $v;
                    $advanced = true;
                    break;
                }
            }
            if (!$advanced) {
                array_pop($stack);
            }
        }
        return [$visited[$t] ? self::rebuild($net, $parent, $s, $t) : null, $seen];
    }

    private static function bfsPath(FlowNetwork $net, int $s, int $t): array
    {
        $n = $net->numVertices();
        $parent = array_fill(0, $n, -1);
        $visited = array_fill(0, $n, false);
        $visited[$s] = true;
        $seen = 1;
        $queue = [$s];
        $head = 0;

        while ($head < count($queue)) {
            $u = $queue[$head++];
            foreach ($net->adj[$u] as $e) {
                $v = $net->head[$e];
                if (!$visited[$v] && $net->cap[$e] - $net->flow[$e] > FlowNetwork::EPS) {
                    $visited[$v] = true;
                    $seen++;
                    $parent[$v] = $e;
                    if ($v === $t) {
                        return [self::rebuild($net, $parent, $s, $t), $seen];
                    }
                    $queue[] = $v;
                }
            }
        }
        return [null, $seen];
    }

    /** @return int[] ids das arestas residuais de s até t */
    private static function rebuild(FlowNetwork $net, array $parent, int $s, int $t): array
    {
        $path = [];
        for ($v = $t; $v !== $s; $v = $net->tail[$e]) {
            $e = $parent[$v];
            $path[] = $e;
        }
        return array_reverse($path);
    }

    /**
     * Corte mínimo: S = vértices alcançáveis da origem na rede residual final.
     * Arestas do corte = originais com cauda em S e cabeça fora de S.
     */
    public static function minCut(FlowNetwork $net, int $s): array
    {
        $reach = array_fill(0, $net->numVertices(), false);
        $reach[$s] = true;
        $queue = [$s];
        $head = 0;
        while ($head < count($queue)) {
            $u = $queue[$head++];
            foreach ($net->adj[$u] as $e) {
                $v = $net->head[$e];
                if (!$reach[$v] && $net->residual($e) > FlowNetwork::EPS) {
                    $reach[$v] = true;
                    $queue[] = $v;
                }
            }
        }

        $side = [];
        foreach ($reach as $v => $r) {
            if ($r) {
                $side[] = $net->labels[$v];
            }
        }
        $edges = [];
        $capacity = 0.0;
        for ($i = 0, $m = $net->numEdges(); $i < $m; $i++) {
            $e = 2 * $i;
            if ($reach[$net->tail[$e]] && !$reach[$net->head[$e]]) {
                $edges[] = $i;
                $capacity += $net->cap[$e];
            }
        }
        return ['sourceSide' => $side, 'edges' => $edges, 'capacity' => $capacity];
    }

    /** Capacidade e fluxo final de cada aresta original. */
    public static function edgeFlows(FlowNetwork $net): array
    {
        $rows = [];
        for ($i = 0, $m = $net->numEdges(); $i < $m; $i++) {
            $e = 2 * $i;
            $rows[] = [
                'edge' => $i,
                'from' => $net->labels[$net->tail[$e]],
                'to' => $net->labels[$net->head[$e]],
                'capacity' => $net->cap[$e],
                'flow' => $net->flow[$e],
                'saturated' => $net->residual($e) <= FlowNetwork::EPS,
            ];
        }
        return $rows;
    }
}
