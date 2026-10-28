import type { Incident, Intersection } from "./database.js";

export type CongestionLevel = "Clear" | "Moderate" | "Heavy" | "Severe";

export interface TrafficRecommendation {
  id: string;
  kind: "incident" | "intersection";
  targetId: string;
  priority: "critical" | "high";
  title: string;
  reason: string;
  actionLabel: string;
}

export interface TrafficReading {
  intersectionId: string;
  vehiclesPerHour: number;
  speed: number;
  congestion: CongestionLevel;
  signalPhase: "Green" | "Yellow" | "Red";
  waitSeconds: number;
}

export function buildTrafficRecommendations(
  intersections: Array<Intersection & TrafficReading>,
  incidents: Incident[],
): TrafficRecommendation[] {
  const recommendations: Array<TrafficRecommendation & { rank: number }> = [];

  for (const incident of incidents) {
    if (incident.status === "resolved" || !["critical", "high"].includes(incident.severity)) {
      continue;
    }
    recommendations.push({
      id: `incident-${incident.id}`,
      kind: "incident",
      targetId: String(incident.id),
      priority: incident.severity,
      title: `Review ${incident.type.toLowerCase()} at ${incident.location}`,
      reason: `${incident.severity[0].toUpperCase()}${incident.severity.slice(1)} priority · ${incident.status} · verify conditions and coordinate the appropriate response.`,
      actionLabel: "Review incident",
      rank: incident.severity === "critical" ? 100 : 70,
    });
  }

  for (const intersection of intersections) {
    if (intersection.congestion !== "Severe" && intersection.congestion !== "Heavy") {
      continue;
    }
    const severe = intersection.congestion === "Severe";
    recommendations.push({
      id: `intersection-${intersection.id}`,
      kind: "intersection",
      targetId: intersection.id,
      priority: severe ? "critical" : "high",
      title: `Review congestion at ${intersection.name}`,
      reason: `Traffic is ${intersection.congestion.toLowerCase()} at ${intersection.speed} mph with ${intersection.waitSeconds}s average waits. ${intersection.mode === "fixed" ? "Consider simulating adaptive timing." : "Check for a downstream incident before adjusting timing."}`,
      actionLabel: "Review signal plan",
      rank: severe ? 90 : 60,
    });
  }

  return recommendations
    .sort((left, right) => right.rank - left.rank || left.title.localeCompare(right.title))
    .slice(0, 3)
    .map(({ rank: _rank, ...recommendation }) => recommendation);
}

export function getTrafficReading(intersection: Intersection, now = new Date()): TrafficReading {
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const rushHour = Math.max(
    Math.exp(-Math.pow(minuteOfDay - 8 * 60, 2) / 12000),
    Math.exp(-Math.pow(minuteOfDay - 17.5 * 60, 2) / 18000),
  );
  const dailyPeak = intersection.dailyVehicles / 24;
  const locationOffset = Number(intersection.id.slice(-2)) || 0;
  const wave = Math.sin((minuteOfDay + locationOffset * 19) / 24) * 0.11;
  const vehiclesPerHour = Math.round(dailyPeak * (0.48 + rushHour * 0.57 + wave));
  const speed = Math.max(9, Math.round(48 - rushHour * 22 - wave * 12 - locationOffset % 5));
  const congestion: CongestionLevel =
    speed >= 39 ? "Clear" : speed >= 30 ? "Moderate" : speed >= 19 ? "Heavy" : "Severe";
  const signalPhases = ["Green", "Green", "Yellow", "Red"] as const;
  const signalPhase = signalPhases[Math.floor((now.getTime() / 1000 + locationOffset * 13) / 12) % 4];

  return {
    intersectionId: intersection.id,
    vehiclesPerHour,
    speed,
    congestion,
    signalPhase,
    waitSeconds: Math.round(Math.max(8, (50 - speed) * 2.15)),
  };
}

export function buildTrafficTrend(now = new Date()): { time: string; volume: number }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const time = new Date(now.getTime() - (11 - index) * 60 * 60 * 1000);
    const hour = time.getHours();
    const morning = Math.exp(-Math.pow(hour - 8, 2) / 5);
    const evening = Math.exp(-Math.pow(hour - 17.5, 2) / 7);
    const wave = Math.sin(index * 1.42) * 4;
    return {
      time: time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(" ", ""),
      volume: Math.round(40 + morning * 34 + evening * 48 + wave),
    };
  });
}
