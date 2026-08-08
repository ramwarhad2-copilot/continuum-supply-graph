"use client";

import {
  Activity,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Command,
  Database,
  Factory,
  Network,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HealthStatus, ImpactAnalysis, NetworkOverview } from "@/domain/supply-network";
import { getJson } from "@/lib/client-api";
import { ImpactPanel } from "@/components/impact-panel";
import { NetworkMap } from "@/components/network-map";

type AsyncValue<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

const loadingState = { status: "loading", data: null, error: null } as const;

export function ContinuumDashboard() {
  const [overview, setOverview] = useState<AsyncValue<NetworkOverview>>(loadingState);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AsyncValue<ImpactAnalysis> | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadOverview = useCallback(async () => {
    try {
      const [network, networkHealth] = await Promise.all([
        getJson<NetworkOverview>("/api/overview"),
        getJson<HealthStatus>("/api/health").catch(() => null),
      ]);
      setOverview({ status: "success", data: network, error: null });
      setHealth(networkHealth);
      setAnalysis(loadingState);
      setSelectedId((current) =>
        current && network.facilities.some((facility) => facility.id === current)
          ? current
          : network.facilities.find((facility) => facility.id === "hub-sahyadri")?.id ??
            network.facilities.find((facility) => facility.kind !== "clinic")?.id ??
            null,
      );
    } catch (error) {
      setOverview({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "The network could not be loaded.",
      });
    }
  }, []);

  const loadAnalysis = useCallback(async (facilityId: string, signal?: AbortSignal) => {
    try {
      const result = await getJson<ImpactAnalysis>(
        `/api/impact?facilityId=${encodeURIComponent(facilityId)}`,
        signal,
      );
      setAnalysis({ status: "success", data: result, error: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalysis({
        status: "error",
        data: null,
        error: error instanceof Error ? error.message : "The scenario could not be calculated.",
      });
    }
  }, []);

  const selectFacility = useCallback((facilityId: string) => {
    setAnalysis(loadingState);
    setSelectedId(facilityId);
  }, []);

  const retryOverview = useCallback(() => {
    setOverview(loadingState);
    void loadOverview();
  }, [loadOverview]);

  const retryAnalysis = useCallback(() => {
    if (!selectedId) return;
    setAnalysis(loadingState);
    void loadAnalysis(selectedId);
  }, [selectedId, loadAnalysis]);

  useEffect(() => {
    // The promise updates state only after the network request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    // The promise updates state only after the parameterized scenario request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalysis(selectedId, controller.signal);
    return () => controller.abort();
  }, [selectedId, loadAnalysis]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === "Escape") {
        setShowSearch(false);
        setShowGuide(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectableFacilities = useMemo(
    () =>
      overview.data?.facilities.filter(
        (facility) =>
          facility.kind !== "clinic" &&
          `${facility.name} ${facility.city}`.toLowerCase().includes(search.trim().toLowerCase()),
      ) ?? [],
    [overview.data, search],
  );

  if (overview.status === "loading") return <DashboardLoading />;
  if (overview.status === "error") return <DashboardError message={overview.error} onRetry={retryOverview} />;

  const network = overview.data;
  const impact = analysis?.status === "success" ? analysis.data : null;
  const selected = network.facilities.find((facility) => facility.id === selectedId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Continuum home">
          <span className="brand-mark" aria-hidden="true"><Network size={19} /></span>
          <span><strong>continuum</strong><small>care supply intelligence</small></span>
        </a>
        <nav className="top-actions" aria-label="Application actions">
          <button className="search-trigger" type="button" onClick={() => setShowSearch(true)}>
            <Search size={16} /><span>Find a facility</span><kbd><Command size={11} />K</kbd>
          </button>
          <button className="icon-button" type="button" aria-label="How Continuum works" onClick={() => setShowGuide(true)}>
            <CircleHelp size={19} />
          </button>
          <span className={`connection-pill${health ? "" : " connection-pill--warning"}`}>
            <i />{network.source === "cognodb" ? "CognoDB live" : "Demo graph"}
          </span>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={13} /> Resilience command centre</span>
            <h1>See the care behind<br />every <em>connection.</em></h1>
            <p>
              Model a supply interruption, trace its clinic-level impact, and uncover safer routes—all in
              one connected view.
            </p>
          </div>
          <div className="hero-scenario">
            <span className="scenario-label">Now modelling</span>
            <button type="button" onClick={() => setShowSearch(true)}>
              <span className="scenario-icon"><Factory size={18} /></span>
              <span><strong>{selected?.name ?? "Choose a facility"}</strong><small>{selected?.city ?? "Open scenario picker"}</small></span>
              <ChevronDown size={18} />
            </button>
            <p><Activity size={14} /> Changes recalculate the entire downstream graph</p>
          </div>
        </section>

        <section className="stat-strip" aria-label="Network summary">
          <OverviewStat value={network.stats.facilities} label="Connected facilities" detail="Across 3 states" />
          <OverviewStat value={network.stats.routes} label="Active supply routes" detail="Road + rail corridors" />
          <OverviewStat value={network.stats.medicines} label="Essential medicines" detail="2 cold-chain products" />
          <OverviewStat value={formatCompact(network.stats.patientsCovered)} label="Patients covered" detail="Each week" accent />
        </section>

        <section className="workspace-grid" aria-label="Supply network scenario workspace">
          <article className="network-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow"><span className="live-dot" /> Live topology</span>
                <h2>Supply network</h2>
                <p>Choose any source or distribution hub to reveal its blast radius.</p>
              </div>
              <div className="view-pill"><Network size={15} /> Relationship view</div>
            </div>
            <NetworkMap
              overview={network}
              analysis={impact}
              selectedId={selectedId}
              onSelect={selectFacility}
            />
            <div className="network-insight">
              <span><ShieldCheck size={17} /></span>
              <p><strong>Graph insight</strong> The selected scenario traverses up to four supply hops and evaluates alternate paths that bypass the interruption.</p>
              <ArrowRight size={17} />
            </div>
          </article>

          <ImpactPanel
            analysis={impact}
            loading={analysis?.status === "loading"}
            error={analysis?.status === "error" ? analysis.error : null}
            onRetry={retryAnalysis}
          />
        </section>
      </main>

      <footer className="app-footer">
        <p><span className="brand-mark brand-mark--small"><Network size={13} /></span> Continuum</p>
        <span>Powered by parameterized openCypher traversals · Updated {new Date(network.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </footer>

      {showSearch && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSearch(false)}>
          <section className="command-modal" role="dialog" aria-modal="true" aria-label="Choose a disruption scenario" onMouseDown={(event) => event.stopPropagation()}>
            <div className="command-input">
              <Search size={19} />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search source or distribution hub…"
                autoFocus
              />
              <button type="button" onClick={() => setShowSearch(false)} aria-label="Close facility search"><X size={18} /></button>
            </div>
            <div className="command-body">
              <span className="command-section-label">Disruption scenarios</span>
              {selectableFacilities.map((facility) => (
                <button
                  className={`command-option${facility.id === selectedId ? " is-current" : ""}`}
                  type="button"
                  key={facility.id}
                  onClick={() => {
                    selectFacility(facility.id);
                    setShowSearch(false);
                    setSearch("");
                  }}
                >
                  <span className={`option-icon option-icon--${facility.kind}`}><PackageSearch size={17} /></span>
                  <span><strong>{facility.name}</strong><small>{facility.city} · {facility.subtitle}</small></span>
                  {facility.id === selectedId ? <span className="current-label">Current</span> : <ArrowRight size={16} />}
                </button>
              ))}
              {!selectableFacilities.length && <div className="command-empty">No facilities match “{search}”.</div>}
            </div>
            <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>esc</kbd> close</span></div>
          </section>
        </div>
      )}

      {showGuide && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowGuide(false)}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowGuide(false)} aria-label="Close guide"><X size={19} /></button>
            <span className="guide-icon"><Network size={24} /></span>
            <span className="eyebrow">A 60-second tour</span>
            <h2 id="guide-title">From interruption to action.</h2>
            <p>Continuum models suppliers, medicines, routes, hubs and clinics as connected entities—not isolated rows.</p>
            <ol className="guide-steps">
              <li><span>1</span><div><strong>Choose a disruption</strong><p>Select any source or hub from the map.</p></div></li>
              <li><span>2</span><div><strong>Trace the blast radius</strong><p>A multi-hop traversal finds every downstream clinic.</p></div></li>
              <li><span>3</span><div><strong>Protect the network</strong><p>Alternate routes bypass the failed facility and cover exposed demand.</p></div></li>
            </ol>
            <button className="primary-button" type="button" onClick={() => setShowGuide(false)}>Explore the network <ArrowRight size={16} /></button>
          </section>
        </div>
      )}
    </div>
  );
}

function OverviewStat({ value, label, detail, accent = false }: { value: string | number; label: string; detail: string; accent?: boolean }) {
  return (
    <div className={`overview-stat${accent ? " overview-stat--accent" : ""}`}>
      <strong>{value}</strong><div><span>{label}</span><small>{detail}</small></div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark"><Network size={19} /></span><span><strong>continuum</strong><small>care supply intelligence</small></span></div></header>
      <main className="dashboard-loading" aria-busy="true">
        <div className="skeleton skeleton--hero" />
        <div className="skeleton skeleton--stats" />
        <div className="loading-workspace"><div className="skeleton skeleton--map" /><div className="skeleton skeleton--panel" /></div>
      </main>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="standalone-state">
      <span className="state-icon state-icon--error"><Database size={24} /></span>
      <span className="eyebrow">Network unavailable</span>
      <h1>Continuum cannot reach the graph.</h1>
      <p>{message}</p>
      <div className="error-hint"><strong>Using CognoDB?</strong> Check the URI, credentials and that your cloud instance is running.</div>
      <button className="primary-button" type="button" onClick={onRetry}><RefreshCw size={16} /> Try again</button>
    </main>
  );
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
