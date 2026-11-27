# root conftest: makes backend/ importable for pytest (tests use `import app`).
import httpx
import pytest

from app.adapters import ncbi


@pytest.fixture(autouse=True)
def _no_real_ncbi():
    """No offline test may reach real NCBI.

    Defaults the NCBI client to a transport that refuses, so a test that
    forgets to stub NCBI fails loudly instead of silently making live
    network calls. Tests that exercise NCBI inject their own client.
    """
    def refuse(request):
        raise httpx.ConnectError("offline test: NCBI not stubbed", request=request)

    ncbi.set_client(
        httpx.Client(
            transport=httpx.MockTransport(refuse),
            base_url=ncbi.BASE,
            timeout=5.0,
        )
    )
    yield
    ncbi.set_client(None)
