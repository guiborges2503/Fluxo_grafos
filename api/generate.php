<?php
declare(strict_types=1);

use Fluxo\Generator;

require __DIR__ . '/settings/includes.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(['error' => 'Método não permitido'], 405);
}

fluxo_run(static function (): void {
    $p = body();
    $seed = (int) ($p['seed'] ?? 1);
    switch ($p['type'] ?? '') {
        case 'random':
            $instance = Generator::random((int) ($p['n'] ?? 100), (int) ($p['degree'] ?? 3), (int) ($p['maxCapacity'] ?? 100), $seed);
            break;
        case 'grid':
            $instance = Generator::grid((int) ($p['rows'] ?? 10), (int) ($p['cols'] ?? 10), (int) ($p['avenueEvery'] ?? 3), $seed);
            break;
        default:
            throw new InvalidArgumentException('Tipo de gerador deve ser "random" ou "grid".');
    }
    respond($instance);
});
