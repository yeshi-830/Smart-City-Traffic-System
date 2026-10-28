import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell,
  CarFront, Check, ChevronDown, CircleHelp, Clock3, CloudSun, Construction,
  Crosshair, Gauge, MapPin, Menu, Moon, Plus, RefreshCw, Search, ShieldCheck,
  Signal, Siren, SlidersHorizontal, Sparkles, Sun, TrendingUp, X, Zap,
} from "lucide-react";
import CityMap from "./components/CityMap";
import TrafficChart from "./components/TrafficChart";
import type { DashboardData, Incident, IncidentSeverity, IncidentStatus, Intersection, TrafficRecommendation } from "./types";

const severityOptions: IncidentSeverity[] = ["low", "medium", "high", "critical"];
type Theme = "light" | "dark";
type Panel = "help" | "notifications" | null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function formatTime(value: string): string {
  const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  return minutes < 1 ? "Just now" : `${minutes} min ago`;
}

function metricLabel(congestion: Intersection["congestion"]): string {
  return congestion.toLowerCase();
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem("flowcity-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [focusedIncidentId, setFocusedIncidentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [formIntersectionId, setFormIntersectionId] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [incidentSeverity, setIncidentSeverity] = useState<"all" | IncidentSeverity>("all");
  const [chartRange, setChartRange] = useState<6 | 12>(12);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("flowcity-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!showIncidentForm && !openPanel) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowIncidentForm(false);
        setOpenPanel(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [openPanel, showIncidentForm]);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api<DashboardData>("/api/dashboard");
      setDashboard(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load traffic operations data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const stream = new EventSource("/api/events");
    stream.onopen = () => setLiveConnected(true);
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DashboardData;
        setDashboard(data);
        setError("");
        setLoading(false);
      } catch (cause) {
        setError(cause instanceof Error ? `Invalid live dashboard update: ${cause.message}` : "Invalid live dashboard update.");
      }
    };
    stream.onerror = () => setLiveConnected(false);
    return () => stream.close();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function announce(message: string, isError = false) {
    setNoticeError(isError);
    setNotice(message);
  }

  function openIncidentForm() {
    setFormIntersectionId(selectedId ?? "");
    setFormLocation("");
    setShowIncidentForm(true);
  }

  const selected = dashboard?.intersections.find((item) => item.id === selectedId) ?? null;
  const activeIncidents = dashboard?.incidents.filter((item) => item.status !== "resolved") ?? [];
  const visibleIncidents = activeIncidents.filter((item) =>
    incidentSeverity === "all" || item.severity === incidentSeverity,
  );
  const visibleTrend = (dashboard?.trend ?? []).slice(-chartRange);
  const averageTrend = visibleTrend.length
    ? Math.round(visibleTrend.reduce((total, point) => total + point.volume, 0) / visibleTrend.length)
    : null;
  const filtered = useMemo(() => {
    if (!dashboard) return [];
    const needle = search.trim().toLowerCase();
    return dashboard.intersections.filter((item) =>
      !needle || `${item.name} ${item.district}`.toLowerCase().includes(needle),
    );
  }, [dashboard, search]);

  function focusIncident(incident: Incident) {
    setOpenPanel(null);
    setIncidentSeverity("all");
    setFocusedIncidentId(String(incident.id));
    window.setTimeout(() => {
      const row = document.getElementById(`incident-${incident.id}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus();
    }, 40);
  }

  async function changeSignalMode(intersection: Intersection) {
    try {
      await api<Intersection>(`/api/intersections/${intersection.id}/optimize`, { method: "POST" });
      announce(`Signal control updated for ${intersection.name}.`);
      await refresh(true);
    } catch (cause) {
      announce(cause instanceof Error ? cause.message : "Could not update signal control.", true);
    }
  }

  async function changeIncidentStatus(incident: Incident, status: IncidentStatus) {
    try {
      await api<Incident>(`/api/incidents/${incident.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      announce(status === "resolved" ? "Incident marked as resolved." : "Incident status updated.");
      await refresh(true);
    } catch (cause) {
      announce(cause instanceof Error ? cause.message : "Could not update incident.", true);
    }
  }

  async function submitIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const intersectionId = String(form.get("intersectionId") ?? "");
    try {
      await api<Incident>("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          intersectionId: intersectionId || null,
          location: String(form.get("location") ?? ""),
          type: String(form.get("type") ?? ""),
          severity: String(form.get("severity") ?? "medium"),
          description: String(form.get("description") ?? ""),
        }),
      });
      setShowIncidentForm(false);
      announce("Incident reported and added to the response queue.");
      await refresh(true);
    } catch (cause) {
      announce(cause instanceof Error ? cause.message : "Could not report the incident.", true);
    } finally {
      setSaving(false);
    }
  }

  function openRecommendation(recommendation: TrafficRecommendation) {
    if (recommendation.kind === "incident") {
      setIncidentSeverity("all");
      setFocusedIncidentId(recommendation.targetId);
      document.getElementById("incidents")?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        const row = document.getElementById(`incident-${recommendation.targetId}`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
        row?.focus();
      }, 250);
      return;
    }

    setSelectedId(recommendation.targetId);
    window.setTimeout(() => document.getElementById("intersections")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  }

  const summary = dashboard?.summary;
  const now = new Date();
  const timeDisplay = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const greeting = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";
  const dateDisplay = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div>
          <div className="brand-name">flow<span>city</span><small>TRAFFIC OPERATIONS</small></div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-picker">
          <div className="city-avatar">MC</div>
          <div className="workspace-copy"><strong>Metro City</strong><span>Operations center</span></div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <a href="#overview" className="nav-link active" onClick={() => setMobileNavOpen(false)}><Crosshair size={17} />Overview<span className="nav-current-dot" /></a>
          <a href="#intersections" className="nav-link" onClick={() => setMobileNavOpen(false)}><MapPin size={17} />Intersections</a>
          <a href="#incidents" className="nav-link" onClick={() => setMobileNavOpen(false)}><Siren size={17} />Incident response{summary?.activeIncidents ? <span className="nav-count">{summary.activeIncidents}</span> : null}</a>
          <a href="#insights" className="nav-link" onClick={() => setMobileNavOpen(false)}><TrendingUp size={17} />Traffic insights</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-heading"><span className={`system-online-dot${!liveConnected ? " status-offline" : ""}`} />LIVE SIMULATION<span>DEMO</span></div>
            <strong>{error ? "API connection unavailable" : liveConnected ? "Live feed connected" : "Reconnecting to live feed"}</strong>
            <div className="system-subline"><span>Traffic readings</span><span className="data-source">SIMULATED</span></div>
          </div>
          <div className="user-profile">
            <div className="user-avatar">MY</div>
            <div className="user-copy"><strong>Mihiretu Yeshi</strong><span>Traffic operator</span></div>
            <button className="icon-button help-button" aria-label="Help" onClick={() => setOpenPanel("help")}><CircleHelp size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-content" id="overview">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Overview</strong></div>
          <div className="topbar-right">
            <div className="weather-chip" title="Sample weather — not a live forecast"><CloudSun size={16} /><strong>72°</strong><span>Sample conditions</span><i /></div>
            <div className="topbar-divider" />
            <span className="clock"><Clock3 size={14} />{timeDisplay}</span>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${activeIncidents.length} active incidents`}
              title="View active incident notifications"
              onClick={() => setOpenPanel(openPanel === "notifications" ? null : "notifications")}
              aria-haspopup="dialog"
            ><Bell size={17} />{activeIncidents.length > 0 && <span />}</button>
            <div className="topbar-avatar">MY</div>
          </div>
        </header>

        <div className="dashboard">
          <div className="page-heading">
            <div>
              <div className="heading-kicker"><span className={`live-pulse${liveConnected ? "" : " disconnected"}`} />{liveConnected ? "LIVE SIMULATION" : "RECONNECTING"} <span>·</span> {dateDisplay}</div>
              <h1>Good {greeting}, Mihiretu <span className="wave">✳</span></h1>
              <p>Here’s what’s happening across Metro City today.</p>
            </div>
            <div className="heading-actions">
              <button className={`button button-secondary${refreshing ? " is-loading" : ""}`} onClick={() => void refresh(true)} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? "spin" : ""} />Refresh
              </button>
              <button className="button button-primary" onClick={openIncidentForm}><Plus size={16} />Report incident</button>
            </div>
          </div>

          {error && <div className="error-banner"><AlertTriangle size={17} /><div><strong>Unable to load live dashboard</strong><span>{error} Start the application with <code>npm run dev</code>.</span></div><button className="text-button" onClick={() => void refresh()}>Try again</button></div>}

          <section className="metrics-grid" aria-label="Traffic network summary">
            <article className="metric-card">
              <div className="metric-top"><span className="metric-icon mint"><Signal size={17} /></span><span className="metric-kicker">NETWORK STATUS</span><button className="metric-more" aria-label="View signal details" title="View intersections" onClick={() => document.getElementById("intersections")?.scrollIntoView({ behavior: "smooth", block: "center" })}><ArrowUpRight size={15} /></button></div>
              <div className="metric-value">{loading ? "—" : `${summary?.monitoredIntersections ?? 0}`}<span className="metric-unit">/ 12</span></div>
              <div className="metric-foot"><span className="status-dot" />{summary?.adaptiveSignals ?? 0} adaptive signals active</div>
              <div className="metric-progress"><span style={{ width: `${Math.min(100, (summary?.monitoredIntersections ?? 0) / 12 * 100)}%` }} /></div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-icon blue"><Gauge size={17} /></span><span className="metric-kicker">AVERAGE SPEED</span><span className="metric-trend metric-demo-tag">SIMULATED</span></div>
              <div className="metric-value">{loading ? "—" : summary?.averageSpeed}<span className="metric-unit">mph</span></div>
              <div className="metric-foot">Across all monitored corridors</div>
              <div className="micro-bars">{[32, 47, 39, 55, 44, 67, 51, 75, 60, 80, 65, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-icon amber"><Siren size={17} /></span><span className="metric-kicker">ACTIVE INCIDENTS</span><span className={`metric-trend${(summary?.activeIncidents ?? 0) > 2 ? " negative" : " positive"}`}>{(summary?.activeIncidents ?? 0) > 2 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{summary?.activeIncidents ? " needs attention" : " clear"}</span></div>
              <div className="metric-value">{loading ? "—" : String(summary?.activeIncidents ?? 0).padStart(2, "0")}<span className="metric-unit"> active</span></div>
              <div className="metric-foot"><span className="incident-foot-dot" />{dashboard?.incidents.filter((item) => item.severity === "critical" && item.status !== "resolved").length ?? 0} critical priority</div>
              <div className="incident-stack">{(dashboard?.incidents ?? []).slice(0, 8).map((incident) => <i key={incident.id} className={`incident-pip ${incident.severity}`} />)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-icon violet"><CarFront size={18} /></span><span className="metric-kicker">CONGESTION INDEX</span><span className="metric-trend metric-demo-tag">SIMULATED</span></div>
              <div className="metric-value">{loading ? "—" : summary?.congestionIndex}<span className="metric-unit">/ 100</span></div>
              <div className="metric-foot">City-wide traffic pressure</div>
              <div className="metric-progress violet-progress"><span style={{ width: `${summary?.congestionIndex ?? 0}%` }} /></div>
            </article>
          </section>

          <section className="recommendations-card" aria-labelledby="recommendations-title">
            <div className="recommendations-heading">
              <div>
                <span className="eyebrow">DECISION SUPPORT · OPERATOR REVIEW</span>
                <h2 id="recommendations-title">Recommended next steps</h2>
              </div>
              <span className="recommendations-note"><Sparkles size={13} />Rule-based · simulated data</span>
            </div>
            {loading && !dashboard ? (
              <div className="recommendations-clear">Waiting for the first live traffic update…</div>
            ) : (dashboard?.recommendations ?? []).length > 0 ? (
              <div className="recommendation-list">
                {dashboard?.recommendations.map((recommendation) => (
                  <article className={`recommendation-item ${recommendation.priority}`} key={recommendation.id}>
                    <span className="recommendation-icon"><AlertTriangle size={16} /></span>
                    <div className="recommendation-copy">
                      <div><span className={`recommendation-priority ${recommendation.priority}`}>{recommendation.priority}</span><strong>{recommendation.title}</strong></div>
                      <p>{recommendation.reason}</p>
                    </div>
                    <button className="recommendation-action" onClick={() => openRecommendation(recommendation)}>
                      {recommendation.actionLabel}<ArrowRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="recommendations-clear"><ShieldCheck size={17} />No urgent actions suggested. Continue routine monitoring.</div>
            )}
            <p className="recommendations-disclaimer">Recommendations are decision support only. Review conditions before taking action; no physical signals are controlled.</p>
          </section>

          <div className="content-grid">
            <div className="primary-column">
              <CityMap
                intersections={dashboard?.intersections ?? []}
                onSelect={(id) => {
                  setSelectedId(id);
                  window.setTimeout(() => document.getElementById("intersections")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
                }}
                selectedId={selectedId}
              />
              <section className="traffic-card" id="insights">
                <div className="section-head">
                  <div><span className="eyebrow">NETWORK PERFORMANCE</span><h2>Traffic volume</h2></div>
                  <label className="chart-range">
                    <span className="visually-hidden">Traffic chart time range</span>
                    <select className="select-button" value={chartRange} onChange={(event) => setChartRange(Number(event.target.value) as 6 | 12)}>
                      <option value={6}>Last 6 hours</option>
                      <option value={12}>Last 12 hours</option>
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                  </label>
                </div>
                <div className="chart-summary"><span className="chart-value">{averageTrend ?? "—"}<span>%</span></span><span className="chart-summary-label">avg. modeled road capacity</span></div>
                <TrafficChart data={visibleTrend} />
                <div className="chart-foot"><span><i className="chart-key" />Modeled road capacity</span><span>Hourly average · Simulated data</span></div>
              </section>
            </div>

            <div className="side-column">
              <section className="incidents-card" id="incidents">
                <div className="section-head incidents-heading">
                  <div><span className="eyebrow">RESPONSE QUEUE</span><h2>Active incidents <span className="heading-count">{summary?.activeIncidents ?? 0}</span></h2></div>
                  <label className="incident-filter" title="Filter incidents by severity">
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    <select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value as "all" | IncidentSeverity)} aria-label="Filter incidents by severity">
                      <option value="all">All severities</option>
                      {[...severityOptions].reverse().map((severity) => <option key={severity} value={severity}>{severity[0].toUpperCase() + severity.slice(1)}</option>)}
                    </select>
                    <ChevronDown size={12} aria-hidden="true" />
                  </label>
                </div>
                <div className="incident-list">
                  {visibleIncidents.map((incident) => (
                    <IncidentRow key={incident.id} incident={incident} recommended={focusedIncidentId === String(incident.id)} onAdvance={() => void changeIncidentStatus(incident, incident.status === "open" ? "investigating" : "resolved")} />
                  ))}
                  {!loading && visibleIncidents.length === 0 && (
                    <div className="empty-incidents">
                      {activeIncidents.length === 0 ? <ShieldCheck size={24} /> : <SlidersHorizontal size={22} />}
                      <strong>{activeIncidents.length === 0 ? "All clear" : "No matching incidents"}</strong>
                      <span>{activeIncidents.length === 0 ? "No active incidents in the response queue." : "Try selecting another severity."}</span>
                    </div>
                  )}
                </div>
                <button className="incident-add" onClick={openIncidentForm}><Plus size={15} /> Report a new incident</button>
              </section>

              <section className="intersection-card" id="intersections">
                <div className="section-head intersection-heading">
                  <div><span className="eyebrow">MONITORED NETWORK</span><h2>Intersections</h2></div>
                  <span className="online-badge"><i /> ONLINE</span>
                </div>
                <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an intersection..." aria-label="Search intersections" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
                <div className="intersection-list">
                  {filtered.map((intersection) => (
                    <button
                      className={`intersection-row${selectedId === intersection.id ? " selected" : ""}`}
                      key={intersection.id}
                      onClick={() => setSelectedId(selectedId === intersection.id ? null : intersection.id)}
                    >
                      <span className={`intersection-signal ${intersection.congestion.toLowerCase()}`}><i /></span>
                      <span className="intersection-name"><strong>{intersection.name}</strong><span>{intersection.district}</span></span>
                      <span className="intersection-speed"><strong>{intersection.speed}</strong><span>mph</span></span>
                      <span className={`congestion-label ${metricLabel(intersection.congestion)}`}>{intersection.congestion}</span>
                    </button>
                  ))}
                  {!loading && filtered.length === 0 && <div className="search-empty">No intersections match “{search}”.</div>}
                </div>
                {selected && (
                  <div className="intersection-detail">
                    <div className="detail-header"><div><span className="eyebrow">DEMO SIGNAL CONTROL · {selected.id.toUpperCase()}</span><strong>{selected.name}</strong></div><span className={`mode-badge ${selected.mode}`}>{selected.mode === "adaptive" ? <Sparkles size={12} /> : <Signal size={12} />}{selected.mode}</span></div>
                    <div className="detail-stats"><span><strong>{selected.vehiclesPerHour.toLocaleString()}</strong><small>vehicles / hr</small></span><span><strong>{selected.waitSeconds}s</strong><small>avg. wait</small></span><span><strong>{selected.dailyVehicles.toLocaleString()}</strong><small>vehicles / day</small></span></div>
                    <button className="optimize-button" onClick={() => void changeSignalMode(selected)}><Zap size={14} />{selected.mode === "adaptive" ? "Simulate fixed timing" : "Simulate adaptive timing"}<ArrowRight size={14} /></button>
                    <span className="operator-note"><ShieldCheck size={12} />Demo only — no physical signal is controlled</span>
                  </div>
                )}
                <div className="intersection-footer"><span>{filtered.length} monitored intersections</span><span className="sim-note"><Activity size={12} /> Simulation</span></div>
              </section>
            </div>
          </div>

          <footer className="dashboard-footer"><span>© 2026 FlowCity Operations</span><span><span className="footer-online-dot" />All systems operational</span><span>Traffic readings are simulated · Connect real sensors to go live</span><button className="footer-help" onClick={() => setOpenPanel("help")}><CircleHelp size={13} />Need help?</button></footer>
        </div>
      </main>

      {showIncidentForm && (
        <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowIncidentForm(false); }}>
          <section className="incident-modal" role="dialog" aria-modal="true" aria-labelledby="incident-form-title">
            <div className="modal-heading"><div><span className="eyebrow">INCIDENT RESPONSE</span><h2 id="incident-form-title">Report an incident</h2><p>Log an issue for the traffic operations team.</p></div><button className="icon-button" aria-label="Close dialog" onClick={() => setShowIncidentForm(false)}><X size={18} /></button></div>
            <form onSubmit={(event) => void submitIncident(event)}>
              <label>Incident type<select name="type" required defaultValue="Vehicle collision"><option>Vehicle collision</option><option>Signal malfunction</option><option>Roadwork</option><option>Pedestrian hazard</option><option>Road obstruction</option><option>Other</option></select></label>
              <label>Location<select name="intersectionId" value={formIntersectionId} onChange={(event) => { setFormIntersectionId(event.target.value); setFormLocation(""); }}><option value="">Unmonitored location</option>{(dashboard?.intersections ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.district}</option>)}</select><input name="location" value={formLocation || dashboard?.intersections.find((item) => item.id === formIntersectionId)?.name || ""} onChange={(event) => setFormLocation(event.target.value)} placeholder="Street or intersection location" maxLength={120} required /></label>
              <label>Severity<select name="severity" defaultValue="medium">{severityOptions.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}</select></label>
              <label>Description <span className="optional-label">Optional</span><textarea name="description" rows={3} maxLength={500} placeholder="Share any details that could help responders..." /></label>
              <div className="form-footer"><span><ShieldCheck size={14} />Visible to city operators</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}{saving ? "Submitting..." : "Submit report"}</button></div>
            </form>
          </section>
        </div>
      )}

      {openPanel && (
        <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpenPanel(null); }}>
          <section className="incident-modal info-modal" role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{openPanel === "help" ? "FLOWCITY GUIDE" : "INCIDENT RESPONSE"}</span>
                <h2 id="info-dialog-title">{openPanel === "help" ? "Dashboard help" : "Active notifications"}</h2>
                <p>{openPanel === "help" ? "Quick guidance for using the traffic operations dashboard." : `${activeIncidents.length} unresolved ${activeIncidents.length === 1 ? "incident" : "incidents"} need operator review.`}</p>
              </div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setOpenPanel(null)}><X size={18} /></button>
            </div>
            {openPanel === "help" ? (
              <div className="help-content">
                <p><strong>Monitor traffic:</strong> Select an intersection on the map or in the network list to view its simulated readings and demo signal mode.</p>
                <p><strong>Manage incidents:</strong> Report an incident, filter the response queue by severity, and advance open incidents through investigation to resolution.</p>
                <p><strong>Change appearance:</strong> Use the moon/sun button in the header to switch themes. Your choice is saved on this device.</p>
                <p className="help-disclaimer">Traffic data and signal controls are simulated. No physical traffic signals are controlled.</p>
              </div>
            ) : (
              <div className="notification-list">
                {activeIncidents.length > 0 ? activeIncidents.map((incident) => (
                  <button className="notification-item" key={incident.id} onClick={() => focusIncident(incident)}>
                    <span className={`severity-badge ${incident.severity}`}>{incident.severity}</span>
                    <span><strong>{incident.type}</strong><small>{incident.location} · {formatTime(incident.reportedAt)}</small></span>
                    <ArrowRight size={15} />
                  </button>
                )) : <div className="empty-incidents"><ShieldCheck size={24} /><strong>All clear</strong><span>No active incidents need review.</span></div>}
              </div>
            )}
          </section>
        </div>
      )}

      {notice && <div className={`toast${noticeError ? " toast-error" : ""}`} role={noticeError ? "alert" : "status"}>{noticeError ? <AlertTriangle size={16} /> : <Check size={16} />}<span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </div>
  );
}

function IncidentRow({ incident, recommended, onAdvance }: { incident: Incident; recommended: boolean; onAdvance: () => void }) {
  const Icon = incident.type.toLowerCase().includes("roadwork") ? Construction : incident.type.toLowerCase().includes("collision") ? CarFront : AlertTriangle;
  return (
    <article className={`incident-row${recommended ? " recommended" : ""}`} id={`incident-${incident.id}`} tabIndex={-1}>
      <span className={`incident-icon ${incident.severity}`}><Icon size={16} /></span>
      <div className="incident-copy"><strong>{incident.type}</strong><span><MapPin size={12} />{incident.location}</span><small><Clock3 size={11} />{formatTime(incident.reportedAt)}</small></div>
      <div className="incident-controls"><span className={`severity-badge ${incident.severity}`}>{incident.severity}</span><button className="incident-action" onClick={onAdvance} aria-label={incident.status === "open" ? "Start investigating incident" : "Resolve incident"} title={incident.status === "open" ? "Start investigating" : "Resolve incident"}>{incident.status === "open" ? <ArrowRight size={15} /> : <Check size={15} />}</button></div>
    </article>
  );
}
