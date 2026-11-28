import { SourceBadge } from "@/components/SourceBadge";
import type { ChemicalComponent } from "@/lib/exploration";

const LABELS: Record<ChemicalComponent["category"], string> = {
  ion: "Ion",
  nonpolymer: "Non-polymer component",
  other: "Other chemical component",
};

export function LigandResults({ records }: { records: ChemicalComponent[] }) {
  return (
    <div className="flex flex-col gap-sm text-body-sm">
      <div><SourceBadge source="PDB" /></div>
      <p>
        These chemical components occur in deposited structures for {records[0].protein_accession}.
        Presence alone does not establish direct binding, affinity, or therapeutic effectiveness.
      </p>
      <ul className="flex flex-col gap-sm">
        {records.map((record) => (
          <li key={record.source_id} className="flex flex-col gap-xs rounded-md border border-outline-subtle p-sm [overflow-wrap:anywhere]">
            <h4 className="font-semibold">
              <a href={record.source_url} className="text-primary underline">{record.source_id} · {record.name}</a>
            </h4>
            <p>{LABELS[record.category]} · Formula: {record.formula ?? "Not reported"}</p>
            {record.cofactor_source_url && <p>
              <a href={record.cofactor_source_url} className="text-primary underline">UniProtKB cofactor annotation</a>
              {" "}({record.cofactor_chebi})
            </p>}
            <p className="flex flex-wrap gap-x-sm">
              Present in PDB:
              {record.pdb_ids.map((id) => <a key={id} href={`https://www.rcsb.org/structure/${id}`} className="text-primary underline">{id}</a>)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
