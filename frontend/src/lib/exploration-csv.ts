import { downloadCsv, toCsv } from "@/lib/csv";
import type { Association, ExplorationResult, Provenance, Publication, StructureRecord } from "@/lib/exploration";

const CONTEXT_COLUMNS = [
  "entity_type", "entity_accession", "entity_name", "organism", "taxonomy_id",
  "source", "source_id", "source_url", "retrieved_at", "result_status", "source_notices",
];

function exportRecords<T extends Provenance>(
  response: ExplorationResult<T>, file: string, fields: readonly string[],
  values: (record: T) => Record<string, unknown>,
) {
  const { identity, notices, records, status } = response;
  const columns = [...CONTEXT_COLUMNS, ...fields].map((key) => ({ key, label: key }));
  const rows = records.map((record) => ({
    entity_type: identity.entity_type,
    entity_accession: identity.accession,
    entity_name: identity.name,
    organism: identity.organism,
    taxonomy_id: identity.taxonomy_id,
    source: record.source,
    source_id: record.source_id,
    source_url: record.source_url,
    retrieved_at: record.retrieved_at,
    result_status: status,
    source_notices: notices.map(({ source, code }) => `${source}:${code}`).join("; "),
    ...values(record),
  }));
  downloadCsv(`${identity.accession}-${file}.csv`, toCsv(rows, columns));
}

export function exportLiterature(response: ExplorationResult<Publication>) {
  exportRecords(response, "literature", [
    "pmid", "doi", "title", "authors", "journal", "year", "relation", "relation_source",
    "abstract_available", "abstract_license",
  ], (record) => ({ ...record, authors: record.authors.join("; ") }));
}

export function exportStructures(response: ExplorationResult<StructureRecord>) {
  exportRecords(response, "structures", [
    "kind", "protein_accession", "title", "methods", "resolution_angstrom",
    "coverage", "mean_plddt", "preview_url", "downloads",
  ], (record) => ({
    ...record,
    methods: record.methods.join("; "),
    resolution_angstrom: record.resolution_angstrom.join("; "),
    coverage: JSON.stringify(record.coverage),
    downloads: JSON.stringify(record.downloads),
  }));
}

export function exportInteractions(response: ExplorationResult<Association>) {
  exportRecords(response, "interactions", [
    "protein_accession", "string_id", "seed_name", "partner_id", "partner_name",
    "partner_url", "network_type", "score", "required_score", "evidence",
  ], (record) => ({ ...record, evidence: JSON.stringify(record.evidence) }));
}
