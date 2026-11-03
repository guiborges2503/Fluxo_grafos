<?php
declare(strict_types=1);

/**
 * Gera database/data/rs_rodovias.json: malha rodoviária do RS na enchente de maio de 2024.
 *     php scripts/build_rs_rodovias.php
 *
 * Origem dos dados (documentada também no relatório):
 *   - cidades e ligações: principais rodovias federais e estaduais do RS (mapa rodoviário do DNIT/DAER);
 *   - coordenadas: posição aproximada da sede de cada município (só para o desenho);
 *   - capacidade: ESTIMATIVA feita pelo grupo, não é dado oficial:
 *         capacidade = faixas por sentido × CAMINHOES_POR_FAIXA × fator do estado da via
 *     fator: 1 = liberada, 0.5 = parcial (pare-e-siga, desvio, uma faixa), 0 = interditada;
 *   - estado de cada trecho: HIPÓTESE do cenário, inspirada nos bloqueios noticiados em maio de 2024
 *     (serra com deslizamentos, Vale do Taquari, Eldorado do Sul e acessos a Porto Alegre alagados).
 *
 * Hipótese de modelagem: cada trecho é orientado no sentido dos centros de doação para os abrigos;
 * a volta dos caminhões vazios não é modelada. Por isso não há arestas antiparalelas.
 */

const CAMINHOES_POR_FAIXA = 150; // caminhões de doação por dia em cada faixa, por sentido
const FATOR = ['liberada' => 1.0, 'parcial' => 0.5, 'interditada' => 0.0];

/** [cidade, latitude, longitude, papel] */
$cidades = [
    ['Erechim', -27.63, -52.27, 'doacao'],
    ['Passo Fundo', -28.26, -52.41, 'doacao'],
    ['Santa Maria', -29.69, -53.81, 'doacao'],
    ['Caxias do Sul', -29.17, -51.18, 'doacao'],
    ['Pelotas', -31.77, -52.34, 'doacao'],
    ['Vacaria (divisa SC, BR-116)', -28.51, -50.93, 'doacao'],
    ['Torres (divisa SC, BR-101)', -29.34, -49.73, 'doacao'],
    ['Carazinho', -28.28, -52.79, 'passagem'],
    ['Lagoa Vermelha', -28.21, -51.53, 'passagem'],
    ['Soledade', -28.83, -52.51, 'passagem'],
    ['Bento Gonçalves', -29.17, -51.52, 'passagem'],
    ['Farroupilha', -29.22, -51.35, 'passagem'],
    ['Nova Petrópolis', -29.37, -51.11, 'passagem'],
    ['São Sebastião do Caí', -29.59, -51.38, 'passagem'],
    ['Santa Cruz do Sul', -29.72, -52.43, 'passagem'],
    ['Venâncio Aires', -29.61, -52.19, 'passagem'],
    ['Cachoeira do Sul', -30.04, -52.89, 'passagem'],
    ['Pantano Grande', -30.19, -52.37, 'passagem'],
    ['Butiá', -30.12, -51.96, 'passagem'],
    ['Camaquã', -30.85, -51.81, 'passagem'],
    ['Guaíba', -30.11, -51.33, 'passagem'],
    ['Montenegro', -29.69, -51.46, 'passagem'],
    ['Taquara', -29.65, -50.78, 'passagem'],
    ['Terra de Areia', -29.58, -50.07, 'passagem'],
    ['Osório', -29.89, -50.27, 'passagem'],
    ['Santo Antônio da Patrulha', -29.82, -50.52, 'passagem'],
    ['Gravataí', -29.94, -50.99, 'passagem'],
    ['Lajeado', -29.47, -51.96, 'abrigo'],
    ['Eldorado do Sul', -30.09, -51.62, 'abrigo'],
    ['Novo Hamburgo', -29.68, -51.13, 'abrigo'],
    ['São Leopoldo', -29.76, -51.15, 'abrigo'],
    ['Canoas', -29.92, -51.18, 'abrigo'],
    ['Porto Alegre', -30.03, -51.23, 'abrigo'],
];

/** [de, para, rodovia, faixas por sentido, estado] */
$trechos = [
    // Planalto e norte
    ['Erechim', 'Passo Fundo', 'BR-153', 1, 'liberada'],
    ['Passo Fundo', 'Carazinho', 'BR-285', 1, 'liberada'],
    ['Passo Fundo', 'Soledade', 'BR-153', 1, 'liberada'],
    ['Passo Fundo', 'Lagoa Vermelha', 'BR-285', 1, 'liberada'],
    ['Carazinho', 'Soledade', 'BR-386', 1, 'liberada'],
    ['Lagoa Vermelha', 'Vacaria (divisa SC, BR-116)', 'BR-285', 1, 'liberada'],
    ['Lagoa Vermelha', 'Bento Gonçalves', 'BR-470', 1, 'parcial'],
    ['Vacaria (divisa SC, BR-116)', 'Caxias do Sul', 'BR-116', 1, 'liberada'],
    // Vale do Taquari (BR-386)
    ['Soledade', 'Lajeado', 'BR-386', 1, 'parcial'],
    ['Lajeado', 'Montenegro', 'BR-386', 2, 'parcial'],
    ['Montenegro', 'Canoas', 'BR-386', 2, 'liberada'],
    // Serra
    ['Bento Gonçalves', 'Farroupilha', 'RS-453', 1, 'liberada'],
    ['Bento Gonçalves', 'Montenegro', 'BR-470', 1, 'parcial'],
    ['Caxias do Sul', 'Farroupilha', 'RS-122', 2, 'liberada'],
    ['Caxias do Sul', 'Nova Petrópolis', 'BR-116', 1, 'parcial'],
    ['Caxias do Sul', 'Terra de Areia', 'RS-453 (Rota do Sol)', 1, 'liberada'],
    ['Farroupilha', 'São Sebastião do Caí', 'RS-122', 1, 'parcial'],
    ['Nova Petrópolis', 'Novo Hamburgo', 'BR-116', 1, 'liberada'],
    ['São Sebastião do Caí', 'São Leopoldo', 'RS-122 / RS-240', 1, 'liberada'],
    // Centro e Vale do Rio Pardo
    ['Santa Maria', 'Santa Cruz do Sul', 'RS-287', 1, 'parcial'],
    ['Santa Maria', 'Cachoeira do Sul', 'RS-287 / BR-153', 1, 'liberada'],
    ['Santa Cruz do Sul', 'Venâncio Aires', 'RS-287', 1, 'liberada'],
    ['Santa Cruz do Sul', 'Pantano Grande', 'BR-471', 1, 'liberada'],
    ['Venâncio Aires', 'Montenegro', 'RS-287', 1, 'liberada'],
    ['Cachoeira do Sul', 'Pantano Grande', 'BR-153 / BR-290', 1, 'liberada'],
    ['Pantano Grande', 'Butiá', 'BR-290', 1, 'liberada'],
    ['Butiá', 'Eldorado do Sul', 'BR-290', 1, 'parcial'],
    // Sul
    ['Pelotas', 'Camaquã', 'BR-116', 2, 'liberada'],
    ['Camaquã', 'Guaíba', 'BR-116', 2, 'liberada'],
    ['Guaíba', 'Eldorado do Sul', 'BR-116 / BR-290', 2, 'liberada'],
    ['Eldorado do Sul', 'Porto Alegre', 'BR-290 (ponte do Guaíba)', 2, 'interditada'],
    // Litoral e Freeway
    ['Torres (divisa SC, BR-101)', 'Terra de Areia', 'BR-101', 2, 'liberada'],
    ['Terra de Areia', 'Osório', 'BR-101', 2, 'liberada'],
    ['Osório', 'Santo Antônio da Patrulha', 'BR-290 (Freeway)', 2, 'liberada'],
    ['Santo Antônio da Patrulha', 'Gravataí', 'BR-290 (Freeway)', 2, 'liberada'],
    ['Santo Antônio da Patrulha', 'Taquara', 'RS-474', 1, 'liberada'],
    ['Taquara', 'Novo Hamburgo', 'RS-239', 2, 'liberada'],
    ['Taquara', 'Gravataí', 'RS-020', 1, 'liberada'],
    // Região metropolitana
    ['Montenegro', 'São Leopoldo', 'RS-240', 1, 'liberada'],
    ['Novo Hamburgo', 'São Leopoldo', 'BR-116', 2, 'liberada'],
    ['São Leopoldo', 'Canoas', 'BR-116', 2, 'parcial'],
    ['Canoas', 'Porto Alegre', 'BR-116 / BR-290', 3, 'parcial'],
    ['Gravataí', 'Canoas', 'RS-118', 2, 'liberada'],
    ['Gravataí', 'Porto Alegre', 'BR-290 (Freeway)', 3, 'parcial'],
];

/** Caminhões por dia que cada abrigo consegue descarregar e distribuir (estimativa do grupo). */
$abrigos = [
    'Porto Alegre' => 500,
    'Canoas' => 300,
    'São Leopoldo' => 200,
    'Novo Hamburgo' => 150,
    'Lajeado' => 150,
    'Eldorado do Sul' => 100,
];

// coordenadas de desenho: longitude → x, latitude → y (norte em cima)
$xy = fn(float $lat, float $lon) => ['x' => round(($lon + 54.0) * 2.2, 2), 'y' => round((-27.4 - $lat) * 2.2, 2)];

$vertices = [['id' => 'S*', 'role' => 'super_source', 'x' => -1.6, 'y' => 4.5]];
foreach ($cidades as [$nome, $lat, $lon, $papel]) {
    $vertices[] = ['id' => $nome, 'role' => $papel, 'lat_real' => $lat, 'lon_real' => $lon] + $xy($lat, $lon);
}
$vertices[] = ['id' => 'T*', 'role' => 'super_sink', 'x' => 11.0, 'y' => 6.5];

$nomes = array_column($cidades, 0);
$edges = [];
foreach ($cidades as [$nome, , , $papel]) {
    if ($papel === 'doacao') {
        $edges[] = ['from' => 'S*', 'to' => $nome, 'capacity' => 'inf', 'artificial' => true];
    }
}
foreach ($trechos as [$de, $para, $rodovia, $faixas, $estado]) {
    foreach ([$de, $para] as $c) {
        if (!in_array($c, $nomes, true)) {
            fwrite(STDERR, "Cidade desconhecida: {$c}\n");
            exit(1);
        }
    }
    $edges[] = [
        'from' => $de,
        'to' => $para,
        'capacity' => (int) round($faixas * CAMINHOES_POR_FAIXA * FATOR[$estado]),
        'name' => $rodovia,
        'faixas' => $faixas,
        'estado' => $estado,
    ];
}
foreach ($abrigos as $nome => $cap) {
    $edges[] = ['from' => $nome, 'to' => 'T*', 'capacity' => $cap, 'name' => 'capacidade do abrigo'];
}

$instance = [
    'name' => 'Malha rodoviária do RS',
    'description' => sprintf(
        'Rodovias do RS em maio de 2024: %d cidades, %d trechos. Sete pontos de entrada de doações (S*) e seis cidades com abrigos (T*). '
        . 'Capacidade = faixas por sentido × %d caminhões/dia × estado da via (liberada 1, parcial 0,5, interditada 0). '
        . 'Estados e capacidades são estimativas do grupo; ver scripts/build_rs_rodovias.php.',
        count($cidades), count($trechos), CAMINHOES_POR_FAIXA
    ),
    'unit' => 'caminhões/dia',
    'source' => 'S*',
    'sink' => 'T*',
    'vertices' => $vertices,
    'edges' => $edges,
];

$out = __DIR__ . '/../database/data/rs_rodovias.json';
file_put_contents($out, json_encode($instance, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
fprintf(STDERR, "%s: %d vértices, %d arestas\n", realpath($out), count($vertices), count($edges));
