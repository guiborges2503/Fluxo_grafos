<?php
declare(strict_types=1);

use Fluxo\InstanceIO;
use Fluxo\NotFoundException;
use Fluxo\UnboundedFlowException;

/** Envia a resposta JSON e encerra a requisição. @param mixed $data */
function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(InstanceIO::jsonSafe($data), JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('O corpo da requisição deve ser um JSON válido.');
    }
    return $data;
}

function fluxo_run(callable $fn): void
{
    try {
        $fn();
    } catch (NotFoundException $e) {
        respond(['error' => $e->getMessage()], 404);
    } catch (UnboundedFlowException | InvalidArgumentException $e) {
        respond(['error' => $e->getMessage()], 422);
    } catch (Throwable $e) {
        respond(['error' => 'Erro interno: ' . $e->getMessage()], 500);
    }
}
