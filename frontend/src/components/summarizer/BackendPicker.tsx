"use client";

import { Check, ShieldAlert, Ban } from "lucide-react";
import { getAgent } from "@/lib/agents";
import { cn } from "@/lib/cn";
import type { SummarizerBackend } from "@/lib/summarizer";

interface BackendPickerProps {
  backends: SummarizerBackend[];
  /** null == "Skip / no AI summaries" selected */
  selected: string | null;
  onSelect: (backend: string | null) => void;
  /** Whether to render the "no AI summaries" opt-out tile. */
  allowSkip?: boolean;
}

/**
 * Shared backend selector — reused by the first-run onboarding modal and the
 * settings surface. Tints each option by its agent hex via getAgent().
 */
export function BackendPicker({ backends, selected, onSelect, allowSkip = true }: BackendPickerProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {backends.map((b) => {
          const meta = getAgent(b.name);
          const Icon = meta.icon;
          const active = selected === b.name;
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => onSelect(b.name)}
              className={cn(
                "group relative flex items-center gap-3 rounded-[var(--tt-radius-lg)] border px-3.5 py-3 text-left transition-colors",
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

      {selected !== null && (
        <div className="flex items-start gap-2 rounded-[var(--tt-radius)] border border-[var(--tt-warn-bd)] bg-[var(--tt-warn-bg)] px-3 py-2.5">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[var(--tt-warn-fg)]" />
          <p className="text-[11px] leading-relaxed text-[var(--tt-warn-fg)]">
            Privacy: choosing a backend means trace content (your prompts, the agent&apos;s output,
            file paths and commands from the session) is sent to that agent&apos;s provider when you
            generate a summary.
          </p>
        </div>
      )}
    </div>
  );
}
