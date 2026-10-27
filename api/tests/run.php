<?php
declare(strict_types=1);

/**
 * Testes da API (sem PHPUnit, para não exigir Composer).
 *     php api/tests/run.php
 */

use Fluxo\FlowNetwork;
use Fluxo\FordFulkerson;
use Fluxo\Generator;
use Fluxo\InstanceIO;
use Fluxo\InstanceRepository;
use Fluxo\UnboundedFlowException;
use Fluxo\Validation;

require __DIR__ . '/../shared/autoload.php';

$passed = 0;
$failed = [];

function test(string $name, callable $fn): void
{
    global $passed, $failed;
    try {
        $fn();
        $passed++;
    } catch (Throwable $e) {
        $failed[] = "{$name}: {$e->getMessage()}";
    }
}

function check(bool $cond, string $msg = 'condição falsa'): void
{
    if (!$cond) throw new RuntimeException($msg);
}

function net(array $edges): FlowNetwork
{
    $n = new FlowNetwork();
    foreach ($edges as [$u, $v, $c]) $n->addEdge($u, $v, (float) $c);
    return $n;
}

function cormen(): FlowNetwork
{
    return net([['s','v1',16],['s','v2',13],['v2','v1',4],['v1','v3',12],['v3','v2',9],
                ['v2','v4',14],['v4','v3',7],['v3','t',20],['v4','t',4]]);
}

function expectThrows(string $class, callable $fn): void
{
    try { $fn(); } catch (Throwable $e) { check($e instanceof $class, 'exceção errada: ' . get_class($e)); return; }
    throw new RuntimeException("esperava {$class}");
}

test('cormen 23', function () {
    $n = cormen();
    $r = FordFulkerson::solve($n, 's', 't');
    check($r['value'] == 23, "valor {$r['value']}");
    check(Validation::verify($n, $r) === [], implode('; ', Validation::verify($n, $r)));
    check($r['cut']['capacity'] == 23);
});
test('sem caminho', function () {
    $r = FordFulkerson::solve(net([['s','a',5],['b','t',5]]), 's', 't');
    check($r['value'] == 0 && $r['numIterations'] === 0 && $r['cut']['edges'] === []);
});
test('paralelas e antiparalelas', function () {
    $n = net([['s','a',3],['s','a',2],['a','b',4],['b','a',6],['b','t',10],['a','t',1]]);
    $r = FordFulkerson::solve($n, 's', 't');
    check($r['value'] == 5 && Validation::verify($n, $r) === []);
});

test('cormen registra 4 iterações com uma reversa', function () {
    $r = FordFulkerson::solve(cormen(), 's', 't');
    check($r['numIterations'] === 4);
    check($r['iterations'][2]['vertices'] === ['s', 'v2', 'v3', 't']);
    check($r['iterations'][2]['edges'][1]['reverse'] === true);
});
test('origem = destino rejeitado', fn() => expectThrows(InvalidArgumentException::class,
    fn() => FordFulkerson::solve(cormen(), 's', 's')));
test('capacidade negativa rejeitada', fn() => expectThrows(InvalidArgumentException::class,
    fn() => net([['s','t',-1]])));
test('aresta única', fn() => check(FordFulkerson::solve(net([['s','t',7]]), 's', 't')['value'] == 7));
test('capacidade zero', fn() => check(FordFulkerson::solve(net([['s','a',5],['a','t',0]]), 's', 't')['value'] == 0));
test('fluxo ilimitado detectado', fn() => expectThrows(UnboundedFlowException::class,
    fn() => FordFulkerson::solve(net([['s','a',INF],['a','t',INF]]), 's', 't')));
test('patológico chega a 2000', function () {
    $r = FordFulkerson::solve(net([['s','a',1000],['s','b',1000],['a','b',1],['a','t',1000],['b','t',1000]]), 's', 't');
    check($r['value'] == 2000);
});
test('rótulos numéricos (OSM)', function () {
    $r = FordFulkerson::solve(net([[101, 202, 5], [202, 303, 3]]), 101, 303);
    check($r['value'] == 3 && $r['iterations'][0]['vertices'] === [101, 202, 303]);
});
test('jsonSafe converte INF', function () {
    check(json_encode(InstanceIO::jsonSafe(['a' => INF, 'b' => [1.5, INF]])) === '{"a":"inf","b":[1.5,"inf"]}');
});
test('slug impede caminhos', fn() => check(InstanceRepository::slug('../../etc/passwd') === 'etc_passwd'));
test('slug remove acentos', fn() => check(InstanceRepository::slug('Evacuação São João 7.4') === 'evacuacao_sao_joao_7_4',
    InstanceRepository::slug('Evacuação São João 7.4')));

test('malha sintética válida', function () {
    $data = Generator::grid(12, 15, 3, 7);
    $n = InstanceIO::toNetwork($data);
    $r = FordFulkerson::solve($n, 'S*', 'T*', false);
    check(Validation::verify($n, $r) === [], implode('; ', Validation::verify($n, $r)));
});

// Em 30 grafos aleatórios o fluxo encontrado precisa passar na validação:
// capacidades, conservação e certificado fluxo máximo = corte mínimo.
for ($seed = 1; $seed <= 30; $seed++) {
    test("aleatório semente {$seed}", function () use ($seed) {
        $data = Generator::random(20 + $seed * 3, 3, 50, $seed);
        $n = InstanceIO::toNetwork($data);
        $r = FordFulkerson::solve($n, $data['source'], $data['sink'], false);
        check(Validation::verify($n, $r) === [], implode('; ', Validation::verify($n, $r)));
    });
}

$total = $passed + count($failed);
echo "{$passed}/{$total} testes passaram\n";
foreach ($failed as $f) echo "  FALHOU {$f}\n";
exit($failed ? 1 : 0);
