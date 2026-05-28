"""Ollama summarizer adapter.

``ollama run <model> <prompt>`` runs a local model and prints plain text. The
model can be supplied to the constructor; otherwise we default to the first
entry from ``ollama list``. Ollama does not write agent-style session traces, so
no cwd-based ingest filter is needed.
"""
from __future__ import annotations

import re
import subprocess
from typing import Optional

from .base import BaseSummarizer, SummarizerError, run_cli

# Thinking models wrap output in a spinner / ANSI control codes; strip them so
# the downstream JSON parse sees clean text.
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


class OllamaSummarizer(BaseSummarizer):
    name = "ollama"
    display_name = "Ollama"
    binary = "ollama"

    def __init__(self, model: Optional[str] = None) -> None:
        self._model = model

    def _resolve_model(self) -> str:
        if self._model:
            return self._model
        # First installed model from `ollama list` (skip the header row).
        try:
            proc = subprocess.run(
                [self.binary, "list"],
                capture_output=True,
                text=True,
                timeout=15,
            )
        except (OSError, subprocess.SubprocessError) as e:
            raise SummarizerError(f"failed to list ollama models: {e}") from e
        lines = [ln for ln in (proc.stdout or "").splitlines() if ln.strip()]
        if len(lines) < 2:
            raise SummarizerError("no ollama models installed")
        model = lines[1].split()[0]
        self._model = model
        return model

    def summarize(self, prompt: str, *, timeout: int = 120) -> str:
        model = self._resolve_model()
        out = run_cli(
            [self.binary, "run", model, prompt],
            timeout=timeout,
        )
        return _ANSI_RE.sub("", out).strip()
