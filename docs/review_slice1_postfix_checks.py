"""Postfix review: simulated upstream/clock; app files unchanged."""
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.adapters import uniprot as u
c=TestClient(app,raise_server_exceptions=False)
for label,body in [('missing_id',{'results':[{}]}),('numeric_id',{'results':[{'primaryAccession':123}]})]:
    with httpx.Client(base_url=u.BASE,transport=httpx.MockTransport(lambda r:httpx.Response(200,json=body))) as client:
        u.set_client(client)
        r=c.get('/api/v1/search',params={'q':'p53'})
        print('SIM_SEARCH',label,r.status_code,r.json())
u.set_client(None)
clock=[0.0]
def slow(r):
    clock[0]=40.0
    return httpx.Response(200,json={'primaryAccession':'P04637'})
with patch.object(u.time,'monotonic',side_effect=lambda:clock[0]):
    with httpx.Client(base_url=u.BASE,transport=httpx.MockTransport(slow)) as client:
        try:
            result=u.retrieve(client,'P04637')
            print('SIM_DEADLINE elapsed=40 limit=35 returned_success',result)
        except u.ProviderTimeout:
            print('SIM_DEADLINE correctly rejected late result')
print('CLASSIFICATION', {s:u.is_accession(s) for s in ['ABC123','A0AAAAAAAA']})
print('SIM_LINK_EXTRA_PARAMETER',u.next_cursor_from_headers({'Link':'<https://rest.uniprot.org/uniprotkb/search?cursor=abc>; type="application/json"; rel="next"'}))
