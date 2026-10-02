<?php
declare(strict_types=1);

namespace Fluxo;

/**
 * Rede de fluxo com rede residual implícita (implementação própria, sem biblioteca de grafos).
 *
 * Cada aresta original u->v de capacidade c gera duas arestas residuais:
 *   id par   (2i)   : u->v, capacidade c
 *   id ímpar (2i+1) : v->u, capacidade 0 (reversa / "gêmea")
 * O fluxo da reversa é sempre o oposto do da original, logo
 *   residual(e) = cap[e] - flow[e]
 * vale para ambas. A gêmea de e é e ^ 1.
 *
 * Arestas antiparalelas (u->v e v->u, rua de mão dupla) não são fundidas:
 * cada uma tem a sua gêmea, o que mantém a rede residual correta.
 *
 * Os dados ficam em arrays paralelos (e não em objetos) por desempenho.
 */
final class FlowNetwork
{
    public const EPS = 1e-9;

    /** @var array<int, int|string> índice interno -> rótulo original */
    public array $labels = [];
    /** @var array<int, array<string, mixed>> atributos de cada vértice (lat, lon, ...) */
    public array $vertexAttrs = [];
    /** @var array<int, int[]> vértice -> ids das arestas residuais que saem dele */
    public array $adj = [];

    /** @var int[] */   public array $tail = [];
    /** @var int[] */   public array $head = [];
    /** @var float[] */ public array $cap = [];
    /** @var float[] */ public array $flow = [];

    /** @var array<int, array<string, mixed>> atributos extras da aresta original i */
    public array $edgeAttrs = [];

    /** @var array<string, int> */
    private array $index = [];

    /** @var string */
    public string $name;

    public function __construct(string $name = '')
    {
        $this->name = $name;
    }

    /** @param int|string $label */
    public function addVertex($label, array $attrs = []): int
    {
        $key = (string) $label;
        if (isset($this->index[$key])) {
            $v = $this->index[$key];
            $this->vertexAttrs[$v] = array_merge($this->vertexAttrs[$v], $attrs);
            return $v;
        }
        $v = count($this->labels);
        $this->index[$key] = $v;
        $this->labels[] = $label;
        $this->vertexAttrs[] = $attrs;
        $this->adj[] = [];
        return $v;
    }

    /** @param int|string $label */
    public function indexOf($label): int
    {
        $key = (string) $label;
        if (!isset($this->index[$key])) {
            throw new \InvalidArgumentException("Vértice inexistente: {$key}");
        }
        return $this->index[$key];
    }

    /** @param int|string $label */
    public function hasVertex($label): bool
    {
        return isset($this->index[(string) $label]);
    }

    /** Adiciona u->v e sua reversa. Retorna o índice da aresta original (0, 1, 2, ...). */
    /**
     * @param int|string $u
     * @param int|string $v
     */
    public function addEdge($u, $v, float $capacity, array $attrs = []): int
    {
        if ($capacity < 0) {
            throw new \InvalidArgumentException("Capacidade negativa em {$u}->{$v}");
        }
        if ((string) $u === (string) $v) {
            throw new \InvalidArgumentException("Laço não permitido em {$u}");
        }
        $ui = $this->addVertex($u);
        $vi = $this->addVertex($v);

        $fwd = count($this->tail);
        $this->tail[] = $ui; $this->head[] = $vi; $this->cap[] = $capacity; $this->flow[] = 0.0;
        $this->tail[] = $vi; $this->head[] = $ui; $this->cap[] = 0.0;       $this->flow[] = 0.0;
        $this->adj[$ui][] = $fwd;
        $this->adj[$vi][] = $fwd + 1;
        $this->edgeAttrs[] = $attrs;
        return intdiv($fwd, 2);
    }

    public function numVertices(): int { return count($this->labels); }

    /** Número de arestas originais (sem as reversas). */
    public function numEdges(): int { return intdiv(count($this->tail), 2); }

    public function residual(int $e): float { return $this->cap[$e] - $this->flow[$e]; }

    public static function isReverse(int $e): bool { return ($e & 1) === 1; }

    public static function originalIndex(int $e): int { return $e >> 1; }

    /** Empurra $amount unidades pela aresta residual $e. */
    public function push(int $e, float $amount): void
    {
        $this->flow[$e] += $amount;
        $this->flow[$e ^ 1] -= $amount;
    }

    public function resetFlow(): void
    {
        $this->flow = array_fill(0, count($this->flow), 0.0);
    }
}
