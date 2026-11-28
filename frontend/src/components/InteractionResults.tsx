import { RelationshipExplorer } from "@/components/RelationshipExplorer";
import { SourceBadge } from "@/components/SourceBadge";
import type { Association, ExplorationIdentity } from "@/lib/exploration";
import type { RelationshipGraph } from "@/types/molearn";

export function InteractionResults({ records, identity }: { records: Association[]; identity: ExplorationIdentity }) {
  const seed = records[0];
  const graph: RelationshipGraph = {
    isDemo: false,
    centerKey: seed.string_id,
    nodes: [
      { key: seed.string_id, type: "protein", id: seed.protein_accession, symbol: seed.seed_name,
        name: seed.seed_name, organism: identity.organism ?? undefined },
      ...records.map((record) => ({
        key: record.partner_id, type: "protein" as const, id: record.partner_id, symbol: record.partner_name,
        name: record.partner_name, organism: identity.organism ?? undefined, sourceHref: record.partner_url,
      })),
    ],
    edges: records.map((record) => {
      const channels = Object.entries(record.evidence).map(([name, score]) => `${name}: ${score.toFixed(3)}`);
      return {
        id: record.source_id, from: record.string_id, to: record.partner_id, label: "functional association",
        source: record.source, evidence: `Partner: ${record.partner_id} · Score: ${record.score.toFixed(3)}`
          + (channels.length ? ` · ${channels.join("; ")}` : " · Evidence scores not reported"),
      };
    }),
  };
  return (
    <div className="flex min-w-0 flex-col gap-sm text-body-sm">
      <div><SourceBadge source="STRING" /></div>
      <p>
        STRING functional associations include indirect links. Even a high score does not confirm direct physical interaction.
      </p>
      <p>
        {seed.seed_name} · {seed.string_id} · Taxonomy {seed.taxonomy_id}.
        {" "}Up to 10 partners, with a minimum association score of {(seed.required_score / 1000).toFixed(2)}.
      </p>
      <a className="text-primary underline" href={seed.source_url}>View source records on STRING v12.0</a>
      <RelationshipExplorer graph={graph} />
    </div>
  );
}
