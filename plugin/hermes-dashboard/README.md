# TokenTelemetry — Hermes Dashboard Plugin

A thin launcher for [TokenTelemetry](https://github.com/VasiHemanth/tokentelemetry) inside the [Hermes Agent](https://github.com/NousResearch/hermes-agent) web dashboard (port `9119`).

Instead of remembering a second port, click the **TokenTelemetry** tab inside Hermes Dashboard and launch any TT page in a new browser tab — Hermes Overview, Skills, Memory, Analytics, Projects.

## Install

From this repo root:

```bash
./scripts/install-hermes-plugin.sh
```

Or manually:

```bash
mkdir -p ~/.hermes/plugins/tokentelemetry
ln -s "$(pwd)/plugin/hermes-dashboard" ~/.hermes/plugins/tokentelemetry/dashboard
```

Then start (or restart) the dashboard:

```bash
hermes dashboard
```

Open `http://127.0.0.1:9119`, click **TokenTelemetry** in the sidebar. If TT isn't running, you'll see start-up instructions; once it's up, the launcher lights up with six deep-link cards.

## What it does

- Registers a nav tab in Hermes Dashboard (position: `after:analytics`)
- Probes your local TokenTelemetry instance (default `http://localhost:3000`) and shows a reachability pill
- Six launcher cards that open TT in a new tab at the right page
- Inline base-URL editor (persists to `localStorage`) for non-default deployments
- Pure frontend — no backend routes, no `plugin_api.py`, no network access beyond your local TT

## File layout

```
plugin/hermes-dashboard/
├── manifest.json        # nav tab + icon + position
├── dist/
│   ├── index.js         # IIFE launcher (uses window.__HERMES_PLUGIN_SDK__)
│   └── style.css        # optional, minimal
└── README.md            # this file
```

## Uninstall

```bash
rm -rf ~/.hermes/plugins/tokentelemetry
hermes dashboard --stop && hermes dashboard
```
