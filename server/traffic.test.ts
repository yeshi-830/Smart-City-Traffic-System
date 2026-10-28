import assert from "node:assert/strict";
import test from "node:test";
import type { Incident, Intersection } from "./database.js";
import { buildTrafficRecommendations, buildTrafficTrend, getTrafficReading } from "./traffic.js";

const intersection: Intersection = {
  id: "j-01",
  name: "Central & 5th",
  district: "Downtown",
  latitude: 0.48,
  longitude: 0.39,
  dailyVehicles: 28_400,
  mode: "adaptive",
};

test("traffic readings remain within realistic safe bounds and use valid categories", () => {
  const reading = getTrafficReading(intersection, new Date("2025-01-01T17:30:00"));

  assert.equal(reading.intersectionId, intersection.id);
  assert.ok(reading.vehiclesPerHour > 0);
  assert.ok(reading.speed >= 9 && reading.speed <= 55);
  assert.ok(reading.waitSeconds >= 8);
  assert.ok(["Clear", "Moderate", "Heavy", "Severe"].includes(reading.congestion));
  assert.ok(["Green", "Yellow", "Red"].includes(reading.signalPhase));
});

test("traffic trend includes 12 hourly points with percentage-based volumes", () => {
  const trend = buildTrafficTrend(new Date("2025-01-01T12:00:00"));

  assert.equal(trend.length, 12);
  assert.ok(trend.every((point) => point.volume > 0 && point.volume <= 100));
  assert.ok(trend.every((point) => /^\d{1,2}(AM|PM)$/.test(point.time)));
});

test("recommendations prioritize unresolved incidents and provide operator actions", () => {
  const highIncident: Incident = {
    id: 4,
    intersectionId: "j-01",
    location: "Central & 5th",
    type: "Vehicle collision",
    severity: "high",
    status: "investigating",
    description: "",
    reportedAt: "2025-01-01 12:00:00",
  };
  const criticalIncident = { ...highIncident, id: 5, severity: "critical" as const, status: "open" as const };
  const recommendations = buildTrafficRecommendations([
    {
      ...intersection,
      ...getTrafficReading(intersection, new Date("2025-01-01T08:00:00")),
      congestion: "Severe",
    },
  ], [highIncident, criticalIncident, { ...highIncident, id: 6, status: "resolved" }]);

  assert.equal(recommendations.length, 3);
  assert.equal(recommendations[0].id, "incident-5");
  assert.equal(recommendations[0].actionLabel, "Review incident");
  assert.ok(recommendations.some((recommendation) => recommendation.kind === "intersection"));
  assert.ok(recommendations.every((recommendation) => recommendation.reason.length > 0));
});

test("recommendations are empty when traffic is clear and incidents are resolved", () => {
  const clearReading = {
    ...intersection,
    ...getTrafficReading(intersection, new Date("2025-01-01T12:00:00")),
    congestion: "Clear" as const,
  };
  const resolvedIncident: Incident = {
    id: 7,
    intersectionId: null,
    location: "Central & 5th",
    type: "Road obstruction",
    severity: "critical",
    status: "resolved",
    description: "",
    reportedAt: "2025-01-01 12:00:00",
  };

  assert.deepEqual(buildTrafficRecommendations([clearReading], [resolvedIncident]), []);
});
