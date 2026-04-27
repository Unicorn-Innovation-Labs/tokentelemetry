"use client";
import { useEffect, useState } from "react";
import { Copy, Check, GitBranch, ArrowRight } from "lucide-react";
import TerminalReplay from "./TerminalReplay";

const PAINS = [
  "Why did that Codex run cost $4.20?",
  "Which agent actually finished the task?",
  "What was Claude thinking for 40 seconds?",
];

const INSTALL: Record<"mac" | "windows", string> = {
  mac: `curl -fsSL https://raw.githubusercontent.com/VasiHemanth/tokentelemetry/main/install.sh | bash`,
  windows: `irm https://raw.githubusercontent.com/VasiHemanth/tokentelemetry/main/install.ps1 | iex`,
};

export default function Hero() {
  const [pain, setPain] = useState(0);
  const [copied, setCopied] = useState(false);
  const [os, setOs] = useState<"mac" | "windows">("mac");

  useEffect(() => {
    const id = setInterval(() => setPain((p) => (p + 1) % PAINS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const copy = () => {
    navigator.clipboard?.writeText(INSTALL[os]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabClass = (active: boolean) =>
    `px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
      active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
    }`;

  return (
    <section className="relative overflow-hidden bg-grid">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center relative">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow" />
            100% local · open source
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-[1.05] mb-6">
            See exactly what your{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              AI agents
            </span>{" "}
            cost, think, and do.
          </h1>
          <p className="text-slate-400 text-lg mb-2 max-w-xl leading-relaxed">
            Local observability for Claude, Codex, Gemini, Cursor, Copilot — and 4 more. One command, no signup.
          </p>
          <p className="text-slate-500 text-base font-mono italic mb-10 transition-all">
            “{PAINS[pain]}”
          </p>

          <div className="flex items-center gap-1 mb-2">
            <button onClick={() => setOs("mac")} className={tabClass(os === "mac")}>macOS / Linux</button>
            <button onClick={() => setOs("windows")} className={tabClass(os === "windows")}>Windows</button>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center justify-between shadow-xl mb-3">
            <pre className="px-4 py-3 font-mono text-[12px] text-slate-300 overflow-x-auto">
              {INSTALL[os]}
            </pre>
            <button
              onClick={copy}
              className="m-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-slate-600 font-mono">
            <span className="text-slate-500">npm package coming soon · </span>requires Node 18+, Python 3.9+
          </p>

          <div className="flex items-center gap-3 mt-8">
            <a
              href="https://github.com/VasiHemanth/tokentelemetry"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-slate-950 font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              <GitBranch size={16} /> View on GitHub
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white font-bold text-sm transition-colors"
            >
              See it in action <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className="lg:pl-8">
          <TerminalReplay />
        </div>
      </div>
    </section>
  );
}
