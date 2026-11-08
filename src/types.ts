export type CongestionLevel = "Clear" | "Moderate" | "Heavy" | "Severe";
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
  vehiclesPerHour: number;
  speed: number;
  congestion: CongestionLevel;
  signalPhase: "Green" | "Yellow" | "Red";
  waitSeconds: number;
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

export interface DashboardData {
  summary: {
    monitoredIntersections: number;
    averageSpeed: number;
    activeIncidents: number;
    adaptiveSignals: number;
    congestionIndex: number;
    severeCongestion: number;
  };
  intersections: Intersection[];
  incidents: Incident[];
  recommendations: TrafficRecommendation[];
  trend: { time: string; volume: number }[];
  forecast: TrafficForecast | null;
  updatedAt: string;
  dataMode: "simulated";
}

export interface TrafficForecast {
  horizonMinutes: 60;
  predictedVolume: number;
  change: number;
  lowerBound: number;
  upperBound: number;
  direction: "rising" | "falling" | "stable";
}

export interface TrafficRecommendation {
  id: string;
  kind: "incident" | "intersection";
  targetId: string;
  priority: "critical" | "high";
  title: string;
  reason: string;
  actionLabel: string;
}
