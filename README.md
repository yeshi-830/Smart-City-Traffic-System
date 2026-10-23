# FlowCity Traffic Operations

FlowCity is a responsive, full-stack traffic operations MVP for prioritizing intersection bottlenecks, recording incidents, and coordinating operator-controlled signal plans. It ships with clearly labelled **simulated** traffic readings and sample city locations; it does not connect to real sensors, emergency services, a city map provider, or live weather services.

## Features

- Responsive traffic command-center dashboard with city map, performance chart, and corridor summary.
- Eight sample intersections with simulated speed, congestion, queue, and signal-phase readings.
- Persistent SQLite storage for signal-control settings and incidents.
- Incident reporting, severity-based response queue, and open → investigating → resolved workflow.
- Operator-controlled adaptive/fixed signal modes, persisted between restarts.
- 30-second dashboard refresh, search, accessible controls, and inline API error feedback.
- Focused tests for traffic reading bounds and trend output.

## Requirements

- Node.js 22.5 or newer (`node:sqlite` is used for the built-in SQLite driver).
- npm.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The Express API runs at `http://localhost:4000`, and Vite proxies `/api` requests to it. The SQLite database is created at `data/traffic.sqlite` on the first run.

On PowerShell, if the `npm` script is blocked by the execution policy, use `npm.cmd install` and `npm.cmd run dev`.

## Production build

```sh
npm run build
npm start
```

The Express server serves the compiled client and API on port `4000`. Set `PORT` to change the HTTP port or `TRAFFIC_DB_PATH` to choose a different SQLite file.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check and data-mode indicator |
| `GET` | `/api/dashboard` | Summary, intersection readings, incident queue, and traffic trend |
| `GET` | `/api/intersections` | Monitored intersections and their latest simulated readings |
| `POST` | `/api/intersections/:id/optimize` | Toggle an intersection between adaptive and fixed signal modes |
| `GET` | `/api/incidents` | List saved incidents |
| `POST` | `/api/incidents` | Report an incident (`location`, `type`, `severity`, optional `intersectionId` and `description`) |
| `PATCH` | `/api/incidents/:id/status` | Change an incident to `open`, `investigating`, or `resolved` |

## Bringing the system online with real data

Replace `server/traffic.ts`'s simulation with normalized observations from an authorized traffic-sensor feed, validate freshness and units at the ingestion boundary, and expose sensor connectivity/quality alongside each reading. Production signal control also needs authenticated, role-based operator access, an auditable approval/safety policy, vendor-specific controller integration, and fail-safe behavior when connectivity or sensor quality is lost. The included signal-mode action is a persisted demo control, not a command to physical signals.
