/** Pure rules for the structure viewer. Keep browser-free so tests run under node --test. */

export const FETCH_TIMEOUT_MS = 30_000;
export const BYTE_LIMIT = 25 * 1024 * 1024;
export const ATOM_LIMIT = 250_000;

const PDB_COORDINATE = /^\/download\/[0-9][A-Za-z0-9]{3}(-assembly[1-9][0-9]{0,5})?\.cif$/;
const ALPHAFOLD_COORDINATE = /^\/files\/AF-[A-Z0-9]+-F[1-9][0-9]*-model_v[1-9][0-9]*\.cif$/;

/** Only the two provider coordinate endpoints already present in the backend contract. */
export function allowedCoordinateUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return false;
  if (url.hostname === "files.rcsb.org") return PDB_COORDINATE.test(url.pathname);
  if (url.hostname === "alphafold.ebi.ac.uk") return ALPHAFOLD_COORDINATE.test(url.pathname);
  return false;
}

export interface ChainComponent {
  labelAsymId: string;
  authAsymId: string;
  polymer: boolean;
}

/**
 * Backend coverage carries author chain IDs. Match them against parsed polymer components only,
 * so a non-polymer sharing an author ID is never reported as the target protein.
 */
export function pickTargetChains(
  components: readonly ChainComponent[],
  coverage: readonly { chain: string }[],
): string[] {
  const polymerByAuth = new Map<string, string[]>();
  for (const component of components) {
    if (!component.polymer) continue;
    polymerByAuth.set(component.authAsymId, [...(polymerByAuth.get(component.authAsymId) ?? []), component.labelAsymId]);
  }
  const labels: string[] = [];
  for (const { chain } of coverage) {
    labels.push(...(polymerByAuth.get(chain) ?? []));
  }
  return [...new Set(labels)];
}

export interface ResidueIdentity {
  comp: string;
  authChain: string;
  labelChain: string;
  authSeq: number;
  labelSeq: number;
  insCode: string;
  model: number;
  copy: string | null;
}

/** Author numbering is primary; label namespace and assembly copy stay explicit, never merged. */
export function formatResidueIdentity(r: ResidueIdentity): string {
  const details = [
    `label chain ${r.labelChain}`,
    `label seq ${r.labelSeq}`,
    `model ${r.model}`,
  ];
  if (r.copy) details.push(`copy ${r.copy}`);
  return `${r.comp} ${r.authChain} ${r.authSeq}${r.insCode} (${details.join(", ")})`;
}

/** A coordinate source is only called a biological assembly when that assembly was actually built. */
export function describeCoordinates(kind: "experimental" | "predicted", assemblyId: string | null): string {
  if (kind === "predicted") return "Predicted model (AlphaFold)";
  return assemblyId ? `Biological assembly ${assemblyId}` : "Deposited coordinates (asymmetric unit)";
}
