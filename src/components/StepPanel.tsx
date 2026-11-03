import { useMemo } from "react";
import type { Instance, Iteration, Label, SolveResult } from "@/types";
import { toNumber } from "@/types";
import { checkProperties, cutOf, describeIteration, flowsAfter } from "@/utils/fordFulkerson";
import { fmt } from "@/utils/format";

interface Props {
  instance: Instance;
  step: number;
  local: SolveResult;
}

/**
 * Painel que narra a execução do método de Ford-Fulkerson:
 * 1º escolher caminho, 2º menor capacidade c, 3º diminuir c no sentido direto e aumentar no inverso.
 */
export function StepPanel({ instance, step, local }: Props) {
  const n = local.numIterations;
  const it: Iteration | undefined = step >= 1 && step <= n ? local.iterations?.[step - 1] : undefined;
  const done = step > n;
  const current = done ? local.value : it ? it.flowAfter : 0;
  const unit = instance.unit ? ` (${instance.unit})` : instance.edges.some((e) => e.highway) ? " (veículos por hora)" : "";
  const lines = step === 0 ? [1] : it ? [2, 3, 4, 5, 6, 7] : done ? [2, 8] : [];

  return (
    <aside className="step-panel">
      <div className={`headline${done ? " final" : ""}`}>
        <span className="headline-label">{done ? "Fluxo máximo" : "Fluxo enviado até agora"}{unit}</span>
        <span className="headline-number">{fmt(current)}</span>
        <span className="headline-label">de {String(local.source)} até {String(local.sink)}</span>
      </div>

      <div className="step-detail">
        {step === 0 && <StartDetail total={n} />}
        {it && local.iterations && <IterationDetail it={it} instance={instance} iterations={local.iterations} />}
        {done && <ResultDetail instance={instance} local={local} />}
      </div>

      <Glossary />
      <Pseudocode active={lines} />
    </aside>
  );
}

function StartDetail({ total }: { total: number }) {
  return (
    <>
      <h3>Como o algoritmo pensa</h3>
      <p>
        Imagine canos (ou ruas) ligando os pontos. O número em cada seta é a <b>capacidade</b>: quanto cabe ali.
        A pergunta é: qual o máximo que dá para mandar de <b>s</b> até <b>t</b> ao mesmo tempo?
      </p>
      <p>O fluxo começa em <b>0</b> em todas as ligações. Depois, enquanto existir um caminho com espaço sobrando, o algoritmo repete:</p>
      <ol className="method">
        <li><b>1º</b> Escolhe um caminho de s até t em que todas as ligações ainda têm espaço (&gt; 0).</li>
        <li><b>2º</b> Acha a ligação com menos espaço nesse caminho: o <b>gargalo</b> <i>c</i>.</li>
        <li><b>3º</b> Manda <i>c</i> pelo caminho: tira <i>c</i> do espaço de cada ligação e cria uma seta de volta com <i>c</i>.</li>
      </ol>
      <p>Nesta rede o algoritmo vai repetir isso <b>{total}</b> {total === 1 ? "vez" : "vezes"}. Clique em <b>Próximo ▶</b> para ver a primeira.</p>
      <p className="muted">Qualquer caminho com espaço serve. Escolher outro caminho muda a ordem das iterações, mas o fluxo máximo final é sempre o mesmo.</p>
    </>
  );
}

/** Termos usados na tela, em linguagem simples. */
function Glossary() {
  return (
    <details className="pseudo">
      <summary>O que significa cada termo?</summary>
      <dl className="glossary">
        <dt>Capacidade</dt><dd>O máximo que cabe numa ligação.</dd>
        <dt>Fluxo f/c</dt><dd>Quanto está passando (f) de quanto cabe (c). Exemplo: 4/16.</dd>
        <dt>Rede residual</dt><dd>Mostra quanto ainda cabe em cada ligação, mais as setas de volta.</dd>
        <dt>Seta de volta (inversa)</dt><dd>Permite desfazer parte de um envio anterior quando isso ajuda a mandar mais no total.</dd>
        <dt>Caminho aumentante</dt><dd>Um caminho de s até t em que todas as ligações ainda têm espaço.</dd>
        <dt>Gargalo</dt><dd>A ligação com menos espaço do caminho. Ela limita quanto dá para mandar.</dd>
        <dt>Corte (S,T)</dt><dd>Divide os pontos em dois grupos, s de um lado e t do outro. O menor corte é o gargalo da rede inteira.</dd>
      </dl>
    </details>
  );
}

function IterationDetail({ it, instance, iterations }: { it: Iteration; instance: Instance; iterations: Iteration[] }) {
  const rows = useMemo(() => describeIteration(instance, iterations, it.index), [instance, iterations, it.index]);
  const bottleneck = rows.find((r) => r.isBottleneck);
  const prev = it.flowAfter - it.bottleneck;
  const reversed = rows.filter((r) => r.reverse);
  const long = it.vertices.length > 14;

  return (
    <>
      <h3>Iteração {it.index} de {iterations.length}</h3>
      <p className="summary">
        Mandamos <b>{fmt(it.bottleneck)}</b> pelo caminho {it.vertices.map(String).join(" → ")}. O total passa de {fmt(prev)} para <b>{fmt(it.flowAfter)}</b>.
      </p>

      <h4><b>1º</b> Caminho escolhido na rede residual</h4>
      <ol className="path-chips" aria-label="Vértices do caminho">
        {it.vertices.map((v, j) => {
          if (long && j === 6) return <li key="gap" className="gap">{it.vertices.length - 12} vértices</li>;
          if (long && j > 6 && j < it.vertices.length - 6) return null;
          return <li key={j} className={j > 0 && it.edges[j - 1].reverse ? "via-reverse" : ""}>{String(v)}</li>;
        })}
      </ol>
      {reversed.length > 0 && (
        <p className="reverse-note">
          Usa {reversed.length === 1 ? "uma seta de volta" : `${reversed.length} setas de volta`} ({reversed.map((r) => `${String(r.from)}→${String(r.to)}`).join(", ")}),
          criada{reversed.length === 1 ? "" : "s"} numa iteração anterior: o algoritmo desfaz parte do que tinha mandado antes e redireciona por outro caminho.
        </p>
      )}

      <h4><b>2º</b> Menor capacidade do caminho</h4>
      <p>
        c = min{"{"}{rows.length <= 10 ? rows.map((r) => fmt(r.before)).join(", ") : "…"}{"}"} = <b>{fmt(it.bottleneck)}</b>
        {bottleneck && <> na aresta {String(bottleneck.from)}→{String(bottleneck.to)}</>}.
      </p>

      <h4><b>3º</b> Atualizar a rede residual</h4>
      {rows.length <= 30 ? (
        <table className="update-table">
          <thead>
            <tr><th>Direto</th><th className="num">− c</th><th>Inverso</th><th className="num">+ c</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.edge}${r.reverse}`} className={r.isBottleneck ? "row-bottleneck" : ""}>
                <td>{String(r.from)}→{String(r.to)}</td>
                <td className="num">{fmt(r.before)} → {fmt(r.after)}</td>
                <td>{String(r.to)}→{String(r.from)}</td>
                <td className="num">{fmt(r.backBefore)} → {fmt(r.backAfter)}{r.created && <span className="tag">criada</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Cada uma das {rows.length} arestas do caminho perde {fmt(it.bottleneck)} no sentido direto e ganha {fmt(it.bottleneck)} no inverso.</p>
      )}
      <p className="muted">Arestas que ficam com 0 somem da rede residual. Arestas inversas "criadas" podem ser usadas nos próximos caminhos.</p>

      <p className="flow-sum">Fluxo total: {fmt(prev)} + {fmt(it.bottleneck)} = <b>{fmt(it.flowAfter)}</b></p>
    </>
  );
}

function ResultDetail({ instance, local }: { instance: Instance; local: SolveResult }) {
  const s = String(local.source), t = String(local.sink);
  const flows = useMemo(
    () => flowsAfter(instance.edges.length, local.iterations ?? [], local.numIterations),
    [instance, local],
  );
  const terms = (pick: (from: string, to: string) => boolean) =>
    instance.edges
      .map((e, i) => ({ e, f: flows[i] }))
      .filter(({ e, f }) => f > 1e-9 && pick(String(e.from), String(e.to)));
  const out = terms((from) => from === s);
  const inn = terms((_, to) => to === t);
  const cut = useMemo(() => cutOf(instance, new Set(local.cut.sourceSide.map(String))), [instance, local]);
  const props = useMemo(() => checkProperties(instance, flows, local.source, local.sink), [instance, flows, local]);
  const list = (xs: Label[]) => `{${xs.map(String).join(", ")}}`;

  return (
    <>
      <h3>Resultado</h3>
      <p>Não existe mais nenhum caminho de {s} até {t} em que todas as arestas tenham capacidade positiva, então o fluxo máximo já está determinado.</p>

      <h4>Fluxo máximo = o que sai da origem = o que chega no destino</h4>
      <p className="flow-sum">
        Sai de {s}: {out.length ? out.map(({ f }) => fmt(f)).join(" + ") : "0"} = <b>{fmt(local.value)}</b><br />
        Chega em {t}: {inn.length ? inn.map(({ f }) => fmt(f)).join(" + ") : "0"} = <b>{fmt(local.value)}</b>
      </p>

      <h4>Corte mínimo (em vermelho no desenho)</h4>
      <p>
        S = vértices que ainda dá para alcançar a partir de {s} na rede residual = {list(cut.sourceSide)}<br />
        T = V − S = {list(cut.sinkSide)}
      </p>
      <p className="flow-sum">
        c(S,T) = {cut.edges.length ? cut.edges.map((i) => `${String(instance.edges[i].from)}→${String(instance.edges[i].to)} (${fmt(toNumber(instance.edges[i].capacity))})`).join(" + ") : "0"}
        {" "}= <b>{fmt(cut.capacity)}</b>
      </p>
      <p>Pelo teorema do fluxo máximo e corte mínimo, o fluxo máximo é igual à capacidade do corte mínimo: {fmt(local.value)} = {fmt(cut.capacity)}. Na aba "Todos os cortes (S,T)" estão todos os cortes possíveis.</p>

      <h4>O que isso quer dizer na prática</h4>
      <p className="summary">
        As ligações do corte mínimo são o <b>gargalo</b>: juntas, elas limitam tudo a {fmt(local.value)}{instance.unit ? ` ${instance.unit}` : ""}.
        Para mandar mais é preciso aumentar a capacidade de pelo menos uma delas. Aumentar qualquer outra ligação não muda o resultado.
        Teste na aba "Editar rede": mude uma capacidade e calcule de novo.
      </p>

      <h4>Conferência do fluxo encontrado</h4>
      <ul className="checks">
        <li className={props.capacity.length ? "bad" : "good"}>
          Restrição de capacidade: f(u,v) ≤ c(u,v){props.capacity.length ? ` violada em ${props.capacity.join("; ")}` : " em todas as arestas"}
        </li>
        <li className="good">Antissimetria: f(v,u) = −f(u,v), garantida pelas arestas inversas</li>
        <li className={props.conservation.length ? "bad" : "good"}>
          Conservação: o que entra é igual ao que sai em todo vértice, exceto {s} e {t}
          {props.conservation.length ? ` (violada em ${props.conservation.join("; ")})` : ""}
        </li>
      </ul>
    </>
  );
}

const PSEUDO = [
  "fluxo de todas as rotas ← 0;  total ← 0",
  "enquanto houver caminho P da origem ao destino com espaço > 0 na rede residual:",
  "    c ← menor espaço livre entre as rotas de P        // gargalo",
  "    para cada rota (u → v) de P:",
  "        espaço(u → v) ← espaço(u → v) − c             // sentido direto",
  "        espaço(v → u) ← espaço(v → u) + c             // seta de volta",
  "    total ← total + c",
  "devolve total                                       // fluxo máximo",
];

/** Pseudocódigo do método, escrito para este projeto, com as linhas do passo atual destacadas. */
function Pseudocode({ active }: { active: number[] }) {
  return (
    <details className="pseudo">
      <summary>Pseudocódigo do método</summary>
      <ol>
        {PSEUDO.map((l, i) => <li key={i} className={active.includes(i + 1) ? "on" : ""}><code>{l}</code></li>)}
      </ol>
    </details>
  );
}
