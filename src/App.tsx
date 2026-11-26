
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
  Download,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudSun,
  Construction,
  Crosshair,
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
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import CityMap from "./components/CityMap";
import TrafficChart from "./components/TrafficChart";

import type {
  DashboardData,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Intersection,
  TrafficRecommendation,
} from "./types";

/* -------------------------------------------------------
   CONFIGURATION
------------------------------------------------------- */

const severityOptions: IncidentSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const emptyIntersections: Intersection[] = [];

const communityProblemTypes = [
  "Road damage",
  "Drainage or flooding",
  "Pedestrian safety",
  "Traffic or transport problem",
  "Road obstruction",
  "Street lighting",
  "Other",
];

type Theme = "light" | "dark";
type Panel = "help" | "notifications" | null;
type IntersectionFilter = "all" | "congested" | "clear";
type IntersectionSort = "priority" | "speed" | "name";
type DashboardSection =
  | "overview"
  | "intersections"
  | "incidents"
  | "insights";

/* -------------------------------------------------------
   API HELPER
------------------------------------------------------- */

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as { error?: string } | null;

    throw new Error(
      body?.error ?? `Request failed (${response.status}).`,
    );
  }

  return response.json() as Promise<T>;
}

/* -------------------------------------------------------
   DATE AND TIME HELPERS
------------------------------------------------------- */

function formatTime(value: string): string {
  if (!value) return "Recently";

  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);

  const normalized = value.includes(" ")
    ? value.replace(" ", "T")
    : value;

  const date = new Date(
    hasTimezone
      ? normalized
      : `${normalized}Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const difference = Date.now() - date.getTime();

  if (difference < 0) return "Just now";

  const minutes = Math.floor(difference / 60_000);

  if (minutes < 1) return "Just now";

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function metricLabel(
  congestion: Intersection["congestion"],
): string {
  return congestion.toLowerCase();
}

/* -------------------------------------------------------
   DASHBOARD COMPARISON
------------------------------------------------------- */

function sameDashboardContent(
  left: DashboardData,
  right: DashboardData,
): boolean {
  const {
    updatedAt: _leftUpdatedAt,
    ...leftContent
  } = left;

  const {
    updatedAt: _rightUpdatedAt,
    ...rightContent
  } = right;

  return (
    JSON.stringify(leftContent) ===
    JSON.stringify(rightContent)
  );
}

/* -------------------------------------------------------
   MAIN APPLICATION
------------------------------------------------------- */

export default function App() {
  /* THEME */

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme =
      window.localStorage.getItem("aykel-connect-theme") ??
      window.localStorage.getItem("flowcity-theme");

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      return savedTheme;
    }

    return window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
      ? "dark"
      : "light";
  });

  /* DASHBOARD DATA */

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  const [focusedIncidentId, setFocusedIncidentId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  /* REPORT FORM */

  const [showIncidentForm, setShowIncidentForm] =
    useState(false);

  const [formLocation, setFormLocation] = useState("");
  const [saving, setSaving] = useState(false);

  /* NOTIFICATIONS */

  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const [mobileNavOpen, setMobileNavOpen] =
    useState(false);

  const [openPanel, setOpenPanel] =
    useState<Panel>(null);

  /* FILTERS */

  const [incidentSeverity, setIncidentSeverity] =
    useState<"all" | IncidentSeverity>("all");

  const [intersectionFilter, setIntersectionFilter] =
    useState<IntersectionFilter>("all");

  const [intersectionSort, setIntersectionSort] =
    useState<IntersectionSort>("priority");

  const [chartRange, setChartRange] =
    useState<6 | 12>(12);

  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");

  const [now, setNow] = useState(() => new Date());

  /* -------------------------------------------------------
     THEME EFFECT
  ------------------------------------------------------- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    window.localStorage.setItem(
      "aykel-connect-theme",
      theme,
    );
  }, [theme]);

  /* -------------------------------------------------------
     ESCAPE KEY
  ------------------------------------------------------- */

  useEffect(() => {
    if (!showIncidentForm && !openPanel) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!saving) {
          setShowIncidentForm(false);
        }

        setOpenPanel(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [openPanel, showIncidentForm, saving]);

  /* -------------------------------------------------------
     CLOCK
  ------------------------------------------------------- */

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  /* -------------------------------------------------------
     ACTIVE SECTION TRACKING
  ------------------------------------------------------- */

  useEffect(() => {
    const sectionIds: DashboardSection[] = [
      "intersections",
      "incidents",
      "insights",
    ];

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(
        (section): section is HTMLElement =>
          section !== null,
      );

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top -
              right.boundingClientRect.top,
          )[0];

        const section =
          current &&
          sectionIds.find(
            (id) => id === current.target.id,
          );

        if (section) {
          setActiveSection(section);
        } else if (window.scrollY < 240) {
          setActiveSection("overview");
        }
      },
      {
        rootMargin: "-80px 0px -65% 0px",
      },
    );

    sections.forEach((section) =>
      observer.observe(section),
    );

    return () => observer.disconnect();
  }, []);

  /* -------------------------------------------------------
     REFRESH DASHBOARD
  ------------------------------------------------------- */

  const refresh = useCallback(
    async (quiet = false) => {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await api<DashboardData>(
          "/api/dashboard",
        );

        setDashboard((current) =>
          current &&
          sameDashboardContent(current, data)
            ? current
            : data,
        );

        setError("");
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load dashboard data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  /* -------------------------------------------------------
     INITIAL LOAD AND LIVE EVENTS
  ------------------------------------------------------- */

  useEffect(() => {
    void refresh();

    const stream = new EventSource("/api/events");

    stream.onopen = () => {
      setLiveConnected(true);
    };

    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data,
        ) as DashboardData;

        setDashboard((current) =>
          current &&
          sameDashboardContent(current, data)
            ? current
            : data,
        );

        setError("");
        setLoading(false);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `Invalid live dashboard update: ${cause.message}`
            : "Invalid live dashboard update.",
        );
      }
    };

    stream.onerror = () => {
      setLiveConnected(false);
    };

    return () => {
      stream.close();
    };
  }, [refresh]);

  /* -------------------------------------------------------
     TOAST NOTIFICATION
  ------------------------------------------------------- */

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  function announce(
    message: string,
    isError = false,
  ) {
    setNoticeError(isError);
    setNotice(message);
  }

  /* -------------------------------------------------------
     REPORT FORM OPENING
  ------------------------------------------------------- */

  function openIncidentForm() {
    setFormLocation("");
    setShowIncidentForm(true);
  }

  /* -------------------------------------------------------
     DASHBOARD DERIVED DATA
  ------------------------------------------------------- */

  const selected =
    dashboard?.intersections.find(
      (item) => item.id === selectedId,
    ) ?? null;

  const activeIncidents = useMemo(
    () =>
      dashboard?.incidents.filter(
        (item) => item.status !== "resolved",
      ) ?? [],
    [dashboard?.incidents],
  );

  const visibleIncidents = useMemo(
    () =>
      activeIncidents.filter(
        (item) =>
          incidentSeverity === "all" ||
          item.severity === incidentSeverity,
      ),
    [activeIncidents, incidentSeverity],
  );

  const visibleTrend = useMemo(
    () =>
      (dashboard?.trend ?? []).slice(-chartRange),
    [dashboard?.trend, chartRange],
  );

  const averageTrend = useMemo(
    () =>
      visibleTrend.length
        ? Math.round(
            visibleTrend.reduce(
              (total, point) => total + point.volume,
              0,
            ) / visibleTrend.length,
          )
        : null,
    [visibleTrend],
  );

  /* -------------------------------------------------------
     COMMUNITY REPORT METRICS
  ------------------------------------------------------- */

  const totalReports =
    dashboard?.incidents.length ?? 0;

  const openReports =
    dashboard?.incidents.filter(
      (item) => item.status === "open",
    ).length ?? 0;

  const investigatingReports =
    dashboard?.incidents.filter(
      (item) => item.status === "investigating",
    ).length ?? 0;

  const resolvedReports =
    dashboard?.incidents.filter(
      (item) => item.status === "resolved",
    ).length ?? 0;

  const criticalReports =
    dashboard?.incidents.filter(
      (item) =>
        item.severity === "critical" &&
        item.status !== "resolved",
    ).length ?? 0;

  /* -------------------------------------------------------
     INTERSECTION SEARCH, FILTER AND SORT
  ------------------------------------------------------- */

  const filtered = useMemo(() => {
    if (!dashboard) return [];

    const needle = search.trim().toLowerCase();

    const matches = dashboard.intersections.filter(
      (item) => {
        const matchesSearch =
          !needle ||
          `${item.name} ${item.district}`
            .toLowerCase()
            .includes(needle);

        const matchesTraffic =
          intersectionFilter === "all" ||
          (intersectionFilter === "congested" &&
            (item.congestion === "Heavy" ||
              item.congestion === "Severe")) ||
          (intersectionFilter === "clear" &&
            (item.congestion === "Clear" ||
              item.congestion === "Moderate"));

        return matchesSearch && matchesTraffic;
      },
    );

    const congestionRank: Record<
      Intersection["congestion"],
      number
    > = {
      Severe: 0,
      Heavy: 1,
      Moderate: 2,
      Clear: 3,
    };

    return matches.sort((left, right) => {
      if (intersectionSort === "speed") {
        return (
          right.speed - left.speed ||
          left.name.localeCompare(right.name)
        );
      }

      if (intersectionSort === "name") {
        return left.name.localeCompare(right.name);
      }

      return (
        congestionRank[left.congestion] -
          congestionRank[right.congestion] ||
        left.speed - right.speed ||
        left.name.localeCompare(right.name)
      );
    });
  }, [
    dashboard,
    intersectionFilter,
    intersectionSort,
    search,
  ]);

  /* -------------------------------------------------------
     SELECT INTERSECTION
  ------------------------------------------------------- */

  const selectIntersection = useCallback(
    (id: string) => {
      setSelectedId(id);

      window.setTimeout(() => {
        document
          .getElementById("intersections")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 40);
    },
    [],
  );

  /* -------------------------------------------------------
     CSV EXPORT
  ------------------------------------------------------- */

  function exportDashboard() {
    if (!dashboard) return;

    const generatedAt = new Date().toISOString();

    const headers = [
      "record_type",
      "generated_at",
      "id",
      "name_or_location",
      "district",
      "congestion",
      "speed_mph",
      "vehicles_per_hour",
      "signal_mode",
      "incident_type",
      "severity",
      "status",
      "reported_at",
      "description",
    ];

    const cell = (
      value: string | number | null,
    ) => {
      const text =
        value === null ? "" : String(value);

      const safeText =
        typeof value === "string" &&
        /^[=+\-@\t\r]/.test(text)
          ? `'${text}`
          : text;

      return `"${safeText.replace(/"/g, '""')}"`;
    };

    const rows = [
      headers,

      ...dashboard.intersections.map(
        (intersection) => [
          "sample_intersection",
          generatedAt,
          intersection.id,
          intersection.name,
          intersection.district,
          intersection.congestion,
          intersection.speed,
          intersection.vehiclesPerHour,
          intersection.mode,
          "",
          "",
          "",
          "",
          "",
        ],
      ),

      ...dashboard.incidents.map((incident) => [
        "community_report",
        generatedAt,
        incident.id,
        incident.location,
        incident.intersectionId ?? "",
        "",
        "",
        "",
        "",
        incident.type,
        incident.severity,
        incident.status,
        incident.reportedAt,
        incident.description,
      ]),
    ];

    const csv = rows
      .map((row) => row.map(cell).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8",
      }),
    );

    const link = document.createElement("a");

    link.href = url;
    link.download =
      `aykel-community-reports-${generatedAt.slice(0, 10)}.csv`;

    link.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    announce("Community report downloaded.");
  }

  /* -------------------------------------------------------
     FOCUS INCIDENT
  ------------------------------------------------------- */

  function focusIncident(incident: Incident) {
    setOpenPanel(null);
    setIncidentSeverity("all");
    setFocusedIncidentId(String(incident.id));

    window.setTimeout(() => {
      const row = document.getElementById(
        `incident-${incident.id}`,
      );

      row?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      row?.focus();
    }, 40);
  }

  /* -------------------------------------------------------
     DEMO SIGNAL CONTROL
  ------------------------------------------------------- */

  async function changeSignalMode(
    intersection: Intersection,
  ) {
    try {
      await api<Intersection>(
        `/api/intersections/${intersection.id}/optimize`,
        {
          method: "POST",
        },
      );

      announce(
        `Demo signal setting updated for ${intersection.name}.`,
      );

      await refresh(true);
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "Could not update the demo signal setting.",
        true,
      );
    }
  }

  /* -------------------------------------------------------
     CHANGE COMMUNITY REPORT STATUS
  ------------------------------------------------------- */

  async function changeIncidentStatus(
    incident: Incident,
    status: IncidentStatus,
  ) {
    try {
      await api<Incident>(
        `/api/incidents/${incident.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      announce(
        status === "resolved"
          ? "Community report marked as resolved."
          : "Community report status updated.",
      );

      await refresh(true);
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "Could not update report status.",
        true,
      );
    }
  }

  /* -------------------------------------------------------
     SUBMIT COMMUNITY REPORT
  ------------------------------------------------------- */

  async function submitIncident(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    const form = new FormData(event.currentTarget);

    try {
      await api<Incident>("/api/incidents", {
        method: "POST",
        body: JSON.stringify({
          intersectionId: null,
          location: String(
            form.get("location") ?? "",
          ).trim(),
          type: String(form.get("type") ?? ""),
          severity: String(
            form.get("severity") ?? "medium",
          ),
          description: String(
            form.get("description") ?? "",
          ).trim(),
        }),
      });

      setShowIncidentForm(false);
      setFormLocation("");

      announce(
        "Community problem submitted successfully.",
      );

      await refresh(true);
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "Could not submit the community report.",
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------------------------------
     RECOMMENDATIONS
  ------------------------------------------------------- */

  function openRecommendation(
    recommendation: TrafficRecommendation,
  ) {
    if (recommendation.kind === "incident") {
      setIncidentSeverity("all");

      setFocusedIncidentId(
        recommendation.targetId,
      );

      document
        .getElementById("incidents")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

      window.setTimeout(() => {
        const row = document.getElementById(
          `incident-${recommendation.targetId}`,
        );

        row?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        row?.focus();
      }, 250);

      return;
    }

    setSelectedId(recommendation.targetId);

    window.setTimeout(() => {
      document
        .getElementById("intersections")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 40);
  }

  /* -------------------------------------------------------
     DISPLAY VALUES
  ------------------------------------------------------- */

  const summary = dashboard?.summary;

  const timeDisplay = now.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );

  const greeting =
    now.getHours() < 12
      ? "morning"
      : now.getHours() < 17
        ? "afternoon"
        : "evening";

  const dateDisplay = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <div className="app-shell">
      {/* SIDEBAR */}

      <aside
        className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Activity size={20} strokeWidth={2.5} />
          </div>

          <div className="brand-name">
            Aykel<span>Connect</span>
            <small>COMMUNITY OPERATIONS</small>
          </div>

          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-picker">
          <div className="city-avatar">AK</div>

          <div className="workspace-copy">
            <strong>Aykel Town</strong>
            <span>Community operations</span>
          </div>

          <ChevronDown size={14} />
        </div>

        <div className="nav-caption">WORKSPACE</div>

        <nav
          className="primary-nav"
          aria-label="Main navigation"
        >
          <a
            href="#overview"
            className={`nav-link${activeSection === "overview" ? " active" : ""}`}
            aria-current={
              activeSection === "overview"
                ? "page"
                : undefined
            }
            onClick={() => {
              setActiveSection("overview");
              setMobileNavOpen(false);
            }}
          >
            <Crosshair size={17} />
            Overview

            {activeSection === "overview" && (
              <span className="nav-current-dot" />
            )}
          </a>

          <a
            href="#intersections"
            className={`nav-link${activeSection === "intersections" ? " active" : ""}`}
            aria-current={
              activeSection === "intersections"
                ? "location"
                : undefined
            }
            onClick={() => {
              setActiveSection("intersections");
              setMobileNavOpen(false);
            }}
          >
            <MapPin size={17} />
            Sample traffic

            {activeSection === "intersections" && (
              <span className="nav-current-dot" />
            )}
          </a>

          <a
            href="#incidents"
            className={`nav-link${activeSection === "incidents" ? " active" : ""}`}
            aria-current={
              activeSection === "incidents"
                ? "location"
                : undefined
            }
            onClick={() => {
              setActiveSection("incidents");
              setMobileNavOpen(false);
            }}
          >
            <Siren size={17} />
            Community reports

            {summary?.activeIncidents ? (
              <span className="nav-count">
                {summary.activeIncidents}
              </span>
            ) : null}

            {activeSection === "incidents" &&
              !summary?.activeIncidents && (
                <span className="nav-current-dot" />
              )}
          </a>

          <a
            href="#insights"
            className={`nav-link${activeSection === "insights" ? " active" : ""}`}
            aria-current={
              activeSection === "insights"
                ? "location"
                : undefined
            }
            onClick={() => {
              setActiveSection("insights");
              setMobileNavOpen(false);
            }}
          >
            <TrendingUp size={17} />
            Traffic demo

            {activeSection === "insights" && (
              <span className="nav-current-dot" />
            )}
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-heading">
              <span
                className={`system-online-dot${!liveConnected ? " status-offline" : ""}`}
              />
              LIVE SIMULATION
              <span>DEMO</span>
            </div>

            <strong>
              {error
                ? "API connection unavailable"
                : liveConnected
                  ? "Live demo feed connected"
                  : "Reconnecting to demo feed"}
            </strong>

            <div className="system-subline">
              <span>Traffic readings</span>
              <span className="data-source">
                SIMULATED
              </span>
            </div>
          </div>

          <div className="user-profile">
            <div className="user-avatar">MY</div>

            <div className="user-copy">
              <strong>Mihiretu Yeshi</strong>
              <span>Project operator</span>
            </div>

            <button
              className="icon-button help-button"
              aria-label="Help"
              onClick={() => setOpenPanel("help")}
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BACKDROP */}

      {mobileNavOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* MAIN CONTENT */}

      <main className="main-content" id="overview">
        {/* TOP BAR */}

        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={19} />
          </button>

          <div className="breadcrumbs">
            <span>Aykel Town</span>
            <span>/</span>
            <strong>Overview</strong>
          </div>

          <div className="topbar-right">
            <div
              className="weather-chip"
              title="Sample weather — not a live forecast"
            >
              <CloudSun size={16} />
              <strong>72°</strong>
              <span>Sample conditions</span>
              <i />
            </div>

            <div className="topbar-divider" />

            <time
              className="clock"
              dateTime={now.toISOString()}
            >
              <Clock3 size={14} />
              {timeDisplay}
            </time>

            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={() =>
                setTheme(
                  theme === "light" ? "dark" : "light",
                )
              }
            >
              {theme === "light" ? (
                <Moon size={17} />
              ) : (
                <Sun size={17} />
              )}
            </button>

            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${activeIncidents.length} active reports`}
              title="View active community reports"
              onClick={() =>
                setOpenPanel(
                  openPanel === "notifications"
                    ? null
                    : "notifications",
                )
              }
              aria-haspopup="dialog"
            >
              <Bell size={17} />

              {activeIncidents.length > 0 && <span />}
            </button>

            <div className="topbar-avatar">MY</div>
          </div>
        </header>

        <div className="dashboard">
          {/* PAGE HEADING */}

          <div className="page-heading">
            <div>
              <div className="heading-kicker">
                <span
                  className={`live-pulse${liveConnected ? "" : " disconnected"}`}
                />

                {liveConnected
                  ? "SYSTEM CONNECTED"
                  : "RECONNECTING"}

                <span>·</span>
                {dateDisplay}
              </div>

              <h1>
                Good {greeting}, Mihiretu{" "}
                <span className="wave">✳</span>
              </h1>

              <p>
                Community reporting for Aykel Town.
                Traffic monitoring below still uses
                simulated demonstration data.
              </p>
            </div>

            <div className="heading-actions">
              <button
                className="button button-secondary"
                onClick={exportDashboard}
                disabled={!dashboard}
              >
                <Download size={15} />
                Export report
              </button>

              <button
                className={`button button-secondary${refreshing ? " is-loading" : ""}`}
                onClick={() => void refresh(true)}
                disabled={refreshing}
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "spin" : ""}
                />
                Refresh
              </button>

              <button
                className="button button-primary"
                onClick={openIncidentForm}
              >
                <Plus size={16} />
                Report a problem
              </button>
            </div>
          </div>

          {/* ERROR MESSAGE */}

          {error && (
            <div className="error-banner">
              <AlertTriangle size={17} />

              <div>
                <strong>
                  Unable to load dashboard
                </strong>

                <span>
                  {error} Start the application with{" "}
                  <code>npm run dev</code>.
                </span>
              </div>

              <button
                className="text-button"
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </div>
          )}

          {/* COMMUNITY REPORT METRICS */}

          <section
            className="metrics-grid"
            aria-label="Community report summary"
          >
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon mint">
                  <Activity size={17} />
                </span>

                <span className="metric-kicker">
                  TOTAL REPORTS
                </span>
              </div>

              <div className="metric-value">
                {loading ? "—" : totalReports}
                <span className="metric-unit">
                  reports
                </span>
              </div>

              <div className="metric-foot">
                All submitted community reports
              </div>

              <div className="metric-progress">
                <span
                  style={{
                    width: totalReports
                      ? `${Math.min(100, (resolvedReports / totalReports) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon amber">
                  <AlertTriangle size={17} />
                </span>

                <span className="metric-kicker">
                  AWAITING REVIEW
                </span>

                <span className="metric-trend negative">
                  <ArrowUpRight size={13} />
                  Open
                </span>
              </div>

              <div className="metric-value">
                {loading ? "—" : openReports}
                <span className="metric-unit">
                  open
                </span>
              </div>

              <div className="metric-foot">
                Reports awaiting operator review
              </div>

              <div className="incident-stack">
                {dashboard?.incidents
                  .filter((item) => item.status === "open")
                  .slice(0, 8)
                  .map((incident) => (
                    <i
                      key={incident.id}
                      className={`incident-pip ${incident.severity}`}
                    />
                  ))}
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon blue">
                  <RefreshCw size={17} />
                </span>

                <span className="metric-kicker">
                  IN PROGRESS
                </span>

                <span className="metric-trend metric-demo-tag">
                  REVIEW
                </span>
              </div>

              <div className="metric-value">
                {loading
                  ? "—"
                  : investigatingReports}
                <span className="metric-unit">
                  investigating
                </span>
              </div>

              <div className="metric-foot">
                Reports being handled by operators
              </div>

              <div className="metric-progress">
                <span
                  style={{
                    width: totalReports
                      ? `${(investigatingReports / totalReports) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon violet">
                  <ShieldCheck size={17} />
                </span>

                <span className="metric-kicker">
                  RESOLVED REPORTS
                </span>

                <span className="metric-trend positive">
                  <Check size={13} />
                  Closed
                </span>
              </div>

              <div className="metric-value">
                {loading ? "—" : resolvedReports}
                <span className="metric-unit">
                  resolved
                </span>
              </div>

              <div className="metric-foot">
                {loading
                  ? "Loading report information..."
                  : `${criticalReports} unresolved critical-priority reports`}
              </div>

              <div className="metric-progress violet-progress">
                <span
                  style={{
                    width: totalReports
                      ? `${(resolvedReports / totalReports) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </article>
          </section>

          {/* RECOMMENDATIONS */}

          <section
            className="recommendations-card"
            aria-labelledby="recommendations-title"
          >
            <div className="recommendations-heading">
              <div>
                <span className="eyebrow">
                  DECISION SUPPORT · OPERATOR REVIEW
                </span>

                <h2 id="recommendations-title">
                  Recommended next steps
                </h2>
              </div>

              <span className="recommendations-note">
                <Sparkles size={13} />
                Rule-based · simulated data
              </span>
            </div>

            {loading && !dashboard ? (
              <div className="recommendations-clear">
                Waiting for the first traffic update…
              </div>
            ) : (
              (dashboard?.recommendations ?? []).length >
              0 ? (
                <div className="recommendation-list">
                  {dashboard?.recommendations.map(
                    (recommendation) => (
                      <article
                        className={`recommendation-item ${recommendation.priority}`}
                        key={recommendation.id}
                      >
                        <span className="recommendation-icon">
                          <AlertTriangle size={16} />
                        </span>

                        <div className="recommendation-copy">
                          <div>
                            <span
                              className={`recommendation-priority ${recommendation.priority}`}
                            >
                              {recommendation.priority}
                            </span>

                            <strong>
                              {recommendation.title}
                            </strong>
                          </div>

                          <p>
                            {recommendation.reason}
                          </p>
                        </div>

                        <button
                          className="recommendation-action"
                          onClick={() =>
                            openRecommendation(
                              recommendation,
                            )
                          }
                        >
                          {recommendation.actionLabel}
                          <ArrowRight size={14} />
                        </button>
                      </article>
                    ),
                  )}
                </div>
              ) : (
                <div className="recommendations-clear">
                  <ShieldCheck size={17} />
                  No urgent actions suggested. Continue
                  routine monitoring.
                </div>
              )
            )}

            <p className="recommendations-disclaimer">
              Recommendations are decision support only.
              Traffic readings and signal simulations are
              demonstration data. No physical traffic
              signals are controlled.
            </p>
          </section>

          {/* MAIN CONTENT GRID */}

          <div className="content-grid">
            <div className="primary-column">
              <p className="recommendations-disclaimer">
                The traffic map below contains sample
                intersections. These are not verified
                Aykel locations.
              </p>

              <CityMap
                intersections={
                  dashboard?.intersections ??
                  emptyIntersections
                }
                onSelect={selectIntersection}
                selectedId={selectedId}
              />

              {/* TRAFFIC CHART */}

              <section
                className="traffic-card"
                id="insights"
              >
                <div className="section-head">
                  <div>
                    <span className="eyebrow">
                      SAMPLE NETWORK PERFORMANCE
                    </span>

                    <h2>
                      Traffic volume demonstration
                    </h2>
                  </div>

                  <label className="chart-range">
                    <span className="visually-hidden">
                      Traffic chart time range
                    </span>

                    <select
                      className="select-button"
                      value={chartRange}
                      onChange={(event) =>
                        setChartRange(
                          Number(
                            event.target.value,
                          ) as 6 | 12,
                        )
                      }
                    >
                      <option value={6}>
                        Last 6 hours
                      </option>

                      <option value={12}>
                        Last 12 hours
                      </option>
                    </select>

                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                    />
                  </label>
                </div>

                <div className="chart-summary">
                  <span className="chart-value">
                    {averageTrend ?? "—"}
                    <span>%</span>
                  </span>

                  <span className="chart-summary-label">
                    avg. road capacity
                  </span>
                </div>

                <TrafficChart
                  data={visibleTrend}
                  hours={chartRange}
                />

                <div className="chart-foot">
                  <span>
                    <i className="chart-key" />
                    Road capacity
                  </span>

                  <span>
                    {dashboard?.trendSource === "history"
                      ? "Saved simulated readings"
                      : dashboard?.trendSource === "mixed"
                        ? "Saved history + modeled gaps"
                        : "Modeled estimate · No recent history"}
                  </span>
                </div>

                {/* TRAFFIC FORECAST */}

                <div
                  className="forecast-panel"
                  aria-live="polite"
                >
                  <div className="forecast-title">
                    <span className="forecast-icon">
                      <Sparkles size={14} />
                    </span>

                    <span>
                      <strong>
                        Next-hour traffic outlook
                      </strong>

                      <small>
                        Linear trend model · simulated
                        readings
                      </small>
                    </span>
                  </div>

                  {dashboard?.forecast ? (
                    <>
                      <div className="forecast-result">
                        <strong>
                          {dashboard.forecast.predictedVolume}%
                        </strong>

                        <span>
                          estimated capacity
                        </span>
                      </div>

                      <div
                        className={`forecast-direction ${dashboard.forecast.direction}`}
                      >
                        {dashboard.forecast.direction ===
                        "rising" ? (
                          <ArrowUpRight size={14} />
                        ) : dashboard.forecast.direction ===
                          "falling" ? (
                          <ArrowDownRight size={14} />
                        ) : (
                          <Activity size={13} />
                        )}

                        <strong>
                          {dashboard.forecast.change > 0
                            ? "+"
                            : ""}
                          {dashboard.forecast.change} pts
                        </strong>

                        <span>
                          {dashboard.forecast.direction}
                        </span>
                      </div>

                      <div className="forecast-range">
                        <span>Estimated range</span>

                        <strong>
                          {dashboard.forecast.lowerBound}–
                          {dashboard.forecast.upperBound}%
                        </strong>
                      </div>
                    </>
                  ) : (
                    <p className="forecast-empty">
                      Not enough traffic readings to
                      estimate a trend.
                    </p>
                  )}

                  <p className="forecast-disclaimer">
                    A short-term statistical estimate, not
                    a trained AI model. Review conditions
                    before changing signal plans.
                  </p>
                </div>
              </section>
            </div>

            {/* SIDE COLUMN */}

            <div className="side-column">
              {/* COMMUNITY REPORTS */}

              <section
                className="incidents-card"
                id="incidents"
              >
                <div className="section-head incidents-heading">
                  <div>
                    <span className="eyebrow">
                      COMMUNITY RESPONSE QUEUE
                    </span>

                    <h2>
                      Community reports{" "}
                      <span className="heading-count">
                        {summary?.activeIncidents ?? 0}
                      </span>
                    </h2>
                  </div>

                  <label
                    className="incident-filter"
                    title="Filter reports by urgency"
                  >
                    <SlidersHorizontal
                      size={15}
                      aria-hidden="true"
                    />

                    <select
                      value={incidentSeverity}
                      onChange={(event) =>
                        setIncidentSeverity(
                          event.target.value as
                            | "all"
                            | IncidentSeverity,
                        )
                      }
                      aria-label="Filter reports by urgency"
                    >
                      <option value="all">
                        All urgencies
                      </option>

                      {[...severityOptions]
                        .reverse()
                        .map((severity) => (
                          <option
                            key={severity}
                            value={severity}
                          >
                            {severity[0].toUpperCase() +
                              severity.slice(1)}
                          </option>
                        ))}
                    </select>

                    <ChevronDown
                      size={12}
                      aria-hidden="true"
                    />
                  </label>
                </div>

                <div className="incident-list">
                  {visibleIncidents.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      recommended={
                        focusedIncidentId ===
                        String(incident.id)
                      }
                      onAdvance={() =>
                        void changeIncidentStatus(
                          incident,
                          incident.status === "open"
                            ? "investigating"
                            : "resolved",
                        )
                      }
                    />
                  ))}

                  {!loading &&
                    visibleIncidents.length === 0 && (
                      <div className="empty-incidents">
                        {activeIncidents.length === 0 ? (
                          <ShieldCheck size={24} />
                        ) : (
                          <SlidersHorizontal size={22} />
                        )}

                        <strong>
                          {activeIncidents.length === 0
                            ? "No active reports"
                            : "No matching reports"}
                        </strong>

                        <span>
                          {activeIncidents.length === 0
                            ? "Community-submitted problems will appear here."
                            : "Try selecting another urgency level."}
                        </span>
                      </div>
                    )}
                </div>

                <button
                  className="incident-add"
                  onClick={openIncidentForm}
                >
                  <Plus size={15} />
                  Report a community problem
                </button>
              </section>

              {/* SAMPLE INTERSECTIONS */}

              <section
                className="intersection-card"
                id="intersections"
              >
                <div className="section-head intersection-heading">
                  <div>
                    <span className="eyebrow">
                      DEMONSTRATION DATA
                    </span>

                    <h2>Sample intersections</h2>
                  </div>

                  <span
                    className={`online-badge${liveConnected ? "" : " offline"}`}
                    aria-live="polite"
                  >
                    <i />
                    {liveConnected
                      ? "CONNECTED"
                      : "RECONNECTING"}
                  </span>
                </div>

                <div className="intersection-controls">
                  <label className="network-filter">
                    <span className="visually-hidden">
                      Filter intersections by congestion
                    </span>

                    <select
                      value={intersectionFilter}
                      onChange={(event) =>
                        setIntersectionFilter(
                          event.target.value as IntersectionFilter,
                        )
                      }
                    >
                      <option value="all">
                        All traffic
                      </option>

                      <option value="congested">
                        Needs attention
                      </option>

                      <option value="clear">
                        Clear / moderate
                      </option>
                    </select>

                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                    />
                  </label>

                  <label className="network-filter">
                    <span className="visually-hidden">
                      Sort intersections
                    </span>

                    <select
                      value={intersectionSort}
                      onChange={(event) =>
                        setIntersectionSort(
                          event.target.value as IntersectionSort,
                        )
                      }
                    >
                      <option value="priority">
                        Priority
                      </option>

                      <option value="speed">
                        Highest speed
                      </option>

                      <option value="name">
                        Name
                      </option>
                    </select>

                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                    />
                  </label>
                </div>

                <label className="search-field">
                  <Search size={15} />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Find a sample intersection..."
                    aria-label="Search sample intersections"
                  />

                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <div className="intersection-list">
                  {filtered.map((intersection) => (
                    <button
                      className={`intersection-row${selectedId === intersection.id ? " selected" : ""}`}
                      key={intersection.id}
                      onClick={() =>
                        setSelectedId(
                          selectedId === intersection.id
                            ? null
                            : intersection.id,
                        )
                      }
                    >
                      <span
                        className={`intersection-signal ${intersection.congestion.toLowerCase()}`}
                      >
                        <i />
                      </span>

                      <span className="intersection-name">
                        <strong>
                          {intersection.name}
                        </strong>

                        <span>
                          {intersection.district}
                        </span>
                      </span>

                      <span className="intersection-speed">
                        <strong>
                          {intersection.speed}
                        </strong>

                        <span>mph</span>
                      </span>

                      <span
                        className={`congestion-label ${metricLabel(intersection.congestion)}`}
                      >
                        {intersection.congestion}
                      </span>
                    </button>
                  ))}

                  {!loading &&
                    filtered.length === 0 && (
                      <div className="search-empty">
                        No sample intersections match the
                        current search and filters.
                      </div>
                    )}
                </div>

                {/* SELECTED INTERSECTION DETAILS */}

                {selected && (
                  <div className="intersection-detail">
                    <div className="detail-header">
                      <div>
                        <span className="eyebrow">
                          DEMO SIGNAL CONTROL ·{" "}
                          {selected.id.toUpperCase()}
                        </span>

                        <strong>{selected.name}</strong>
                      </div>

                      <span
                        className={`mode-badge ${selected.mode}`}
                      >
                        {selected.mode === "adaptive" ? (
                          <Sparkles size={12} />
                        ) : (
                          <Signal size={12} />
                        )}

                        {selected.mode}
                      </span>
                    </div>

                    <div className="detail-stats">
                      <span>
                        <strong>
                          {selected.vehiclesPerHour.toLocaleString()}
                        </strong>

                        <small>vehicles / hr</small>
                      </span>

                      <span>
                        <strong>
                          {selected.waitSeconds}s
                        </strong>

                        <small>avg. wait</small>
                      </span>

                      <span>
                        <strong>
                          {selected.dailyVehicles.toLocaleString()}
                        </strong>

                        <small>vehicles / day</small>
                      </span>
                    </div>

                    <button
                      className="optimize-button"
                      onClick={() =>
                        void changeSignalMode(selected)
                      }
                    >
                      <Zap size={14} />

                      {selected.mode === "adaptive"
                        ? "Simulate fixed timing"
                        : "Simulate adaptive timing"}

                      <ArrowRight size={14} />
                    </button>

                    <span className="operator-note">
                      <ShieldCheck size={12} />
                      Demo only — no physical signal is
                      controlled
                    </span>
                  </div>
                )}

                <div className="intersection-footer">
                  <span>
                    Showing {filtered.length} of{" "}
                    {dashboard?.intersections.length ?? 0}
                  </span>

                  <span className="sim-note">
                    <Activity size={12} />
                    Simulation
                  </span>
                </div>
              </section>
            </div>
          </div>

          {/* FOOTER */}

          <footer className="dashboard-footer">
            <span>
              © 2026 Aykel Community Operations
            </span>

            <span>
              <span
                className={`footer-online-dot${liveConnected && !error ? "" : " status-offline"}`}
              />

              {error
                ? "API unavailable"
                : liveConnected
                  ? "System connected"
                  : "System reconnecting"}
            </span>

            <span>
              Community reports are submissions and
              require verification. Traffic readings
              are simulated.
            </span>

            <button
              className="footer-help"
              onClick={() => setOpenPanel("help")}
            >
              <CircleHelp size={13} />
              Need help?
            </button>
          </footer>
        </div>
      </main>

      {/* REPORT FORM MODAL */}

      {showIncidentForm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setShowIncidentForm(false);
            }
          }}
        >
          <section
            className="incident-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  AYKEL COMMUNITY REPORTING
                </span>

                <h2 id="incident-form-title">
                  Report a community problem
                </h2>

                <p>
                  Help identify problems affecting people
                  in Aykel Town.
                </p>
              </div>

              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() =>
                  setShowIncidentForm(false)
                }
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void submitIncident(event)
              }
            >
              <label>
                Problem category

                <select
                  name="type"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a problem category
                  </option>

                  {communityProblemTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Location in Aykel

                <input
                  name="location"
                  value={formLocation}
                  onChange={(event) =>
                    setFormLocation(event.target.value)
                  }
                  placeholder="Enter an area, road, or nearby landmark"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Urgency

                <select
                  name="severity"
                  defaultValue="medium"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">
                    Critical
                  </option>
                </select>
              </label>

              <label>
                Describe the problem{" "}
                <span className="optional-label">
                  Optional
                </span>

                <textarea
                  name="description"
                  rows={4}
                  maxLength={500}
                  placeholder="Explain what happened and how it affects people..."
                />
              </label>

              <div className="form-footer">
                <span>
                  <ShieldCheck size={14} />
                  Community-submitted report
                </span>

                <button
                  className="button button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw
                      size={15}
                      className="spin"
                    />
                  ) : (
                    <Plus size={15} />
                  )}

                  {saving
                    ? "Submitting..."
                    : "Submit report"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* HELP AND NOTIFICATIONS MODAL */}

      {openPanel && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpenPanel(null);
            }
          }}
        >
          <section
            className="incident-modal info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-dialog-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {openPanel === "help"
                    ? "AYKEL CONNECT GUIDE"
                    : "COMMUNITY REPORTING"}
                </span>

                <h2 id="info-dialog-title">
                  {openPanel === "help"
                    ? "Dashboard help"
                    : "Active community reports"}
                </h2>

                <p>
                  {openPanel === "help"
                    ? "Quick guidance for using the Aykel community reporting system."
                    : `${activeIncidents.length} unresolved ${
                        activeIncidents.length === 1
                          ? "report"
                          : "reports"
                      } need review.`}
                </p>
              </div>

              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setOpenPanel(null)}
              >
                <X size={18} />
              </button>
            </div>

            {openPanel === "help" ? (
              <div className="help-content">
                <p>
                  <strong>
                    Report a problem:
                  </strong>{" "}
                  Use the report button to submit a
                  category, location, urgency, and
                  description.
                </p>

                <p>
                  <strong>
                    Track community reports:
                  </strong>{" "}
                  Submitted reports appear in the
                  community response queue. An operator
                  can move a report from open to
                  investigating and then resolved.
                </p>

                <p>
                  <strong>
                    Understand urgency:
                  </strong>{" "}
                  Urgency is selected by the person
                  submitting the report. It is not an
                  automatic verification or safety
                  assessment.
                </p>

                <p>
                  <strong>
                    Traffic demonstration:
                  </strong>{" "}
                  The sample traffic map, readings, and
                  signal controls are simulated and do
                  not represent verified Aykel traffic
                  conditions.
                </p>

                <p className="help-disclaimer">
                  Community reports should be reviewed
                  before being treated as verified facts.
                </p>
              </div>
            ) : (
              <div className="notification-list">
                {activeIncidents.length > 0 ? (
                  activeIncidents.map((incident) => (
                    <button
                      className="notification-item"
                      key={incident.id}
                      onClick={() =>
                        focusIncident(incident)
                      }
                    >
                      <span
                        className={`severity-badge ${incident.severity}`}
                      >
                        {incident.severity}
                      </span>

                      <span>
                        <strong>
                          {incident.type}
                        </strong>

                        <small>
                          {incident.location} ·{" "}
                          {formatTime(
                            incident.reportedAt,
                          )}
                        </small>
                      </span>

                      <ArrowRight size={15} />
                    </button>
                  ))
                ) : (
                  <div className="empty-incidents">
                    <ShieldCheck size={24} />

                    <strong>
                      No active reports
                    </strong>

                    <span>
                      No community reports need review.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TOAST */}

      {notice && (
        <div
          className={`toast${noticeError ? " toast-error" : ""}`}
          role={noticeError ? "alert" : "status"}
        >
          {noticeError ? (
            <AlertTriangle size={16} />
          ) : (
            <Check size={16} />
          )}

          <span>{notice}</span>

          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   INCIDENT ROW COMPONENT
------------------------------------------------------- */

function IncidentRow({
  incident,
  recommended,
  onAdvance,
}: {
  incident: Incident;
  recommended: boolean;
  onAdvance: () => void;
}) {
  const Icon = incident.type
    .toLowerCase()
    .includes("roadwork")
    ? Construction
    : incident.type
          .toLowerCase()
          .includes("collision")
      ? CarFront
      : AlertTriangle;

  return (
    <article
      className={`incident-row${recommended ? " recommended" : ""}`}
      id={`incident-${incident.id}`}
      tabIndex={-1}
    >
      <span
        className={`incident-icon ${incident.severity}`}
      >
        <Icon size={16} />
      </span>

      <div className="incident-copy">
        <strong>{incident.type}</strong>

        <span>
          <MapPin size={12} />
          {incident.location}
        </span>

        <small>
          <Clock3 size={11} />
          {formatTime(incident.reportedAt)}
        </small>
      </div>

      <div className="incident-controls">
        <span
          className={`severity-badge ${incident.severity}`}
        >
          {incident.severity}
        </span>

        <button
          className="incident-action"
          onClick={onAdvance}
          aria-label={
            incident.status === "open"
              ? "Start investigating report"
              : "Resolve report"
          }
          title={
            incident.status === "open"
              ? "Start investigating"
              : "Resolve report"
          }
        >
          {incident.status === "open" ? (
            <ArrowRight size={15} />
          ) : (
            <Check size={15} />
          )}
        </button>
      </div>
    </article>
  );
}
