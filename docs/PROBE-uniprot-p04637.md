# PROBE — UniProt P04637 (bukti read-only, putaran koreksi 1)

Tanggal: 27 Nov 2026. Semua HTTP status + field di bawah hasil probe nyata di lingkungan ini (curl + python json), tanpa mengubah apa pun.

## Endpoint yang diuji

| URL | HTTP | Ukuran | Catatan |
|---|---|---|---|
| `GET https://rest.uniprot.org/uniprotkb/P04637.json` | **200** | ~848 KB | retrieve by accession |
| `GET https://rest.uniprot.org/uniprotkb/search?query=accession%3AP04637&format=json&size=1` | **200** | ~848 KB | 1 hasil |
| `GET https://rest.uniprot.org/uniprotkb/search?query=protein_name%3A%22p53%22%20AND%20organism_id%3A%229606%22&format=json&size=5` | **200** | 5 hasil | P04637, O15350, Q9Y6P5, A1A5B4, O15151 |
| `GET .../search?...&size=5&cursor=*` | **500** | 87 B | `{"url":"http://rest.uniprot.org/uniprotkb/search","messages":["Internal server error"]}` — 2× ulangan, konsisten |

## Temuan kunci

1. **Search jalan normal di lingkungan ini** (HTTP 200 utk accession & nama).
   - Probe awal giliran 1 salah pakai path lama `/uniprotkb?query=` → dapat 301 redirect ke `http://rest.uniprot.org:8080/` (port 8080, http, mati). Itutak pernah ditest ulang dengan path yang benar.
   - Endpoint yang benar: **`/uniprotkb/search?query=`** → 200. Jadi klaim "search rusak/proxy mitm" di rancangan awal **salah** (akar: path salah).

2. **`cursor=*` → 500 konsisten** (2 percobaan). Gejala nyata; akar tak diketahui — bisa param salah, bisa server. Jangan asumsikan format token. Tandai `[LIVE-UNVERIFIED: cursor]`.

## Mapping nyata P04637 (dari payload 200, bukan asumsi)

```
primaryAccession                       = P04637
entryType                              = "UniProtKB reviewed (Swiss-Prot)"
organism.scientificName                = Homo sapiens
organism.taxonId                       = 9606        # BUKAN null; field-nya ada & terpopulasi
organism.taxonomyId                    = (tidak ada)  # key ini memang tidak ada di payload
proteinDescription (object, BUKAN array)
  .recommendedName.fullName.value      = "Cellular tumor antigen p53"
  .alternativeNames[*].fullName.value  = ["Antigen NY-CO-13","Phosphoprotein p53","Tumor suppressor p53"]
genes[0].geneName.value                = TP53
comments[commentType=FUNCTION].texts[*].value
                                       = "Multifunctional transcription factor that induces cell cycle arrest, DNA repair or apoptosis upon binding to its target DNA sequence (PubMed:11025664, ...)"
sequence.length                        = 393
uniProtKBCrossReferences (namespace yang ADA di payload ini):
  GeneID  -> id 7157
  HGNC    -> id HGNC:11998
  (GeneCards, GeneReviews, DisGeNET, Gene3D, GeneTree, GeneWiki juga ada)
  NCBI-Gene -> TIDAK ADA di payload P04637
```

## Field yang benar-benar hilang vs salah dibaca
- `organism.taxonomyId` → benar-benar **tidak ada** di payload (jangan hardcode; nullable di kontrak).
- `organism.taxonId` → **ada, nilai 9606**. Gue dulu salah baca "taxonomy_id null" karena salah pakai nama key.
- `NCBI-Gene` xref → tidak ada di payload; jangan dianggap ada.
