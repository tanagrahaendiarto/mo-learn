"""PubMed identifiers, explicitly linked references, and article records."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Literal

from ..exploration import Identity, Provenance
from .ncbi import EUTILS
from .scientific_http import SourceError, retrieved_now

LIMIT = 8
ID = re.compile(r"[1-9][0-9]{0,11}")
DOI = re.compile(r"10\.[0-9]{4,9}/[^\s<>]+", re.ASCII | re.IGNORECASE)
CC_ABSTRACT = re.compile(
    r"""https://creativecommons\.org/(?:licenses/by/4\.0|publicdomain/zero/1\.0)/?(?=$|[\s.,;)"'<])""",
    re.IGNORECASE,
)


class Publication(Provenance):
    title: str
    authors: list[str]
    journal: str | None
    year: int | None
    pmid: str
    doi: str | None
    relation: Literal["direct", "related"]
    relation_source: str
    abstract_available: bool
    abstract: str | None
    abstract_license: str | None


def _ids(values: list) -> list[str]:
    return list(dict.fromkeys(str(value) for value in values if ID.fullmatch(str(value))))[:LIMIT]


def gene_pmids(gene_id: str, deadline: float) -> list[str]:
    body = EUTILS.json("/entrez/eutils/elink.fcgi", deadline, params={
        "dbfrom": "gene", "db": "pubmed", "id": gene_id, "linkname": "gene_pubmed", "retmode": "json",
    }, max_bytes=1_000_000)
    try:
        [links] = body["linksets"]
        if links.get("dbfrom") != "gene" or links.get("ids") != [gene_id]:
            raise SourceError("identity_mismatch")
        candidates = links.get("linksetdbs", [])
        ids = []
        for group in candidates:
            if group.get("linkname") == "gene_pubmed" and group.get("dbto") == "pubmed":
                if not isinstance(group.get("links"), list):
                    raise TypeError("links must be a list")
                ids.extend(group["links"])
        return _ids(ids)
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        raise SourceError("malformed_response") from exc


def protein_pmids(raw: dict) -> list[str]:
    try:
        return _ids([ref["id"] for reference in raw.get("references", [])
                     for ref in reference.get("citation", {}).get("citationCrossReferences", [])
                     if ref.get("database") == "PubMed"])
    except (KeyError, TypeError, AttributeError) as exc:
        raise SourceError("malformed_response") from exc


def _term(text: str | None) -> str:
    return re.sub(r"[^A-Za-z0-9 ._-]", " ", text or "").strip()[:100]


def related_pmids(identity: Identity, symbol: str | None, deadline: float) -> list[str] | None:
    terms = list(dict.fromkeys(filter(None, (_term(symbol), _term(identity.name)))))
    organism = _term(identity.organism)
    if not organism or not identity.taxonomy_id or not terms:
        return None
    taxa = [f'"{organism}"[Title/Abstract]', f'"{organism}"[MeSH Terms]']
    if identity.taxonomy_id == 9606:
        taxa = ['"Humans"[MeSH Terms]', 'human[Title/Abstract]', taxa[0]]
    query = "(" + " OR ".join(f'"{term}"[Title/Abstract]' for term in terms) + ") AND (" + " OR ".join(taxa) + ")"
    body = EUTILS.json("/entrez/eutils/esearch.fcgi", deadline, params={
        "db": "pubmed", "term": query, "retmax": LIMIT, "sort": "relevance", "retmode": "json",
    }, max_bytes=32_000)
    try:
        values = body["esearchresult"]["idlist"]
        if not isinstance(values, list):
            raise TypeError("idlist must be a list")
        return _ids(values)
    except (KeyError, TypeError) as exc:
        raise SourceError("malformed_response") from exc


def _text(node: ET.Element, path: str) -> str | None:
    element = node.find(path)
    return "".join(element.itertext()).strip() or None if element is not None else None


def articles(direct: list[str], related: list[str], direct_source: str, deadline: float) -> tuple[list[Publication], int]:
    ids = list(dict.fromkeys(direct + related))
    if not ids:
        return [], 0
    data = EUTILS.get("/entrez/eutils/efetch.fcgi", deadline, params={
        "db": "pubmed", "id": ",".join(ids), "retmode": "xml",
    })
    try:
        root = ET.fromstring(data)
    except (ET.ParseError, TypeError) as exc:
        raise SourceError("malformed_response") from exc
    if root.tag != "PubmedArticleSet":
        raise SourceError("malformed_response")
    retrieved_at = retrieved_now()
    records: dict[str, Publication] = {}
    for item in root.findall("PubmedArticle"):
        pmid = item.findtext("MedlineCitation/PMID")
        article = item.find("MedlineCitation/Article")
        if pmid not in ids or article is None:
            continue
        title = _text(article, "ArticleTitle")
        if not title:
            continue
        year = article.findtext("Journal/JournalIssue/PubDate/Year") or article.findtext("ArticleDate/Year")
        if not year:
            date = article.findtext("Journal/JournalIssue/PubDate/MedlineDate", "")
            match = re.match(r"[12][0-9]{3}\b", date)
            year = match[0] if match else None
        authors = []
        for author in article.findall("AuthorList/Author"):
            name = " ".join(filter(None, [_text(author, "ForeName") or _text(author, "Initials"),
                                          _text(author, "LastName"), _text(author, "Suffix")]))
            name = name or _text(author, "CollectiveName")
            if name:
                authors.append(name)
        doi = item.findtext("PubmedData/ArticleIdList/ArticleId[@IdType='doi']")
        abstract = article.findall("Abstract/AbstractText")
        copyright_text = _text(article, "Abstract/CopyrightInformation") or ""
        license_match = CC_ABSTRACT.search(copyright_text)
        abstract_text = "\n".join("".join(section.itertext()).strip() for section in abstract)
        records[pmid] = Publication(
            title=title, authors=authors, journal=_text(article, "Journal/Title"),
            year=int(year) if year and re.fullmatch(r"[12][0-9]{3}", year) else None,
            pmid=pmid, doi=doi if doi and DOI.fullmatch(doi) else None,
            relation="direct" if pmid in direct else "related",
            relation_source=direct_source if pmid in direct else "PubMed entity and organism search",
            abstract_available=bool(abstract_text),
            abstract=abstract_text if license_match and abstract_text else None,
            abstract_license=license_match[0] if license_match and abstract_text else None,
            source="PubMed", source_id=pmid, source_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            retrieved_at=retrieved_at,
        )
    return [records[pmid] for pmid in ids if pmid in records], len(ids) - len(records)
