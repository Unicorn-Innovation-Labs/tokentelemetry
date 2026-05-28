"""Codex CLI summarizer adapter.

``codex exec`` runs non-interactively. We bypass every approval/sandbox prompt
(``--dangerously-bypass-approvals-and-sandbox``) and allow running outside a git
repo (``--skip-git-repo-check``) so the call is fully headless. The agent's final
message is written to a temp file via ``-o`` so we get clean text without the
banner/event noise that goes to stdout.

Codex logs its own session under ~/.codex; running from SUMMARIZER_CWD lets the
ingest layer recognise and skip those phantom traces.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from .base import BaseSummarizer, SummarizerError, run_cli, _ensure_cwd


class CodexSummarizer(BaseSummarizer):
    name = "codex"
    display_name = "Codex"
    binary = "codex"

    def summarize(self, prompt: str, *, timeout: int = 120) -> str:
        with tempfile.NamedTemporaryFile(
            "r", suffix=".txt", prefix="tt-codex-", delete=False
        ) as f:
            last_message = f.name
        try:
            # stdout carries a banner + event log; the clean final message is
            # written to ``last_message`` by ``-o``.
            run_cli(
                [
                    self.binary,
                    "exec",
                    "--dangerously-bypass-approvals-and-sandbox",
                    "--skip-git-repo-check",
                    "-o",
                    last_message,
                    prompt,
                ],
                cwd=_ensure_cwd(),
                timeout=timeout,
            )
            text = Path(last_message).read_text().strip()
        finally:
            Path(last_message).unlink(missing_ok=True)
        if not text:
            raise SummarizerError("codex returned no result text")
        return text
