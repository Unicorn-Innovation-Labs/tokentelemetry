"use client";

import { Fragment, useMemo, useState } from "react";
import { Sparkles, Activity, Flame, Clock4, Wrench } from "lucide-react";

import { getAgent } from "@/lib/agents";
import { cn } from "@/lib/cn";
import {
  Card, CardHeader, CardTitle, StatTile, EmptyState,
} from "@/components/ui";
import { useProject } from "../_lib/project-context";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InsightsTab() {
  const { sessions } = useProject();
  const [heatMetric, setHeatMetric] = useState<"sessions" | "tokens">("sessions");

  const insights = useMemo(() => {
    const DAYS = 365;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (DAYS - 1));
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    type DayBucket = { date: string; count: number; tokens: number; byAgent: Record<string, number> };
    const daily: Record<string, DayBucket> = {};
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      daily[dayKey(d)] = { date: dayKey(d), count: 0, tokens: 0, byAgent: {} };
    }

    const agentStats: Record<string, { count: number; tokens: number; firstSeen: number; lastSeen: number }> = {};
    const toolCounts: Record<string, { sessions: number; byAgent: Record<string, number> }> = {};
    const hourly: number[] = Array(24).fill(0);
    const activeDays = new Set<string>();
    const dowHour: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const perAgentDaily: Record<string, Record<string, { count: number; tokens: number }>> = {};
    const seedAgentDaily = (a: string) => {
      if (perAgentDaily[a]) return;
      perAgentDaily[a] = {};
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(start); d.setDate(d.getDate() + i);
        perAgentDaily[a][dayKey(d)] = { count: 0, tokens: 0 };
      }
    };

    for (const s of sessions) {
      const ts = new Date(s.timestamp); if (isNaN(ts.getTime())) continue;
      const tsMs = ts.getTime();
      const k = dayKey(new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()));
      const tok = s.tokens?.total || 0;
      if (daily[k]) {
        daily[k].count += 1; daily[k].tokens += tok;
        daily[k].byAgent[s.agent] = (daily[k].byAgent[s.agent] || 0) + 1;
      }
      activeDays.add(k);
      hourly[ts.getHours()] += 1;
      dowHour[ts.getDay()][ts.getHours()] += 1;

      seedAgentDaily(s.agent);
      if (perAgentDaily[s.agent][k]) {
        perAgentDaily[s.agent][k].count += 1;
        perAgentDaily[s.agent][k].tokens += tok;
      }

      const as = agentStats[s.agent] ||= { count: 0, tokens: 0, firstSeen: tsMs, lastSeen: tsMs };
      as.count += 1; as.tokens += tok;
      as.firstSeen = Math.min(as.firstSeen, tsMs); as.lastSeen = Math.max(as.lastSeen, tsMs);

      const seenTools = new Set<string>();
      for (const t of s.mcp_tools || []) {
        if (!t || seenTools.has(t)) continue;
        seenTools.add(t);
        const tc = toolCounts[t] ||= { sessions: 0, byAgent: {} };
        tc.sessions += 1; tc.byAgent[s.agent] = (tc.byAgent[s.agent] || 0) + 1;
      }
    }

    const dailyArr = Object.values(daily);
    const agents = Object.entries(agentStats).sort((a, b) => b[1].tokens - a[1].tokens);
    const topTokens = Math.max(1, ...agents.map(([, a]) => a.tokens));
    const tools = Object.entries(toolCounts).sort((a, b) => b[1].sessions - a[1].sessions);
    const topToolCount = Math.max(1, ...tools.map(([, t]) => t.sessions));

    let current = 0;
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      if (activeDays.has(dayKey(d))) current++;
      else break;
    }
    let longest = 0, run = 0;
    for (const d of dailyArr) { if (d.count > 0) { run++; longest = Math.max(longest, run); } else run = 0; }

    const perAgent = agents.map(([a, s]) => {
      const arr = Object.values(perAgentDaily[a] || {}) as { count: number; tokens: number }[];
      const max = Math.max(1, ...arr.map(x => x.count));
      const maxTok = Math.max(1, ...arr.map(x => x.tokens));
      return { agent: a, stats: s, arr, max, maxTok };
    });

    const maxDowHour = Math.max(1, ...dowHour.flat());

    return {
      dailyArr, start, today, agents, topTokens, tools, topToolCount,
      hourly, current, longest, perAgent, dowHour, maxDowHour,
    };
  }, [sessions]);

  const totalTokens = insights.agents.reduce((a, [, x]) => a + x.tokens, 0);
  const totalSessions = insights.agents.reduce((a, [, x]) => a + x.count, 0);

  if (sessions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Sparkles size={20} />}
          title="No insights yet"
          description="Insights compute from session activity over the last year — once data lands, this tab populates automatically."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Streaks + tallies */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Current streak" value={`${insights.current}d`} icon={<Flame size={16} />} accent="var(--tt-success)" />
        <StatTile label="Longest streak" value={`${insights.longest}d`} icon={<Flame size={16} />} accent="var(--tt-warn)" />
        <StatTile label="Total sessions" value={fmtNum(totalSessions)} icon={<Activity size={16} />} accent="var(--tt-brand)" />
        <StatTile label="Total tokens" value={totalTokens.toLocaleString()} icon={<Sparkles size={16} />} accent="#a855f7" />
      </div>

      {/* Combined activity heatmap */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle><Activity size={14} className="text-[var(--tt-brand)]" /> Activity heatmap</CardTitle>
            <p className="text-[11px] text-[var(--tt-fg-dim)] mt-0.5">
              Last 365 days. Each cell colored by the dominant agent that day, intensity by {heatMetric}.
            </p>
          </div>
          <div className="flex items-center rounded-[var(--tt-radius)] border border-[var(--tt-border)] bg-[var(--tt-panel)] overflow-hidden">
            {(["sessions", "tokens"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setHeatMetric(m)}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
                  heatMetric === m
                    ? "text-[var(--tt-fg)] tt-tint-2"
                    : "text-[var(--tt-fg-muted)] hover:text-[var(--tt-fg)]",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </CardHeader>

        <CombinedHeatmap
          dailyArr={insights.dailyArr}
          start={insights.start}
          metric={heatMetric}
        />

        {/* Per-agent compact sparkline strip */}
        {insights.perAgent.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[var(--tt-border)] space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--tt-fg-dim)] mb-2">
              Per-agent activity
            </div>
            {insights.perAgent.map(({ agent, stats, arr, max, maxTok }) => {
              const meta = getAgent(agent);
              const denom = heatMetric === "sessions" ? max : maxTok;
              return (
                <div key={agent} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded shrink-0" style={{ backgroundColor: meta.hex }} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] truncate" style={{ color: meta.hex }}>
                      {meta.label}
                    </span>
                  </div>
                  <Sparkline
                    arr={arr}
                    metric={heatMetric}
                    denom={denom}
                    color={meta.hex}
                  />
                  <span className="tabular text-[10px] text-[var(--tt-fg-dim)] whitespace-nowrap">
                    {stats.count} sess · {fmtNum(stats.tokens)} tok
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Leaderboard + migration ribbon */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle><Activity size={14} className="text-[var(--tt-brand)]" /> Agent leaderboard</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {insights.agents.map(([a, s]) => {
            const meta = getAgent(a);
            const pct = (s.tokens / (insights.topTokens || 1)) * 100;
            return (
              <div key={a} className="grid grid-cols-[80px_1fr_auto] items-center gap-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: meta.hex }}>
                  {meta.label}
                </span>
                <div className="h-1.5 rounded-full tt-tint-1 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: meta.hex }} />
                </div>
                <span className="tabular text-[10px] text-[var(--tt-fg-dim)] whitespace-nowrap">
                  {s.count} sess · {fmtNum(s.tokens)} tok
                </span>
              </div>
            );
          })}
        </div>

        {insights.agents.length > 1 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--tt-fg-dim)] mt-7 mb-3">
              Agent migration · last 365 days
            </div>
            <MigrationRibbon agents={insights.agents} start={insights.start} today={insights.today} />
          </>
        )}
      </Card>

      {/* Tools + day-of-week / hour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padding="lg">
          <CardHeader>
            <CardTitle><Wrench size={14} className="text-emerald-400" /> Tools & MCPs used</CardTitle>
          </CardHeader>
          {insights.tools.length === 0 ? (
            <div className="text-[12px] text-[var(--tt-fg-dim)] italic py-4">No tool invocations recorded.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {insights.tools.slice(0, 30).map(([t, info]) => {
                const top = Object.entries(info.byAgent).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];
                const meta = getAgent(top);
                return (
                  <div key={t} className="grid grid-cols-[150px_1fr_auto] items-center gap-3">
                    <span className="font-mono text-[11px] text-[var(--tt-fg)] truncate" title={t}>{t}</span>
                    <div className="h-1.5 rounded-full tt-tint-1 overflow-hidden">
                      <div
                        className="h-full transition-[width] duration-500"
                        style={{ width: `${(info.sessions / insights.topToolCount) * 100}%`, backgroundColor: meta.hex }}
                      />
                    </div>
                    <span className="tabular text-[10px] text-[var(--tt-fg-dim)] whitespace-nowrap">{info.sessions}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle><Clock4 size={14} className="text-[var(--tt-brand)]" /> When you work</CardTitle>
          </CardHeader>
          <p className="text-[11px] text-[var(--tt-fg-dim)] mb-4">Session starts by day-of-week × hour (local time).</p>
          <div className="grid grid-cols-[44px_1fr] gap-2 items-center">
            <div />
            <div className="grid gap-[2px] text-[8px] font-mono text-[var(--tt-fg-faint)] mb-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center">{h % 2 === 0 ? h : ""}</div>
              ))}
            </div>
            {DOW_LABELS.map((label, d) => (
              <Fragment key={d}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--tt-fg-dim)] pr-2 text-right">
                  {label}
                </div>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                  {insights.dowHour[d].map((v, h) => {
                    const intensity = v > 0 ? Math.max(0.18, v / insights.maxDowHour) : 0;
                    return (
                      <div
                        key={h}
                        title={`${label} ${h.toString().padStart(2, "0")}:00 — ${v} sessions`}
                        className="aspect-square rounded-[2px] hover:ring-1 hover:ring-white/30"
                        style={{
                          backgroundColor: intensity > 0 ? hexWithAlpha("#60a5fa", intensity) : "var(--tt-empty-cell)",
                        }}
                      />
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-5 text-[10px] text-[var(--tt-fg-dim)]">
            <span className="italic opacity-60">quiet</span>
            <span className="flex gap-[1px]">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(x => (
                <span
                  key={x}
                  className="w-3 h-3 rounded-[2px]"
                  style={{ backgroundColor: x === 0 ? "var(--tt-empty-cell)" : hexWithAlpha("#60a5fa", x) }}
                />
              ))}
            </span>
            <span className="italic opacity-60">busy</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MigrationRibbon({
  agents, start, today,
}: { agents: [string, { firstSeen: number; lastSeen: number; count: number; tokens: number }][]; start: Date; today: Date }) {
  const span = Math.max(1, today.getTime() - start.getTime());
  return (
    <div className="space-y-2">
      {agents.map(([a, s]) => {
        const meta = getAgent(a);
        const firstPct = Math.max(0, ((s.firstSeen - start.getTime()) / span) * 100);
        const lastPct  = Math.min(100, ((s.lastSeen  - start.getTime()) / span) * 100);
        const width = Math.max(1, lastPct - firstPct);
        return (
          <div key={a} className="grid grid-cols-[80px_1fr] items-center gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: meta.hex }}>{meta.label}</span>
            <div className="relative h-3 rounded-full tt-tint-1 overflow-hidden">
              <div className="absolute top-0 h-full rounded-full" style={{ left: `${firstPct}%`, width: `${width}%`, backgroundColor: meta.hex, opacity: 0.85 }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" style={{ left: `calc(${firstPct}% - 3px)` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" style={{ left: `calc(${lastPct}% - 3px)` }} />
            </div>
          </div>
        );
      })}
      <div className="grid grid-cols-[80px_1fr] items-center gap-4 pt-1">
        <span />
        <div className="flex justify-between text-[9px] font-mono text-[var(--tt-fg-faint)]">
          <span>{start.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <span>today</span>
        </div>
      </div>
    </div>
  );
}

type DayBucket = { date: string; count: number; tokens: number; byAgent: Record<string, number> };

function CombinedHeatmap({
  dailyArr, start, metric,
}: { dailyArr: DayBucket[]; start: Date; metric: "sessions" | "tokens" }) {
  const weeks: (DayBucket | null)[][] = [];
  let cur: (DayBucket | null)[] = [];
  const offset = new Date(start).getDay();
  for (let i = 0; i < offset; i++) cur.push(null);
  for (const d of dailyArr) {
    cur.push(d);
    if (cur.length === 7) { weeks.push(cur); cur = []; }
  }
  if (cur.length) {
    while (cur.length < 7) cur.push(null);
    weeks.push(cur);
  }

  const denom = Math.max(
    1,
    ...dailyArr.map((d) => (metric === "sessions" ? d.count : d.tokens)),
  );

  // Month labels: column index of first week of each month
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const firstReal = wk.find((d) => d) as DayBucket | undefined;
    if (!firstReal) return;
    const m = new Date(firstReal.date + "T00:00").getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: wi, label: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m] });
      lastMonth = m;
    }
  });

  const dowLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block">
        {/* Month label row */}
        <div className="grid gap-[3px] mb-1.5 ml-[28px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}>
          {weeks.map((_, wi) => {
            const lbl = monthLabels.find((m) => m.col === wi);
            return (
              <div key={wi} className="text-[9px] font-mono text-[var(--tt-fg-faint)] uppercase tracking-[0.1em] h-3">
                {lbl?.label ?? ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          {/* DOW labels */}
          <div className="flex flex-col gap-[3px] pt-[1px]">
            {dowLabels.map((l, i) => (
              <div key={i} className="h-[12px] text-[9px] font-mono text-[var(--tt-fg-faint)] flex items-center">
                {l}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((wk, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {wk.map((d, di) => {
                  if (!d) return <div key={di} className="w-[12px] h-[12px]" />;
                  const val = metric === "sessions" ? d.count : d.tokens;
                  const intensity = val > 0 ? Math.max(0.22, val / denom) : 0;
                  const top = Object.entries(d.byAgent).sort((a, b) => b[1] - a[1])[0]?.[0];
                  const hex = top ? getAgent(top).hex : "#60a5fa";
                  return (
                    <div
                      key={di}
                      title={d ? `${d.date} · ${d.count} sessions · ${fmtNum(d.tokens)} tokens` : ""}
                      className="w-[12px] h-[12px] rounded-[3px] transition-colors"
                      style={{
                        backgroundColor: intensity > 0 ? hexWithAlpha(hex, intensity) : "var(--tt-empty-cell)",
                        outline: intensity > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-[var(--tt-fg-dim)]">
          <span className="italic opacity-60">less</span>
          <span className="flex gap-[2px]">
            {[0, 0.25, 0.5, 0.75, 1].map((x) => (
              <span
                key={x}
                className="w-[12px] h-[12px] rounded-[3px]"
                style={{ backgroundColor: x === 0 ? "var(--tt-empty-cell)" : hexWithAlpha("#60a5fa", x) }}
              />
            ))}
          </span>
          <span className="italic opacity-60">more</span>
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  arr, metric, denom, color,
}: { arr: { count: number; tokens: number }[]; metric: "sessions" | "tokens"; denom: number; color: string }) {
  const W = 100;
  const H = 22;
  const n = arr.length;
  if (n === 0) return <div className="h-[22px]" />;
  const step = W / Math.max(1, n - 1);
  const pts = arr
    .map((d, i) => {
      const v = metric === "sessions" ? d.count : d.tokens;
      const y = H - (v / (denom || 1)) * (H - 2) - 1;
      return `${(i * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-[22px] block"
      aria-hidden
    >
      <polyline
        points={`0,${H} ${pts} ${W},${H}`}
        fill={hexWithAlpha(color, 0.18)}
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
