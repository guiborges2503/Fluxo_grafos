<?php
declare(strict_types=1);

use Fluxo\InstanceRepository;

require __DIR__ . '/settings/includes.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$file = isset($_GET['file']) ? (string) $_GET['file'] : '';
$repo = new InstanceRepository(fluxo_instances_dir());

fluxo_run(static function () use ($method, $file, $repo): void {
    if ($method === 'GET' && $file === '') {
        respond($repo->list());
    }
    if ($method === 'GET') {
        respond($repo->get($file));
    }
    if ($method === 'POST') {
        respond(['file' => $repo->save(body())], 201);
    }
    if ($method === 'DELETE') {
        if ($file === '') {
            throw new InvalidArgumentException('Informe o arquivo da instância.');
        }
        $repo->delete($file);
        respond(['deleted' => $file]);
    }
    respond(['error' => "Método não permitido: {$method}"], 405);
});
