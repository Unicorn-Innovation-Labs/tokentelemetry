import { Lock, FileCode, Zap, GitBranch } from "lucide-react";

const ITEMS = [
  { icon: Lock,     title: "100% local",    body: "Your logs never leave your machine. No telemetry endpoints. No accounts." },
  { icon: FileCode, title: "MIT open source", body: "Read every line. Fork it. Replace it with something better. Up to you." },
  { icon: Zap,      title: "No signup",     body: "One command, browser opens. That's the entire onboarding." },
];

export default function TrustStrip() {
  return (
    <section className="border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col items-start gap-3">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                <Icon size={18} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-900">
          <div className="text-[11px] font-mono text-slate-600">
            tokentelemetry · built by{" "}
            <a href="https://www.linkedin.com/in/vasi-hemanth/" className="text-slate-400 hover:text-white">
              Hemanth Vasi
            </a>
          </div>
          <a
            href="https://github.com/VasiHemanth/tokentelemetry"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            <GitBranch size={14} />
            <img
              src="https://img.shields.io/github/stars/VasiHemanth/tokentelemetry?style=flat&label=star&color=334155&labelColor=0f172a"
              alt="GitHub stars"
              className="h-4"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
