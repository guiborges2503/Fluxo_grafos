<?php
declare(strict_types=1);

namespace Fluxo;

/**
 * Conversão entre o formato JSON das instâncias e FlowNetwork.
 *
 * { "name", "description", "source", "sink",
 *   "vertices": [{"id", "lat"?, "lon"?, ...}],
 *   "edges": [{"from", "to", "capacity", ...}] }
 * Capacidade infinita = "inf".
 */
final class InstanceIO
{
    public static function toNetwork(array $data): FlowNetwork
    {
        if (!isset($data['edges']) || !is_array($data['edges'])) {
            throw new \InvalidArgumentException('A instância precisa de uma lista "edges".');
        }
        $net = new FlowNetwork((string) ($data['name'] ?? ''));
        foreach ($data['vertices'] ?? [] as $v) {
            if (!isset($v['id'])) {
                throw new \InvalidArgumentException('Vértice sem "id".');
            }
            $attrs = $v;
            unset($attrs['id']);
            $net->addVertex($v['id'], $attrs);
        }
        foreach ($data['edges'] as $k => $e) {
            if (!isset($e['from'], $e['to'], $e['capacity'])) {
                throw new \InvalidArgumentException("Aresta {$k} precisa de from, to e capacity.");
            }
            $attrs = $e;
            unset($attrs['from'], $attrs['to'], $attrs['capacity']);
            $net->addEdge($e['from'], $e['to'], self::parseCapacity($e['capacity']), $attrs);
        }
        return $net;
    }

    /** @param mixed $c */
    public static function parseCapacity($c): float
    {
        if ($c === 'inf' || $c === 'Infinity') {
            return INF;
        }
        if (!is_numeric($c)) {
            throw new \InvalidArgumentException("Capacidade inválida: " . json_encode($c));
        }
        return (float) $c;
    }

    /** Converte INF em "inf" recursivamente (json_encode não aceita INF). */
    /**
     * @param mixed $value
     * @return mixed
     */
    public static function jsonSafe($value)
    {
        if (is_float($value) && is_infinite($value)) {
            return $value > 0 ? 'inf' : '-inf';
        }
        if (is_array($value)) {
            foreach ($value as $k => $v) {
                $value[$k] = self::jsonSafe($v);
            }
        }
        return $value;
    }
}
