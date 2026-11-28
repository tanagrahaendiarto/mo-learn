"""Bounded, non-streaming DeepSeek Chat Completions over httpx."""
import asyncio
import json
import logging

import httpx

from ..ai_schemas import LearningFailure

MAX_RESPONSE_BYTES = 32_768
MAX_OUTPUT_TOKENS = 600
REQUEST_TIMEOUT_SECONDS = 20
logger = logging.getLogger(__name__)


async def complete(
    base_url: str, model: str, api_key: str, instructions: str, data: str
) -> dict:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": data},
        ],
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
        "max_tokens": MAX_OUTPUT_TOKENS,
        "stream": False,
    }
    try:
        async with asyncio.timeout(REQUEST_TIMEOUT_SECONDS):
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, trust_env=False) as client:
                async with client.stream(
                    "POST", f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json=payload,
                ) as response:
                    logger.info("AI provider_http=%d", response.status_code)
                    if response.status_code == 429:
                        raise LearningFailure(429, "rate_limited", "model_rate_limited")
                    if response.status_code == 402:
                        raise LearningFailure(429, "quota_exhausted", "model_balance_exhausted")
                    if response.status_code in {408, 504}:
                        raise LearningFailure(504, "timeout", "model_timeout")
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                            raise ValueError("Oversized model response.")
                        body.extend(chunk)
        envelope = json.loads(body)
        usage = envelope.get("usage")
        if isinstance(usage, dict):
            for name in ("prompt_tokens", "completion_tokens", "prompt_cache_hit_tokens", "prompt_cache_miss_tokens"):
                count = usage.get(name)
                if type(count) is int and count >= 0:
                    logger.info("AI %s=%d", name, count)
        choice = envelope["choices"][0]
        if choice["finish_reason"] != "stop":
            reason = "truncated" if choice["finish_reason"] == "length" else "unexpected_finish_reason"
            logger.info("AI provider_output=%s", reason)
            raise ValueError("Incomplete model response.")
        draft = json.loads(choice["message"]["content"])
        if not isinstance(draft, dict):
            raise ValueError("Expected a JSON object.")
        return draft
    except (TimeoutError, httpx.TimeoutException):
        raise LearningFailure(504, "timeout", "model_timeout") from None
    except httpx.HTTPError:
        raise LearningFailure(502, "provider_error", "model_error") from None
    except json.JSONDecodeError:
        logger.info("AI provider_output=invalid_json")
        raise LearningFailure(502, "provider_error", "invalid_model_output") from None
    except (AttributeError, IndexError, KeyError, TypeError, ValueError, RecursionError):
        raise LearningFailure(502, "provider_error", "invalid_model_output") from None
