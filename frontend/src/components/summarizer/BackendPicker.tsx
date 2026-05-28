"use client";

import { useEffect, useState } from "react";
import { Check, Ban } from "lucide-react";
import { getAgent } from "@/lib/agents";
import { cn } from "@/lib/cn";
import {
  listCodexModels, listOllamaModels,
  type CodexModel, type OllamaModel, type SummarizerBackend,
} from "@/lib/summarizer";

interface BackendPickerProps {
  backends: SummarizerBackend[];
  /** null == "Skip / no AI summaries" selected */
  selected: string | null;
  onSelect: (backend: string | null) => void;
  /** Whether to render the "no AI summaries" opt-out tile. */
  allowSkip?: boolean;
  /** Currently chosen model (meaningful for Ollama + Codex). */
  model?: string | null;
  /** Notified when the user picks a different model. */
  onModelChange?: (model: string | null) => void;
}

/**
 * Shared backend selector — reused by the first-run onboarding modal and the
 * settings surface. Tints each option by its agent hex via getAgent().
 *
 * For Ollama and Codex, a sub-dropdown appears so the user can pin a specific
 * model — useful when the default model isn't installed (Ollama) or isn't
 * available on the user's API tier (Codex / no Pro/Plus). Model lists are
 * fetched lazily on first selection of that backend.
 */
export function BackendPicker({
  backends, selected, onSelect, allowSkip = true,
  model = null, onModelChange,
}: BackendPickerProps) {
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[] | null>(null);
  const [ollamaErr, setOllamaErr] = useState<string | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const [codexModels, setCodexModels] = useState<CodexModel[] | null>(null);
  const [codexErr, setCodexErr] = useState<string | null>(null);
  const [codexLoading, setCodexLoading] = useState(false);

  // Lazy-load the model list for whichever backend the user picks.
  useEffect(() => {
    if (selected === "ollama" && ollamaModels === null && !ollamaLoading) {
      setOllamaLoading(true);
      listOllamaModels()
        .then(setOllamaModels)
        .catch((e) => setOllamaErr(e instanceof Error ? e.message : String(e)))
        .finally(() => setOllamaLoading(false));
    }
    if (selected === "codex" && codexModels === null && !codexLoading) {
      setCodexLoading(true);
      listCodexModels()
        .then(setCodexModels)
        .catch((e) => setCodexErr(e instanceof Error ? e.message : String(e)))
        .finally(() => setCodexLoading(false));
    }
  }, [selected, ollamaModels, ollamaLoading, codexModels, codexLoading]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {backends.map((b) => {
          const meta = getAgent(b.name);
          const Icon = meta.icon;
          const active = selected === b.name;
          return (
            <div key={b.name}>
              <button
                type="button"
                onClick={() => onSelect(b.name)}
                className={cn(
                  "group relative w-full flex items-center gap-3 rounded-[var(--tt-radius-lg)] border px-3.5 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--tt-border-strong)] bg-[var(--tt-raised)]"
                    : "border-[var(--tt-border)] bg-[var(--tt-panel)] hover:border-[var(--tt-border-strong)] hover:bg-[var(--tt-sunken)]",
                )}
              >
                <div
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-md"
                  style={{ backgroundColor: `${meta.hex}14`, color: meta.hex }}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--tt-fg)] truncate">{b.display_name}</div>
                  <div className="text-[11px] text-[var(--tt-fg-dim)] truncate">
                    Summaries generated locally via {b.display_name}.
                  </div>
                </div>
                {active && (
                  <span
                    className="h-5 w-5 grid place-items-center rounded-full"
                    style={{ backgroundColor: meta.hex, color: "#fff" }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>

              {active && b.name === "ollama" && (
                <ModelDropdown
                  label="Model"
                  value={model}
                  onChange={onModelChange}
                  loading={ollamaLoading}
                  error={ollamaErr}
                  empty={ollamaModels !== null && ollamaModels.length === 0}
                  emptyHint={<>No Ollama models installed. Run <code className="font-mono">ollama pull llama3</code> (or similar) first.</>}
                  options={(ollamaModels || []).map((m) => ({
                    value: m.name,
                    label: m.size ? `${m.name} · ${m.size}` : m.name,
                  }))}
                  autoOption="Auto — use first installed"
                  hint={model ? "Local inference is CPU-bound — larger models take several minutes per summary." : undefined}
                />
              )}

              {active && b.name === "codex" && (
                <ModelDropdown
                  label="Model"
                  value={model}
                  onChange={onModelChange}
                  loading={codexLoading}
                  error={codexErr}
                  empty={false}
                  options={(codexModels || []).map((m) => ({
                    value: m.name,
                    label: m.label,
                    hint: m.hint,
                  }))}
                  autoOption="Auto — use Codex default (~/.codex/config.toml)"
                  hint="Pick a cheaper model if you don't have ChatGPT Pro/Plus or hit 'incorrect API key' / quota errors on the default."
                />
              )}
            </div>
          );
        })}

        {allowSkip && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "flex items-center gap-3 rounded-[var(--tt-radius-lg)] border px-3.5 py-3 text-left transition-colors",
              selected === null
                ? "border-[var(--tt-border-strong)] bg-[var(--tt-raised)]"
                : "border-[var(--tt-border)] bg-[var(--tt-panel)] hover:border-[var(--tt-border-strong)] hover:bg-[var(--tt-sunken)]",
            )}
          >
            <div className="h-8 w-8 shrink-0 grid place-items-center rounded-md tt-tint-2 text-[var(--tt-fg-dim)]">
              <Ban size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--tt-fg)]">Skip — no AI summaries</div>
              <div className="text-[11px] text-[var(--tt-fg-dim)]">
                Only the deterministic brief is shown. Nothing leaves your machine.
              </div>
            </div>
            {selected === null && (
              <span className="h-5 w-5 grid place-items-center rounded-full bg-[var(--tt-fg-muted)] text-[var(--tt-canvas)]">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface ModelDropdownProps {
  label: string;
  value: string | null;
  onChange?: (v: string | null) => void;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyHint?: React.ReactNode;
  options: { value: string; label: string; hint?: string }[];
  autoOption: string;
  hint?: string;
}

/** Shared dropdown UI for the model sub-picker. */
function ModelDropdown({
  label, value, onChange, loading, error, empty, emptyHint,
  options, autoOption, hint,
}: ModelDropdownProps) {
  return (
    <div className="mt-2 ml-11 mr-1">
      <label className="block text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--tt-fg-muted)] mb-1.5">
        {label}
      </label>
      {loading ? (
        <div className="text-[12px] text-[var(--tt-fg-dim)] italic">Loading…</div>
      ) : error ? (
        <div className="text-[12px] text-[var(--tt-danger-fg)]">{error}</div>
      ) : empty ? (
        <div className="text-[12px] text-[var(--tt-fg-dim)]">{emptyHint}</div>
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value || null)}
          className="w-full h-9 px-3 rounded-md bg-[var(--tt-sunken)] border border-[var(--tt-border-strong)] text-[13px] text-[var(--tt-fg)] focus:outline-none focus:border-[var(--tt-border-focus)] transition-colors"
        >
          <option value="">{autoOption}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} title={o.hint}>
              {o.label}{o.hint ? ` — ${o.hint}` : ""}
            </option>
          ))}
        </select>
      )}
      {hint && (
        <p className="text-[10.5px] text-[var(--tt-fg-dim)] mt-1.5">{hint}</p>
      )}
    </div>
  );
}
