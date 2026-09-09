/**
 * Kontekst gospodarstwa — WYBORU dokonanego na ekranie startowym.
 * Uwaga: w localStorage trzymamy WYŁĄCZNIE identyfikatory wyboru (companyId/farmId),
 * nigdy dane biznesowe — te żyją w bazie i są filtrowane po stronie serwera.
 */
export type Workspace = {
  companyId: number;
  farmId: number;
  companyName: string;
  farmName: string;
  isDemo: boolean;
};

const KEY = "bt_workspace";

export function getWorkspace(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as Workspace;
    return w && w.companyId > 0 && w.farmId >= 0 ? w : null;
  } catch {
    return null;
  }
}

export function setWorkspace(w: Workspace) {
  localStorage.setItem(KEY, JSON.stringify(w));
}

export function clearWorkspace() {
  localStorage.removeItem(KEY);
}
