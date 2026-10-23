import express from "express";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  addIncident,
  countActiveIncidents,
  getIncident,
  getIntersection,
  listIncidents,
  listIntersections,
  updateIncidentStatus,
  updateSignalMode,
  type IncidentSeverity,
  type IncidentStatus,
} from "./database.js";
import { buildTrafficTrend, getTrafficReading } from "./traffic.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", dataMode: "simulated", timestamp: new Date().toISOString() });
});

app.get("/api/dashboard", (_request, response) => {
  const intersections = listIntersections();
  const readings = intersections.map((intersection) => ({
    ...intersection,
    ...getTrafficReading(intersection),
  }));
  const incidents = listIncidents();
  const averageSpeed = Math.round(readings.reduce((total, item) => total + item.speed, 0) / readings.length);
  const severeCount = readings.filter((item) => item.congestion === "Severe").length;

  response.json({
    summary: {
      monitoredIntersections: readings.length,
      averageSpeed,
      activeIncidents: countActiveIncidents(),
      adaptiveSignals: intersections.filter((item) => item.mode === "adaptive").length,
      congestionIndex: Math.round((1 - averageSpeed / 50) * 100),
      severeCongestion: severeCount,
    },
    intersections: readings,
    incidents: incidents.slice(0, 8),
    trend: buildTrafficTrend(),
    updatedAt: new Date().toISOString(),
    dataMode: "simulated",
  });
});

app.get("/api/intersections", (_request, response) => {
  response.json(listIntersections().map((intersection) => ({
    ...intersection,
    ...getTrafficReading(intersection),
  })));
});

app.post("/api/intersections/:id/optimize", (request, response) => {
  const intersection = getIntersection(request.params.id);
  if (!intersection) {
    response.status(404).json({ error: "Intersection not found." });
    return;
  }
  const updated = updateSignalMode(intersection.id, intersection.mode === "adaptive" ? "fixed" : "adaptive");
  response.json(updated);
});

app.get("/api/incidents", (_request, response) => {
  response.json(listIncidents());
});

app.post("/api/incidents", (request, response) => {
  const body: unknown = request.body;
  if (!body || typeof body !== "object") {
    response.status(400).json({ error: "A JSON incident payload is required." });
    return;
  }

  const input = body as Record<string, unknown>;
  const validSeverities: IncidentSeverity[] = ["low", "medium", "high", "critical"];
  const location = typeof input.location === "string" ? input.location.trim() : "";
  const type = typeof input.type === "string" ? input.type.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const intersectionId = input.intersectionId === null || input.intersectionId === ""
    ? null
    : typeof input.intersectionId === "string" ? input.intersectionId : undefined;

  if (!location || location.length > 120 || !type || type.length > 80) {
    response.status(400).json({ error: "Location (1–120 characters) and incident type (1–80 characters) are required." });
    return;
  }
  if (!validSeverities.includes(input.severity as IncidentSeverity)) {
    response.status(400).json({ error: "Choose a valid incident severity." });
    return;
  }
  if (description.length > 500) {
    response.status(400).json({ error: "Description must be 500 characters or fewer." });
    return;
  }
  if (intersectionId === undefined || (intersectionId && !getIntersection(intersectionId))) {
    response.status(400).json({ error: "Choose a valid monitored intersection or enter an unmonitored location." });
    return;
  }

  const incident = addIncident({
    intersectionId,
    location,
    type,
    severity: input.severity as IncidentSeverity,
    status: "open",
    description,
  });
  response.status(201).json(incident);
});

app.patch("/api/incidents/:id/status", (request, response) => {
  const id = Number(request.params.id);
  const status = request.body?.status as IncidentStatus;
  const validStatuses: IncidentStatus[] = ["open", "investigating", "resolved"];

  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: "A valid incident ID is required." });
    return;
  }
  if (!validStatuses.includes(status)) {
    response.status(400).json({ error: "Choose open, investigating, or resolved." });
    return;
  }
  if (!updateIncidentStatus(id, status)) {
    response.status(404).json({ error: "Incident not found." });
    return;
  }

  response.json(getIncident(id));
});

const builtFrontend = resolve("dist/client");
if (existsSync(join(builtFrontend, "index.html"))) {
  app.use(express.static(builtFrontend));
  app.get("/{*path}", (_request, response) => response.sendFile(join(builtFrontend, "index.html")));
}

app.listen(port, () => {
  console.log(`FlowCity API listening on http://localhost:${port}`);
});
