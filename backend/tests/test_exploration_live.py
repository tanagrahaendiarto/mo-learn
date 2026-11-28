"""Opt-in paced checks against the scientific providers, with no model calls."""
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as transport:
        yield transport


@pytest.mark.parametrize(("kind", "identifier", "taxonomy"), [
    ("protein", "P04637", 9606),
    ("gene", "7157", 9606),
    ("protein", "P00918", 9606),
    ("gene", "22059", 10090),
])
def test_live_scientific_exploration(client, kind, identifier, taxonomy):
    payloads = {}
    for module in ("sequence", "literature", "structure", "ligand", "interaction"):
        response = client.get(f"/api/v1/entities/{kind}/{identifier}/{module}")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("available", "partial"), (module, data["notices"])
        assert data["identity"]["accession"] == identifier
        assert data["identity"]["taxonomy_id"] == taxonomy
        assert data["records"]
        for record in data["records"]:
            assert record["source"] and record["source_id"] and record["retrieved_at"]
            assert record["source_url"].startswith("https://")
        payloads[module] = data["records"]
        time.sleep(0.5)

    sequence = payloads["sequence"]
    assert {row["kind"] for row in sequence} == ({"protein"} if kind == "protein" else {"genomic_dna", "transcript", "cds"})
    assert all(row["length"] == len(row["sequence"]) for row in sequence)
    articles = payloads["literature"]
    assert len(articles) <= 16 and {row["relation"] for row in articles} == {"direct", "related"}
    assert all(row["title"] and row["pmid"].isdigit() for row in articles)
    assert all(not row["abstract"] or row["abstract_license"] for row in articles)
    assert {row["kind"] for row in payloads["structure"]} == {"experimental", "predicted"}
    assert all(row["pdb_ids"] and row["name"] for row in payloads["ligand"])
    assert 0 < len(payloads["interaction"]) <= 10
    assert all(row["taxonomy_id"] == taxonomy and 0.7 <= row["score"] <= 1 for row in payloads["interaction"])
