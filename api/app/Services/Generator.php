<?php
declare(strict_types=1);

namespace Fluxo;

/**
 * Geração de instâncias sintéticas reprodutíveis (semente fixa).
 * Usadas para testes de tamanho crescente e análise de tempo.
 */
final class Generator
{
    /** Grafo aleatório: n vértices, cada um com `degree` arcos de saída. Origem 0, destino n-1. */
    public static function random(int $n, int $degree, int $maxCapacity, int $seed): array
    {
        self::check($n >= 2 && $n <= 50000, 'n deve estar entre 2 e 50000');
        self::check($degree >= 1 && $degree <= 20, 'grau deve estar entre 1 e 20');
        mt_srand($seed);
        $edges = [];
        for ($u = 0; $u < $n; $u++) {
            for ($k = 0; $k < $degree; $k++) {
                $v = mt_rand(0, $n - 1);
                if ($v !== $u) {
                    $edges[] = ['from' => $u, 'to' => $v, 'capacity' => mt_rand(1, $maxCapacity)];
                }
            }
        }
        return [
            'name' => "aleatorio_n{$n}_g{$degree}_s{$seed}",
            'description' => "Grafo aleatório: {$n} vértices, grau de saída {$degree}, capacidades 1..{$maxCapacity}, semente {$seed}",
            'source' => 0,
            'sink' => $n - 1,
            'vertices' => array_map(fn($i) => ['id' => $i], range(0, $n - 1)),
            'edges' => $edges,
        ];
    }

    /**
     * Malha viária sintética rows × cols com ruas de mão dupla e capacidades
     * por tipo de via (avenidas a cada `avenueEvery` linhas). Evacua a coluna
     * esquerda para a coluna direita.
     */
    public static function grid(int $rows, int $cols, int $avenueEvery, int $seed): array
    {
        self::check($rows >= 2 && $cols >= 2 && $rows * $cols <= 40000, 'malha entre 2×2 e 40000 vértices');
        mt_srand($seed);
        $id = fn(int $r, int $c) => "r{$r}c{$c}";
        $vertices = [];
        $edges = [];
        for ($r = 0; $r < $rows; $r++) {
            for ($c = 0; $c < $cols; $c++) {
                $vertices[] = ['id' => $id($r, $c), 'x' => $c, 'y' => $r];
                foreach ([[0, 1], [1, 0]] as [$dr, $dc]) {
                    $r2 = $r + $dr; $c2 = $c + $dc;
                    if ($r2 >= $rows || $c2 >= $cols) continue;
                    $avenue = $dr === 0 && $avenueEvery > 0 && $r % $avenueEvery === 0;
                    $cap = $avenue ? 1500 * mt_rand(1, 3) : 600 * mt_rand(1, 2);
                    $edges[] = ['from' => $id($r, $c), 'to' => $id($r2, $c2), 'capacity' => $cap];
                    $edges[] = ['from' => $id($r2, $c2), 'to' => $id($r, $c), 'capacity' => $cap];
                }
            }
        }
        $vertices[] = ['id' => 'S*', 'role' => 'super_source', 'x' => -1, 'y' => ($rows - 1) / 2];
        $vertices[] = ['id' => 'T*', 'role' => 'super_sink', 'x' => $cols, 'y' => ($rows - 1) / 2];
        for ($r = 0; $r < $rows; $r++) {
            $edges[] = ['from' => 'S*', 'to' => $id($r, 0), 'capacity' => 'inf', 'artificial' => true];
            $edges[] = ['from' => $id($r, $cols - 1), 'to' => 'T*', 'capacity' => 'inf', 'artificial' => true];
        }
        return [
            'name' => "malha_{$rows}x{$cols}_s{$seed}",
            'description' => "Malha sintética {$rows}×{$cols}, avenidas a cada {$avenueEvery} linhas, semente {$seed}",
            'source' => 'S*',
            'sink' => 'T*',
            'vertices' => $vertices,
            'edges' => $edges,
        ];
    }

    private static function check(bool $ok, string $msg): void
    {
        if (!$ok) {
            throw new \InvalidArgumentException($msg);
        }
    }
}
