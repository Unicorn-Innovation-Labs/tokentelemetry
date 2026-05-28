"""Claude Code summarizer adapter.

Invoked with ``--no-session-persistence`` so the summarization call is never
written to ~/.claude/projects — that means it can't be re-ingested as a phantom
trace, and (unlike codex/gemini/qwen) needs no cwd-based ingest filter.
"""
from __future__ import annotations

import json

from .base import BaseSummarizer, SummarizerError, run_cli


class ClaudeSummarizer(BaseSummarizer):
    name = "claude"
    display_name = "Claude Code"
    binary = "claude"

    def summarize(self, prompt: str, *, timeout: int = 120) -> str:
        out = run_cli(
            [
                self.binary,
                "-p",
                prompt,
                "--output-format",
                "json",
                "--no-session-persistence",
            ],
            timeout=timeout,
        )
        # `--output-format json` yields a single result object:
        #   {"type":"result","subtype":"success","result":"<text>",
        #    "total_cost_usd":..., "usage":{...}}
        try:
            data = json.loads(out)
        except json.JSONDecodeError:
            # Fall back to raw stdout if the CLI ever changes its envelope.
            return out
        result = data.get("result")
        if not result:
            raise SummarizerError("claude returned no result text")
        return str(result)
