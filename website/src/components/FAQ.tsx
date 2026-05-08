export const FAQ_ITEMS = [
  {
    q: "How do I track Claude Code token usage?",
    a: "Install TokenTelemetry, run Claude Code normally, and open http://localhost:3000. TokenTelemetry auto-detects Claude Code sessions from ~/.claude/ logs — no instrumentation, no SDK, no config.",
  },
  {
    q: "How do I monitor Gemini CLI and Codex costs?",
    a: "TokenTelemetry auto-reads logs from Gemini CLI, OpenAI Codex CLI, Cursor, GitHub Copilot, Qwen CLI, OpenCode, Vibe, and Antigravity. Token counts and dollar costs appear in the local dashboard automatically.",
  },
  {
    q: "Is there a free tool to monitor AI coding agent token usage?",
    a: "Yes — TokenTelemetry is free, open-source (MIT), and runs 100% locally. No account, no signup, no cloud.",
  },
  {
    q: "Does TokenTelemetry send my data to the cloud?",
    a: "No. Everything runs on your machine. The dashboard reads session log files from your local filesystem and serves a UI on localhost. Nothing leaves your computer.",
  },
  {
    q: "How does TokenTelemetry compare to Langfuse or Helicone?",
    a: "TokenTelemetry is purpose-built for AI coding agents and is zero-config — no SDK instrumentation. Langfuse and Helicone are general LLM-app observability platforms that require code changes and (typically) a cloud account.",
  },
  {
    q: "Which coding agents does it support?",
    a: "Claude Code (Anthropic), OpenAI Codex CLI, Gemini CLI (Google), Cursor, GitHub Copilot, Qwen CLI, OpenCode, Vibe, and Antigravity — nine agents total.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="border-t border-[var(--tt-border)]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-28">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--tt-fg-dim)] mb-3">FAQ</p>
          <h2 className="text-[26px] sm:text-[38px] leading-[1.1] tracking-[-0.02em] font-semibold text-[var(--tt-fg)]">
            Common questions
          </h2>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <details
              key={i}
              className="group rounded-[var(--tt-radius-lg)] border border-[var(--tt-border)] bg-[var(--tt-panel)] open:bg-[var(--tt-raised)] transition-colors"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none gap-4 px-5 py-4">
                <h3 className="text-[var(--tt-fg)] font-medium text-[15px] sm:text-[16px] tracking-[-0.005em]">
                  {item.q}
                </h3>
                <span className="text-[var(--tt-fg-dim)] text-xl leading-none transition-transform group-open:rotate-45 select-none">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-[13.5px] text-[var(--tt-fg-muted)] leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
