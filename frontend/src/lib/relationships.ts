import type { EntityProfile, RelationshipGraph } from "@/types/molearn";

/**
 * Adapter boundary relasi (Task D).
 *
 * Membangun graf relasi frontend dari cross-reference yang TERVALIDASI
 * pada profil (mis. `geneCrossrefs` dari UniProt). Label relasi selalu
 * "cross-reference" sesuai bukti yang ada — TIDAK diinterpretasikan
 * sebagai "encodes" dan TIDAK disimpulkan dari kemiripan simbol.
 *
 * Model data (`RelationshipGraph`) independen dari visualisasi, sehingga
 * Cytoscape.js dapat diperkenalkan nanti tanpa mengubah kontrak ini.
 */
export function buildCrossrefGraph(
  profile: EntityProfile,
  isDemo: boolean,
): RelationshipGraph {
  const proteinKey = `protein:${profile.id}`;
  const nodes: RelationshipGraph["nodes"] = [
    {
      key: proteinKey,
      type: "protein",
      id: profile.id,
      symbol: profile.symbol,
      name: profile.name,
      organism: profile.organism,
      isDemo,
    },
  ];
  const edges: RelationshipGraph["edges"] = [];
  const seen = new Set<string>();

  for (const xref of profile.geneCrossrefs) {
    const geneKey = `gene:${xref.namespace}:${xref.id}`;
    if (seen.has(geneKey)) continue;
    seen.add(geneKey);
    nodes.push({
      key: geneKey,
      type: "gene",
      id: xref.id,
      name: `${xref.namespace}:${xref.id}`,
      isDemo,
    });
    edges.push({
      id: `edge-${proteinKey}-${geneKey}`,
      from: proteinKey,
      to: geneKey,
      label: "cross-reference",
      source: xref.namespace,
      evidence: `Cross-reference from ${xref.namespace} (${xref.id}).`,
      isDemo,
    });
  }

  return { nodes, edges, isDemo };
}
