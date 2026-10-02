<?php
declare(strict_types=1);

require __DIR__ . '/settings/includes.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    respond(['error' => 'Método não permitido'], 405);
}

respond(['ok' => true, 'php' => PHP_VERSION]);
