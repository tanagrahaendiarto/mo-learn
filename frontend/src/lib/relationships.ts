import type {
  EntityProfile,
  RelationshipGraph,
  RelationshipNode,
} from "@/types/molearn";

/**
 * Adapter boundary relasi (Task D).
 *
 * Graf hanya dibangun dari bukti yang dilaporkan penyedia:
 *  - Gen→protein: `protein_links[]` NCBI, yang berasal dari cross-reference
 *    GeneID milik UniProt (`xref:geneid-<id>`).
 *  - Protein→gen: cross-reference namespace `GeneID` milik UniProt.
 *
 * Kecocokan simbol gen BUKAN bukti dan tidak pernah dipakai. Label selalu
 * "GeneID cross-reference" — tidak diinterpretasikan sebagai "encodes".
 *
 * Model data (`RelationshipGraph`) independen dari visualisasi, sehingga
 * Cytoscape.js dapat diperkenalkan nanti tanpa mengubah kontrak ini.
 */
export function buildCrossrefGraph(
  profile: EntityProfile,
  isDemo: boolean,
): RelationshipGraph {
  const selfKey = `${profile.type}:${profile.id}`;
  const nodes: RelationshipNode[] = [
    {
      key: selfKey,
      type: profile.type,
      id: profile.id,
      symbol: profile.symbol,
      name: profile.name,
      organism: profile.organism,
      isDemo,
    },
  ];
  const edges: RelationshipGraph["edges"] = [];

  if (profile.type === "gene") {
    for (const link of profile.proteinLinks) {
      const proteinKey = `protein:${link.accession}`;
      if (nodes.some((n) => n.key === proteinKey)) continue;
      nodes.push({
        key: proteinKey,
        type: "protein",
        id: link.accession,
        // Gen yang sama dapat memiliki banyak isoform; accession membedakan node.
        name: link.primaryName ?? link.accession,
        isDemo,
      });
      edges.push({
        id: `edge-${selfKey}-${proteinKey}`,
        from: selfKey,
        to: proteinKey,
        label: "GeneID cross-reference",
        source: "UniProt",
        evidence: `${link.evidence}: UniProt ${link.accession} lists GeneID ${profile.id}.`,
        isDemo,
      });
    }
    return { nodes, edges, isDemo };
  }

  // Protein: hanya GeneID yang bisa dinavigasi ke profil gen kanonik.
  for (const xref of profile.geneCrossrefs) {
    if (xref.namespace !== "GeneID" || !/^[1-9][0-9]{0,11}$/.test(xref.id)) {
      continue;
    }
    const geneKey = `gene:${xref.id}`;
    if (nodes.some((n) => n.key === geneKey)) continue;
    nodes.push({
      key: geneKey,
      type: "gene",
      id: xref.id,
      name: `NCBI Gene ${xref.id}`,
      isDemo,
    });
    edges.push({
      id: `edge-${selfKey}-${geneKey}`,
      from: selfKey,
      to: geneKey,
      label: "GeneID cross-reference",
      source: "UniProt",
      evidence: `UniProt cross-reference GeneID=${xref.id}.`,
      isDemo,
    });
  }

  return { nodes, edges, isDemo };
}
