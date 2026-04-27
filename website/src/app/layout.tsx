import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenTelemetry — See exactly what your AI agents cost, think, and do",
  description:
    "Local, read-only observability for Claude, Codex, Gemini, Cursor, Copilot, and 4 more coding agents. Tokens, traces, cost — one command, no signup.",
  openGraph: {
    title: "TokenTelemetry",
    description:
      "Local observability for 9 coding agents. See cost, reasoning, tool calls.",
    url: "https://tokentelemetry.com",
    siteName: "TokenTelemetry",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
