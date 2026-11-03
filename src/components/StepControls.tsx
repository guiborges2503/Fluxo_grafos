import { useEffect, useRef, useState } from "react";

interface Props {
  /** número de iterações (caminhos aumentantes) */
  total: number;
  /** 0 = início, 1..N = iterações, N+1 = resultado */
  step: number;
  onStep: (s: number) => void;
}

/** Botões Anterior / Próximo e a trilha "Início, 1, 2, ..., Resultado". Setas do teclado também funcionam. */
export function StepControls({ total, step, onStep }: Props) {
  const last = total + 1;
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    timer.current = window.setTimeout(() => onStep(step + 1), total > 40 ? 150 : 1800);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [playing, step, last, total, onStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") onStep(Math.min(last, step + 1));
      else if (e.key === "ArrowLeft") onStep(Math.max(0, step - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep]);

  const name = (k: number) => (k === 0 ? "Início" : k === last ? "Resultado" : String(k));
  const crumbs = total <= 24
    ? Array.from({ length: last + 1 }, (_, k) => k)
    : [0, ...Array.from({ length: 5 }, (_, i) => Math.max(1, Math.min(total, step - 2 + i))), last]
        .filter((k, i, a) => a.indexOf(k) === i);

  return (
    <section className="controls" aria-label="Passo a passo do algoritmo">
      <button className="big" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>◀ Anterior</button>
      <ol className="crumbs">
        {crumbs.map((k) => (
          <li key={k}>
            <button className={k === step ? "on" : k < step ? "done" : ""} onClick={() => onStep(k)}
              aria-current={k === step ? "step" : undefined} title={k === 0 || k === last ? name(k) : `Iteração ${k}`}>
              {name(k)}
            </button>
          </li>
        ))}
      </ol>
      <button className="big primary" onClick={() => onStep(Math.min(last, step + 1))} disabled={step === last}>Próximo ▶</button>
      <button className="link" onClick={() => { if (step >= last) onStep(0); setPlaying((p) => !p); }}>
        {playing ? "Pausar" : "Automático"}
      </button>
    </section>
  );
}
