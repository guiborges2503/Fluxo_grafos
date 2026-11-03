<?php
declare(strict_types=1);

/**
 * Gera os gráficos do relatório (SVG) a partir de docs/resultados/benchmark.csv.
 *     php docs/gerar_graficos.php
 */

$csv = array_map('str_getcsv', file(__DIR__ . '/resultados/benchmark.csv', FILE_IGNORE_NEW_LINES));
$head = array_shift($csv);
$rows = array_map(fn($r) => array_combine($head, $r), $csv);

/** Gráfico de linhas em escala log-log: x = arestas, uma série por (tipo, busca). */
function chart(array $series, string $yLabel, string $title): string
{
    $W = 720; $H = 360; $L = 70; $R = 230; $T = 36; $B = 50;
    $xs = []; $ys = [];
    foreach ($series as $s) foreach ($s['points'] as [$x, $y]) { $xs[] = $x; $ys[] = max($y, 0.01); }
    $lx = fn($v) => log10($v);
    [$x0, $x1] = [floor($lx(min($xs))), ceil($lx(max($xs)))];
    [$y0, $y1] = [floor($lx(min($ys))), ceil($lx(max($ys)))];
    $px = fn($v) => $L + ($lx($v) - $x0) / max(1e-9, $x1 - $x0) * ($W - $L - $R);
    $py = fn($v) => $H - $B - ($lx(max($v, 0.01)) - $y0) / max(1e-9, $y1 - $y0) * ($H - $T - $B);

    $o = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {$W} {$H}' font-family='Segoe UI, sans-serif' font-size='12'>";
    $o .= "<text x='{$L}' y='20' font-size='14' font-weight='600' fill='#17324d'>{$title}</text>";
    for ($e = $y0; $e <= $y1; $e++) {
        $y = $py(10 ** $e);
        $o .= "<line x1='{$L}' x2='" . ($W - $R) . "' y1='{$y}' y2='{$y}' stroke='#dde3e8'/>";
        $o .= "<text x='" . ($L - 8) . "' y='" . ($y + 4) . "' text-anchor='end' fill='#546a7f'>" . number_format(10 ** $e, $e < 0 ? 2 : 0, ',', '.') . "</text>";
    }
    for ($e = $x0; $e <= $x1; $e++) {
        $x = $px(10 ** $e);
        $o .= "<line x1='{$x}' x2='{$x}' y1='{$T}' y2='" . ($H - $B) . "' stroke='#dde3e8'/>";
        $o .= "<text x='{$x}' y='" . ($H - $B + 18) . "' text-anchor='middle' fill='#546a7f'>" . number_format(10 ** $e, 0, ',', '.') . "</text>";
    }
    $o .= "<text x='" . (($L + $W - $R) / 2) . "' y='" . ($H - 8) . "' text-anchor='middle' fill='#17324d'>arestas (escala log)</text>";
    $o .= "<text transform='translate(16 " . (($T + $H - $B) / 2) . ") rotate(-90)' text-anchor='middle' fill='#17324d'>{$yLabel}</text>";
    foreach (array_values($series) as $i => $s) {
        $pts = implode(' ', array_map(fn($p) => round($px($p[0]), 1) . ',' . round($py($p[1]), 1), $s['points']));
        $dash = $s['dash'] ? " stroke-dasharray='6 4'" : '';
        $o .= "<polyline points='{$pts}' fill='none' stroke='{$s['color']}' stroke-width='2.5'{$dash}/>";
        foreach ($s['points'] as $p) {
            $o .= "<circle cx='" . round($px($p[0]), 1) . "' cy='" . round($py($p[1]), 1) . "' r='3.5' fill='{$s['color']}'/>";
        }
        $ly = $T + 14 + $i * 22;
        $lx0 = $W - $R + 16;
        $o .= "<line x1='{$lx0}' x2='" . ($lx0 + 26) . "' y1='{$ly}' y2='{$ly}' stroke='{$s['color']}' stroke-width='2.5'{$dash}/>";
        $o .= "<text x='" . ($lx0 + 32) . "' y='" . ($ly + 4) . "' fill='#17324d'>{$s['label']}</text>";
    }
    return $o . '</svg>';
}

$colors = ['aleatorio' => '#c2362b', 'malha' => '#1f6fb0'];
$names = ['aleatorio' => 'aleatório', 'malha' => 'malha viária'];
foreach (['iteracoes' => ['Iterações (escala log)', 'Iterações × tamanho'], 'tempo_ms' => ['Tempo em ms (escala log)', 'Tempo × tamanho']] as $metric => [$yLabel, $title]) {
    $series = [];
    foreach (['aleatorio', 'malha'] as $type) {
        foreach (['dfs' => 'prof.', 'bfs' => 'largura'] as $search => $sLabel) {
            $pts = [];
            foreach ($rows as $r) {
                if ($r['tipo'] === $type) $pts[] = [(float) $r['arestas'], (float) $r["{$metric}_{$search}"]];
            }
            usort($pts, fn($a, $b) => $a[0] <=> $b[0]);
            $series[] = ['label' => "{$names[$type]}, busca em {$sLabel}", 'color' => $colors[$type], 'dash' => $search === 'bfs', 'points' => $pts];
        }
    }
    file_put_contents(__DIR__ . "/resultados/{$metric}.svg", chart($series, $yLabel, $title));
}
echo "Gráficos gravados em docs/resultados/\n";
