import type { EntityType } from "@/types/molearn";

export interface ExplorationIdentity {
  entity_type: EntityType;
  accession: string;
  name: string | null;
  organism: string | null;
  taxonomy_id: number | null;
}

export interface Provenance {
  source: string;
  source_id: string;
  source_url: string;
  retrieved_at: string;
}

export interface ExplorationResult<T> {
  status: "available" | "empty" | "unavailable" | "partial" | "provider_error";
  identity: ExplorationIdentity;
  records: T[];
  notices: { source: string; code: string; message: string }[];
}

export interface SequenceRecord extends Provenance {
  kind: "protein" | "genomic_dna" | "transcript" | "cds";
  accession: string;
  label: string;
  length: number;
  sequence: string;
  start: number | null;
  end: number | null;
  strand: string | null;
}

export interface Publication extends Provenance {
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  pmid: string;
  doi: string | null;
  relation: "direct" | "related";
  relation_source: string;
  abstract_available: boolean;
  abstract: string | null;
  abstract_license: string | null;
}

export interface StructureRecord extends Provenance {
  kind: "experimental" | "predicted";
  title: string | null;
  protein_accession: string;
  methods: string[];
  resolution_angstrom: number[];
  coverage: { chain: string; start: number | null; end: number | null }[];
  mean_plddt: number | null;
  preview_url: string | null;
  downloads: { format: string; url: string }[];
}

export interface ChemicalComponent extends Provenance {
  name: string;
  formula: string | null;
  category: "ion" | "nonpolymer" | "other";
  ccd_type: string | null;
  pdb_ids: string[];
  protein_accession: string;
  cofactor_chebi: string | null;
  cofactor_source_url: string | null;
}

export interface Association extends Provenance {
  protein_accession: string;
  string_id: string;
  seed_name: string;
  partner_id: string;
  partner_name: string;
  partner_url: string;
  taxonomy_id: number;
  network_type: "functional";
  score: number;
  evidence: Record<string, number>;
  required_score: number;
}

export interface ExplorationRecords {
  sequence: SequenceRecord;
  literature: Publication;
  structure: StructureRecord;
  ligand: ChemicalComponent;
  interaction: Association;
}

export type LiveModule = keyof ExplorationRecords;

export async function fetchExploration<K extends LiveModule>(
  type: EntityType, id: string, module: K, signal: AbortSignal,
): Promise<ExplorationResult<ExplorationRecords[K]>> {
  const response = await fetch(`/api/backend/api/v1/entities/${type}/${encodeURIComponent(id)}/${module}`, { signal });
  if (!response.ok) throw new Error("Exploration request failed");
  return response.json();
}
