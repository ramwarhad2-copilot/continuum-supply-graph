"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  HeartPulse,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { ImpactAnalysis } from "@/domain/supply-network";

interface ImpactPanelProps {
  analysis: ImpactAnalysis | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ImpactPanel({ analysis, loading, error, onRetry }: ImpactPanelProps) {
  if (loading) return <ImpactSkeleton />;

  if (error) {
    return (
      <aside className="impact-panel impact-panel--state" aria-live="polite">
        <span className="state-icon state-icon--error"><AlertTriangle size={23} /></span>
        <span className="eyebrow">Analysis interrupted</span>
        <h2>We lost the network connection.</h2>
        <p>{error}</p>
        <button className="secondary-button" type="button" onClick={onRetry}>
          <RefreshCw size={16} /> Retry analysis
        </button>
      </aside>
    );
  }

  if (!analysis) {
    return (
      <aside className="impact-panel impact-panel--state">
        <span className="state-icon"><Sparkles size={23} /></span>
        <span className="eyebrow">Scenario lab</span>
        <h2>Select a source or hub.</h2>
        <p>Continuum will trace every downstream clinic and surface safer supply paths.</p>
      </aside>
    );
  }

  const { summary } = analysis;
  return (
    <aside className="impact-panel" aria-live="polite">
      <div className="impact-heading">
        <div>
          <span className="eyebrow eyebrow--danger">Simulated interruption</span>
          <h2>{analysis.disruptedFacility.name}</h2>
          <p>{analysis.disruptedFacility.city} · {analysis.disruptedFacility.subtitle}</p>
        </div>
        <span className="simulation-badge"><i /> Active</span>
      </div>

      <div className="score-card">
        <div
          className="score-ring"
          style={{ "--score-angle": `${summary.resilienceScore * 3.6}deg` } as React.CSSProperties}
          aria-label={`${summary.resilienceScore} percent resilience score`}
        >
          <div><strong>{summary.resilienceScore}</strong><span>/100</span></div>
        </div>
        <div>
          <span className="score-label">Network resilience</span>
          <strong>{scoreCopy(summary.resilienceScore)}</strong>
          <p>{summary.resilienceScore >= 70 ? "Alternates cover most exposed demand." : "Immediate mitigation is recommended."}</p>
        </div>
      </div>

      <div className="impact-metrics">
        <Metric icon={<HeartPulse />} value={summary.affectedClinics} label="Clinics affected" />
        <Metric icon={<AlertTriangle />} value={summary.essentialMedicines} label="Essential medicines" />
        <Metric icon={<RouteIcon />} value={summary.routesAtRisk} label="Routes exposed" />
        <Metric icon={<ShieldCheck />} value={formatCompact(summary.patientsAtRisk)} label="Patients / week" />
      </div>

      <section className="impact-section">
        <div className="section-heading">
          <div><span className="eyebrow">Priority response</span><h3>Affected care points</h3></div>
          <span className="count-badge">{analysis.clinics.length}</span>
        </div>
        <div className="clinic-list">
          {analysis.clinics.map((item, index) => (
            <details className="clinic-card" key={item.clinic.id} open={index === 0}>
              <summary>
                <span className={`risk-dot risk-dot--${item.risk}`} />
                <span className="clinic-summary-copy">
                  <strong>{item.clinic.name}</strong>
                  <small>{item.clinic.city} · {formatCompact(item.clinic.capacity)} patients/week</small>
                </span>
                <span className={`risk-badge risk-badge--${item.risk}`}>{item.risk}</span>
              </summary>
              <div className="clinic-detail">
                <div className="path-row" aria-label="Affected delivery path">
                  {item.path.map((facility, pathIndex) => (
                    <span key={facility.id}>
                      <b>{facility.city}</b>
                      {pathIndex < item.path.length - 1 && <ArrowRight size={13} />}
                    </span>
                  ))}
                </div>
                <div className="detail-meta">
                  <span><Clock3 size={14} /> {item.leadTimeHours}h route</span>
                  <span className={item.alternateCount ? "has-alternate" : "no-alternate"}>
                    {item.alternateCount ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {item.alternateCount || "No"} alternate{item.alternateCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="medicine-tags">
                  {item.medicines.map((medicine) => (
                    <span key={medicine.id}>{medicine.name}<small>{medicine.weeklyUnits}/wk</small></span>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="impact-section alternatives-section">
        <div className="section-heading">
          <div><span className="eyebrow eyebrow--safe">Graph recommendation</span><h3>Best alternate paths</h3></div>
          <ShieldCheck size={19} />
        </div>
        {analysis.alternatives.length ? (
          <div className="alternative-list">
            {analysis.alternatives.slice(0, 4).map((route) => (
              <article className="alternative-card" key={`${route.clinicId}-${route.medicineId}-${route.supplierName}`}>
                <div className="alternative-icon"><RouteIcon size={17} /></div>
                <div>
                  <strong>{route.medicineName} → {route.clinicName}</strong>
                  <p>via {route.path.map((node) => node.city).join(" → ")}</p>
                  <span>{Math.round(route.reliability * 100)}% reliable · {route.leadTimeHours}h</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="inline-empty"><AlertTriangle size={18} /><p>No alternate route covers the exposed medicine demand.</p></div>
        )}
      </section>
    </aside>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return <div className="impact-metric"><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>;
}

function ImpactSkeleton() {
  return (
    <aside className="impact-panel" aria-busy="true" aria-label="Calculating disruption impact">
      <div className="skeleton skeleton--eyebrow" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--copy" />
      <div className="skeleton skeleton--score" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton--metric" key={index} />)}
      </div>
      <div className="skeleton skeleton--section" />
      <div className="skeleton skeleton--card" />
      <div className="skeleton skeleton--card" />
    </aside>
  );
}

function scoreCopy(score: number): string {
  if (score >= 85) return "Well protected";
  if (score >= 70) return "Recoverable";
  if (score >= 45) return "At risk";
  return "Fragile";
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
