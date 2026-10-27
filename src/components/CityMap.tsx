import { useState } from "react";
import { ArrowUpRight, Layers2, LocateFixed } from "lucide-react";
import type { Intersection } from "../types";

interface CityMapProps {
  intersections: Intersection[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

const streets = [
  "M 58 36 L 524 36", "M 36 84 L 548 84", "M 24 138 L 522 138",
  "M 34 192 L 552 192", "M 20 250 L 520 250", "M 44 310 L 546 310",
  "M 86 18 L 86 322", "M 172 30 L 172 322", "M 256 14 L 256 330",
  "M 342 28 L 342 322", "M 430 14 L 430 326", "M 512 24 L 512 315",
  "M 30 275 Q 162 235 282 253 T 546 226", "M 46 111 Q 156 143 260 105 T 536 129",
];

export default function CityMap({ intersections, onSelect, selectedId }: CityMapProps) {
  const [layersEnabled, setLayersEnabled] = useState(true);
  const [north, setNorth] = useState(false);

  return (
    <section className="map-card">
      <div className="map-topline">
        <div>
          <span className="eyebrow">NETWORK OVERVIEW</span>
          <h2>Central District</h2>
        </div>
        <button
          className={`icon-button map-layer-button${layersEnabled ? " active" : ""}`}
          aria-label={layersEnabled ? "Hide traffic layer" : "Show traffic layer"}
          title={layersEnabled ? "Hide traffic layer" : "Show traffic layer"}
          onClick={() => setLayersEnabled(!layersEnabled)}
        ><Layers2 size={16} /></button>
      </div>
      <div className="city-map" aria-label="Map of monitored city intersections">
        <svg viewBox="0 0 560 340" role="img">
          <defs>
            <pattern id="map-grid" width="19" height="19" patternUnits="userSpaceOnUse">
              <path d="M 19 0 L 0 0 0 19" fill="none" stroke="#dde5df" strokeWidth="0.7" />
            </pattern>
            <linearGradient id="green-road" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#39a982" stopOpacity=".06" />
              <stop offset="50%" stopColor="#39a982" stopOpacity=".72" />
              <stop offset="100%" stopColor="#39a982" stopOpacity=".12" />
            </linearGradient>
            <linearGradient id="amber-road" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#dda349" stopOpacity=".08" />
              <stop offset="52%" stopColor="#dda349" stopOpacity=".78" />
              <stop offset="100%" stopColor="#dda349" stopOpacity=".08" />
            </linearGradient>
          </defs>
          <rect width="560" height="340" rx="12" fill="#edf3ed" />
          <rect width="560" height="340" fill="url(#map-grid)" opacity=".4" />
          <path d="M 14 287 Q 115 281 195 289 T 364 280 T 554 289 L 554 324 Q 426 315 355 322 T 166 329 L 14 321 Z" fill="#d8e9e2" />
          <path d="M 12 87 Q 108 72 206 93 T 371 83 T 552 95 L 550 119 Q 427 112 367 110 T 193 119 T 14 111 Z" fill="#dcebdc" />
          <path d="M 256 22 L 266 20 278 331 L 261 332 Z" fill="#e4ebe2" />
          <path d="M 35 194 L 550 190" stroke={layersEnabled ? "url(#green-road)" : "#d5dcd4"} strokeWidth="8" />
          <path d="M 32 250 L 531 243" stroke={layersEnabled ? "url(#amber-road)" : "#d5dcd4"} strokeWidth="8" />
          {streets.map((path) => (
            <path key={path} d={path} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          ))}
          {streets.map((path) => (
            <path key={`edge-${path}`} d={path} fill="none" stroke="#d6ded7" strokeWidth="1" strokeLinecap="round" />
          ))}
          <text x="30" y="22" className="map-label">WEST END</text>
          <text x="245" y="19" className="map-label">DOWNTOWN</text>
          <text x="415" y="18" className="map-label">CIVIC CENTER</text>
          <text x="353" y="318" className="map-label">WATERFRONT</text>
          {intersections.map((intersection) => {
            const x = intersection.longitude * 520 + 20;
            const y = intersection.latitude * 300 + 14;
            const selected = selectedId === intersection.id;
            const tone = intersection.congestion === "Severe" || intersection.congestion === "Heavy"
              ? "map-marker-warning" : "map-marker-clear";
            return (
              <g
                key={intersection.id}
                className="map-marker"
                role="button"
                tabIndex={0}
                aria-label={`${intersection.name}, ${intersection.congestion} traffic. View details.`}
                onClick={() => onSelect(intersection.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(intersection.id);
                }}
              >
                <circle cx={x} cy={y} r={selected ? 20 : 15} className={`${tone} map-marker-halo`} opacity={selected ? ".25" : ".15"} />
                <circle cx={x} cy={y} r={selected ? 12 : 10} className={`${tone} map-marker-body`} />
                <circle cx={x} cy={y} r="3" fill="white" />
                <text x={x + 14} y={y - 11} className={`map-marker-label${selected ? " selected" : ""}`}>
                  {intersection.id.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="map-attribution">STREET NETWORK · SIMULATED LIVE DATA</div>
        <button className="map-location-button" aria-label="Change map orientation" onClick={() => setNorth(!north)}>
          <LocateFixed size={16} className={north ? "north-up" : ""} />
        </button>
        <div className="map-legend"><span className="legend-dot green" />Clear <span className="legend-dot amber" />Slowdown</div>
      </div>
      <div className="map-footer">
        <span><span className="map-live-dot" />{intersections.length} intersections online</span>
        <button className="text-button" onClick={() => onSelect(intersections[0]?.id ?? "")}>
          View network <ArrowUpRight size={14} />
        </button>
      </div>
    </section>
  );
}
