import { toNumber } from "@/types";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Número em formato brasileiro; capacidade infinita vira ∞. */
export const fmt = (x: number | string | undefined | null): string => {
  if (x === undefined || x === null) return "";
  const n = toNumber(x as number);
  return Number.isFinite(n) ? nf.format(n) : "∞";
};

export const fmtMs = (ms: number): string =>
  ms < 1 ? `${nf.format(ms)} ms` : ms < 1000 ? `${Math.round(ms)} ms` : `${nf.format(ms / 1000)} s`;
