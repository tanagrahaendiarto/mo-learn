"""Loopback-only browser test server. Real app, captured records, simulated LLM."""
import asyncio
import json
import os

import httpx
import uvicorn

from test_ai_offline import ACCESS, FIXTURES, MODEL_KEY, claim, completion, draft, select_passage, selection
from app.adapters import deepseek, ncbi, uniprot
from app.main import app

protein = json.loads((FIXTURES / "P04637.json").read_bytes())
gene = (FIXTURES / "ncbi_gene_7157.xml").read_bytes()


def uni(request):
    if request.url.path.endswith("/search"):
        return httpx.Response(200, json={"results": [protein]})
    if request.url.path.endswith("/P04637.json"):
        return httpx.Response(200, json=protein)
    return httpx.Response(404)


async def model(request):
    payload = json.loads(request.content)
    context = json.loads(payload["messages"][1]["content"])
    question = context.get("question")
    is_gene = context["record"]["type"] == "gene"
    if question == "Simulate model timeout":
        return httpx.Response(504)
    if question == "Simulate quota exhaustion":
        return httpx.Response(402)
    if question == "Simulate rate limit":
        return httpx.Response(429)
    if question == "Ask for unsupported evidence":
        return completion(selection())
    if question == "Simulate slow p53 answer":
        await asyncio.sleep(4)
        return select_passage(request, "in response to DNA damage, thus stopping cell cycle progression")
    if question == "Simulate unsafe text":
        return completion({**selection("e1"), "answer": "<img alt=test-markup>"})
    if question:
        return select_passage(request, f"This {context['record']['type']} record is from Homo sapiens.")
    if is_gene:
        return completion(draft(claim("TP53 is a human gene that encodes the p53 protein.")))
    return completion(draft(
        claim("p53 is a protein that binds DNA and regulates which genes are active."),
        [claim("p53 can activate transcription of target genes.")],
        [{**claim("A protein that attaches to DNA."), "term": "DNA-binding protein"}],
    ))


if __name__ == "__main__":
    os.environ.update({
        "MOLEARN_AI_ENABLED": "true",
        "MOLEARN_LLM_API_KEY": MODEL_KEY,
        "MOLEARN_LLM_BASE_URL": "https://api.deepseek.com",
        "MOLEARN_LLM_MODEL": "deepseek-flash",
        "MOLEARN_AI_ACCESS_CODE": ACCESS["X-MoLearn-AI-Access"],
        "MOLEARN_AI_MAX_CALLS_PER_PROCESS": "100",
        "MOLEARN_AI_REQUESTS_PER_MINUTE": "60",
        "MOLEARN_AI_CONCURRENCY": "2",
    })
    async_client = httpx.AsyncClient
    deepseek.httpx.AsyncClient = lambda **options: async_client(
        **options, transport=httpx.MockTransport(model)
    )
    uniprot.set_client(httpx.Client(transport=httpx.MockTransport(uni), base_url=uniprot.BASE))
    ncbi.set_client(httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=gene)), base_url=ncbi.BASE
    ))
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("MOLEARN_TEST_MOCK_PORT", "8014")), access_log=False)
