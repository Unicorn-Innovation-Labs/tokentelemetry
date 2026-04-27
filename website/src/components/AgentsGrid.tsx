import { AGENTS } from "@/data/agents";
import { Terminal } from "lucide-react";

export default function AgentsGrid() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-3">Supported</p>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
          Nine agents. Zero config.
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          TokenTelemetry reads logs your agents already write. No proxies, no wrappers, no telemetry endpoints to register.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((a) => (
          <div
            key={a.name}
            className="group bg-slate-900/40 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 hover:bg-slate-900/80 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className={`text-base font-black tracking-tight ${a.accent}`}>{a.name}</div>
                <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mt-0.5">
                  {a.vendor}
                </div>
              </div>
              <Terminal size={16} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {a.captures.map((c) => (
                <span
                  key={c}
                  className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded uppercase tracking-widest"
                >
                  {c}
                </span>
              ))}
            </div>

            <div className="text-[10px] font-mono text-slate-600 group-hover:text-slate-500 transition-colors truncate">
              reads: {a.logPath}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
