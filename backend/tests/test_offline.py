"""Offline tests: adapter + endpoint via fixture / mocked transport.
All UniProt responses are either real fixtures (labeled) or explicitly
labeled simulations. No network."""
import json
import re
import time
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.adapters import uniprot
from app.schemas import GeneXref

FIX = Path(__file__).parent / "fixtures"


def load_json(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def load_headers(name):
    return (FIX / name).read_text(encoding="utf-8")


def make_transport(handler):
    def http_handler(request):
        return handler(request)

    return httpx.MockTransport(http_handler)


@pytest.fixture
def _unused():
    yield


# ---------- adapter: mapping ----------

class TestAdapterMapping:
    def test_p04637_summary_fields(self):
        rec = load_json("P04637.json")
        s = uniprot.map_summary(rec, "2026-11-27T04:00:00Z")
        assert s.accession == "P04637"
        assert s.primary_name == "Cellular tumor antigen p53"
        assert "Antigen NY-CO-13" in s.synonyms
        assert s.gene_symbols == ["TP53"]
        assert s.organism.scientific_name == "Homo sapiens"
        assert s.organism.taxonomy_id == 9606
        assert s.reviewed is True
        assert s.source_url == "https://www.uniprot.org/uniprotkb/P04637"
        assert s.status == "available"

    def test_p04637_profile_fields(self):
        rec = load_json("P04637.json")
        p = uniprot.map_profile(rec, "2026-11-27T04:00:00Z")
        assert p.length == 393
        assert GeneXref(namespace="GeneID", id="7157") in p.gene_crossrefs
        assert GeneXref(namespace="HGNC", id="HGNC:11998") in p.gene_crossrefs
        assert len(p.function_annotations) >= 1
        assert "transcription factor" in p.function_annotations[0].lower()

    def test_optional_fields_missing_never_fail(self):
        rec = load_json("P04637.json")
        del rec["proteinDescription"]
        del rec["genes"]
        del rec["comments"]
        s = uniprot.map_summary(rec, "t")
        assert s.primary_name is None
        assert s.synonyms == []
        assert s.gene_symbols == []

    def test_name_fallback_to_first_alternative(self):
        """Documented fallback: no recommendedName -> first alternativeName.
        Labeled as verified shape, not invented."""
        rec = load_json("P04637.json")
        del rec["proteinDescription"]["recommendedName"]
        s = uniprot.map_summary(rec, "t")
        assert s.primary_name == s.synonyms[0]


# ---------- adapter: pagination (Link header) ----------

class TestPagination:
    def test_next_cursor_read_from_link_header_not_items(self):
        hdrs = load_headers("search_p53_p1.headers")
        link_line = re.search(r"^Link: (.*)$", hdrs, re.M).group(1)
        got, ok = uniprot.next_cursor_from_headers({"Link": link_line})
        assert ok and got, "p1 Link header must yield a cursor"
        # item JSON has no cursor field
        items = load_json("search_p53_p1.json")["results"]
        assert "cursor" not in items[0]

    def test_cursor_must_be_opaque_not_url(self):
        with pytest.raises(ValueError):
            uniprot.validate_cursor("https://evil.example/x")
        with pytest.raises(ValueError):
            uniprot.validate_cursor("*")
        with pytest.raises(ValueError):
            uniprot.validate_cursor("a" * 201)

    def test_invalid_next_link_is_flagged_not_silent(self):
        # wrong host with rel="next": (None, False) -> provider_error,
        # deliberately distinguished from legitimate end of results
        got, ok = uniprot.next_cursor_from_headers({"Link": '<https://evil.example/uniprotkb/search?cursor=abc123>; rel="next"'})
        assert got is None and not ok

    def test_wrong_path_next_link_is_flagged(self):
        got, ok = uniprot.next_cursor_from_headers({"Link": '<https://rest.uniprot.org/other?cursor=abc>; rel="next"'})
        assert got is None and not ok

    def test_no_link_header_gives_clean_end(self):
        got, ok = uniprot.next_cursor_from_headers({})
        assert got is None and ok  # legitimate end of results


# ---------- endpoint: search ----------

def _search_handler(request):
    """Offline transport emulating real fixtures + labeled simulations."""
    path = request.url.path
    params = dict(request.url.params)
    q = params.get("query", "")

    if "unknown_sim" in q:  # SIMULASI: no Link header (last page)
        return httpx.Response(200, json=load_json("search_sim_lastpage.json"))
    if "accession:A1B2C3" in q:  # SIMULASI: valid 6-char accession, not found
        return httpx.Response(200, json={"results": []})
    if "accession:A0A022YWF9" in q:  # SIMULASI: upstream 500 (valid 10-char accession per official syntax)
        return httpx.Response(500, json={"messages": ["Internal server error"]})
    if "malformed_numeric_id" in q:  # SIMULASI: record with numeric primaryAccession
        return httpx.Response(200, json={"results": [{"primaryAccession": 123}]})
    if "empty_record_sim" in q:  # SIMULASI: record with no identity at all
        return httpx.Response(200, json={"results": [{}]})
    if "protein_name" in q:
        # real p1/p2 fixtures
        cursor = params.get("cursor")
        if cursor:
            body = load_json("search_p53_p2.json")
            hdrs = load_headers("search_p53_p2.headers")
        else:
            body = load_json("search_p53_p1.json")
            hdrs = load_headers("search_p53_p1.headers")
        h = dict(re.findall(r"^(.+?): (.*)$", hdrs, re.M))
        return httpx.Response(200, json=body, headers=h)
    return httpx.Response(200, json={"results": []})


class TestSearchEndpoint:
    def setup_method(self):
        from app.adapters.uniprot import set_client
        self.c = TestClient(app)
        set_client(httpx.Client(transport=httpx.MockTransport(_search_handler), base_url="https://rest.uniprot.org", timeout=20.0))

    def test_empty_q_422(self):
        r = self.c.get("/api/v1/search", params={"q": "   "})
        assert r.status_code == 422

    def test_name_search_p1(self):
        r = self.c.get("/api/v1/search", params={"q": "p53", "page_size": 2})
        assert r.status_code == 200
        b = r.json()
        assert b["match_mode"] == "name"
        assert [x["accession"] for x in b["results"]] == ["P04637", "O15350"]
        assert b["next_cursor"], "p1 must carry next_cursor from Link header"
        assert b["provider_status"] == "available"

    def test_name_search_p2_follows_cursor(self):
        r1 = self.c.get("/api/v1/search", params={"q": "p53", "page_size": 2}).json()
        r2 = self.c.get("/api/v1/search", params={"q": "p53", "page_size": 2, "cursor": r1["next_cursor"]}).json()
        assert [x["accession"] for x in r2["results"]] == ["Q9Y6P5", "A1A5B4"]

    def test_accession_exact_mode(self):
        r = self.c.get("/api/v1/search", params={"q": "P04637"})
        assert r.status_code == 200
        assert r.json()["match_mode"] == "exact_accession"

    def test_accession_not_found_is_not_name_search(self):
        # valid 6-char accession that upstream has no record for -> not_found,
        # still classified exact_accession (never silently downgraded to name).
        r = self.c.get("/api/v1/search", params={"q": "A1B2C3"})
        assert r.status_code == 200
        b = r.json()
        assert b["results"] == []
        assert b["provider_status"] == "not_found"
        assert b["match_mode"] == "exact_accession"

    def test_sim_lastpage_next_cursor_null(self):
        # SIMULASI: response without Link header -> next_cursor None
        r = self.c.get("/api/v1/search", params={"q": "unknown_sim"})
        assert r.json()["next_cursor"] is None
        assert r.json()["provider_status"] == "not_found"

    def test_upstream_500_gives_provider_error_not_null_cursor(self):
        # valid 10-char accession (official syntax) -> upstream 500 -> provider_error
        r = self.c.get("/api/v1/search", params={"q": "A0A022YWF9"})
        assert r.status_code == 502
        assert r.json() == {"status": "provider_error", "detail": "upstream_uniprot_error"}

    def test_malformed_numeric_accession_is_provider_error_not_result(self):
        # SIMULASI (review_slice1_postfix_checks.py case 1): item carries a NUMERIC
        # primaryAccession -> record has no valid identity. Must be 502
        # upstream_uniprot_malformed, never a 200 with an empty accession string.
        r = self.c.get("/api/v1/search", params={"q": "malformed_numeric_id"})
        assert r.status_code == 502
        assert r.json() == {"status": "provider_error", "detail": "upstream_uniprot_malformed"}

    def test_malformed_empty_record_is_provider_error_not_not_found(self):
        # SIMULASI (postfix probe case 2): results:[{}] -> source record is malformed.
        # Must be 502, distinguished from a genuine empty result set (not_found).
        r = self.c.get("/api/v1/search", params={"q": "empty_record_sim"})
        assert r.status_code == 502
        assert r.json()["detail"] == "upstream_uniprot_malformed"

    def test_query_too_long_400(self):
        r = self.c.get("/api/v1/search", params={"q": "x" * 101})
        assert r.status_code == 400
        assert r.json()["detail"] == "query_too_long"

    def test_cursor_url_rejected_400(self):
        r = self.c.get("/api/v1/search", params={"q": "p53", "cursor": "https://evil.example?"})
        assert r.status_code == 400
        assert r.json()["detail"] == "cursor_invalid"

    def test_page_size_bounds(self):
        assert self.c.get("/api/v1/search", params={"q": "p53", "page_size": 0}).status_code == 422
        assert self.c.get("/api/v1/search", params={"q": "p53", "page_size": 101}).status_code == 422


# ---------- endpoint: profile ----------

class TestProfileEndpoint:
    def setup_method(self):
        from app.adapters.uniprot import set_client
        # mode drives the upstream behaviour for the next request:
        #   ok            -> real P04637 record
        #   not_found     -> 404
        #   http403       -> 403 Forbidden (provider error, not not-found)
        #   empty_record  -> 200 {} (malformed: no identity)
        #   bad_nested    -> 200 with proteinDescription as a list
        #   broken_json   -> 200 with non-JSON body (real syntax error)
        #   connect_error -> transport raises ConnectError
        state = {"mode": "ok", "record": load_json("P04637.json")}

        def handler(request):
            m = re.search(r"/uniprotkb/([A-Z0-9]+)\.json", request.url.path)
            acc = m.group(1) if m else "?"
            mode = state.get("mode", "ok")
            if mode == "connect_error":
                raise httpx.ConnectError("SIMULATED connection failure", request=request)
            if mode == "http403":
                return httpx.Response(403, json={"messages": ["Forbidden"]})
            if mode == "empty_record":
                return httpx.Response(200, json={})
            if mode == "bad_nested":
                return httpx.Response(200, json={
                    "primaryAccession": "P04637",
                    "proteinDescription": ["bad"],  # wrong shape: list not dict
                })
            if mode == "broken_json":
                return httpx.Response(200, text="{ not valid json ", headers={"Content-Type": "application/json"})
            if mode == "not_found":
                return httpx.Response(404, text="not found")
            if acc != "P04637" and acc != "A0A024RBG1":
                return httpx.Response(404, text="not found")
            return httpx.Response(200, json=state["record"])

        self.state = state
        self.c = TestClient(app, raise_server_exceptions=False)
        set_client(httpx.Client(transport=httpx.MockTransport(handler), base_url="https://rest.uniprot.org", timeout=20.0))

    def test_p04637_profile(self):
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code == 200
        b = r.json()
        assert b["primary_name"] == "Cellular tumor antigen p53"
        assert b["length"] == 393
        assert b["status"] == "available"

    def test_valid_format_not_found_404(self):
        self.state["mode"] = "not_found"
        r = self.c.get("/api/v1/entities/protein/A1B2C3")
        assert r.status_code == 404
        assert r.json() == {"status": "not_found", "detail": "protein_not_found"}

    def test_ten_char_accession_accepted_422_regression(self):
        # A0A024RBG1 is a real 10-char TrEMBL accession -> must NOT 422.
        # (handler returns the P04637 record for it in mode 'ok'; we only
        #  assert it passes format validation, i.e. status is 200/502 not 422.)
        r = self.c.get("/api/v1/entities/protein/A0A024RBG1")
        assert r.status_code != 422

    def test_upstream_403_is_provider_error_not_empty_protein(self):
        # SIMULASI: 403 must be a structured provider_error, never a
        # successful empty protein (review finding HIGH).
        self.state["mode"] = "http403"
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_empty_record_is_malformed_not_available(self):
        # SIMULASI: 200 {} has no identity -> provider_error, not 200/available.
        self.state["mode"] = "empty_record"
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_malformed_nested_field_is_not_500(self):
        # SIMULASI: proteinDescription as a list must not crash to raw 500.
        self.state["mode"] = "bad_nested"
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code in (200, 502)
        assert r.status_code != 500

    def test_broken_json_syntax_is_provider_error(self):
        # SIMULASI: genuinely broken JSON (not a valid JSON string).
        self.state["mode"] = "broken_json"
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_connect_error_is_provider_error_not_500(self):
        # SIMULASI: transport ConnectError -> structured provider_error.
        self.state["mode"] = "connect_error"
        r = self.c.get("/api/v1/entities/protein/P04637")
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_invalid_format_422(self):
        r = self.c.get("/api/v1/entities/protein/XYZ")
        assert r.status_code == 422


# ---------- regression: malformed search records (postfix review HIGH) ----------

class TestSearchMalformedRecords:
    """A source record lacking a usable primaryAccession (numeric id, or empty
    object) is MALFORMED SOURCE DATA, not a biological 'not found' result and
    never a result row with an empty identifier. Both cases -> 502
    provider_error. A genuine empty result set (results:[]) stays not_found."""

    def setup_method(self):
        from app.adapters.uniprot import set_client
        self.c = TestClient(app, raise_server_exceptions=False)
        self.state = {"body": {"results": []}}

        def handler(request):
            return httpx.Response(200, json=self.state["body"])

        set_client(httpx.Client(transport=httpx.MockTransport(handler), base_url="https://rest.uniprot.org", timeout=20.0))

    def test_numeric_primary_accession_is_malformed_not_empty_result(self):
        # SIMULASI of review_slice1_postfix_checks.py case 1:
        # upstream {results:[{primaryAccession:123}]} must be 502 provider_error
        # (upstream_uniprot_malformed), never 200 with an empty accession.
        self.state["body"] = {"results": [{"primaryAccession": 123}]}
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 502
        assert r.json() == {"status": "provider_error", "detail": "upstream_uniprot_malformed"}

    def test_empty_record_object_is_malformed_not_not_found(self):
        # SIMULASI of postfix probe case 2: upstream {results:[{}]} must be
        # 502 provider_error, distinguished from a genuine empty result set.
        self.state["body"] = {"results": [{}]}
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_blank_string_accession_is_malformed(self):
        self.state["body"] = {"results": [{"primaryAccession": "   "}, {"primaryAccession": "P04637"}]}
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 502
        assert r.json()["detail"] == "upstream_uniprot_malformed"

    def test_genuine_empty_result_still_not_found(self):
        # results:[] with no Link = a real (empty) biological answer. Must stay
        # 200/not_found — the fix must not swallow the empty-result case.
        self.state["body"] = {"results": []}
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 200
        b = r.json()
        assert b["results"] == []
        assert b["provider_status"] == "not_found"

    def test_valid_results_pass_through(self):
        self.state["body"] = {"results": [{"primaryAccession": "P04637", "organism": {"scientificName": "Homo sapiens"}}]}
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 200
        b = r.json()
        assert [x["accession"] for x in b["results"]] == ["P04637"]
        assert b["provider_status"] == "available"


# ---------- regression: deadline budget (postfix review MEDIUM) ----------

class TestDeadlineBudget:
    """TOTAL_DEADLINE_S must actually BOUND the provider call, not just be
    checked before each attempt. SIMULASI clock (mirrors the postfix probe):
    a late response arriving after the budget is exhausted is rejected with
    ProviderTimeout, not returned. The per-attempt timeout must shrink to
    the remaining budget so a slow in-flight request cannot overshoot it."""

    def _client(self, delay_s):
        def handler(request):
            if delay_s:
                time.sleep(delay_s)
            return httpx.Response(200, json={"results": []})

        return httpx.Client(transport=httpx.MockTransport(handler), base_url="https://rest.uniprot.org", timeout=0.5)

    def test_late_response_after_deadline_rejected(self):
        # SIMULASI: clock jumps 0 -> 40s during the request; limit is 35s.
        clock = [0.0]

        def slow_handler(request):
            clock[0] = 40.0
            return httpx.Response(200, json={"primaryAccession": "P04637"})

        client = httpx.Client(transport=httpx.MockTransport(slow_handler), base_url="https://rest.uniprot.org", timeout=0.5)
        with patch.object(uniprot.time, "monotonic", side_effect=lambda: clock[0]):
            with pytest.raises(uniprot.ProviderTimeout):
                uniprot.retrieve(client, "P04637")

    def test_request_timeout_respects_remaining_budget(self):
        # SIMULASI: shrink TOTAL_DEADLINE_S to 0.4s; upstream is slow (0.5s).
        # Without a per-attempt timeout budget, the 20s-phase timeout would
        # let the request finish (or the test would take far longer than the
        # total deadline). With the fix, the attempt aborts near 0.4s and
        # ProviderTimeout is raised quickly.
        with patch.object(uniprot, "TOTAL_DEADLINE_S", 0.4), patch.object(
            uniprot, "MAX_RETRY_AFTER_S", 0.0
        ):
            t0 = time.monotonic()
            with pytest.raises(uniprot.ProviderTimeout):
                uniprot.search(self._client(0.5), "accession:A1B2C3", 5, None)
            elapsed = time.monotonic() - t0
        assert elapsed < 2.0, f"deadline budget ignored, call ran {elapsed:.1f}s"


# ---------- regression: Link parser parameter order (postfix review MEDIUM) ----------

class TestLinkHeaderParsing:
    """rel must be found regardless of parameter order (type before rel,
    multiple parameters), per RFC 5988. Host/path/cursor-token rules
    unchanged: https, rest.uniprot.org, /uniprotkb/search, opaque cursor in
    charset with length cap."""

    def test_rel_after_type_parameter(self):
        # SIMULASI of the postfix probe: type before rel (parameter order).
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search?cursor=abc>; type="application/json"; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert ok and got == "abc"

    def test_rel_first_parameter(self):
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search?cursor=abc123>; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert ok and got == "abc123"

    def test_multiple_parameters_between(self):
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search?cursor=zz>; rel="next"; type="application/json"; charset="utf-8"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert ok and got == "zz"

    def test_rel_prev_only_is_clean_end(self):
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search>; rel="prev"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert ok and got is None  # no next relation: legitimate end

    def test_wrong_host_next_link_flagged(self):
        hdr = {'Link': '<https://evil.example/uniprotkb/search?cursor=abc123>; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert not ok and got is None

    def test_wrong_path_next_link_flagged(self):
        hdr = {'Link': '<https://rest.uniprot.org/other?cursor=abc>; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert not ok and got is None

    def test_no_cursor_param_flagged(self):
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search>; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert not ok and got is None

    def test_cursor_outside_charset_flagged(self):
        # URL-decoded cursor '/' falls outside the documented charset -> malformed
        hdr = {'Link': '<https://rest.uniprot.org/uniprotkb/search?cursor=%2F>; rel="next"'}
        got, ok = uniprot.next_cursor_from_headers(hdr)
        assert not ok and got is None

    def test_no_link_header_clean_end(self):
        got, ok = uniprot.next_cursor_from_headers({})
        assert ok and got is None


# ---------- regression: accession syntax per official UniProt docs ----------

class TestAccessionSyntaxOfficial:
    """Regex per https://www.uniprot.org/help/accession_numbers:
    [OPQ][0-9][A-Z0-9]{3}[0-9]  |  [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}
    Consequences: 10-char = the {2} repetition of the second alternative
    (A0A024RBG1, A0A022YWF9, B4DMQ7 are 6-char {1} forms); length alone
    never implies reviewed/unreviewed status. The old digit-among-5 and
    'A0A + 7 alnum' heuristics are replaced."""

    def test_official_six_char_patterns(self):
        for a in ["P04637", "Q9Y6P5", "O15350", "A1A5B4", "B4DMQ7", "P12345", "Q1AAA9", "O456A1", "P4A123"]:
            assert uniprot.is_accession(a), a

    def test_official_ten_char_patterns(self):
        # A0A024RBG1 = real NUDT4B entry (verified live by reviewer); A0A022YWF9 = official doc example
        for a in ["A0A024RBG1", "A0A022YWF9"]:
            assert uniprot.is_accession(a), a

    def test_lowercase_normalizes(self):
        assert uniprot.is_accession("p04637")
        assert uniprot.is_accession("a0a024rbg1")

    def test_probe_cases_now_rejected(self):
        # Postfix probe: ABC123=True and A0AAAAAAAA=True were flagged as
        # guesses. Official syntax: A,B not in {O,P,Q} or [A-NR-Z] start...
        # A is in [A-N] but 2nd char must be [0-9] -> both invalid.
        assert not uniprot.is_accession("ABC123")
        assert not uniprot.is_accession("A0AAAAAAAA")  # 10-char must end in a digit

    def test_names_and_invalid_shapes_rejected(self):
        for s in ["INSULI", "xyz", "P53", "P0463700", "S12345", "M23765", "A0A024RBGZ"]:
            # A0A024RBGZ: 10-char ending in Z (not a digit) -> invalid per official pattern
            assert not uniprot.is_accession(s), s


# ---------- regression: OpenAPI 400 covers both bad_request details ----------

class TestOpenAPIBadRequestDetails:
    def test_search_400_detail_enum_covers_both(self):
        spec = app.openapi()
        schema = spec["paths"]["/api/v1/search"]["get"]["responses"]["400"]["content"]["application/json"]["schema"]
        details = schema["properties"]["detail"]
        # Both 400 details the route can actually return must be documented.
        assert set(details.get("enum", [])) == {"cursor_invalid", "query_too_long"}


# ---------- regression: profile 422 message matches official syntax ----------

class TestProfileValidationMessage:
    def test_422_message_does_not_claim_wrong_pattern(self):
        from app.adapters.uniprot import set_client

        def handler(request):
            return httpx.Response(404, text="not found")

        c = TestClient(app, raise_server_exceptions=False)
        set_client(httpx.Client(transport=httpx.MockTransport(handler), base_url="https://rest.uniprot.org", timeout=20.0))
        r = c.get("/api/v1/entities/protein/ABC123")
        assert r.status_code == 422
        msg = r.json()["detail"]
        assert "5 letters + 4 digits" not in msg  # old wrong wording removed

class TestAccessionClassification:
    """Valid 6- and 10-char accessions accepted; names must NOT be classified
    as accessions. Lowercase normalizes deliberately."""

    def test_valid_six_char(self):
        for a in ["P04637", "Q9Y6P5", "O15350", "A1A5B4", "B4DMQ7"]:
            assert uniprot.is_accession(a), a

    def test_valid_ten_char(self):
        assert uniprot.is_accession("A0A024RBG1")

    def test_lowercase_normalizes(self):
        assert uniprot.is_accession("p04637")

    def test_names_not_accessions(self):
        # INSULI is the insulin protein NAME (all-letter) -> not an accession
        assert not uniprot.is_accession("INSULI")
        assert not uniprot.is_accession("xyz")
        assert not uniprot.is_accession("P53")
        assert not uniprot.is_accession("P0463700")  # 8 chars

    def test_search_and_profile_agree_on_lowercase(self):
        # search route uses is_accession(q); both normalize, so p04637 is
        # exact_accession in search and accepted by profile (same predicate).
        assert uniprot.is_accession("p04637")


# ---------- regression: error contract in OpenAPI (review finding MEDIUM) ----------

class TestOpenAPIErrorContract:
    def test_profile_documents_error_responses(self):
        spec = app.openapi()
        codes = list(spec["paths"]["/api/v1/entities/protein/{accession}"]["get"]["responses"])
        for code in ("404", "429", "502", "504"):
            assert code in codes, f"{code} missing from profile OpenAPI: {codes}"

    def test_search_documents_error_responses(self):
        spec = app.openapi()
        codes = list(spec["paths"]["/api/v1/search"]["get"]["responses"])
        for code in ("400", "429", "502", "504"):
            assert code in codes, f"{code} missing from search OpenAPI: {codes}"
