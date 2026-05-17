import { spawn, type ChildProcess } from "node:child_process";

interface RunningSite {
  port: number;
  proc: ChildProcess;
}

const sites = new Map<string, RunningSite>();

/** Demo default — one business, one site, port 5173 (see docs/CONTRACTS.md). */
export const DEFAULT_VITE_PORT = 5173;

/** Start (or return the already-running) Vite dev server for a site. */
export function startSite(
  businessId: string,
  cwd: string,
  port = DEFAULT_VITE_PORT,
): RunningSite {
  const existing = sites.get(businessId);
  if (existing) return existing;

  const proc = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(port), "--strictPort"],
    { cwd, stdio: "inherit", env: process.env },
  );
  const site: RunningSite = { port, proc };
  sites.set(businessId, site);
  proc.on("exit", () => sites.delete(businessId));
  return site;
}

export function stopSite(businessId: string): void {
  const s = sites.get(businessId);
  if (s) {
    s.proc.kill();
    sites.delete(businessId);
  }
}

export function siteUrl(businessId: string): string | null {
  const s = sites.get(businessId);
  return s ? `http://localhost:${s.port}` : null;
}
