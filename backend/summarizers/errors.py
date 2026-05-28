"""Classify raw stderr from summarizer backends into user-friendly cards.

Pure stdlib — keeps the module trivially testable. The classifier returns a
dict shaped for the frontend: a short title, plain-English message, optional
actionable hint, and the truncated raw stderr so the user can still inspect
the underlying error when reporting bugs.
"""

from __future__ import annotations

from typing import Optional

_MAX_RAW = 3000


def _truncate(text: str, limit: int = _MAX_RAW) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n… (truncated)"


def _first_line(text: str) -> str:
    for line in text.splitlines():
        s = line.strip()
        if s:
            return s
    return text.strip()


# (substring, category) — checked in order, first match wins.
_PATTERNS: list[tuple[tuple[str, ...], str]] = [
    (("401", "unauthorized", "invalid_api_key", "incorrect api key"), "auth"),
    (("429", "rate limit", "quota", "exceeded your current quota"), "quota"),
    (("model_not_found", "does not exist", "model not found", "no such model"), "model"),
    (("timed out", "timeout"), "timeout"),
    (("connection refused", "could not connect", "network", "dns"), "network"),
    (("no output", "produced no output", "returned no result text"), "no_output"),
]


def _auth_hint(backend_name: str) -> str:
    b = (backend_name or "").lower()
    if b == "codex":
        return "Run `codex login` (Pro/Plus) or `export OPENAI_API_KEY=sk-...` (API key)."
    if b == "claude":
        return "Run `claude login` or set `ANTHROPIC_API_KEY`."
    if b == "gemini":
        return "Run `gemini auth` or set `GEMINI_API_KEY`."
    if b == "qwen":
        return "Run `qwen auth` or set `DASHSCOPE_API_KEY`."
    if b == "antigravity":
        return "Re-authenticate the Antigravity agent (check `agy auth status`)."
    return "Check the CLI's auth configuration."


def _network_hint(backend_name: str) -> str:
    if (backend_name or "").lower() == "ollama":
        return "Is `ollama serve` running?"
    return "Check your internet connection."


def _timeout_hint(backend_name: str) -> str:
    suffix = (backend_name or "BACKEND").upper() or "BACKEND"
    return f"Try a faster/smaller model, or override the timeout via TT_{suffix}_TIMEOUT."


def classify(stderr_text: str, *, backend_name: str = "") -> dict:
    """Return a structured error card for the given stderr from a summarizer."""
    raw = stderr_text or ""
    raw_trunc = _truncate(raw)
    haystack = raw.lower()

    category = "unknown"
    for needles, cat in _PATTERNS:
        if any(n in haystack for n in needles):
            category = cat
            break

    title: str
    message: str
    hint: Optional[str]

    if category == "auth":
        title = "API key invalid"
        message = "The summarizer CLI rejected your credentials (HTTP 401 / invalid key)."
        hint = _auth_hint(backend_name)
    elif category == "quota":
        title = "Rate limit or quota exceeded"
        message = "The model provider throttled the request or your quota is exhausted."
        hint = "Wait and retry, or pick a cheaper model in Settings → Summarizer."
    elif category == "model":
        title = "Model not available"
        message = "The selected model isn't accessible to your account or the CLI."
        hint = "Pick a different model in Settings → Summarizer that your account can access."
    elif category == "timeout":
        title = "Summarizer timed out"
        message = "The backend didn't return a result before the timeout elapsed."
        hint = _timeout_hint(backend_name)
    elif category == "network":
        title = "Network error"
        message = "The summarizer couldn't reach its backend."
        hint = _network_hint(backend_name)
    elif category == "no_output":
        title = "Empty response"
        message = "The backend completed but returned no narrative text."
        hint = "The backend completed but returned nothing — try a different model or regenerate."
    else:
        title = "Summarizer failed"
        message = _first_line(raw) or "Unknown error."
        hint = None

    return {
        "category": category,
        "title": title,
        "message": message,
        "hint": hint,
        "raw": raw_trunc,
    }
