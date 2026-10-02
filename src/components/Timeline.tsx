import { useEffect, useRef, useState } from "react";
import { fmt } from "@/utils/format";

interface Props {
  bottlenecks: number[];
  /** 0 = início, 1..N = iterações, N+1 = resultado */
  step: number;
  onStep: (s: number) => void;
}

/**
 * Linha do tempo das iterações: uma barra por caminho aumentante, com altura
 * proporcional ao gargalo. Clique numa barra ou use as setas do teclado.
 */
export function Timeline({ bottlenecks, step, onStep }: Props) {
  const n = bottlenecks.length;
  const last = n + 1;
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const max = Math.max(1, ...bottlenecks);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const delay = n > 200 ? 30 : n > 40 ? 120 : 650;
    timer.current = window.setTimeout(() => onStep(step + 1), delay);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, step, last, n, onStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") onStep(Math.min(last, step + 1));
      else if (e.key === "ArrowLeft") onStep(Math.max(0, step - 1));
      else if (e.key === "Home") onStep(0);
      else if (e.key === "End") onStep(last);
      else if (e.key === " ") setPlaying((p) => !p);
      else return;
      e.preventDefault(); // evita rolar a página
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep]);

  const W = 1000, H = 70, pad = 2;
  const bw = n ? (W - pad * 2) / n : 0;

  const caption =
    step === 0 ? "Início: rede sem fluxo"
    : step === last ? `Resultado: fluxo máximo após ${n} ${n === 1 ? "caminho aumentante" : "caminhos aumentantes"}`
    : `Caminho aumentante ${step} de ${n}, gargalo ${fmt(bottlenecks[step - 1])}`;

  return (
    <section className="timeline" aria-label="Iterações do algoritmo">
      <div className="timeline-controls">
        <button onClick={() => onStep(0)} disabled={step === 0} title="Início (Home)">Início</button>
        <button onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} title="Anterior (seta para a esquerda)">Anterior</button>
        <button className="primary" onClick={() => { if (step >= last) onStep(0); setPlaying((p) => !p); }} title="Reproduzir (espaço)">
          {playing ? "Pausar" : "Reproduzir"}
        </button>
        <button onClick={() => onStep(Math.min(last, step + 1))} disabled={step === last} title="Próximo (seta para a direita)">Próximo</button>
        <button onClick={() => onStep(last)} disabled={step === last} title="Resultado (End)">Resultado</button>
        <span className="timeline-caption" aria-live="polite">{caption}</span>
      </div>
      {n === 0 ? (
        <p className="timeline-empty">Nenhum caminho aumentante: não há como levar fluxo da origem ao destino.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="timeline-bars">
          {bottlenecks.map((b, i) => {
            const h = Math.max(3, (H - 6) * Math.sqrt(b / max));
            const k = i + 1;
            const cls = k === step ? "bar current" : k < step ? "bar done" : "bar";
            return (
              <rect key={i} x={pad + i * bw + (bw > 4 ? 1 : 0)} y={H - h} width={Math.max(0.6, bw - (bw > 4 ? 2 : 0))} height={h}
                className={cls} onClick={() => onStep(k)}>
                <title>{`Iteração ${k}: gargalo ${fmt(b)}`}</title>
              </rect>
            );
          })}
          {step === last && <rect x={0} y={0} width={W} height={H} className="bar-final" pointerEvents="none" />}
        </svg>
      )}
      <input type="range" min={0} max={last} value={step} onChange={(e) => onStep(Number(e.target.value))}
        aria-label="Escolher iteração" className="timeline-range" />
    </section>
  );
}
