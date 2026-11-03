<?php
declare(strict_types=1);

use Fluxo\FordFulkerson;
use Fluxo\InstanceIO;
use Fluxo\InstanceRepository;
use Fluxo\Validation;

require __DIR__ . '/settings/includes.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(['error' => 'Método não permitido'], 405);
}

fluxo_run(static function (): void {
    $p = body();
    $repo = new InstanceRepository(fluxo_instances_dir());
    $data = isset($p['instance']) ? $p['instance'] : $repo->get((string) ($p['file'] ?? ''));
    $net = InstanceIO::toNetwork($data);
    $source = $p['source'] ?? $data['source'] ?? null;
    $sink = $p['sink'] ?? $data['sink'] ?? null;
    if ($source === null || $sink === null) {
        throw new InvalidArgumentException('Informe a origem e o destino.');
    }
    $search = (string) ($p['search'] ?? 'dfs');
    $result = FordFulkerson::solve($net, $source, $sink, (bool) ($p['record'] ?? true), null, $search);
    $result['validation'] = Validation::verify($net, $result);
    $result['engine'] = 'php ' . PHP_VERSION;
    respond($result);
});
