"""Read-only review probes. Simulated upstream errors; no application edits."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.adapters import uniprot as u

c = TestClient(app, raise_server_exceptions=False)
def probe(label, handler, path='/api/v1/entities/protein/P04637', params=None):
    with httpx.Client(transport=httpx.MockTransport(handler), base_url=u.BASE) as upstream:
        u.set_client(upstream)
        r = c.get(path, params=params)
        print(label, r.status_code, r.text[:220])
    u.set_client(None)

print('ACCESSION_CLASSIFICATION', {s:u.is_accession(s) for s in ['P04637','A0A024RBG1','INSULI','p04637']})
probe('TEN_CHAR_PROFILE', lambda r:httpx.Response(200,json={}), '/api/v1/entities/protein/A0A024RBG1')
def disconnected(r):
    raise httpx.ConnectError('SIMULATED connection failure',request=r)
probe('SIM_CONNECTION_ERROR', disconnected)
probe('SIM_UPSTREAM_403', lambda r:httpx.Response(403,json={'messages':['Forbidden']}))
probe('SIM_INVALID_RECORD', lambda r:httpx.Response(200,json={'proteinDescription':['bad']}))
probe('SIM_EMPTY_RECORD', lambda r:httpx.Response(200,json={}))
print('SIM_INVALID_NEXT_LINK', u.next_cursor_from_headers({'Link':'<https://evil.example/uniprotkb/search?cursor=x>; rel="next"'}))
seen=[]
def changed_query(r):
    seen.append(dict(r.url.params))
    return httpx.Response(200,json={'results':[]})
probe('SIM_CURSOR_FORWARDED',changed_query,'/api/v1/search',{'q':'different name','cursor':'oldToken','page_size':9})
print('UPSTREAM_PARAMS',seen)
print('OPENAPI_PROFILE_CODES',list(app.openapi()['paths']['/api/v1/entities/protein/{accession}']['get']['responses']))
with httpx.Client(timeout=25) as live:
    r=live.get('https://rest.uniprot.org/uniprotkb/A0A024RBG1.json')
    print('LIVE_TEN_CHAR_UPSTREAM',r.status_code,r.json().get('primaryAccession'))
    r=live.get('http://127.0.0.1:8000/api/v1/entities/protein/A0A024RBG1')
    print('LIVE_TEN_CHAR_LOCAL',r.status_code,r.text[:160])
