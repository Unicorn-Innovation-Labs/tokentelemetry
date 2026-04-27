"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FEATURES } from "@/data/features";
import { Check } from "lucide-react";

export default function FeatureShowcase() {
  const [active, setActive] = useState(FEATURES[0].id);
  const feature = FEATURES.find((f) => f.id === active)!;

  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3">What you'll see</p>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
          One dashboard. Every agent.
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => setActive(f.id)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              active === f.id
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="grid lg:grid-cols-2 gap-10 items-center bg-slate-900/40 border border-slate-800 rounded-3xl p-8 md:p-12"
        >
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-6 leading-tight">
              {feature.headline}
            </h3>
            <ul className="space-y-4">
              {feature.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-slate-300 text-sm leading-relaxed">
                  <span className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-emerald-400" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative group">
            <motion.div 
              key={feature.screenshot}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="aspect-[16/10] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden relative"
            >
              <img 
                src={feature.screenshot} 
                alt={feature.label}
                className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
            </motion.div>
            
            {/* Glossy overlay */}
            <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none" />
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
