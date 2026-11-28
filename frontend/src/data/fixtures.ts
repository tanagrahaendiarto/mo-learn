import type {
  BiologicalEntitySummary,
  ExplorationModuleData,
  GeneEntityProfile,
  GlossaryEntry,
  SavedEntity,
} from "@/types/molearn";

/**
 * FIXTURE DEV — DATA LOKAL BERSIFAT DEMO.
 *
 * File ini TERPISAH dari kode API: dipakai hanya ketika backend belum
 * terhubung (`NEXT_PUBLIC_DEMO_MODE=true`). Semua entitas di sini
 * berasal dari blueprint Stitch (landing + halaman pencarian), jadi tidak
 * ada fakta biologis yang diarang. Data ini WAJIB ditandai "Lokal (demo)"
 * di UI agar tidak disalahartikan sebagai data live.
 */

/** Ikon + aksen kartu ensiklopedia landing (DEX #001–#004). */
export const FEATURED_ENTITIES: BiologicalEntitySummary[] = [
  {
    type: "gene",
    id: "7157",
    symbol: "TP53",
    name: "Tumor protein p53",
    organism: "Homo sapiens",
    source: "NCBI Gene",
    badge: "gene",
    icon: "dna",
    dexCode: "DEX #001",
    summary:
      "Gene on chromosome 17 that provides instructions for making the tumor-suppressor protein p53.",
  },
  {
    type: "protein",
    id: "P04637",
    symbol: "p53",
    name: "Cellular tumor antigen p53",
    organism: "Homo sapiens",
    source: "UniProt",
    badge: "protein",
    icon: "protein",
    dexCode: "DEX #002",
    summary:
      "The \u201Cguardian of the genome\u201D — halts cell division when DNA is damaged.",
  },
  {
    type: "protein",
    id: "P01308",
    symbol: "Insulin",
    name: "Insulin",
    organism: "Homo sapiens",
    source: "UniProt",
    badge: "hormone",
    icon: "hormone",
    dexCode: "DEX #003",
    summary:
      "A peptide hormone from pancreatic beta cells that regulates glucose uptake into cells.",
  },
  {
    type: "protein",
    id: "P00918",
    symbol: "CA II",
    name: "Carbonic anhydrase II",
    organism: "Homo sapiens",
    source: "UniProt",
    badge: "enzyme",
    icon: "enzyme",
    dexCode: "DEX #004",
    summary:
      "An extremely fast enzyme with a zinc (Zn\u00B2\u207A) cofactor that maintains blood pH balance.",
  },
];

/** Istilah contoh yang ditawarkan di hero pencarian. */
export const SUGGESTED_TERMS: string[] = [
  "TP53",
  "Insulin",
  "BRCA1",
  "Hemoglobin",
];

/** Hasil fixture untuk halaman pencarian `/search?q=...`. */
export const SEARCH_FIXTURE: BiologicalEntitySummary[] = [
  {
    type: "protein",
    id: "P04637",
    symbol: "p53",
    name: "Cellular tumor antigen p53",
    organism: "Homo sapiens",
    source: "UniProt",
    aliases: ["TP53"],
    summary:
      "Tumor-suppressor protein that regulates the cell cycle, DNA repair, and apoptosis in humans.",
  },
  {
    type: "gene",
    id: "7157",
    symbol: "TP53",
    name: "Tumor protein p53",
    organism: "Homo sapiens",
    source: "NCBI Gene",
    aliases: ["p53"],
    summary:
      "Gene encoding the p53 protein, located on the short arm of human chromosome 17 (17p13.1).",
  },
  {
    type: "protein",
    id: "P02340",
    symbol: "Trp53",
    name: "Cellular tumor antigen p53",
    organism: "Mus musculus",
    source: "UniProt",
    summary:
      "Mouse (Mus musculus) homolog of p53, widely used in cancer research models.",
  },
  {
    type: "gene",
    id: "22059",
    symbol: "Trp53",
    name: "Transformation related protein 53",
    organism: "Mus musculus",
    source: "NCBI Gene",
    partial: true,
    summary:
      "Gene encoding the mouse p53 protein; advanced structure annotations are not yet available.",
  },
];

/** Modul eksplorasi (menu perintah lab) — urutan sesuai blueprint Stitch.
 *  `state` mencerminkan apa yang BENAR-BENAR didukung oleh data sumber.
 *  Tanpa backend Slice 2, hanya metadata sekuens + export yang aktif;
 *  sisanya jujur ditandai `unavailable`. */
export const EXPLORATION_MODULES: ExplorationModuleData[] = [
  {
    module: "structure",
    title: "1. Structure",
    description: "Preview of 3D molecular structure and PDB codes.",
    state: "unavailable",
    detail:
      "3D structure is not available yet. It will arrive with a future data source.",
  },
  {
    module: "ligand",
    title: "2. Ligand",
    description: "Ions and other chemical components observed in deposited structures.",
    state: "unavailable",
    detail:
      "Ligand data is not available for this entity yet.",
  },
  {
    module: "interaction",
    title: "3. Protein Interaction",
    description: "Explore protein associations and supporting evidence from STRING.",
    state: "unavailable",
    detail:
      "Interaction data is not available yet. Only verified cross-references are shown in the Relationship Explorer.",
  },
  {
    module: "sequence",
    title: "4. Sequence",
    description: "View verified protein or reference nucleotide sequences.",
    state: "unavailable",
    detail:
      "The full sequence is not loaded. Sequence length is shown in Advanced Details when available.",
  },
  {
    module: "literature",
    title: "5. Scientific Literature",
    description: "Trusted journal references with DOI and PMID.",
    state: "unavailable",
    detail:
      "Literature references are not available for this entity yet.",
  },
  {
    module: "export",
    title: "6. Data Export",
    description: "Download summarized data as CSV.",
    state: "unavailable",
    detail:
      "Export becomes available once there is source data with permitted redistribution.",
  },
];

/** Glosarium awal (10 istilah inti) — transkripsi blueprint halaman 5. */
export const GLOSSARY_FIXTURE: GlossaryEntry[] = [
  {
    term: "Accession",
    definition:
      "A unique identifier assigned by a scientific database (such as UniProt or NCBI) to unambiguously refer to a single biological entity.",
    example: "P04637 for the human p53 protein.",
    relatedEntity: "P04637",
    link: { label: "View in Entity Profile", href: "/entity/protein/P04637" },
  },
  {
    term: "Binding Site",
    definition:
      "A specific area on the surface of a protein or enzyme where a ligand or another molecule binds precisely.",
    example: "The zinc-ion (Zn\u207A) binding pocket on p53.",
    relatedEntity: "P04637",
    link: { label: "Open Structure Module", href: "/entity/protein/P04637" },
  },
  {
    term: "Enzyme",
    definition:
      "A specialized protein that accelerates biochemical reactions inside the cell without being consumed by them.",
    example: "Carbonic anhydrase II, which regulates blood pH.",
    relatedEntity: "P00918",
    link: { label: "Explore an Enzyme Example", href: "/search?q=Carbonic" },
  },
  {
    term: "Gene",
    definition:
      "A segment of DNA carrying the genetic instructions to make a functional RNA or a specific protein.",
    example: "The TP53 gene on human chromosome 17.",
    relatedEntity: "7157",
    link: { label: "Find a Gene in Explore", href: "/search?q=TP53" },
  },
  {
    term: "Isoform",
    definition:
      "A protein variant produced from a single gene through differences in mRNA splicing.",
    example: "p53 has several short isoforms.",
    relatedEntity: "P04637",
    link: { label: "View Canonical Sequence", href: "/entity/protein/P04637" },
  },
  {
    term: "Ligand",
    definition:
      "An ion or small molecule that binds to a protein to stabilize its structure or trigger a biological signal.",
    example: "The zinc ion (ZN) in PDB structure 1TUP.",
    link: { label: "Open Ligand Module", href: "/entity/protein/P04637" },
  },
  {
    term: "Protein",
    definition:
      "A macromolecule made of amino-acid chains that carries out nearly all of the work inside the cell.",
    example: "Cellular tumor antigen p53 and insulin.",
    relatedEntity: "P04637",
    link: { label: "Open p53 Profile", href: "/entity/protein/P04637" },
  },
  {
    term: "Protein Interaction",
    definition:
      "A physical or functional relationship between two or more proteins to carry out a cell-signaling pathway.",
    example: "MDM2 binds p53 to regulate its stability.",
    relatedEntity: "P04637",
    link: { label: "Open Interaction Graph", href: "/entity/protein/P04637" },
  },
  {
    term: "Sequence",
    definition:
      "A linear order of nucleotides (DNA/RNA) or amino acids (protein), usually stored in FASTA format.",
    example: "393 amino-acid residues in human p53.",
    relatedEntity: "P04637",
    link: { label: "Open Sequence Module", href: "/entity/protein/P04637" },
  },
  {
    term: "Transcript",
    definition:
      "An RNA molecule copied (transcribed) from a DNA gene before it is translated into a protein.",
    example: "The TP53 mRNA that is translated into p53.",
    relatedEntity: "7157",
    link: { label: "Learn Gene vs Protein", href: "/search?q=TP53" },
  },
  {
    term: "Hormone",
    definition:
      "A signaling molecule made in one part of the body and carried (often through the blood) to act on distant cells.",
    example: "Insulin, which tells cells to take up glucose from the blood.",
    relatedEntity: "P01308",
    link: { label: "Explore an Insulin Example", href: "/search?q=Insulin" },
  },
  {
    term: "GeneID",
    definition:
      "The numeric identifier that NCBI assigns to a gene record. It is different from a protein accession.",
    example: "7157 is the NCBI GeneID for the human TP53 gene.",
    relatedEntity: "7157",
    link: { label: "Find a Gene in Explore", href: "/search?q=TP53" },
  },
  {
    term: "Organism",
    definition:
      "The living species a biological record belongs to, written as a Latin binomial (genus and species).",
    example: "Homo sapiens (human) and Mus musculus (mouse).",
  },
  {
    term: "Taxonomy ID",
    definition:
      "A stable numeric identifier for a species in the NCBI taxonomy database.",
    example: "9606 is the taxonomy ID for Homo sapiens.",
  },
  {
    term: "Amino acid",
    definition:
      "The building block of proteins. Twenty standard amino acids link into chains that fold into a working protein.",
    example: "Human p53 is built from 393 amino-acid residues.",
  },
  {
    term: "Reviewed entry",
    definition:
      "A UniProt record (Swiss-Prot) manually curated and cross-checked by expert annotators, labeled \"reviewed\".",
    example: "P04637 is a reviewed UniProt entry.",
  },
  {
    term: "Unreviewed entry",
    definition:
      "A UniProt record (TrEMBL) produced automatically from genome data without manual review, labeled \"unreviewed\".",
  },
  {
    term: "Cross-reference",
    definition:
      "A recorded link between two databases that identifies the same or a related entity.",
    example: "A UniProt protein pointing to its HGNC gene identifier.",
    link: { label: "Open a Protein Profile", href: "/entity/protein/P04637" },
  },
  {
    term: "Gene–protein relationship",
    definition:
      "A gene (DNA) carries instructions; the protein is the product built from those instructions. A gene may encode one or more proteins, but moLearn never merges the two automatically.",
    example: "The TP53 gene and the p53 protein it encodes.",
    link: { label: "Compare Gene vs Protein", href: "/search?q=TP53" },
  },
  {
    term: "Biological sequence",
    definition:
      "The ordered chain of building blocks in DNA, RNA, or protein, usually written one letter per residue.",
    example: "A protein sequence written with one letter per amino acid.",
  },
  {
    term: "Experimental structure",
    definition:
      "A three-dimensional molecular shape determined by laboratory methods such as X-ray crystallography or cryo-EM.",
  },
  {
    term: "Predicted structure",
    definition:
      "A three-dimensional molecular shape estimated by computational methods, not directly measured in a laboratory.",
  },
];

/**
 * Benih "Koleksi Contoh" — transkripsi `defaultItems` blueprint halaman 4.
 * Dipakai saat koleksi kosong: tombol "Muat Contoh Koleksi" mengisi slot
 * dengan item demo ini (tetap disimpan di localStorage pengguna).
 */
export const DEMO_COLLECTION: SavedEntity[] = [
  {
    type: "protein",
    id: "P04637",
    name: "Cellular tumor antigen p53",
    symbol: "p53",
    organism: "Homo sapiens",
    source: "UniProt",
    isDemo: true,
    note: "Guardian of the genome and regulator of the cell cycle.",
    savedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
  {
    type: "gene",
    id: "7157",
    name: "Tumor protein p53",
    symbol: "TP53",
    organism: "Homo sapiens",
    source: "NCBI Gene",
    isDemo: true,
    note: "Gene encoding the p53 protein on chromosome 17.",
    savedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
  {
    type: "protein",
    id: "P01308",
    name: "Insulin",
    symbol: "INS",
    organism: "Homo sapiens",
    source: "UniProt",
    isDemo: true,
    note: "A peptide hormone that regulates blood glucose levels.",
    savedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
  {
    type: "protein",
    id: "P00918",
    name: "Carbonic anhydrase 2",
    symbol: "CA2",
    organism: "Homo sapiens",
    source: "UniProt",
    isDemo: true,
    note: "An enzyme with a zinc cofactor for pH regulation.",
    savedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
];

/** Jumlah slot koleksi (konstanta inventaris dari blueprint halaman 4). */
export const COLLECTION_SLOT_CAP = 20;

/**
 * FIXTURE DEMO — profil gen (Task E).
 * Bentuk data mengikuti kontrak NCBI Gene slice 2; hanya dipakai saat
 * mode demo dan selalu ditandai "Demo" di UI.
 */
export const GENE_PROFILE_FIXTURES: GeneEntityProfile[] = [
  {
    type: "gene",
    id: "7157",
    symbol: "TP53",
    name: "Tumor protein p53",
    organism: "Homo sapiens",
    source: "NCBI Gene",
    taxonomyId: 9606,
    description:
      "Gene that provides instructions for making the tumor-suppressor protein p53.",
    chromosome: "17p13.1",
    geneType: "protein-coding",
    synonyms: ["P53", "LFS1", "BCC7"],
    crossReferences: [
      { namespace: "HGNC", id: "HGNC:11998" },
      { namespace: "Ensembl", id: "ENSG00000141510" },
      { namespace: "MIM", id: "191170" },
    ],
    relatedProteins: ["antigen NY-CO-13", "phosphoprotein p53", "tumor protein 53"],
    proteinLinks: [
      {
        accession: "P04637",
        primaryName: "Cellular tumor antigen p53",
        geneSymbols: ["TP53"],
        reviewed: true,
        source: "UniProt",
        sourceUrl: "https://www.uniprot.org/uniprotkb/P04637",
        evidence: "uniprot_geneid_crossref",
      },
    ],
    sourceUrl: "https://www.ncbi.nlm.nih.gov/gene/7157",
  },
  {
    type: "gene",
    id: "22059",
    symbol: "Trp53",
    name: "Transformation related protein 53",
    organism: "Mus musculus",
    source: "NCBI Gene",
    taxonomyId: 10090,
    description:
      "Gene encoding the mouse p53 protein; advanced structure annotations are not yet available.",
    chromosome: "11",
    geneType: "protein-coding",
    synonyms: ["p53"],
    crossReferences: [{ namespace: "MGI", id: "MGI:98834" }],
    relatedProteins: ["Cellular tumor antigen p53"],
    proteinLinks: [],
    sourceUrl: "https://www.ncbi.nlm.nih.gov/gene/22059",
  },
];
