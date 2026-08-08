"use client";

import { Building2, Factory, Hospital, PackageOpen } from "lucide-react";

import type {
  Facility,
  FacilityKind,
  ImpactAnalysis,
  NetworkOverview,
} from "@/domain/supply-network";

interface NetworkMapProps {
  overview: NetworkOverview;
  analysis: ImpactAnalysis | null;
  selectedId: string | null;
  onSelect: (facilityId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const groupOrder: FacilityKind[][] = [
  ["manufacturer", "supplier"],
  ["hub"],
  ["clinic"],
];

const xByKind: Record<FacilityKind, number> = {
  manufacturer: 112,
  supplier: 112,
  hub: 520,
  clinic: 922,
};

const icons = {
  manufacturer: Factory,
  supplier: PackageOpen,
  hub: Building2,
  clinic: Hospital,
};

export function NetworkMap({ overview, analysis, selectedId, onSelect }: NetworkMapProps) {
  const positions = layoutFacilities(overview.facilities);
  const impactedRouteIds = new Set(
    analysis?.clinics.flatMap((clinic) => clinic.pathRouteIds) ?? [],
  );
  const impactedClinicIds = new Set(analysis?.clinics.map((item) => item.clinic.id) ?? []);
  const alternativePairs = new Set(
    analysis?.alternatives.flatMap((alternative) =>
      alternative.path.slice(0, -1).map((facility, index) => {
        const next = alternative.path[index + 1];
        return `${facility.id}:${next.id}`;
      }),
    ) ?? [],
  );

  return (
    <div className="network-map-wrap">
      <svg
        className="network-map"
        viewBox="0 0 1040 590"
        role="img"
        aria-labelledby="network-title network-description"
      >
        <title id="network-title">Medicine supply network</title>
        <desc id="network-description">
          Manufacturers and suppliers connect through distribution hubs to six clinics. Select a node to
          simulate a disruption.
        </desc>
        <defs>
          <linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbfaf7" />
            <stop offset="100%" stopColor="#f1efe9" />
          </linearGradient>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#173f37" floodOpacity=".12" />
          </filter>
          <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9bdb7" />
          </marker>
          <marker id="arrow-impact" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#d85c49" />
          </marker>
          <marker id="arrow-safe" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3e967b" />
          </marker>
        </defs>
        <rect width="1040" height="590" rx="20" fill="url(#mapWash)" />

        <g className="map-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <line key={`v${index}`} x1={index * 95} y1="0" x2={index * 95} y2="590" />
          ))}
          {Array.from({ length: 7 }, (_, index) => (
            <line key={`h${index}`} x1="0" y1={index * 95} x2="1040" y2={index * 95} />
          ))}
        </g>

        <g className="column-labels" aria-hidden="true">
          <text x="34" y="36">SOURCE</text>
          <text x="446" y="36">DISTRIBUTION</text>
          <text x="860" y="36">POINT OF CARE</text>
        </g>

        <g className="network-links" aria-hidden="true">
          {overview.routes.map((route) => {
            const origin = positions.get(route.from);
            const destination = positions.get(route.to);
            if (!origin || !destination) return null;
            const isImpacted = impactedRouteIds.has(route.id);
            const isAlternative = alternativePairs.has(`${route.from}:${route.to}`) && !isImpacted;
            return (
              <path
                key={route.id}
                className={`route-line${isImpacted ? " route-line--impact" : ""}${isAlternative ? " route-line--safe" : ""}`}
                d={linkPath(origin, destination)}
                markerEnd={`url(#arrow-${isImpacted ? "impact" : isAlternative ? "safe" : "muted"})`}
              />
            );
          })}
        </g>

        <g className="network-nodes">
          {overview.facilities.map((facility) => {
            const point = positions.get(facility.id)!;
            const Icon = icons[facility.kind];
            const selected = selectedId === facility.id;
            const impacted = impactedClinicIds.has(facility.id);
            const disabled = facility.kind === "clinic";
            return (
              <g
                key={facility.id}
                className={`map-node map-node--${facility.kind}${selected ? " is-selected" : ""}${impacted ? " is-impacted" : ""}${disabled ? " is-passive" : ""}`}
                transform={`translate(${point.x} ${point.y})`}
                role={disabled ? undefined : "button"}
                tabIndex={disabled ? undefined : 0}
                aria-label={disabled ? undefined : `Simulate a disruption at ${facility.name}`}
                aria-pressed={disabled ? undefined : selected}
                onClick={() => !disabled && onSelect(facility.id)}
                onKeyDown={(event) => {
                  if (!disabled && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(facility.id);
                  }
                }}
              >
                {selected && <circle className="node-pulse" r="31" />}
                <circle className="node-disc" r="24" filter="url(#nodeShadow)" />
                <foreignObject x="-10" y="-10" width="20" height="20" aria-hidden="true">
                  <Icon size={19} strokeWidth={2} />
                </foreignObject>
                <text className="node-name" x="0" y="39">
                  {shortName(facility.name)}
                </text>
                <text className="node-city" x="0" y="54">
                  {facility.city}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-legend" aria-label="Network legend">
        <span><i className="legend-dot legend-dot--source" />Source</span>
        <span><i className="legend-dot legend-dot--hub" />Hub</span>
        <span><i className="legend-dot legend-dot--clinic" />Clinic</span>
        <span><i className="legend-line legend-line--impact" />At risk</span>
        <span><i className="legend-line legend-line--safe" />Alternate</span>
      </div>
    </div>
  );
}

function layoutFacilities(facilities: Facility[]): Map<string, Point> {
  const result = new Map<string, Point>();
  for (const kinds of groupOrder) {
    const group = facilities.filter((facility) => kinds.includes(facility.kind));
    const availableHeight = 430;
    const gap = availableHeight / Math.max(1, group.length - 1);
    group.forEach((facility, index) => {
      result.set(facility.id, {
        x: xByKind[facility.kind],
        y: group.length === 1 ? 295 : 74 + index * gap,
      });
    });
  }
  return result;
}

function linkPath(origin: Point, destination: Point): string {
  const bend = Math.max(65, (destination.x - origin.x) * 0.47);
  return `M ${origin.x + 27} ${origin.y} C ${origin.x + bend} ${origin.y}, ${destination.x - bend} ${destination.y}, ${destination.x - 29} ${destination.y}`;
}

function shortName(name: string): string {
  const words = name.split(" ");
  return words.length > 2 ? `${words[0]} ${words[1]}` : name;
}
