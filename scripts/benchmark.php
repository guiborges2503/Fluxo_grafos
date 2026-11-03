<?php
declare(strict_types=1);

/**
 * Tempo e nº de iterações do Ford-Fulkerson em instâncias de tamanho crescente,
 * com o 1º passo feito por busca em profundidade (método do projeto) e por busca
 * em largura (só para comparação). Também roda as instâncias salvas do projeto.
 * Saída em CSV, pronta para o gráfico do relatório:
 *     php scripts/benchmark.php > docs/resultados/benchmark.csv
 */

use Fluxo\FordFulkerson;
use Fluxo\Generator;
use Fluxo\InstanceIO;
use Fluxo\Validation;

require __DIR__ . '/../api/shared/autoload.php';
ini_set('memory_limit', '2048M');

$sizes = array_map('intval', array_slice($argv, 1)) ?: [100, 250, 500, 1000, 2000, 4000];
$reps = 3;

/** @return array{0: array, 1: float} último resultado e mediana do tempo */
function measure(array $data, string $search, int $reps): array
{
    $times = [];
    for ($i = 0; $i < $reps; $i++) {
        $net = InstanceIO::toNetwork($data);
        $r = FordFulkerson::solve($net, $data['source'], $data['sink'], false, null, $search);
        $times[] = $r['elapsedMs'];
    }
    if (Validation::verify($net, $r) !== []) {
        fwrite(STDERR, "Resultado inválido em {$data['name']} ({$search})\n");
        exit(1);
    }
    sort($times);
    $r['vertices'] = $net->numVertices();
    $r['edges'] = $net->numEdges();
    return [$r, $times[intdiv($reps, 2)]];
}

$cases = [];
foreach (['enchente_rs', 'rs_rodovias', 'cormen', 'patologico', 'sem_caminho', 'malha_bairro_pequeno', 'aleatorio_300', 'malha_cidade_40x60'] as $f) {
    $cases[] = ['instancia', $f, json_decode(file_get_contents(__DIR__ . "/../database/data/{$f}.json"), true)];
}
foreach ($sizes as $n) {
    $side = max(2, (int) sqrt($n));
    $cases[] = ['aleatorio', "aleatorio_{$n}", Generator::random($n, 4, 1000, $n)];
    $cases[] = ['malha', "malha_{$side}x{$side}", Generator::grid($side, $side, 3, $n)];
}

echo "tipo,nome,vertices,arestas,fluxo,iteracoes_dfs,tempo_ms_dfs,iteracoes_bfs,tempo_ms_bfs\n";
foreach ($cases as [$type, $name, $data]) {
    [$dfs, $tDfs] = measure($data, 'dfs', $reps);
    [$bfs, $tBfs] = measure($data, 'bfs', $reps);
    printf("%s,%s,%d,%d,%g,%d,%.2f,%d,%.2f\n", $type, $name, $dfs['vertices'], $dfs['edges'],
        $dfs['value'], $dfs['numIterations'], $tDfs, $bfs['numIterations'], $tBfs);
}
