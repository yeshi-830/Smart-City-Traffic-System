
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type SignalMode = "adaptive" | "fixed";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Intersection {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  dailyVehicles: number;
  mode: SignalMode;
}

export interface Incident {
  id: number;
  intersectionId: string | null;
  location: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  reportedAt: string;
}

const seedIntersections: Omit<Intersection, "mode">[] = [
  { id: "j-01", name: "Central & 5th", district: "Downtown", latitude: 0.48, longitude: 0.39, dailyVehicles: 28400 },
  { id: "j-02", name: "Market & Pine", district: "Downtown", latitude: 0.64, longitude: 0.27, dailyVehicles: 21900 },
  { id: "j-03", name: "Riverside & 8th", district: "Riverside", latitude: 0.32, longitude: 0.55, dailyVehicles: 17200 },
  { id: "j-04", name: "Union & Grand", district: "Civic Center", latitude: 0.77, longitude: 0.47, dailyVehicles: 24100 },
  { id: "j-05", name: "Parkway & 12th", district: "West End", latitude: 0.19, longitude: 0.3, dailyVehicles: 14600 },
  { id: "j-06", name: "Harbor & Bay", district: "Waterfront", latitude: 0.49, longitude: 0.7, dailyVehicles: 19800 },
  { id: "j-07", name: "Oak & University", district: "University", latitude: 0.82, longitude: 0.69, dailyVehicles: 16600 },
  { id: "j-08", name: "Broadway & Elm", district: "Midtown", latitude: 0.36, longitude: 0.23, dailyVehicles: 23100 },
];

const databasePath = resolve(
  process.env.TRAFFIC_DB_PATH ?? "data/traffic.sqlite",
);

mkdirSync(dirname(databasePath), { recursive: true });
export const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS intersections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    daily_vehicles INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'adaptive'
      CHECK (mode IN ('adaptive', 'fixed'))
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intersection_id TEXT REFERENCES intersections(id),
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL
      CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open', 'investigating', 'resolved')),
    description TEXT NOT NULL DEFAULT '',
    reported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS traffic_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intersection_id TEXT NOT NULL REFERENCES intersections(id),
    vehicles_per_hour INTEGER NOT NULL,
    speed REAL NOT NULL,
    congestion TEXT NOT NULL
      CHECK (congestion IN ('Clear', 'Moderate', 'Heavy', 'Severe')),
    signal_phase TEXT NOT NULL
      CHECK (signal_phase IN ('Green', 'Yellow', 'Red')),
    wait_seconds INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS incidents_status_severity_reported_at
    ON incidents (status, severity, reported_at DESC);
  CREATE INDEX IF NOT EXISTS traffic_history_intersection_recorded_at
    ON traffic_history (intersection_id, recorded_at DESC, id DESC);
`);

const seedIntersection = database.prepare(`
  INSERT OR IGNORE INTO intersections
    (id, name, district, latitude, longitude, daily_vehicles)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const intersection of seedIntersections) {
  seedIntersection.run(
    intersection.id,
    intersection.name,
    intersection.district,
    intersection.latitude,
    intersection.longitude,
    intersection.dailyVehicles,
  );
}

const incidentCount = database.prepare(
  "SELECT COUNT(*) AS count FROM incidents",
).get() as { count: number };

if (incidentCount.count === 0) {
  const addIncident = database.prepare(`
    INSERT INTO incidents
      (intersection_id, location, type, severity, status, description, reported_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  addIncident.run(
    "j-04",
    "Union & Grand",
    "Vehicle collision",
    "high",
    "investigating",
    "Two vehicles blocking the eastbound lane.",
    "-12 minutes",
  );

  addIncident.run(
    "j-06",
    "Harbor & Bay",
    "Roadwork",
    "medium",
    "open",
    "Utility work reducing northbound traffic to one lane.",
    "-34 minutes",
  );

  addIncident.run(
    "j-02",
    "Market & Pine",
    "Signal malfunction",
    "critical",
    "open",
    "Pedestrian signal reported unresponsive.",
    "-58 minutes",
  );
}

export function listIntersections(): Intersection[] {
  return database.prepare(`
    SELECT
      id, name, district, latitude, longitude,
      daily_vehicles AS dailyVehicles, mode
    FROM intersections
    ORDER BY district, name
  `).all() as unknown as Intersection[];
}

export function getIntersection(id: string): Intersection | undefined {
  return database.prepare(`
    SELECT
      id, name, district, latitude, longitude,
      daily_vehicles AS dailyVehicles, mode
    FROM intersections
    WHERE id = ?
  `).get(id) as Intersection | undefined;
}

export function listIncidents(): Incident[] {
  return database.prepare(`
    SELECT
      id,
      intersection_id AS intersectionId,
      location, type, severity, status,
      description,
      reported_at AS reportedAt
    FROM incidents
    ORDER BY
      CASE status
        WHEN 'open' THEN 0
        WHEN 'investigating' THEN 1
        ELSE 2
      END,
      CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      reported_at DESC
    LIMIT 30
  `).all() as unknown as Incident[];
}

export function countActiveIncidents(): number {
  const result = database.prepare(
    "SELECT COUNT(*) AS count FROM incidents WHERE status != 'resolved'",
  ).get() as { count: number };

  return result.count;
}

export function addIncident(
  input: Omit<Incident, "id" | "reportedAt">,
): Incident {
  const result = database.prepare(`
    INSERT INTO incidents
      (intersection_id, location, type, severity, status, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.intersectionId,
    input.location,
    input.type,
    input.severity,
    input.status,
    input.description,
  );

  return database.prepare(`
    SELECT
      id,
      intersection_id AS intersectionId,
      location, type, severity, status,
      description,
      reported_at AS reportedAt
    FROM incidents
    WHERE id = ?
  `).get(Number(result.lastInsertRowid)) as unknown as Incident;
}

export function updateIncidentStatus(
  id: number,
  status: IncidentStatus,
): boolean {
  const result = database.prepare(
    "UPDATE incidents SET status = ? WHERE id = ?",
  ).run(status, id);

  return result.changes > 0;
}

export function updateSignalMode(
  id: string,
  mode: SignalMode,
): Intersection | undefined {
  database.prepare(
    "UPDATE intersections SET mode = ? WHERE id = ?",
  ).run(mode, id);

  return getIntersection(id);
}

export function getIncident(id: number): Incident | undefined {
  return database.prepare(`
    SELECT
      id,
      intersection_id AS intersectionId,
      location, type, severity, status,
      description,
      reported_at AS reportedAt
    FROM incidents
    WHERE id = ?
  `).get(id) as Incident | undefined;
}
export interface TrafficHistoryRecord {
  id: number;
  intersectionId: string;
  vehiclesPerHour: number;
  speed: number;
  congestion: "Clear" | "Moderate" | "Heavy" | "Severe";
  signalPhase: "Green" | "Yellow" | "Red";
  waitSeconds: number;
  recordedAt: string;
}

export function recordTrafficReading(input: Omit<TrafficHistoryRecord, "id" | "recordedAt">): void {
  database.prepare(`
    INSERT INTO traffic_history (
      intersection_id,
      vehicles_per_hour,
      speed,
      congestion,
      signal_phase,
      wait_seconds
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.intersectionId,
    input.vehiclesPerHour,
    input.speed,
    input.congestion,
    input.signalPhase,
    input.waitSeconds,
  );
}

export function listTrafficHistory(
  intersectionId?: string,
  limit = 100,
): TrafficHistoryRecord[] {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));

  if (intersectionId) {
    return database.prepare(`
      SELECT
        id,
        intersection_id AS intersectionId,
        vehicles_per_hour AS vehiclesPerHour,
        speed,
        congestion,
        signal_phase AS signalPhase,
        wait_seconds AS waitSeconds,
        recorded_at AS recordedAt
      FROM traffic_history
      WHERE intersection_id = ?
      ORDER BY recorded_at DESC, id DESC
      LIMIT ?
    `).all(intersectionId, safeLimit) as unknown as TrafficHistoryRecord[];
  }

  return database.prepare(`
    SELECT
      id,
      intersection_id AS intersectionId,
      vehicles_per_hour AS vehiclesPerHour,
      speed,
      congestion,
      signal_phase AS signalPhase,
      wait_seconds AS waitSeconds,
      recorded_at AS recordedAt
    FROM traffic_history
    ORDER BY recorded_at DESC, id DESC
    LIMIT ?
  `).all(safeLimit) as unknown as TrafficHistoryRecord[];
}

export function recordTrafficReadings(
  readings: Array<Omit<TrafficHistoryRecord, "id" | "recordedAt">>,
): void {
  if (readings.length === 0) {
    return;
  }

  const insert = database.prepare(`
    INSERT INTO traffic_history (
      intersection_id,
      vehicles_per_hour,
      speed,
      congestion,
      signal_phase,
      wait_seconds
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const reading of readings) {
      insert.run(
        reading.intersectionId,
        reading.vehiclesPerHour,
        reading.speed,
        reading.congestion,
        reading.signalPhase,
        reading.waitSeconds,
      );
    }

    database.prepare(
      "DELETE FROM traffic_history WHERE recorded_at < datetime('now', '-30 days')",
    ).run();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function checkDatabaseConnection(): void {
  database.prepare("SELECT 1").get();
}