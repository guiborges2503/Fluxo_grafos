<?php
declare(strict_types=1);

require_once __DIR__ . '/../shared/autoload.php';
require_once __DIR__ . '/../shared/Http.php';
require_once __DIR__ . '/../cors.php';

ini_set('memory_limit', '1024M');
set_time_limit(300);

header('Content-Type: application/json; charset=utf-8');
setCorsHeaders();

function fluxo_instances_dir(): string
{
    $fromEnv = getenv('FLUXO_INSTANCES');
    if (is_string($fromEnv) && $fromEnv !== '') {
        return $fromEnv;
    }
    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'data';
}
