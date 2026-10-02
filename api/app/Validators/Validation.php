<?php
declare(strict_types=1);

namespace Fluxo;

/**
 * Verificação automática de um fluxo máximo:
 * capacidade, conservação, valor e certificado fluxo máximo = corte mínimo.
 */
final class Validation
{
    /** @return string[] problemas encontrados (vazio = fluxo correto) */
    public static function verify(FlowNetwork $net, array $result): array
    {
        $problems = [];
        $s = $net->indexOf($result['source']);
        $t = $net->indexOf($result['sink']);
        $balance = array_fill(0, $net->numVertices(), 0.0);

        for ($i = 0, $m = $net->numEdges(); $i < $m; $i++) {
            $e = 2 * $i;
            $f = $net->flow[$e];
            if ($f < -FlowNetwork::EPS || $f > $net->cap[$e] + FlowNetwork::EPS) {
                $problems[] = sprintf('Capacidade violada na aresta %d: fluxo %g, capacidade %g', $i, $f, $net->cap[$e]);
            }
            $balance[$net->tail[$e]] -= $f;
            $balance[$net->head[$e]] += $f;
        }
        foreach ($balance as $v => $b) {
            if ($v !== $s && $v !== $t && abs($b) > 1e-6) {
                $problems[] = sprintf('Conservação violada no vértice %s: saldo %g', $net->labels[$v], $b);
            }
        }
        if (!self::close(-$balance[$s], $result['value'])) {
            $problems[] = 'A saída líquida da origem difere do valor do fluxo.';
        }
        if (!self::close($balance[$t], $result['value'])) {
            $problems[] = 'A entrada líquida no destino difere do valor do fluxo.';
        }
        if (in_array((string) $result['sink'], array_map('strval', $result['cut']['sourceSide']), true)) {
            $problems[] = 'O destino ainda é alcançável na rede residual: o fluxo não é máximo.';
        }
        if (!self::close($result['cut']['capacity'], $result['value'])) {
            $problems[] = sprintf('Capacidade do corte (%g) difere do fluxo (%g).', $result['cut']['capacity'], $result['value']);
        }
        return $problems;
    }

    private static function close(float $a, float $b): bool
    {
        if (is_infinite($a) || is_infinite($b)) {
            return $a === $b;
        }
        return abs($a - $b) <= 1e-6 * max(1.0, abs($a), abs($b));
    }
}
