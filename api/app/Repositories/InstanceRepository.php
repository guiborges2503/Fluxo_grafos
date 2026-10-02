<?php
declare(strict_types=1);

namespace Fluxo;

/** Instâncias guardadas como arquivos JSON em database/data/. */
final class InstanceRepository
{
    /** @var string */
    private string $dir;

    public function __construct(string $dir)
    {
        $this->dir = $dir;
    }

    /** Lista resumida das instâncias disponíveis. */
    public function list(): array
    {
        $out = [];
        foreach (glob($this->dir . '/*.json') ?: [] as $path) {
            $data = json_decode((string) file_get_contents($path), true);
            if (!is_array($data)) continue;
            $first = $data['vertices'][0] ?? [];
            $out[] = [
                'file' => basename($path, '.json'),
                'name' => $data['name'] ?? basename($path, '.json'),
                'description' => $data['description'] ?? '',
                'vertices' => count($data['vertices'] ?? []),
                'edges' => count($data['edges'] ?? []),
                'geo' => isset($first['lat']) || isset(($data['vertices'][1] ?? [])['lat']),
                'sizeKb' => (int) round(filesize($path) / 1024),
            ];
        }
        usort($out, fn($a, $b) => $a['edges'] <=> $b['edges']);
        return $out;
    }

    public function get(string $file): array
    {
        $path = $this->path($file);
        if (!is_file($path)) {
            throw new NotFoundException("Instância não encontrada: {$file}");
        }
        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data)) {
            throw new \RuntimeException("JSON inválido em {$file}");
        }
        return $data;
    }

    /** Valida e grava. Retorna o nome do arquivo usado. */
    public function save(array $data): string
    {
        InstanceIO::toNetwork($data); // lança exceção se a instância for inválida
        $file = self::slug((string) ($data['name'] ?? 'instancia'));
        file_put_contents($this->path($file), json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        return $file;
    }

    public function delete(string $file): void
    {
        $path = $this->path($file);
        if (!is_file($path)) {
            throw new NotFoundException("Instância não encontrada: {$file}");
        }
        unlink($path);
    }

    private function path(string $file): string
    {
        return $this->dir . '/' . self::slug($file) . '.json';
    }

    /** Impede nomes de arquivo com caminhos ("../") ou caracteres especiais. */
    public static function slug(string $name): string
    {
        // tabela própria: iconv//TRANSLIT se comporta diferente em cada sistema (Windows, Alpine...)
        $s = strtr($name, [
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A',
            'é' => 'e', 'ê' => 'e', 'è' => 'e', 'ë' => 'e', 'É' => 'E', 'Ê' => 'E', 'È' => 'E', 'Ë' => 'E',
            'í' => 'i', 'î' => 'i', 'ì' => 'i', 'ï' => 'i', 'Í' => 'I', 'Î' => 'I', 'Ì' => 'I', 'Ï' => 'I',
            'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ò' => 'o', 'ö' => 'o', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ò' => 'O', 'Ö' => 'O',
            'ú' => 'u', 'û' => 'u', 'ù' => 'u', 'ü' => 'u', 'Ú' => 'U', 'Û' => 'U', 'Ù' => 'U', 'Ü' => 'U',
            'ç' => 'c', 'Ç' => 'C', 'ñ' => 'n', 'Ñ' => 'N',
        ]);
        $s = strtolower(trim(preg_replace('/[^A-Za-z0-9_-]+/', '_', $s) ?? '', '_'));
        return $s !== '' ? substr($s, 0, 80) : 'instancia';
    }
}

final class NotFoundException extends \RuntimeException {}
