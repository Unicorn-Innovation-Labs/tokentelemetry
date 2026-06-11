"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  BarChart3, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Zap, DollarSign, Cpu, GitBranch,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

import { useResource } from "@/lib/api";
import { getAgent } from "@/lib/agents";
import { useTheme } from "@/components/ThemeProvider";
import { formatTokens as compact } from "@/lib/format";
import {
  PageHeader, StatTile, Section, Card, CardHeader, CardTitle, CardEyebrow,
  Table, THead, TBody, TR, TH, TD, AgentBadge, Badge, EmptyState, Skeleton,
} from "@/components/ui";

interface AnalyticsData {
  by_agent: Record<string, AgentStats>;
  by_day: { date: string; total: number; input: number; output: number; cached: number; cost: number }[];
  by_model?: Record<string, AgentStats & { agent: string }>;
  by_skill?: Record<string, { invocations: number; session_count: number; agents?: string[] }>;
  by_mcp_server?: Record<string, { calls: number; tools: Record<string, number>; session_count: number; agents?: string[] }>;
  by_subagent_type?: Record<string, { spawns: number; tokens: number; cost: number; session_count: number; tokens_recorded?: boolean; agents?: string[] }>;
  delegation?: {
    delegated_tokens: number; delegated_cost: number; sessions_with_spawns: number;
    linked_children?: number; linked_child_tokens?: number; linked_child_cost?: number;
    by_agent?: Record<string, { parents: number; spawns: number; children: number; child_tokens: number; child_cost: number; delegated_tokens: number; delegated_cost: number }>;
  };
  total: { input: number; output: number; cached: number; total: number; cost: number };
  pricing_updated?: string;
}

interface AgentStats {
  input: number; output: number; cached: number; total: number; cost: number; session_count: number;
}

/* ──────────────────────────────────────────────────────────────────────────
   Recharts theme — picks values per active theme. Recharts can't read
   CSS vars from `stroke` attrs, so we resolve them in JS.
   ────────────────────────────────────────────────────────────────────────── */
function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    axisStroke: isDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.32)",
    tickFill:   isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.65)",
    grid:       isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.07)",
    tooltipStyle: {
      backgroundColor: "var(--tt-overlay)",
      border: "1px solid var(--tt-border-strong)",
      borderRadius: "10px",
      padding: "8px 10px",
      boxShadow: isDark ? "0 12px 32px -12px rgba(0,0,0,0.6)" : "0 12px 32px -12px rgba(15,23,42,0.18)",
    },
    tooltipItem:  { fontSize: "11px", color: "var(--tt-fg)" },
    tooltipLabel: { fontSize: "10px", color: "var(--tt-fg-dim)", textTransform: "uppercase" as const, letterSpacing: "0.16em" },
  };
}

type DayRange = "7d" | "30d" | "90d" | "all";
const RANGES: { key: DayRange; label: string; days: number | null }[] = [
  { key: "7d",  label: "7d",  days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: null },
];

export default function AnalyticsPage() {
  const { data, loading } = useResource<AnalyticsData>("/analytics", { pollMs: 30_000 });
  const ct = useChartTheme();
  const AXIS = { stroke: ct.axisStroke, fontSize: 10, tickLine: false, axisLine: false, tick: { fill: ct.tickFill } } as const;
  const [range, setRange] = useState<DayRange>("30d");

  // Filter by_day to the selected window. Dates are local "YYYY-MM-DD"
  // strings (see backend A10 fix), so a lex compare against a cutoff string works.
  const filteredByDay = useMemo(() => {
    if (!data?.by_day) return [];
    const cfg = RANGES.find(r => r.key === range);
    if (!cfg?.days) return data.by_day;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (cfg.days - 1));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.by_day.filter(d => d.date >= cutoffStr);
  }, [data, range]);

  const rangeTotals = useMemo(() => {
    return filteredByDay.reduce(
      (acc, d) => ({
        total: acc.total + (d.total || 0),
        cost:  acc.cost  + (d.cost  || 0),
      }),
      { total: 0, cost: 0 }
    );
  }, [filteredByDay]);

  const modelData = useMemo(() => {
    if (!data?.by_model) return [];
    return Object.entries(data.by_model)
      .map(([name, s]) => ({ name, ...s, color: getAgent(s.agent).hex }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const agentData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_agent)
      .map(([name, s]) => ({ key: name, name: getAgent(name).label, value: s.total, color: getAgent(name).hex }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (loading && !data) return <AnalyticsLoading />;
  if (!data) {
    return (
      <div className="px-8 py-8 max-w-[1600px] mx-auto">
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="No analytics data"
          description="Once agent sessions are recorded, this view will surface token consumption, cost, and cache efficiency across agents and models."
        />
      </div>
    );
  }

  const cacheEff = ((data.total.cached / Math.max(1, data.total.input + data.total.cached)) * 100);

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto space-y-10 pb-20">
      <PageHeader
        eyebrow="Analytics"
        title="Token analytics"
        description="In-depth analysis of agent consumption, cost, and cache efficiency."
        icon={<BarChart3 size={20} strokeWidth={2.25} />}
        actions={
          data.pricing_updated && (
            <Badge variant="outline" size="sm" className="h-9">
              <DollarSign size={11} /> Rates · {data.pricing_updated}
            </Badge>
          )
        }
      />

      {/* KPI strip */}
      <Section title="Totals">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label="Total tokens"
            value={data.total.total.toLocaleString()}
            hint="Across all agents"
            icon={<TrendingUp size={16} />}
            accent="var(--tt-brand)"
          />
          <StatTile
            label="Input"
            value={compact(data.total.input)}
            hint={`${pct(data.total.input, data.total.total)}% of total`}
            icon={<ArrowDownToLine size={16} />}
            accent="var(--tt-info)"
          />
          <StatTile
            label="Output"
            value={compact(data.total.output)}
            hint={`${pct(data.total.output, data.total.total)}% of total`}
            icon={<ArrowUpFromLine size={16} />}
            accent="var(--tt-success)"
          />
          <StatTile
            label="Cache efficiency"
            value={`${cacheEff.toFixed(1)}%`}
            hint={`${compact(data.total.cached)} cached · est. $${data.total.cost.toFixed(2)} API equiv.`}
            icon={<Zap size={16} />}
            accent="var(--tt-warn)"
          />
        </div>
      </Section>

      {/* Daily consumption + agent share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader>
            <CardTitle><TrendingUp size={14} className="text-[var(--tt-brand)]" /> Token consumption (daily)</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-[10px] tabular text-[var(--tt-fg-dim)] tracking-[0.1em]">
                {compact(rangeTotals.total)} tokens · ${rangeTotals.cost.toFixed(2)}
              </span>
              <div className="flex gap-0.5 bg-[var(--tt-sunken)] border border-[var(--tt-border)] rounded-[var(--tt-radius)] p-0.5">
                {RANGES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] rounded-[calc(var(--tt-radius)-2px)] transition-colors",
                      range === r.key
                        ? "bg-[var(--tt-panel)] text-[var(--tt-fg)] shadow-sm"
                        : "text-[var(--tt-fg-dim)] hover:text-[var(--tt-fg)]"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredByDay} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ttArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#60a5fa" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis tickFormatter={(v) => compact(v)} {...AXIS} width={42} />
                <Tooltip
                  contentStyle={ct.tooltipStyle}
                  itemStyle={ct.tooltipItem}
                  labelStyle={ct.tooltipLabel}
                  formatter={(v: any) => [Number(v).toLocaleString(), "Tokens"]}
                  cursor={{ stroke: ct.axisStroke }}
                />
                <Area type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} fill="url(#ttArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle><Cpu size={14} className="text-emerald-400" /> Agent share</CardTitle>
            <CardEyebrow>{agentData.length} agents</CardEyebrow>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4 items-center h-72">
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={agentData} innerRadius={56} outerRadius={84} paddingAngle={3} dataKey="value" stroke="none">
                    {agentData.map((a) => <Cell key={a.key} fill={a.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={ct.tooltipStyle}
                    itemStyle={ct.tooltipItem}
                    formatter={(v: any, _n, p: any) => [Number(v).toLocaleString(), p.payload.name]}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 max-h-full overflow-y-auto pr-1">
              {agentData.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-2 text-[var(--tt-fg-muted)] min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <span className="tabular text-[var(--tt-fg-dim)] whitespace-nowrap">
                    {pct(a.value, data.total.total)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Per-agent table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--tt-border)] flex items-center justify-between">
          <CardTitle><BarChart3 size={14} className="text-[var(--tt-brand)]" /> Agent breakdown</CardTitle>
          <CardEyebrow>{Object.keys(data.by_agent).length} agents</CardEyebrow>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="pl-5">Agent</TH>
                <TH className="text-right">Sessions</TH>
                <TH className="text-right">Input</TH>
                <TH className="text-right">Output</TH>
                <TH className="text-right">Cached</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right pr-5 text-amber-300">API equiv.</TH>
              </TR>
            </THead>
            <TBody>
              {Object.entries(data.by_agent)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([name, s]) => (
                  <TR key={name} interactive>
                    <TD className="pl-5"><AgentBadge agent={name} /></TD>
                    <TD className="text-right tabular text-[var(--tt-fg-muted)]">{s.session_count}</TD>
                    <TD className="text-right tabular text-[var(--tt-fg-muted)]">{s.input.toLocaleString()}</TD>
                    <TD className="text-right tabular text-[var(--tt-fg-muted)]">{s.output.toLocaleString()}</TD>
                    <TD className="text-right tabular text-cyan-300/80">{s.cached.toLocaleString()}</TD>
                    <TD className="text-right tabular font-semibold text-[var(--tt-fg)]">{s.total.toLocaleString()}</TD>
                    <TD className="text-right pr-5 tabular font-semibold text-amber-300">${s.cost.toFixed(2)}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Models */}
      {modelData.length > 0 && (
        <Section
          title="Per-model"
          description="Distinct models observed across agents — click a row to filter sessions (coming soon)."
          actions={<Badge variant="neutral" size="sm">{modelData.length} models</Badge>}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" padding="lg">
              <CardHeader>
                <CardTitle><Cpu size={14} className="text-emerald-400" /> Tokens per model</CardTitle>
              </CardHeader>
              <div className="w-full" style={{ height: Math.max(280, modelData.length * 32 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => compact(v)} {...AXIS} />
                    <YAxis
                      type="category" dataKey="name" width={210} interval={0}
                      tick={{ fill: "var(--tt-fg-muted)", fontSize: 11 }}
                      tickLine={false} axisLine={false}
                    />
                    <Tooltip
                      contentStyle={ct.tooltipStyle}
                      itemStyle={ct.tooltipItem}
                      cursor={{ fill: ct.grid }}
                      formatter={(v: any) => [v.toLocaleString(), "Tokens"]}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={16}>
                      {modelData.map((m) => <Cell key={m.name} fill={m.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card padding="lg" className="flex flex-col min-h-0">
              <CardHeader>
                <CardTitle><Cpu size={14} className="text-emerald-400" /> Model share</CardTitle>
                <CardEyebrow>{modelData.length} models</CardEyebrow>
              </CardHeader>
              <div className="h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={modelData} innerRadius={40} outerRadius={64} paddingAngle={2} dataKey="total" stroke="none">
                      {modelData.map((m) => <Cell key={m.name} fill={m.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={ct.tooltipStyle}
                      itemStyle={ct.tooltipItem}
                      formatter={(v: any, _n, p: any) => [v.toLocaleString(), p.payload.name]}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                {modelData.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      <span className="font-mono text-[var(--tt-fg)] truncate" title={m.name}>{m.name}</span>
                    </span>
                    <span className="tabular text-[var(--tt-fg-dim)] whitespace-nowrap">
                      {pct(m.total, data.total.total)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--tt-border)] flex items-center justify-between">
              <CardTitle>Per-model breakdown</CardTitle>
              <CardEyebrow>{modelData.length} models</CardEyebrow>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="pl-5">Model</TH>
                    <TH>Agent</TH>
                    <TH className="text-right">Sessions</TH>
                    <TH className="text-right">Input</TH>
                    <TH className="text-right">Output</TH>
                    <TH className="text-right">Cached</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right pr-5 text-amber-300">API equiv.</TH>
                  </TR>
                </THead>
                <TBody>
                  {modelData.map((m) => (
                    <TR key={m.name} interactive>
                      <TD className="pl-5">
                        <span className="flex items-center gap-2 font-mono text-[12px] text-[var(--tt-fg)]">
                          <Cpu size={12} className="text-emerald-400" /> {m.name}
                        </span>
                      </TD>
                      <TD><AgentBadge agent={m.agent} /></TD>
                      <TD className="text-right tabular text-[var(--tt-fg-muted)]">{m.session_count}</TD>
                      <TD className="text-right tabular text-[var(--tt-fg-muted)]">{m.input.toLocaleString()}</TD>
                      <TD className="text-right tabular text-[var(--tt-fg-muted)]">{m.output.toLocaleString()}</TD>
                      <TD className="text-right tabular text-cyan-300/80">{m.cached.toLocaleString()}</TD>
                      <TD className="text-right tabular font-semibold text-[var(--tt-fg)]">{m.total.toLocaleString()}</TD>
                      <TD className="text-right pr-5 tabular font-semibold text-amber-300">${m.cost.toFixed(2)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </Section>
      )}

      <EcosystemSection data={data} />
    </div>
  );
}

/* Delegation + skills + MCP usage — which capabilities actually earn their keep.
   Only agents whose logs record these signals contribute; the section hides
   itself entirely when there's nothing to show (no fake zeros). */
function EcosystemSection({ data }: { data: AnalyticsData }) {
  const subagentTypes = Object.entries(data.by_subagent_type || {})
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.cost - a.cost);
  const skills = Object.entries(data.by_skill || {})
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.invocations - a.invocations);
  const mcpServers = Object.entries(data.by_mcp_server || {})
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.calls - a.calls);
  const deleg = data.delegation;
  if (subagentTypes.length === 0 && skills.length === 0 && mcpServers.length === 0) return null;

  return (
    <Section
      title="Delegation & ecosystem"
      description="Subagents your sessions spawned, skills you invoked, and MCP servers you actually used — recorded only where the agent's logs carry the signal (Claude Code is the richest source)."
    >
      {deleg && deleg.sessions_with_spawns > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label="Delegated tokens"
            value={compact(deleg.delegated_tokens)}
            hint="Claude subagent transcripts — on top of session totals"
            icon={<GitBranch size={16} />}
            accent="var(--tt-brand)"
          />
          <StatTile
            label="Delegated cost"
            value={`$${deleg.delegated_cost.toFixed(2)}`}
            hint="Priced per subagent's own model"
            icon={<DollarSign size={16} />}
            accent="var(--tt-warn)"
          />
          <StatTile
            label="Sessions that delegated"
            value={String(deleg.sessions_with_spawns)}
            hint="Across Claude, Grok, Codex, Antigravity, OpenCode & Hermes"
            icon={<Cpu size={16} />}
            accent="var(--tt-success)"
          />
          <StatTile
            label="Spawned child sessions"
            value={String(deleg.linked_children ?? 0)}
            hint={`${compact(deleg.linked_child_tokens ?? 0)} tokens · $${(deleg.linked_child_cost ?? 0).toFixed(2)} — already in session totals`}
            icon={<GitBranch size={16} />}
            accent="var(--tt-info)"
          />
        </div>
      )}

      {/* Per-agent delegation: who spawns, and what their children consume */}
      {deleg?.by_agent && Object.keys(deleg.by_agent).length > 0 && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle><GitBranch size={14} className="text-[var(--tt-brand)]" /> Delegation by agent</CardTitle>
            <CardEyebrow>{Object.keys(deleg.by_agent).length} agents</CardEyebrow>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {Object.entries(deleg.by_agent)
              .sort((a, b) => (b[1].delegated_cost + b[1].child_cost) - (a[1].delegated_cost + a[1].child_cost))
              .map(([agent, a]) => (
                <div key={agent} className="flex items-center justify-between gap-2 text-[11px] py-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <AgentBadge agent={agent} />
                    <span className="text-[var(--tt-fg-dim)] whitespace-nowrap">
                      {a.parents} session{a.parents === 1 ? "" : "s"} · {a.spawns} spawn{a.spawns === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="tabular text-right whitespace-nowrap">
                    {a.delegated_tokens > 0 ? (
                      <span className="text-amber-300 font-semibold">+{compact(a.delegated_tokens)} · ${a.delegated_cost.toFixed(2)}</span>
                    ) : a.children > 0 ? (
                      <span className="text-[var(--tt-fg-muted)]">{compact(a.child_tokens)} in children · ${a.child_cost.toFixed(2)}</span>
                    ) : (
                      <span className="text-[var(--tt-fg-dim)]">tokens n/a</span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {subagentTypes.length > 0 && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle><GitBranch size={14} className="text-[var(--tt-brand)]" /> Subagent types</CardTitle>
              <CardEyebrow>by cost</CardEyebrow>
            </CardHeader>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {subagentTypes.map((t) => (
                <li key={t.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 flex flex-col">
                    <span className="font-mono text-[var(--tt-fg)] truncate" title={t.name}>{t.name}</span>
                    <span className="text-[var(--tt-fg-dim)]">
                      {t.spawns} spawn{t.spawns === 1 ? "" : "s"}
                      {t.agents && t.agents.length > 0 && <> · {t.agents.join(", ")}</>}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    {t.tokens_recorded !== false && (t.tokens > 0 || t.cost > 0) ? (
                      <>
                        <span className="block tabular font-semibold text-amber-300">${t.cost.toFixed(2)}</span>
                        <span className="block tabular text-[var(--tt-fg-dim)]">{compact(t.tokens)} tok</span>
                      </>
                    ) : (
                      <span className="block tabular text-[var(--tt-fg-dim)]">tokens n/a</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {skills.length > 0 && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle><Zap size={14} className="text-[var(--tt-success)]" /> Skills used</CardTitle>
              <CardEyebrow>{skills.length} skills</CardEyebrow>
            </CardHeader>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {skills.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0">
                    <span className="font-mono text-[var(--tt-fg)] truncate block" title={s.name}>/{s.name}</span>
                    {s.agents && s.agents.length > 0 && (
                      <span className="text-[10px] text-[var(--tt-fg-dim)]">{s.agents.join(", ")}</span>
                    )}
                  </span>
                  <span className="tabular text-[var(--tt-fg-dim)] whitespace-nowrap shrink-0">
                    ×{s.invocations} · {s.session_count} session{s.session_count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {mcpServers.length > 0 && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle><Cpu size={14} className="text-cyan-300" /> MCP servers</CardTitle>
              <CardEyebrow>by calls</CardEyebrow>
            </CardHeader>
            <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {mcpServers.map((m) => {
                const topTools = Object.entries(m.tools).sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <li key={m.name} className="text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[var(--tt-fg)] truncate" title={m.name}>{m.name}</span>
                      <span className="tabular text-[var(--tt-fg-dim)] whitespace-nowrap">
                        {m.calls} calls · {m.session_count} session{m.session_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--tt-fg-dim)] truncate">
                      {m.agents && m.agents.length > 0 && <span className="text-[var(--tt-fg-muted)]">{m.agents.join(", ")} · </span>}
                      {topTools.map(([tool, n]) => `${tool} ×${n}`).join(" · ")}
                      {Object.keys(m.tools).length > 3 && ` · +${Object.keys(m.tools).length - 3} more`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </Section>
  );
}

function AnalyticsLoading() {
  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto space-y-10">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function pct(part: number, whole: number) {
  return ((part / Math.max(1, whole)) * 100).toFixed(1);
}

// `compact` lives in @/lib/format (formatTokens) — see import at top of file.
