
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  Gauge,
  MapPin,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  Siren,
  Sun,
  TrendingUp,
  X,
  Zap,
  Construction,
  Filter,
} from "lucide-react";

import CityMap from "./components/CityMap";
import TrafficChart from "./components/TrafficChart";

import type {
  DashboardData,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Intersection,
} from "./types";

type Theme = "light" | "dark";
type Page =
  | "overview"
  | "incidents"
  | "monitoring"
  | "analytics";

const API_TIMEOUT = 12_000;

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    API_TIMEOUT,
  );

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      throw new Error(
        body?.error ?? `Request failed (${response.status}).`,
      );
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatTime(value: string): string {
  if (!value) return "Recently";

  const normalized = value.includes(" ")
    ? value.replace(" ", "T")
    : value;

  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);

  const date = new Date(
    hasTimezone ? normalized : `${normalized}Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const minutes = Math.floor(
    (Date.now() - date.getTime()) / 60_000,
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function severityLabel(severity: IncidentSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function statusLabel(status: IncidentStatus): string {
  if (status === "investigating") return "Investigating";
  if (status === "resolved") return "Resolved";
  return "Open";
}

function congestionClass(value: string): string {
  return value.toLowerCase();
}

function downloadCsv(
  incidents: Incident[],
): void {
  const headers = [
    "ID",
    "Location",
    "Type",
    "Severity",
    "Status",
    "Description",
    "Reported At",
  ];

  const escapeCsv = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = incidents.map((incident) => [
    incident.id,
    incident.location,
    incident.type,
    incident.severity,
    incident.status,
    incident.description,
    incident.reportedAt,
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `aykel-connect-incidents-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = "green",
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Activity;
  trend?: string;
  tone?: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{title}</span>
        <span className={`metric-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>

      <div className="metric-value">
        {value}
      </div>

      <div className="metric-bottom">
        <span className="metric-description">
          {description}
        </span>

        {trend && (
          <span className="metric-trend">
            <TrendingUp size={13} />
            {trend}
          </span>
        )}
      </div>
    </article>
  );
}

function IncidentRow({
  incident,
  onStatusChange,
}: {
  incident: Incident;
  onStatusChange: (
    id: number,
    status: IncidentStatus,
  ) => void;
}) {
  return (
    <div className="incident-row">
      <div className="incident-indicator">
        <span className={`severity-dot ${incident.severity}`} />
      </div>

      <div className="incident-main">
        <div className="incident-title-line">
          <strong>{incident.type}</strong>

          <span className={`severity-badge ${incident.severity}`}>
            {severityLabel(incident.severity)}
          </span>
        </div>

        <div className="incident-location">
          <MapPin size={13} />
          {incident.location}
        </div>

        {incident.description && (
          <p className="incident-description">
            {incident.description}
          </p>
        )}

        <div className="incident-meta">
          <span>
            <Clock3 size={12} />
            {formatTime(incident.reportedAt)}
          </span>

          <span className={`status-badge ${incident.status}`}>
            {statusLabel(incident.status)}
          </span>
        </div>
      </div>

      <div className="incident-actions">
        {incident.status !== "resolved" && (
          <button
            className="icon-button"
            title={
              incident.status === "open"
                ? "Start investigation"
                : "Resolve incident"
            }
            aria-label={
              incident.status === "open"
                ? "Start investigation"
                : "Resolve incident"
            }
            onClick={() =>
              onStatusChange(
                incident.id,
                incident.status === "open"
                  ? "investigating"
                  : "resolved",
              )
            }
          >
            {incident.status === "open"
              ? <ArrowRight size={17} />
              : <Check size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("aykel-connect-theme");

      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const [page, setPage] = useState<Page>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState("all");

  const [selectedIntersection, setSelectedIntersection] =
    useState<string | null>(null);

  const [chartHours, setChartHours] =
    useState<6 | 12>(6);

  const [now, setNow] = useState(new Date());

  const [report, setReport] = useState({
    location: "",
    type: "Road damage",
    severity: "medium" as IncidentSeverity,
    description: "",
    intersectionId: "",
  });

  const [reporting, setReporting] = useState(false);

  const [toast, setToast] = useState("");

  const showToast = useCallback((message: string) => {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 3500);
  }, []);

  const refresh = useCallback(async (
    showLoading = false,
  ) => {
    if (showLoading) setRefreshing(true);

    try {
      const data = await api<DashboardData>(
        "/api/dashboard",
      );

      setDashboard(data);
      setError("");

      setSelectedIntersection((current) => {
        if (
          current &&
          data.intersections.some((item) => item.id === current)
        ) {
          return current;
        }

        return data.intersections[0]?.id ?? null;
      });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to load dashboard.";

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);

    const interval = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data,
        ) as DashboardData;

        setDashboard(data);
        setError("");
      } catch {
        // Ignore malformed event messages.
      }
    };

    source.onerror = () => {
      // EventSource automatically attempts to reconnect.
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(
        "aykel-connect-theme",
        theme,
      );
    } catch {
      // Theme still works for the current session.
    }
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const intersections = dashboard?.intersections ?? [];
  const incidents = dashboard?.incidents ?? [];

  const activeIncidents = incidents.filter(
    (incident) => incident.status !== "resolved",
  );

  const filteredIntersections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return intersections.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.district.toLowerCase().includes(query);

      return matchesSearch;
    });
  }, [intersections, search]);

  const filteredIncidents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesSearch =
        !query ||
        incident.location.toLowerCase().includes(query) ||
        incident.type.toLowerCase().includes(query) ||
        incident.description.toLowerCase().includes(query);

      const matchesSeverity =
        severityFilter === "all" ||
        incident.severity === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [incidents, search, severityFilter]);

  const selected = intersections.find(
    (item) => item.id === selectedIntersection,
  );

  const trafficData = useMemo(() => {
    const points = dashboard?.trend ?? [];

    return points.slice(
      Math.max(0, points.length - (chartHours === 6 ? 6 : 12)),
    );
  }, [dashboard, chartHours]);

  async function changeIncidentStatus(
    id: number,
    status: IncidentStatus,
  ) {
    try {
      await api<Incident>(
        `/api/incidents/${id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      await refresh();

      showToast(
        `Incident marked as ${statusLabel(status).toLowerCase()}.`,
      );
    } catch (requestError) {
      showToast(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update incident.",
      );
    }
  }

  async function submitIncident(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!report.location.trim()) {
      showToast("Please enter the incident location.");
      return;
    }

    if (!report.type.trim()) {
      showToast("Please select an incident type.");
      return;
    }

    setReporting(true);

    try {
      await api<Incident>("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          location: report.location.trim(),
          type: report.type,
          severity: report.severity,
          description: report.description.trim(),
          intersectionId: report.intersectionId || null,
        }),
      });

      setReport({
        location: "",
        type: "Road damage",
        severity: "medium",
        description: "",
        intersectionId: "",
      });

      setReportOpen(false);

      await refresh();

      showToast("Your community report was submitted.");
    } catch (requestError) {
      showToast(
        requestError instanceof Error
          ? requestError.message
          : "Unable to submit report.",
      );
    } finally {
      setReporting(false);
    }
  }

  async function toggleSignal(intersection: Intersection) {
    try {
      await api<Intersection>(
        `/api/intersections/${intersection.id}/optimize`,
        { method: "POST" },
      );

      await refresh();

      showToast(
        `${intersection.name}: signal mode updated in the demo.`,
      );
    } catch (requestError) {
      showToast(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update signal mode.",
      );
    }
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMobileMenuOpen(false);
    setSearch("");
  }

  const pageTitle = {
    overview: "Community overview",
    incidents: "Community reports",
    monitoring: "Traffic monitoring",
    analytics: "Traffic analytics",
  }[page];

  const dateLabel = now.toLocaleDateString(
    undefined,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  if (loading && !dashboard) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          <Activity size={28} />
        </div>
        <h2>Aykel Connect</h2>
        <p>Connecting to community operations...</p>
        <div className="loading-bar">
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} />
          </div>

          <div className="brand-copy">
            <strong>Aykel Connect</strong>
            <span>COMMUNITY OPERATIONS</span>
          </div>

          <button
            className="mobile-close icon-button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-card">
          <div className="workspace-icon">
            <MapPin size={17} />
          </div>

          <div>
            <strong>Aykel Town</strong>
            <span>Community workspace</span>
          </div>

          <ChevronDown size={15} />
        </div>

        <div className="nav-section-label">
          WORKSPACE
        </div>

        <nav className="navigation">
          <button
            className={`nav-link ${page === "overview" ? "active" : ""}`}
            onClick={() => navigate("overview")}
          >
            <Activity size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-link ${page === "incidents" ? "active" : ""}`}
            onClick={() => navigate("incidents")}
          >
            <Siren size={18} />
            <span>Community reports</span>

            {activeIncidents.length > 0 && (
              <span className="nav-count">
                {activeIncidents.length}
              </span>
            )}
          </button>

          <button
            className={`nav-link ${page === "monitoring" ? "active" : ""}`}
            onClick={() => navigate("monitoring")}
          >
            <Signal size={18} />
            <span>Traffic monitoring</span>
          </button>

          <button
            className={`nav-link ${page === "analytics" ? "active" : ""}`}
            onClick={() => navigate("analytics")}
          >
            <TrendingUp size={18} />
            <span>Analytics</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="connection-dot" />
            <div>
              <strong>System connected</strong>
              <span>API connection status</span>
            </div>
          </div>

          <button
            className="nav-link"
            onClick={() => showToast("Help center is not configured yet.")}
          >
            <CircleHelp size={18} />
            <span>Help & support</span>
          </button>

          <div className="profile-card">
            <div className="profile-avatar">AC</div>
            <div className="profile-info">
              <strong>Community Admin</strong>
              <span>Operations team</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button icon-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div>
              <div className="breadcrumb">
                Aykel Town <span>/</span> Operations
              </div>
              <h1>{pageTitle}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-date">
              <Clock3 size={15} />
              {dateLabel}
            </div>

            <button
              className="icon-button"
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
              disabled={refreshing}
              onClick={() => void refresh(true)}
            >
              <RefreshCw
                size={18}
                className={refreshing ? "spin" : ""}
              />
            </button>

            <button
              className="icon-button notification-button"
              title="Notifications"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell size={18} />
              {activeIncidents.length > 0 && (
                <span className="notification-dot" />
              )}
            </button>

            <button
              className="icon-button"
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              aria-label="Toggle theme"
              onClick={() =>
                setTheme(theme === "light" ? "dark" : "light")
              }
            >
              {theme === "light"
                ? <Moon size={18} />
                : <Sun size={18} />}
            </button>
          </div>

          {notificationsOpen && (
            <div className="notification-panel">
              <div className="panel-heading">
                <strong>Notifications</strong>
                <button
                  className="icon-button"
                  onClick={() => setNotificationsOpen(false)}
                  aria-label="Close notifications"
                >
                  <X size={16} />
                </button>
              </div>

              {activeIncidents.length === 0 ? (
                <p className="empty-message">
                  No active community reports.
                </p>
              ) : (
                activeIncidents.slice(0, 5).map((incident) => (
                  <div className="notification-item" key={incident.id}>
                    <span className={`severity-dot ${incident.severity}`} />
                    <div>
                      <strong>{incident.type}</strong>
                      <span>{incident.location}</span>
                      <small>{formatTime(incident.reportedAt)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                COMMUNITY OPERATIONS CENTER
              </div>
              <h2>Good day, Community Team</h2>
              <p>
                Monitor local activity, review reports and coordinate responses.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setReportOpen(true)}
            >
              <Plus size={17} />
              New community report
            </button>
          </div>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              <div>
                <strong>Connection problem</strong>
                <span>{error}</span>
              </div>
              <button
                className="secondary-button"
                onClick={() => void refresh(true)}
              >
                Try again
              </button>
            </div>
          )}

          <div className="demo-banner">
            <span className="demo-icon">
              <Activity size={16} />
            </span>
            <span>
              <strong>Demonstration environment</strong>
              Traffic readings, intersection locations and signal controls
              are simulated. Community reports are stored in your local database.
            </span>
          </div>

          <section className="metrics-grid">
            <MetricCard
              title="Monitored intersections"
              value={dashboard?.summary.monitoredIntersections ?? 0}
              description="Demo network locations"
              icon={MapPin}
              tone="green"
            />

            <MetricCard
              title="Average traffic speed"
              value={`${dashboard?.summary.averageSpeed ?? 0} km/h`}
              description="Simulated traffic readings"
              icon={Gauge}
              tone="blue"
            />

            <MetricCard
              title="Active reports"
              value={dashboard?.summary.activeIncidents ?? 0}
              description="Unresolved community reports"
              icon={Siren}
              tone="orange"
            />

            <MetricCard
              title="Adaptive signals"
              value={dashboard?.summary.adaptiveSignals ?? 0}
              description="Simulated signal settings"
              icon={Zap}
              tone="purple"
            />
          </section>

          {page === "overview" && (
            <>
              <section className="content-grid">
                <div className="panel map-panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">NETWORK OVERVIEW</div>
                      <h3>Traffic demonstration network</h3>
                      <p>Illustrative intersection positions</p>
                    </div>

                    <span className="demo-tag">SIMULATED</span>
                  </div>

                  <CityMap
                    intersections={intersections}
                    onSelect={setSelectedIntersection}
                    selectedId={selectedIntersection}
                  />
                </div>

                <div className="panel traffic-panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">TRAFFIC ANALYTICS</div>
                      <h3>Traffic volume trend</h3>
                      <p>Recorded demonstration readings</p>
                    </div>

                    <select
                      className="small-select"
                      value={chartHours}
                      onChange={(event) =>
                        setChartHours(
                          Number(event.target.value) as 6 | 12,
                        )
                      }
                      aria-label="Chart time range"
                    >
                      <option value={6}>6 points</option>
                      <option value={12}>12 points</option>
                    </select>
                  </div>

                  <div className="chart-summary">
                    <strong>
                      {formatNumber(
                        trafficData.at(-1)?.volume ?? 0,
                      )}
                    </strong>
                    <span>vehicles per hour · latest reading</span>
                  </div>

                  <TrafficChart
                    data={trafficData}
                    hours={chartHours}
                  />

                  <div className="chart-footer">
                    <span><span className="legend-dot green" />Traffic volume</span>
                    <span>Historical demo data</span>
                  </div>
                </div>
              </section>

              <section className="content-grid lower-grid">
                <div className="panel incidents-panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">COMMUNITY ACTIVITY</div>
                      <h3>Recent reports</h3>
                      <p>Latest submitted community incidents</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => navigate("incidents")}
                    >
                      View all <ArrowRight size={15} />
                    </button>
                  </div>

                  {incidents.length === 0 ? (
                    <div className="empty-state">
                      <ShieldCheck size={28} />
                      <strong>No reports yet</strong>
                      <span>Community reports will appear here.</span>
                    </div>
                  ) : (
                    <div className="incident-list">
                      {incidents.slice(0, 5).map((incident) => (
                        <IncidentRow
                          key={incident.id}
                          incident={incident}
                          onStatusChange={changeIncidentStatus}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel recommendations-panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">SYSTEM INSIGHTS</div>
                      <h3>Recommendations</h3>
                      <p>Automated demonstration insights</p>
                    </div>
                    <span className="recommendation-icon">
                      <Zap size={18} />
                    </span>
                  </div>

                  {dashboard?.recommendations.length ? (
                    <div className="recommendation-list">
                      {dashboard.recommendations.map((item) => (
                        <div className="recommendation-item" key={item.id}>
                          <span className={`recommendation-priority ${item.priority}`} />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.reason}</p>
                            <button
                              className="text-button"
                              onClick={() => {
                                if (item.kind === "incident") {
                                  navigate("incidents");
                                } else {
                                  setSelectedIntersection(item.targetId);
                                  navigate("monitoring");
                                }
                              }}
                            >
                              {item.actionLabel}
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Check size={27} />
                      <strong>No recommendations</strong>
                      <span>There are no current system recommendations.</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {page === "incidents" && (
            <section className="panel full-panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">REPORT MANAGEMENT</div>
                  <h3>Community reports</h3>
                  <p>Review, investigate and resolve reported issues.</p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => setReportOpen(true)}
                >
                  <Plus size={16} />
                  Submit report
                </button>
              </div>

              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reports..."
                  />
                </div>

                <div className="filter-control">
                  <Filter size={15} />
                  <select
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value)}
                    aria-label="Filter by severity"
                  >
                    <option value="all">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => downloadCsv(filteredIncidents)}
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>

              <div className="incident-list">
                {filteredIncidents.length === 0 ? (
                  <div className="empty-state">
                    <Search size={28} />
                    <strong>No matching reports</strong>
                    <span>Try changing your search or filters.</span>
                  </div>
                ) : (
                  filteredIncidents.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      onStatusChange={changeIncidentStatus}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          {page === "monitoring" && (
            <section className="panel full-panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">DEMONSTRATION NETWORK</div>
                  <h3>Traffic monitoring</h3>
                  <p>Simulated readings from the demonstration intersections.</p>
                </div>

                <span className="demo-tag">SIMULATED DATA</span>
              </div>

              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search intersections or districts..."
                  />
                </div>
              </div>

              <div className="intersection-grid">
                {filteredIntersections.map((intersection) => (
                  <article
                    className={`intersection-card ${selectedIntersection === intersection.id ? "selected" : ""}`}
                    key={intersection.id}
                  >
                    <div className="intersection-card-top">
                      <div className="intersection-icon">
                        <CarFront size={20} />
                      </div>

                      <span className={`congestion-badge ${congestionClass(intersection.congestion)}`}>
                        {intersection.congestion}
                      </span>
                    </div>

                    <h4>{intersection.name}</h4>
                    <span className="intersection-district">
                      <MapPin size={13} />
                      {intersection.district}
                    </span>

                    <div className="intersection-stats">
                      <div>
                        <span>Speed</span>
                        <strong>{intersection.speed} km/h</strong>
                      </div>
                      <div>
                        <span>Vehicles/hour</span>
                        <strong>{formatNumber(intersection.vehiclesPerHour)}</strong>
                      </div>
                      <div>
                        <span>Waiting time</span>
                        <strong>{intersection.waitSeconds}s</strong>
                      </div>
                      <div>
                        <span>Signal phase</span>
                        <strong>{intersection.signalPhase}</strong>
                      </div>
                    </div>

                    <div className="intersection-card-footer">
                      <span className="signal-mode">
                        <span className={`signal-dot ${intersection.mode}`} />
                        {intersection.mode === "adaptive" ? "Adaptive" : "Fixed"} mode
                      </span>

                      <button
                        className="text-button"
                        onClick={() => void toggleSignal(intersection)}
                      >
                        Switch mode <ArrowRight size={13} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {filteredIntersections.length === 0 && (
                <div className="empty-state">
                  No intersections match your search.
                </div>
              )}
            </section>
          )}

          {page === "analytics" && (
            <>
              <section className="metrics-grid analytics-metrics">
                <MetricCard
                  title="Congestion index"
                  value={`${dashboard?.summary.congestionIndex ?? 0}%`}
                  description="Calculated from average speed"
                  icon={Gauge}
                  tone="orange"
                />

                <MetricCard
                  title="Severe congestion"
                  value={dashboard?.summary.severeCongestion ?? 0}
                  description="Intersections with severe congestion"
                  icon={AlertTriangle}
                  tone="red"
                />

                <MetricCard
                  title="Active reports"
                  value={dashboard?.summary.activeIncidents ?? 0}
                  description="Current unresolved reports"
                  icon={Siren}
                  tone="purple"
                />

                <MetricCard
                  title="Adaptive signals"
                  value={dashboard?.summary.adaptiveSignals ?? 0}
                  description="Simulated adaptive signal settings"
                  icon={Zap}
                  tone="blue"
                />
              </section>

              <section className="panel full-panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">TRAFFIC ANALYTICS</div>
                    <h3>Traffic volume history</h3>
                    <p>
                      Source: {dashboard?.trendSource ?? "modeled"} demonstration data
                    </p>
                  </div>

                  <select
                    className="small-select"
                    value={chartHours}
                    onChange={(event) =>
                      setChartHours(
                        Number(event.target.value) as 6 | 12,
                      )
                    }
                  >
                    <option value={6}>Last 6 points</option>
                    <option value={12}>Last 12 points</option>
                  </select>
                </div>

                <TrafficChart
                  data={trafficData}
                  hours={chartHours}
                />

                {dashboard?.forecast && (
                  <div className="forecast-panel">
                    <div className="forecast-icon">
                      <TrendingUp size={20} />
                    </div>

                    <div>
                      <strong>60-minute demonstration forecast</strong>
                      <p>
                        Predicted volume:{" "}
                        {formatNumber(dashboard.forecast.predictedVolume)}
                        {" vehicles/hour"}
                      </p>
                      <span>
                        Expected direction: {dashboard.forecast.direction}
                        {" · "}
                        Change: {dashboard.forecast.change}%
                      </span>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="dashboard-footer">
            <div>
              <span className="footer-status-dot" />
              Connected to Aykel Connect API
            </div>

            <span>
              Last updated:{" "}
              {dashboard?.updatedAt
                ? formatTime(dashboard.updatedAt)
                : "Waiting for data"}
            </span>
          </footer>
        </div>
      </main>

      {reportOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReportOpen(false);
            }
          }}
        >
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">COMMUNITY REPORTING</div>
                <h3 id="report-modal-title">Submit a report</h3>
                <p>Tell the operations team about a local issue.</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setReportOpen(false)}
                aria-label="Close report form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submitIncident}>
              <label>
                Location *
                <input
                  required
                  maxLength={120}
                  value={report.location}
                  onChange={(event) =>
                    setReport({
                      ...report,
                      location: event.target.value,
                    })
                  }
                  placeholder="Enter the location of the issue"
                />
              </label>

              <label>
                Related demonstration intersection
                <select
                  value={report.intersectionId}
                  onChange={(event) =>
                    setReport({
                      ...report,
                      intersectionId: event.target.value,
                    })
                  }
                >
                  <option value="">Not linked to an intersection</option>

                  {intersections.map((intersection) => (
                    <option
                      key={intersection.id}
                      value={intersection.id}
                    >
                      {intersection.name} — {intersection.district}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Issue type *
                <select
                  value={report.type}
                  onChange={(event) =>
                    setReport({
                      ...report,
                      type: event.target.value,
                    })
                  }
                >
                  <option>Road damage</option>
                  <option>Vehicle collision</option>
                  <option>Roadwork</option>
                  <option>Traffic congestion</option>
                  <option>Signal malfunction</option>
                  <option>Pedestrian safety</option>
                  <option>Street lighting</option>
                  <option>Waste management</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Severity
                <select
                  value={report.severity}
                  onChange={(event) =>
                    setReport({
                      ...report,
                      severity: event.target.value as IncidentSeverity,
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label>
                Description
                <textarea
                  maxLength={500}
                  rows={4}
                  value={report.description}
                  onChange={(event) =>
                    setReport({
                      ...report,
                      description: event.target.value,
                    })
                  }
                  placeholder="Describe the issue and any useful details..."
                />
                <span className="character-count">
                  {report.description.length}/500
                </span>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setReportOpen(false)}
                  disabled={reporting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={reporting}
                >
                  {reporting ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Submit report
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast-message" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
