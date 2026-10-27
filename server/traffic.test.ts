import assert from "node:assert/strict";
import test from "node:test";
import type { Intersection } from "./database.js";
import { buildTrafficTrend, getTrafficReading } from "./traffic.js";

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
