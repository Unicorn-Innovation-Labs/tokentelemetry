"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Brain, Code, MessageSquare, Terminal, User, FileText, Activity, Zap, Info, Sparkles, GitBranch, LayoutPanelLeft, ListMusic, ChevronRight, ChevronLeft, Play, Pause, Wrench, Cpu, Folder, AlertTriangle, Hash, Clock, FileCode, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Artifact {
  name: string;
  path: string;
  type: 'video' | 'image' | 'document' | 'terminal';
}

interface Session {
  id: string;
  agent: string;
  project: string;
  timestamp: string;
  display?: string;
  text?: string;
  mcp_tools: string[];
  subagents: string[];
  has_plan: boolean;
  plans: any[];
  model?: string;
  tokens?: { input: number; output: number; cached: number; total: number };
  artifacts?: Artifact[];
}

interface Event {
  id?: string;
  type: string;
  role?: string;
  timestamp?: string;
  normalized_timestamp?: number;
  payload?: any;
  message?: any;
  attachment?: any;
  toolUseResult?: any;
  uuid?: string;
  content?: any;
  thoughts?: any[];
  toolCalls?: any[];
}

type StepKind = "user" | "assistant" | "reasoning" | "tool" | "tool_result" | "meta" | "other";

interface Step {
  idx: number;
  kind: StepKind;
  label: string;
  ts?: number;
}

function eventKind(evt: Event): StepKind {
  const type = evt.type;
  const role = evt.role || evt.message?.role;
  
  if (type === "session_meta" || type === "event_msg" || type === "turn_context") return "meta";
  if (type === "agent_reasoning" || evt.thoughts || evt.payload?.type === "reasoning" || type === "assistant_thinking") return "reasoning";
  if (Array.isArray(evt.payload) && evt.payload.some((p: any) => p.kind === "thinking" || p.type === "thinking")) return "reasoning";
  if (role === "assistant" && Array.isArray(evt.message?.content) && evt.message.content.some((c: any) => c.type === "thinking" || c.type === "thought")) return "reasoning";
  if (evt.toolCalls || evt.payload?.type === "function_call" || evt.payload?.type === "tool_use") return "tool";
  if (role === "assistant" && Array.isArray(evt.message?.content) && evt.message.content.some((c: any) => c.type === "tool_use")) return "tool";
  if ((type === "user" || role === "user") && Array.isArray(evt.message?.content) && evt.message.content.some((c: any) => c.type === "tool_result")) return "tool_result";
  if (type === "user" || role === "user" || (type === "response_item" && evt.payload?.role === "user") || type === "request_item") return "user";
  if (type === "assistant" || role === "assistant" || role === "model" || role === "gemini" || type === "model" || type === "gemini" || (type === "response_item" && evt.payload?.role === "assistant" && evt.payload?.type === "message")) return "assistant";
  return "other";
}

function ResponseBody({ text }: { text: string }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!text) return null;
  
  return (
    <div className="relative group/body">
      <div className="prose prose-invert prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-sm">
        {showRaw ? (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-400 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            {text}
          </pre>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>
        )}
      </div>
      
      <button 
        onClick={() => setShowRaw(!showRaw)}
        className="absolute -bottom-2 -right-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[9px] font-black uppercase tracking-tighter text-slate-500 hover:text-white hover:bg-slate-700 transition-all opacity-0 group-hover/body:opacity-100 shadow-xl z-10"
      >
        {showRaw ? "Rendered" : "Raw Source"}
      </button>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session_id = params.id as string;
  const agent = searchParams.get("agent") || "claude";

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<Session | null>(null);

  // Split view mode: Dialogue on left, Tools/Reasoning on right
  const [splitView, setSplitView] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(1000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"context" | "tools" | "artifacts" | "raw">("context");
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(true);

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [evResp, infoResp] = await Promise.all([
          fetch(`http://localhost:8000/sessions/${session_id}?agent=${agent}`),
          fetch(`http://localhost:8000/sessions`)
        ]);
        
        const evData = await evResp.json();
        const allSessions = await infoResp.json();
        
        setEvents(Array.isArray(evData) ? evData : []);
        setPlaybackIndex(Array.isArray(evData) ? evData.length : 0);
        
        const info = allSessions.find((s: any) => s.id === session_id);
        if (info) setSessionInfo(info);
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session_id, agent]);

  const visibleEvents = useMemo(() => {
     return events.slice(0, playbackIndex);
  }, [events, playbackIndex]);

  // SAFE Helper to check content for a type (Fixes TypeError)
  const hasContentType = (event: Event, type: string) => {
    const content = event.message?.content;
    if (Array.isArray(content)) {
      return content.some((c: any) => c.type === type);
    }
    return false;
  };

  const steps = useMemo(() => {
    return events.map((e, i) => {
      const kind = eventKind(e);
      let label = "Event";
      if (kind === "user") label = "User Input";
      if (kind === "assistant") label = "Assistant";
      if (kind === "reasoning") label = "Reasoning";
      if (kind === "tool") label = "Tool Call";
      if (kind === "tool_result") label = "Tool Result";
      
      return { idx: i, kind, label, ts: e.normalized_timestamp };
    });
  }, [events]);

  const extractText = (contentArr: any[]) => {
    if (!contentArr) return "";
    if (typeof contentArr === 'string') return contentArr;
    if (!Array.isArray(contentArr)) return "";
    return contentArr
      .map(c => {
         if (typeof c === 'string') return c;
         if (c.type === "text" || c.type === "input_text") return c.text || c.input_text || "";
         return "";
      })
      .filter(Boolean)
      .join("\n\n");
  };

  const jumpTo = (idx: number) => {
    setPlaybackIndex(idx + 1);
    setActiveStep(idx);
    stepRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="font-black text-xs uppercase tracking-[0.3em] text-slate-500">Reconstructing Log Streams...</span>
      </div>
    );
  }

  const stepRingClass: Record<string, string> = {
    user: "ring-2 ring-blue-500/50 ring-offset-4 ring-offset-slate-950",
    assistant: "ring-2 ring-emerald-500/50 ring-offset-4 ring-offset-slate-950",
    reasoning: "ring-2 ring-amber-500/50 ring-offset-4 ring-offset-slate-950",
    tool: "ring-2 ring-cyan-500/50 ring-offset-4 ring-offset-slate-950",
    tool_result: "ring-2 ring-cyan-500/50 ring-offset-4 ring-offset-slate-950",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      {/* HEADER: Dynamic Sticky Stats */}
      <header className="bg-slate-900/50 border-b border-slate-800 p-6 sticky top-0 z-50 backdrop-blur-md">
         <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <button
                     onClick={() => router.back()}
                     className="bg-slate-800 p-2 rounded-xl hover:bg-slate-700 transition-colors shadow-lg"
                     title="Back"
                  >
                     <ArrowLeft size={20} />
                  </button>
                  <div>
                     <h1 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                        <Activity className="text-blue-500" size={24} />
                        SESSION TRACE
                     </h1>
                     <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-sm ${
                           agent === 'claude' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                           agent === 'codex' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                           agent === 'gemini' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                           'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                           {agent}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                           ID: {session_id.slice(0, 8)}...
                        </span>
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-3 flex-wrap justify-end">
               {sessionInfo && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                     <StatPill icon={<Hash size={12}/>} label="Steps" value={steps.length} />
                     <StatPill icon={<Wrench size={12}/>} label="Tools" value={sessionInfo.mcp_tools.length} tone="blue" />
                     <StatPill icon={<Brain size={12}/>} label="Reason" value={events.filter(e => eventKind(e) === "reasoning").length} tone="amber" />
                     <StatPill icon={<User size={12}/>} label="Turns" value={events.filter(e => eventKind(e) === "user").length} />
                     <StatPill icon={<Clock size={12}/>} label="Dur" value={sessionInfo.timestamp ? format(new Date(sessionInfo.timestamp), 'HH:mm') : "—"} />
                     <StatPill icon={<AlertTriangle size={12}/>} label="Err" value={0} />
                  </div>
               )}

               {sessionInfo?.tokens && (
                  <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl shadow-inner group hover:border-slate-600 transition-all">
                     <Zap size={14} className="text-cyan-400" />
                     <div className="flex flex-col leading-none">
                        <span className="text-[7px] font-black uppercase text-slate-500 tracking-tighter mb-0.5">Cached</span>
                        <span className="text-xs font-bold text-cyan-400">{sessionInfo.tokens.cached.toLocaleString()}</span>
                     </div>
                  </div>
               )}

               <button 
                  onClick={() => setSplitView(!splitView)}
                  className={`p-2 px-4 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${splitView ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
               >
                  <LayoutPanelLeft size={16} />
                  Split Brain
               </button>
               </div>
            </div>
         </div>
      </header>

      <main className="flex-1 grid grid-cols-[320px_1fr_380px] max-w-full overflow-hidden">
          {/* LEFT: Timeline Navigation */}
          <aside className="border-r border-slate-800 bg-slate-950/50 overflow-y-auto p-6 scrollbar-hide">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                   <ListMusic size={14} /> PLAYBACK TIMELINE
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPlaybackIndex(Math.max(0, playbackIndex - 1))} className="p-1 hover:bg-slate-800 rounded text-slate-500"><ChevronLeft size={16}/></button>
                  <button onClick={() => setIsPlaying(!isPlaying)} className="p-1.5 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-900/20">{isPlaying ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}</button>
                  <button onClick={() => setPlaybackIndex(Math.min(steps.length, playbackIndex + 1))} className="p-1 hover:bg-slate-800 rounded text-slate-500"><ChevronRight size={16}/></button>
                </div>
             </div>
             
             <div className="space-y-1 relative">
                <div className="absolute left-[11px] top-4 bottom-4 w-px bg-slate-800/50"></div>
                {steps.map((step, i) => (
                   <button
                      key={i}
                      onClick={() => jumpTo(i)}
                      className={`w-full group flex items-start gap-4 p-3 rounded-xl transition-all relative z-10 ${
                        i === activeStep ? 'bg-slate-900 border border-slate-800 shadow-xl' : 'hover:bg-slate-900/40 border border-transparent'
                      } ${i >= playbackIndex ? 'opacity-30 grayscale' : ''}`}
                   >
                      <div className={`mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 shadow-sm transition-colors ${
                         step.kind === 'user' ? 'bg-blue-500' : 
                         step.kind === 'assistant' ? 'bg-emerald-500' :
                         step.kind === 'reasoning' ? 'bg-amber-500' :
                         'bg-slate-600'
                      }`} />
                      <div className="flex flex-col items-start min-w-0">
                         <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                            i === activeStep ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                         }`}>{step.label}</span>
                         <span className="text-[9px] font-mono text-slate-600 tabular-nums">
                            {step.ts ? format(new Date(step.ts), 'HH:mm:ss') : `STEP ${i+1}`}
                         </span>
                      </div>
                   </button>
                ))}
             </div>
          </aside>

          {/* CENTER: Conversation */}
          <section className="overflow-y-auto max-h-[calc(100vh-200px)] p-8">
             <div className={splitView ? "grid grid-cols-2 gap-8" : "space-y-8"}>
                <div className="space-y-8">
                   {splitView && <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 mb-2 flex items-center gap-2"><User size={14}/> User & Agent Dialogue</h3>}
                   {visibleEvents.map((event, idx) => {
                      const isReasoning = event.type === "agent_reasoning" || event.thoughts || (event.message?.role === "assistant" && (hasContentType(event, "thinking") || hasContentType(event, "thought"))) || event.payload?.type === "reasoning" || event.type === "assistant_thinking";
                      const isTool = event.toolCalls || (event.message?.role === "assistant" && hasContentType(event, "tool_use")) || (event.type === "user" && hasContentType(event, "tool_result")) || event.payload?.type === "function_call";
                      
                      // Check for thinking inside Copilot assistant payload array
                      const hasThinkingPart = Array.isArray(event.payload) && event.payload.some((p: any) => p.kind === "thinking" || p.type === "thinking");
                      
                      // For Cursor/Claude/Codex/Copilot: If it's an message with BOTH text and tools/reasoning, 
                      // we want the text to show up in the dialogue column.
                      const hasText = (Array.isArray(event.message?.content) && event.message.content.some((c: any) => (c.type === "text" || c.type === "input_text") && (c.text || c.input_text))) || 
                                      (event.type === "response_item" && event.payload?.type === "message" && Array.isArray(event.payload.content) && event.payload.content.some((c: any) => c.text || c.input_text)) ||
                                      (event.type === "assistant" && Array.isArray(event.payload) && event.payload.some((p: any) => p.value && p.kind !== "thinking")) ||
                                      (typeof event.message?.content === 'string' && event.message.content.length > 0);

                      if (splitView && !hasText) return null;
                      const kind = eventKind(event);
                      
                      return (
                         <div key={idx} ref={(el) => { stepRefs.current[idx] = el; }} className={activeStep === idx ? `${stepRingClass[kind]} rounded-3xl` : ""}>
                            <EventCard event={event} mode={splitView ? "dialogue" : "all"} agent={agent} />
                         </div>
                      );
                   })}
                </div>
                {splitView && (
                   <div className="space-y-8 border-l border-slate-800/50 pl-8">
                      <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Brain size={14}/> Internal Reasoning & Tools</h3>
                      {visibleEvents.map((event, idx) => {
                         const isReasoning = event.type === "agent_reasoning" || event.thoughts || (event.message?.role === "assistant" && (hasContentType(event, "thinking") || hasContentType(event, "thought"))) || event.payload?.type === "reasoning" || event.type === "assistant_thinking";
                         const isTool = event.toolCalls || (event.message?.role === "assistant" && hasContentType(event, "tool_use")) || (event.type === "user" && hasContentType(event, "tool_result")) || event.payload?.type === "function_call";
                         
                         const hasThinkingPart = Array.isArray(event.payload) && event.payload.some((p: any) => p.kind === "thinking" || p.type === "thinking");

                         if (!isReasoning && !isTool && !hasThinkingPart) return null;
                         const kind = eventKind(event);
                         return (
                            <div key={idx} ref={(el) => { stepRefs.current[idx] = el; }} className={activeStep === idx ? `${stepRingClass[kind]} rounded-3xl` : ""}>
                               <EventCard event={event} mode="brain" agent={agent} />
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          </section>

          {/* RIGHT: Context & Artifacts */}
          <aside className="border-l border-slate-800 bg-slate-900/20 p-6 overflow-y-auto">
             <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-8 shadow-inner">
                {["context", "tools", "artifacts", "raw"].map(tab => (
                   <button
                      key={tab}
                      onClick={() => setSidebarTab(tab as any)}
                      className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${
                         sidebarTab === tab ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'
                      }`}
                   >
                      {tab}
                   </button>
                ))}
             </div>

             {sidebarTab === "context" && (
                <div className="space-y-6">
                   <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest mb-4">
                      <Folder size={14} /> Active Workspace Context
                   </div>
                   <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-4 shadow-xl">
                      <Row k="Current Directory" v={sessionInfo?.project || "Evaluating..."} />
                      <Row k="Agent Identity" v={agent} />
                      <Row k="Model Class" v={sessionInfo?.model || "GPT-5 Hybrid"} />
                      <Row k="Reasoning Effort" v="Maximum" />
                   </div>
                   
                   <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest mt-10 mb-4">
                      <ListMusic size={14} /> Current Sub-Task Trace
                   </div>
                   <div className="space-y-3">
                      {sessionInfo?.plans?.map((p, i) => (
                        <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                           <div className="flex items-center gap-2 text-emerald-400 font-black text-[9px] uppercase mb-2">
                              <ClipboardList size={12}/> Active Plan Entry
                           </div>
                           <p className="text-[11px] text-slate-400 leading-relaxed italic">{p.content}</p>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {sidebarTab === "artifacts" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest mb-4">
                      <Activity size={14} /> Session Artifacts ({sessionInfo?.artifacts?.length || 0})
                   </div>
                   {sessionInfo?.artifacts?.map((art, idx) => (
                      <ArtifactCard key={idx} artifact={art} />
                   ))}
                   {(!sessionInfo?.artifacts || sessionInfo.artifacts.length === 0) && (
                      <div className="p-12 text-center text-slate-700 text-[10px] font-black uppercase border-2 border-dashed border-slate-900 rounded-3xl">
                         No media artifacts generated in this session
                      </div>
                   )}
                </div>
             )}

             {sidebarTab === "tools" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest mb-4">
                      <Wrench size={14} /> Connected MCP Capabilities
                   </div>
                   {sessionInfo?.mcp_tools.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl hover:border-blue-500/30 transition-all cursor-default">
                         <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Terminal size={14} />
                         </div>
                         <span className="text-[11px] font-bold text-slate-300">{t}</span>
                      </div>
                   ))}
                </div>
             )}

             {sidebarTab === "raw" && (
                <div className="h-full">
                  <pre className="text-[10px] font-mono text-slate-500 bg-slate-950 p-6 rounded-2xl border border-slate-800 h-[calc(100vh-320px)] overflow-auto scrollbar-hide">
                    {JSON.stringify(events, null, 2)}
                  </pre>
                </div>
             )}
          </aside>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string, v: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">{k}</span>
      <span className="text-[11px] text-slate-300 font-mono truncate" title={v}>{v}</span>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group hover:border-slate-600 transition-all">
       <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                {artifact.type === 'video' ? <Play size={14} /> : <FileText size={14} />}
             </div>
             <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-slate-200 truncate max-w-[180px]">{artifact.name}</span>
                <span className="text-[8px] font-mono text-slate-500 uppercase">{artifact.type}</span>
             </div>
          </div>
          <button onClick={() => setOpen(!open)} className="text-slate-600 hover:text-white transition-colors">
             <Info size={14} />
          </button>
       </div>
       
       {artifact.type === 'image' && (
          <div className="px-4 pb-4">
             <img 
               src={`http://localhost:8000/artifacts/file?path=${encodeURIComponent(artifact.path)}`} 
               className="w-full rounded-xl border border-slate-800 shadow-lg cursor-zoom-in" 
               alt={artifact.name}
               onClick={() => window.open(`http://localhost:8000/artifacts/file?path=${encodeURIComponent(artifact.path)}`, '_blank')}
             />
          </div>
       )}

       {artifact.type === 'video' && (
          <div className="px-4 pb-4">
             <video 
               src={`http://localhost:8000/artifacts/file?path=${encodeURIComponent(artifact.path)}`} 
               controls 
               className="w-full rounded-xl border border-slate-800 shadow-lg"
             />
          </div>
       )}
    </div>
  );
}

function StatPill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "blue" | "amber" | "red" | "emerald" | "cyan" }) {
  const toneCls = 
    tone === "blue" ? "text-blue-400" : 
    tone === "amber" ? "text-amber-400" : 
    tone === "red" ? "text-red-400" : 
    tone === "emerald" ? "text-emerald-400" :
    tone === "cyan" ? "text-cyan-400" :
    "text-slate-300";

  return (
    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 shadow-inner">
      <span className="text-slate-600">{icon}</span>
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className={`text-[11px] font-black tabular-nums ${toneCls}`}>{value}</span>
    </div>
  );
}

function EventCard({ event, mode, agent }: { event: Event, mode: "all" | "dialogue" | "brain", agent: string }) {
  const type = event.type;
  const payload = event.payload;
  const message = event.message;
  const role = event.role || message?.role;

  const renderTimestamp = () => {
    const ts = event.normalized_timestamp || (event.timestamp ? new Date(event.timestamp).getTime() : null);
    if (!ts) return null;
    return (
      <span className="text-[8px] font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/50">
        {format(new Date(ts), 'HH:mm:ss')}
      </span>
    );
  };

  const extractText = (content: any) => {
    if (!content) return "";
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(c => {
        if (typeof c === 'string') return c;
        if (c.type === "text" || c.type === "input_text") return c.text || c.input_text || "";
        if (c.value && c.kind !== "thinking") return c.value;
        return "";
      }).filter(Boolean).join("\n\n");
    }
    if (typeof content === 'object') {
       return content.text || content.input_text || content.value || "";
    }
    return "";
  };

  const parts: React.ReactNode[] = [];

  // 1. OLLAMA
  if (agent === "ollama") {
     parts.push(
        <div key="ollama-msg" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <Sparkles size={16} strokeWidth={3} /> Thinking
            </div>
            {renderTimestamp()}
          </div>
          <ResponseBody text={typeof event.content === 'string' ? event.content : JSON.stringify(event.content)} />
        </div>
     );
  }

  // 2. COPILOT (Array payload with kind: "thinking" vs other)
  if (agent === "copilot" && Array.isArray(payload)) {
       const thinkingParts = payload.filter((p: any) => p.kind === "thinking" || p.type === "thinking");
       const textParts = payload.filter((p: any) => p.kind !== "thinking" && p.type !== "thinking" && (p.value || typeof p === 'string'));
       const combinedText = textParts.map((p: any) => typeof p === 'string' ? p : (p.value || "")).join("");

       if (thinkingParts.length > 0 && mode !== "dialogue") {
         thinkingParts.forEach((p: any, i: number) => {
           parts.push(
             <div key={`copilot-think-${i}`} className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-indigo-500/50 group">
               <div className="flex justify-between items-start mb-3">
                 <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
                   <Brain size={16} /> Reasoning
                 </div>
                 {renderTimestamp()}
               </div>
               <div className="text-slate-400 whitespace-pre-wrap italic text-xs leading-relaxed font-mono opacity-80">{p.value}</div>
             </div>
           );
         });
       }
       if (combinedText && mode !== "brain") {
         parts.push(
           <div key="copilot-msg" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all">
             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
             <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">
                   <GitBranch size={16} strokeWidth={3} /> Thinking
               </div>
               {renderTimestamp()}
             </div>
             <ResponseBody text={combinedText} />
           </div>
         );
       }
  }

  // 3. VIBE / OPENCODE Assistant Response
  if (type === "assistant" && payload?.content && !message) {
    const isOpencode = agent === "opencode";
    const accent = isOpencode ? "bg-amber-600" : "bg-pink-600";
    const textColor = isOpencode ? "text-amber-400" : "text-pink-400";
    parts.push(
      <div key="vibe-msg" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
        <div className={`absolute top-0 left-0 w-1 h-full ${accent}`}></div>
        <div className="flex justify-between items-start mb-4">
          <div className={`flex items-center gap-2 ${textColor} font-black text-[10px] uppercase tracking-[0.2em]`}>
              <Zap size={16} strokeWidth={3} /> Thinking
          </div>
          {renderTimestamp()}
        </div>
        <ResponseBody text={payload.content} />
      </div>
    );
  }

  // 4. VIBE / OPENCODE User Prompt
  if (type === "user" && payload?.content && !message) {
    parts.push(
      <div key="vibe-user" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-[0.2em]">
              <User size={16} strokeWidth={3} /> User Prompt
          </div>
          {renderTimestamp()}
        </div>
        <div className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed font-medium">{payload.content}</div>
      </div>
    );
  }

  // 5. ANTIGRAVITY / GEMINI (brain-based Markdown synthesis)
  if (type === "brain_md") {
     parts.push(
        <div key="brain-md" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
          <div className={`absolute top-0 left-0 w-1 h-full ${role === 'user' ? 'bg-blue-600' : 'bg-cyan-600'}`}></div>
          <div className="flex justify-between items-start mb-4">
            <div className={`flex items-center gap-2 ${role === 'user' ? 'text-blue-400' : 'text-cyan-400'} font-black text-[10px] uppercase tracking-[0.2em]`}>
                {role === 'user' ? <User size={16} strokeWidth={3} /> : <Sparkles size={16} strokeWidth={3} />}
                {event.payload?.label || "Thinking"}
            </div>
            {renderTimestamp()}
          </div>
          <ResponseBody text={event.payload?.content} />
        </div>
     );
  }

  // 6. Generic Gemini Tool Call
  if (type === "gemini_tool") {
     parts.push(
        <div key="gemini-tool" className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-cyan-500/50 group">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-widest">
              <Code size={16} /> Tool Call: {event.payload?.name}
            </div>
            {renderTimestamp()}
          </div>
          <pre className="bg-slate-950 text-cyan-300 p-5 rounded-xl text-[11px] overflow-x-auto font-mono border border-slate-800 shadow-inner">
            {JSON.stringify(event.payload?.arguments, null, 2)}
          </pre>
        </div>
     );
  }

  // 7. CATCH-ALL for separate reasoning events (Claude/Cursor/Copilot/Qwen)
  if ((type === "agent_reasoning" || type === "assistant_thinking" || type === "reasoning" || payload?.type === "reasoning") && mode !== "dialogue") {
    const rawReasoning = payload?.text ?? payload?.content ?? payload?.thinking ?? payload?.summary ?? payload?.value ?? payload?.message ?? event.thoughts ?? (typeof payload === 'string' ? payload : payload);
    let text = "";
    if (typeof rawReasoning === 'string') text = rawReasoning;
    else if (Array.isArray(rawReasoning)) text = rawReasoning.map((p: any) => (typeof p === 'string' ? p : (p?.text ?? p?.thinking ?? p?.content ?? p?.value ?? ""))).filter(Boolean).join("\n\n");
    else if (rawReasoning && typeof rawReasoning === 'object') text = rawReasoning.text ?? rawReasoning.thinking ?? rawReasoning.content ?? rawReasoning.value ?? JSON.stringify(rawReasoning, null, 2);
    if (text) {
      const isCopilot = agent === "copilot" || type === "assistant_thinking";
      const accent = isCopilot ? "border-l-indigo-500/50" : "border-l-amber-500/50";
      const textColor = isCopilot ? "text-indigo-400" : "text-amber-500";
      const bg = isCopilot ? "bg-indigo-500/5" : "bg-amber-500/5";
      const border = isCopilot ? "border-indigo-500/20" : "border-amber-500/20";

      parts.push(
        <div key="catch-reasoning" className={`${bg} border ${border} rounded-2xl p-6 shadow-sm ml-4 border-l-4 ${accent} group`}>
          <div className="flex justify-between items-start mb-3">
            <div className={`flex items-center gap-2 ${textColor} font-bold text-xs uppercase tracking-widest`}>
              <Brain size={16} /> Reasoning
            </div>
            {renderTimestamp()}
          </div>
          <div className="text-slate-400 whitespace-pre-wrap italic text-[11px] leading-relaxed font-mono opacity-80">{text}</div>
        </div>
      );
    }
  }

  // 8. CLAUDE / CURSOR (Multi-part support: thinkingArr + text + tool_result)
  if ((type === "user" || role === "user") && message?.role === "user") {
    const toolResults = Array.isArray(message.content) ? message.content.filter((c: any) => c.type === "tool_result") : [];
    if (toolResults.length > 0 && mode !== "dialogue") {
      parts.push(
        <div key="claude-tool-results" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl ml-8 group hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest group-hover:text-emerald-500">
              <Terminal size={16} /> Tool Output
            </div>
            {renderTimestamp()}
          </div>
          {toolResults.map((c: any, i: number) => (
            <div key={i} className="space-y-3 mb-6 last:mb-0">
               <div className="text-[9px] font-mono text-slate-600 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 w-fit">ID: {c.tool_use_id}</div>
              <pre className="bg-slate-950 text-emerald-400 p-5 rounded-xl text-[11px] overflow-x-auto font-mono border border-slate-800 shadow-inner">
                {typeof c.content === 'string' ? c.content : JSON.stringify(c.content, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      );
    }
    const textContent = Array.isArray(message.content) ? extractText(message.content) : (typeof message.content === 'string' ? message.content : "");
    if (textContent && mode !== "brain") {
      parts.push(
        <div key="claude-user-msg" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <User size={16} strokeWidth={3} /> User Prompt
            </div>
            {renderTimestamp()}
          </div>
          <div className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed font-medium">{textContent}</div>
        </div>
      );
    }
  }

  if ((type === "assistant" || role === "assistant") && (message?.role === "assistant" || role === "assistant")) {
    const contentArr = Array.isArray(message?.content) ? message.content : [];
    const toolCallsArr = contentArr.filter((c: any) => c.type === "tool_use");
    const thinkingArr = contentArr.filter((c: any) => c.type === "thinking");
    const text = extractText(contentArr);

    if (thinkingArr.length > 0 && mode !== "dialogue") {
       thinkingArr.forEach((t: any, i: number) => {
         const body = t.thinking || t.text || t.content || "";
         const isEncrypted = !body && (t.signature || t.type === "redacted_thinking");
         parts.push(
            <div key={`think-${i}`} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-amber-500/50 group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
                  <Brain size={16} /> Reasoning {isEncrypted && <span className="text-[9px] font-mono normal-case tracking-normal text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">encrypted</span>}
                </div>
                {renderTimestamp()}
              </div>
              {isEncrypted ? (
                <div className="text-slate-500 italic text-[11px] leading-relaxed">
                  Extended thinking is sealed by the API — the local log stores only the cryptographic signature, not the reasoning text.
                  <div className="mt-2 text-[9px] font-mono text-slate-600 break-all opacity-60">sig: {String(t.signature || "").slice(0, 64)}…</div>
                </div>
              ) : (
                <div className="text-slate-400 whitespace-pre-wrap italic text-[11px] leading-relaxed font-mono opacity-80">{body || JSON.stringify(t)}</div>
              )}
            </div>
         );
       });
    }

    if (text && mode !== "brain") {
      parts.push(
        <div key="claude-assistant-msg" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <MessageSquare size={16} strokeWidth={3} /> Thinking
            </div>
            {renderTimestamp()}
          </div>
          <ResponseBody text={text} />
        </div>
      );
    }

    if (toolCallsArr.length > 0 && mode !== "dialogue") {
      toolCallsArr.forEach((toolUse: any, i: number) => {
        parts.push(
          <div key={`tool-${i}`} className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-blue-500/50 group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                <Code size={16} /> Tool Call: {toolUse.name}
              </div>
              {renderTimestamp()}
            </div>
            <pre className="bg-slate-950 text-blue-300 p-5 rounded-xl text-[11px] overflow-x-auto font-mono border border-slate-800 shadow-inner">
              {JSON.stringify(toolUse.input || toolUse.args || toolUse.payload || toolUse.parameters, null, 2)}
            </pre>
          </div>
        );
      });
    }
  }

  // 9. CODEX (request_item / response_item)
  if (agent === "codex" || type === "response_item" || type === "request_item") {
    const r = payload?.role || (type === "request_item" ? "user" : "assistant") || role;
    const itemType = payload?.type || type;
    
    const isReasoning = itemType === "reasoning" || itemType === "thought" || itemType === "thinking";
    if (isReasoning && mode !== "dialogue") {
       const isEncrypted = !payload.content && !!payload.encrypted_content;
       parts.push(
          <div key="codex-reasoning" className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-purple-500/50 group">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold mb-3 text-xs uppercase tracking-widest">
                <Brain size={16} /> Reasoning {isEncrypted && <span className="text-[9px] font-mono normal-case tracking-normal text-purple-400/70 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/30">encrypted</span>}
              </div>
              {renderTimestamp()}
            </div>
            {isEncrypted ? (
              <div className="text-slate-500 italic text-[11px] leading-relaxed">
                Extended thinking is sealed by the API — the local log stores only the cryptographic signature, not the reasoning text.
                <div className="mt-2 text-[9px] font-mono text-slate-600 break-all opacity-60">sig: {String(payload.encrypted_content || "").slice(0, 64)}…</div>
              </div>
            ) : (
              <div className="text-slate-400 whitespace-pre-wrap italic text-xs leading-relaxed font-mono opacity-80">{
                extractText(payload?.content || payload?.text || payload?.thinking || payload?.summary || payload?.value)
              }</div>
            )}
          </div>
       );
    }

    if ((itemType === "function_call" || itemType === "tool_use" || itemType === "tool_call") && mode !== "dialogue") {
       parts.push(
          <div key="codex-tool" className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm ml-4 border-l-4 border-l-blue-500/50 group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-blue-400 font-bold mb-4 text-xs uppercase tracking-widest">
                <Code size={16} /> Tool Call: {payload?.name || payload?.tool}
              </div>
              {renderTimestamp()}
            </div>
            <pre className="bg-slate-950 text-blue-300 p-5 rounded-xl text-[11px] overflow-x-auto font-mono border border-slate-800 shadow-inner">
              {JSON.stringify(payload?.arguments || payload?.input || payload?.parameters || payload?.payload, null, 2)}
            </pre>
          </div>
       );
    }

    if (itemType === "message" || type === "user" || type === "assistant" || payload?.content) {
       const text = extractText(payload?.content || payload?.text || content || event.text);

       if (text) {
         const isAssistant = r === "assistant" || r === "model" || r === "bot";
         if (mode !== "brain") {
           parts.push(
              <div key="codex-message" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-slate-600 transition-all text-left">
                <div className={`absolute top-0 left-0 w-1 h-full ${isAssistant ? 'bg-emerald-600' : 'bg-blue-600'}`}></div>
                <div className="flex justify-between items-start mb-4">
                  <div className={`flex items-center gap-2 ${isAssistant ? 'text-emerald-400' : 'text-blue-400'} font-black text-[10px] uppercase tracking-[0.2em]`}>
                      {isAssistant ? <MessageSquare size={16} strokeWidth={3} /> : <User size={16} strokeWidth={3} />}
                      {isAssistant ? 'Thinking' : 'User Prompt'}
                  </div>
                  {renderTimestamp()}
                </div>
                {isAssistant
                  ? <ResponseBody text={text} />
                  : <div className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed font-medium">{text}</div>}
              </div>
           );
         }
       }
    }
  }

  // 10. SYSTEM METADATA
  if (type === "session_meta") {
    parts.push(
      <div key="sys-meta" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl opacity-90 border-dashed">
        <div className="flex items-center gap-2 text-slate-400 font-bold mb-4 text-xs uppercase tracking-widest">
          <Info size={16} /> Session Metadata
        </div>
        <div className="grid grid-cols-2 gap-6 text-[11px] font-mono text-slate-500">
           <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase tracking-widest opacity-50">CWD</span>
              <span className="text-slate-300 truncate">{payload.cwd}</span>
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase tracking-widest opacity-50">Model</span>
              <span className="text-slate-300">{payload.model_provider}</span>
           </div>
        </div>
      </div>
    );
  }

  if (type === "event_msg") {
    parts.push(
      <div key="evt-msg" className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-4 text-[10px] text-slate-500 flex items-center gap-4 group hover:bg-slate-800/20 transition-all">
         <div className="p-2 bg-slate-800 rounded-lg group-hover:text-white transition-colors">
            <Activity size={14} />
         </div>
         <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
               <span className="font-black uppercase tracking-widest opacity-60">Log Event</span>
               {renderTimestamp()}
            </div>
            <div className="truncate font-mono opacity-80">{event.payload?.message || JSON.stringify(event.payload)}</div>
         </div>
      </div>
    );
  }

  if (parts.length === 0 && mode === "all") {
    parts.push(
      <div key="fallback-evt" className="bg-slate-900/20 border border-slate-800/30 rounded-xl p-3 text-[10px] text-slate-600 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
        <span className="font-mono">System Event: {type}</span>
      </div>
    );
  }

  return <>{parts}</>;
}
