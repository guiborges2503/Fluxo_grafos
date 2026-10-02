<?php
declare(strict_types=1);

/**
 * Tempo e nº de iterações de DFS × BFS em instâncias de tamanho crescente.
 * Saída em CSV, pronta para o gráfico do relatório:
 *     php scripts/benchmark.php > resultados/benchmark.csv
 */

use Fluxo\FordFulkerson;
use Fluxo\Generator;
use Fluxo\InstanceIO;

require __DIR__ . '/../api/shared/autoload.php';
ini_set('memory_limit', '2048M');

$sizes = array_map('intval', array_slice($argv, 1)) ?: [100, 250, 500, 1000, 2000, 4000];
$reps = 3;
echo "tipo,vertices,arestas,estrategia,fluxo,iteracoes,tempo_ms_mediana\n";
foreach ($sizes as $n) {
    $cases = [
        'aleatorio' => Generator::random($n, 4, 1000, $n),
        'malha' => Generator::grid(max(2, (int) sqrt($n)), max(2, (int) sqrt($n)), 3, $n),
    ];
    foreach ($cases as $type => $data) {
        foreach (['dfs', 'bfs'] as $st) {
            $times = [];
            for ($i = 0; $i < $reps; $i++) {
                $net = InstanceIO::toNetwork($data);
                $r = FordFulkerson::solve($net, $data['source'], $data['sink'], $st, false);
                $times[] = $r['elapsedMs'];
            }
            sort($times);
            printf("%s,%d,%d,%s,%g,%d,%.2f\n", $type, $net->numVertices(), $net->numEdges(), $st,
                $r['value'], $r['numIterations'], $times[intdiv($reps, 2)]);
        }
    }
}
