export type Feature = {
  id: string;
  label: string;
  headline: string;
  bullets: string[];
  screenshot: string; // /screenshots/<id>.png
};

export const FEATURES: Feature[] = [
  {
    id: "cost",
    label: "Cost",
    headline: "Per-model pricing, not flat-rate guesswork.",
    bullets: [
      "Input, output, and cached-read tiers split for every model — Opus, Sonnet, GPT-5, Gemini 3, GLM, Devstral.",
      "Cache efficiency surfaced as a real saving, not a vanity metric.",
      "Daily / weekly / monthly burn rate. See a $4 session before it becomes a $400 month.",
    ],
    screenshot: "/screenshots/cost.png",
  },
  {
    id: "traces",
    label: "Traces",
    headline: "Every prompt, tool call, and reasoning block — replayable.",
    bullets: [
      "Step-by-step playback with kind-aware highlighting (reasoning amber, tools sky, response emerald).",
      "Tool calls paired with their results and timing, surfaced as a waterfall.",
      "Encrypted reasoning (Claude extended thinking) labeled honestly — no fake content.",
    ],
    screenshot: "/screenshots/traces.png",
  },
  {
    id: "analytics",
    label: "Analytics",
    headline: "Tokens by agent, by model, by day.",
    bullets: [
      "Stacked daily area chart shows where your budget is actually going.",
      "Model leaderboard ranked by usage, cost, and cache hit rate.",
      "All math local. No data leaves your machine.",
    ],
    screenshot: "/screenshots/analytics.png",
  },
  {
    id: "projects",
    label: "Projects",
    headline: "One card per working directory.",
    bullets: [
      "Aliases collapse renamed folders into one project.",
      "Per-project plans library — every plan-mode output, searchable.",
      "Configuration tab: MCP servers, subagents, skills, slash commands.",
    ],
    screenshot: "/screenshots/projects.png",
  },
  {
    id: "artifacts",
    label: "Artifacts",
    headline: "Screenshots, browser recordings, generated docs.",
    bullets: [
      "Antigravity browser_recordings sampled into thumbnail strips.",
      "Inline image and video viewer — no copy-paste to find a screenshot.",
      "Document artifacts (task.md, plan.md, walkthrough.md) viewable in-browser.",
    ],
    screenshot: "/screenshots/artifacts.png",
  },
];
