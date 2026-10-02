<?php
declare(strict_types=1);

if (PHP_VERSION_ID < 70400) {
    http_response_code(500);
    exit("Este projeto requer PHP 7.4 ou superior (versão atual: " . PHP_VERSION . ").\n");
}

spl_autoload_register(static function (string $class): void {
    $map = [
        'Fluxo\\FlowNetwork' => __DIR__ . '/../app/Services/FlowNetwork.php',
        'Fluxo\\FordFulkerson' => __DIR__ . '/../app/Services/FordFulkerson.php',
        'Fluxo\\UnboundedFlowException' => __DIR__ . '/../app/Services/FordFulkerson.php',
        'Fluxo\\Generator' => __DIR__ . '/../app/Services/Generator.php',
        'Fluxo\\InstanceRepository' => __DIR__ . '/../app/Repositories/InstanceRepository.php',
        'Fluxo\\NotFoundException' => __DIR__ . '/../app/Repositories/InstanceRepository.php',
        'Fluxo\\Validation' => __DIR__ . '/../app/Validators/Validation.php',
        'Fluxo\\InstanceIO' => __DIR__ . '/../app/Support/InstanceIO.php',
    ];

    if (isset($map[$class])) {
        require_once $map[$class];
    }
});
