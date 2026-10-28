
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { after, before, test } from "node:test";

const previousNodeEnv = process.env.NODE_ENV;
const previousDatabasePath = process.env.TRAFFIC_DB_PATH;
const testDirectory = mkdtempSync(join(tmpdir(), "traffic-api-test-"));

let server: Server;
let baseUrl = "";
let database: typeof import("./database.js").database;
let recordTrafficReading: typeof import("./database.js").recordTrafficReading;
let recordTrafficReadings: typeof import("./database.js").recordTrafficReadings;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.TRAFFIC_DB_PATH = join(testDirectory, "traffic.sqlite");

  const appModule = await import("./index.js");
  const databaseModule = await import("./database.js");

  database = databaseModule.database;
  recordTrafficReading = databaseModule.recordTrafficReading;
  recordTrafficReadings = databaseModule.recordTrafficReadings;
  server = appModule.app.listen(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  database?.close();
  rmSync(testDirectory, { recursive: true, force: true });

  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }

  if (previousDatabasePath === undefined) {
    delete process.env.TRAFFIC_DB_PATH;
  } else {
    process.env.TRAFFIC_DB_PATH = previousDatabasePath;
  }
});

test("incident API supports creation, retrieval, updates, and validation", async (t) => {
  const createResponse = await fetch(`${baseUrl}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intersectionId: "j-01",
      location: "Test Avenue",
      type: "Vehicle collision",
      severity: "high",
      description: "Automated API test incident.",
    }),
  });

  assert.equal(createResponse.status, 201);

  const created = (await createResponse.json()) as {
    id: number;
    status: string;
    location: string;
  };

  assert.ok(Number.isSafeInteger(created.id));
  assert.equal(created.status, "open");
  assert.equal(created.location, "Test Avenue");

  await t.test("retrieves the created incident", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/${created.id}`);
    assert.equal(response.status, 200);

    const incident = (await response.json()) as {
      id: number;
      location: string;
    };

    assert.equal(incident.id, created.id);
    assert.equal(incident.location, "Test Avenue");
  });

  await t.test("updates incident status", async () => {
    const response = await fetch(
      `${baseUrl}/api/incidents/${created.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "investigating" }),
      },
    );

    assert.equal(response.status, 200);
    const incident = (await response.json()) as { status: string };
    assert.equal(incident.status, "investigating");
  });

  await t.test("rejects an invalid severity", async () => {
    const response = await fetch(`${baseUrl}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intersectionId: "j-01",
        location: "Test Avenue",
        type: "Vehicle collision",
        severity: "extreme",
        description: "",
      }),
    });

    assert.equal(response.status, 400);
  });

   await t.test("rejects an invalid incident ID", async () => {
    const response = await fetch(`${baseUrl}/api/incidents/abc`);
    assert.equal(response.status, 400);
  });

  await t.test("rejects an invalid status", async () => {
    const response = await fetch(
      `${baseUrl}/api/incidents/${created.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      },
    );

    assert.equal(response.status, 400);
  });

  await t.test("returns 404 when updating a nonexistent incident", async () => {
    const response = await fetch(
      `${baseUrl}/api/incidents/999999/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      },
    );

    assert.equal(response.status, 404);
  });
});

test("health and traffic-history endpoints use the SQLite database", async (t) => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json() as {
    status: string;
    database: string;
  };
  assert.deepEqual(
    { status: health.status, database: health.database },
    { status: "ok", database: "connected" },
  );

  recordTrafficReading({
    intersectionId: "j-01",
    vehiclesPerHour: 1200,
    speed: 32,
    congestion: "Moderate",
    signalPhase: "Green",
    waitSeconds: 39,
  });

  await t.test("returns saved readings and supports intersection filtering", async () => {
    const response = await fetch(
      `${baseUrl}/api/traffic/history?intersectionId=j-01&limit=10`,
    );
    assert.equal(response.status, 200);

    const result = await response.json() as {
      intersectionId: string;
      readings: Array<{ intersectionId: string; vehiclesPerHour: number }>;
    };
    assert.equal(result.intersectionId, "j-01");
    assert.equal(result.readings[0].intersectionId, "j-01");
    assert.equal(result.readings[0].vehiclesPerHour, 1200);
  });

  await t.test("rejects unknown intersections and out-of-range limits", async () => {
    const unknownIntersection = await fetch(
      `${baseUrl}/api/traffic/history?intersectionId=unknown`,
    );
    assert.equal(unknownIntersection.status, 404);

    const invalidLimit = await fetch(
      `${baseUrl}/api/traffic/history?limit=1001`,
    );
    assert.equal(invalidLimit.status, 400);
  });

  await t.test("writes a batch atomically", async () => {
    assert.throws(() => recordTrafficReadings([
      {
        intersectionId: "j-01",
        vehiclesPerHour: 900,
        speed: 30,
        congestion: "Moderate",
        signalPhase: "Green",
        waitSeconds: 43,
      },
      {
        intersectionId: "missing",
        vehiclesPerHour: 800,
        speed: 28,
        congestion: "Heavy",
        signalPhase: "Red",
        waitSeconds: 47,
      },
    ]));

    const readings = await fetch(
      `${baseUrl}/api/traffic/history?intersectionId=j-01`,
    ).then((response) => response.json()) as {
      readings: Array<{ vehiclesPerHour: number }>;
    };
    assert.equal(readings.readings.length, 1);
    assert.equal(readings.readings[0].vehiclesPerHour, 1200);
  });
});

test("signal mode updates persist in SQLite and malformed JSON returns an API error", async () => {
  const updateResponse = await fetch(
    `${baseUrl}/api/intersections/j-01/optimize`,
    { method: "POST" },
  );
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json() as { mode: string };
  assert.equal(updated.mode, "fixed");

  const malformedJson = await fetch(`${baseUrl}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), {
    error: "Request body must contain valid JSON.",
  });
});
