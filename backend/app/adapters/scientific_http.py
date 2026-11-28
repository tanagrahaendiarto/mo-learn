"""Bounded transport for scientific exploration providers."""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone

import httpx


class SourceError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def retrieved_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ScientificSource:
    def __init__(self, base_url: str, *, spacing: float = 0.25):
        self.client = httpx.Client(
            base_url=base_url,
            headers={
                "User-Agent": "MoLearn/0.4 (educational scientific browser)",
                "Accept-Encoding": "identity",
            },
        )
        self.spacing = spacing
        self.next_request = 0.0
        self.lock = threading.Lock()

    def pace(self, deadline: float) -> None:
        with self.lock:
            now = time.monotonic()
            start = max(now, self.next_request)
            if start >= deadline:
                raise SourceError("timeout")
            self.next_request = start + self.spacing
        if start > now:
            time.sleep(start - now)

    def get(
        self, path: str, deadline: float, *, params: dict | None = None,
        missing_ok: bool = False, max_bytes: int = 2_000_000,
    ) -> bytes | None:
        for attempt in range(2):
            self.pace(deadline)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise SourceError("timeout")
            delay = 0.35
            try:
                with self.client.stream("GET", path, params=params, timeout=min(6.0, remaining)) as response:
                    status = response.status_code
                    if status == 404 and missing_ok:
                        return None
                    if status == 429:
                        code = "rate_limited"
                        try:
                            delay = float(response.headers.get("Retry-After", "2"))
                        except ValueError:
                            delay = 2
                    elif status >= 500:
                        code = "upstream_error"
                    elif not response.is_success:
                        raise SourceError("upstream_error")
                    else:
                        body = bytearray()
                        for chunk in response.iter_bytes():
                            body.extend(chunk)
                            if len(body) > max_bytes:
                                raise SourceError("response_too_large")
                            if time.monotonic() >= deadline:
                                raise SourceError("timeout")
                        if time.monotonic() >= deadline:
                            raise SourceError("timeout")
                        return bytes(body)
            except httpx.TimeoutException:
                code = "timeout"
            except httpx.HTTPError:
                code = "upstream_error"
            if attempt or not 0 <= delay <= 2 or time.monotonic() + delay >= deadline:
                raise SourceError(code)
            time.sleep(delay)
        raise SourceError("upstream_error")

    def json(self, path: str, deadline: float, **kwargs) -> dict | list | None:
        body = self.get(path, deadline, **kwargs)
        if body is None:
            return None
        try:
            parsed = json.loads(body)
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise SourceError("malformed_response") from exc
        if not isinstance(parsed, (dict, list)):
            raise SourceError("malformed_response")
        return parsed
