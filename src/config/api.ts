/** Cliente da API PHP. O prefixo vem de VITE_API_BASE_URL (arquivo .env). */

import type { Instance, InstanceSummary, SolveResult } from "@/types";

/** Mesmo domínio do site. No dev, o Vite encaminha /api para o Apache ou para o PHP embutido. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ServerOfflineError(
      `A API PHP não respondeu em ${API_BASE_URL}. Confirme o Apache do WAMP ou rode npm run dev.`,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status} em ${path}`);
  return data as T;
}

export class ServerOfflineError extends Error {}

export const api = {
  health: () => request<{ ok: boolean; php: string }>("/health.php"),
  listInstances: () => request<InstanceSummary[]>("/instances.php"),
  getInstance: (file: string) => request<Instance>(`/instances.php?file=${encodeURIComponent(file)}`),
  saveInstance: (inst: Instance) =>
    request<{ file: string }>("/instances.php", { method: "POST", body: JSON.stringify(inst) }),
  deleteInstance: (file: string) =>
    request<{ deleted: string }>(`/instances.php?file=${encodeURIComponent(file)}`, { method: "DELETE" }),
  generate: (params: Record<string, string | number>) =>
    request<Instance>("/generate.php", { method: "POST", body: JSON.stringify(params) }),
  solve: (instance: Instance, source: string | number, sink: string | number, record: boolean, search: "dfs" | "bfs" = "dfs") =>
    request<SolveResult>("/solve.php", {
      method: "POST",
      body: JSON.stringify({ instance, source, sink, record, search }),
    }),
};
