
import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Bell, CarFront, CheckCircle2, ChevronDown, Clock3,
  CloudSun, Gauge, LayoutDashboard, MapPin, Menu,
  Navigation, Search, Settings, ShieldAlert, Signal,
  TrafficCone, Users, X, Zap,
} from "lucide-react";

const intersections = [
  { name: "Central Junction", area: "Town Center", vehicles: 245, speed: 24, level: "Heavy", signal: "Adaptive" },
  { name: "Market Area", area: "Commercial Zone", vehicles: 182, speed: 36, level: "Moderate", signal: "Fixed" },
  { name: "Bus Station Area", area: "Transport Zone", vehicles: 310, speed: 18, level: "Severe", signal: "Adaptive" },
  { name: "Hospital Area", area: "Public Service Zone", vehicles: 125, speed: 42, level: "Clear", signal: "Adaptive" },
  { name: "School Area", area: "Education Zone", vehicles: 198, speed: 29, level: "Moderate", signal: "Fixed" },
];

const incidents = [
  { title: "Traffic congestion", place: "Bus Station Area", time: "10 min ago", severity: "High", status: "Investigating" },
  { title: "Road obstruction", place: "Central Junction", time: "25 min ago", severity: "Medium", status: "Open" },
  { title: "Heavy vehicle movement", place: "Market Area", time: "42 min ago", severity: "Low", status: "Monitoring" },
];

const chartValues = [35, 48, 42, 64, 52, 72, 60, 84, 67, 75, 57, 70];

type Level = "Clear" | "Moderate" | "Heavy" | "Severe";

function Status({ level }: { level: string }) {
  return <span className={`status status-${level.toLowerCase()}`}>{level}</span>;
}

export default function App() {
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [period, setPeriod] = useState("Today");
  const [notifications, setNotifications] = useState(true);

  const filteredIntersections = useMemo(() => {
    return intersections.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.area.toLowerCase().includes(search.toLowerCase());

      const matchesFilter = filter === "All" || item.level === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Traffic Map", icon: MapPin },
    { name: "Intersections", icon: Navigation },
    { name: "Incidents", icon: ShieldAlert },
    { name: "Analytics", icon: Activity },
  ];

  const totalVehicles = intersections.reduce((sum, item) => sum + item.vehicles, 0);
  const severeCount = intersections.filter((item) => item.level === "Severe").length;

  return (
    <div className="app-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f7fb; font-family: 'DM Sans', sans-serif; color: #17243a; }
        button, input, select { font: inherit; }
        button { cursor: pointer; }

        .app-shell { min-height: 100vh; display: flex; background: #f4f7fb; }
        .sidebar { width: 250px; background: #101e35; color: #fff; padding: 25px 17px; display: flex; flex-direction: column; flex-shrink: 0; }
        .brand { display: flex; align-items: center; gap: 12px; padding: 0 9px 32px; }
        .brand-icon { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; background: #1769e8; }
        .brand-name { font-family: Manrope, sans-serif; font-size: 17px; font-weight: 800; letter-spacing: -.5px; }
        .brand-sub { color: #91a2bb; font-size: 11px; margin-top: 3px; }
        .nav-label { color: #71839d; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; padding: 14px 12px 11px; }
        .nav-item { width: 100%; display: flex; align-items: center; gap: 13px; color: #aab9ce; border: 0; background: transparent; padding: 12px 13px; border-radius: 9px; margin: 3px 0; font-size: 13px; text-align: left; transition: .2s; }
        .nav-item:hover, .nav-item.active { color: #fff; background: #1d3558; }
        .nav-item.active { box-shadow: inset 3px 0 #3987ff; }
        .nav-item.active svg { color: #66a4ff; }
        .sidebar-bottom { margin-top: auto; }
        .system-card { background: #1a304e; border: 1px solid #29415f; border-radius: 12px; padding: 14px; margin: 16px 3px; }
        .system-title { font-size: 12px; font-weight: 700; margin-bottom: 9px; }
        .system-line { display: flex; align-items: center; gap: 7px; color: #a9bad0; font-size: 11px; }
        .green-dot { width: 7px; height: 7px; border-radius: 50%; background: #35d39a; box-shadow: 0 0 0 4px #35d39a20; }
        .sidebar-footer { color: #72849d; font-size: 10px; padding: 12px; line-height: 1.7; }

        .main { flex: 1; min-width: 0; }
        .topbar { height: 76px; background: #fff; border-bottom: 1px solid #e8edf4; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; gap: 15px; }
        .top-left { display: flex; align-items: center; gap: 14px; }
        .page-title { font: 800 18px Manrope, sans-serif; }
        .breadcrumb { color: #8996a9; font-size: 11px; margin-top: 4px; }
        .top-actions { display: flex; align-items: center; gap: 12px; }
        .search-box { display: flex; align-items: center; gap: 8px; border: 1px solid #e7ebf2; border-radius: 9px; padding: 9px 12px; width: 220px; color: #8794a8; }
        .search-box input { border: 0; outline: 0; width: 100%; min-width: 0; font-size: 12px; color: #25334a; }
        .icon-btn { width: 37px; height: 37px; border: 1px solid #e7ebf2; background: white; border-radius: 9px; color: #5d6b80; display: grid; place-items: center; position: relative; }
        .notification-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef5a67; position: absolute; right: 8px; top: 7px; }
        .profile { display: flex; align-items: center; gap: 9px; padding-left: 10px; border-left: 1px solid #edf0f5; }
        .avatar { width: 35px; height: 35px; border-radius: 50%; display: grid; place-items: center; background: #e5efff; color: #1769e8; font-weight: 800; font-size: 12px; }
        .profile-name { font-size: 11px; font-weight: 700; }
        .profile-role { font-size: 10px; color: #8996a9; margin-top: 3px; }
        .mobile-menu { display: none; }

        .content { padding: 27px 32px 40px; max-width: 1600px; margin: auto; }
        .welcome { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
        .welcome h1 { font: 800 23px Manrope, sans-serif; margin: 0; letter-spacing: -.7px; }
        .welcome p { color: #8592a5; font-size: 12px; margin: 7px 0 0; }
        .welcome-actions { display: flex; gap: 9px; align-items: center; }
        .date-select { background: white; border: 1px solid #e5eaf1; padding: 10px 13px; border-radius: 9px; font-size: 11px; color: #536178; outline: 0; }
        .primary-btn { background: #1769e8; color: white; border: 0; padding: 11px 15px; border-radius: 9px; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; }
        .primary-btn:hover { background: #0d56c7; }

        .demo-banner { display: flex; align-items: center; gap: 9px; background: #fff8e8; border: 1px solid #f3e2b8; border-radius: 10px; color: #87651c; font-size: 11px; padding: 11px 14px; margin-bottom: 18px; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin-bottom: 19px; }
        .card { background: #fff; border: 1px solid #e9edf3; border-radius: 13px; box-shadow: 0 3px 12px #17243a05; }
        .metric-card { padding: 17px 18px; }
        .metric-top { display: flex; justify-content: space-between; align-items: center; }
        .metric-label { color: #8390a4; font-size: 11px; font-weight: 600; }
        .metric-icon { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 10px; }
        .blue { background: #eaf2ff; color: #2875e8; }
        .green { background: #e8f8f1; color: #17a574; }
        .orange { background: #fff3e6; color: #e58a27; }
        .red { background: #ffeded; color: #e4535e; }
        .metric-value { font: 800 25px Manrope, sans-serif; margin-top: 13px; letter-spacing: -.7px; }
        .metric-foot { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #8b97a8; margin-top: 7px; }
        .trend-up { color: #16a477; font-weight: 700; }
        .trend-down { color: #df5964; font-weight: 700; }

        .section-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(270px, .9fr); gap: 17px; margin-bottom: 18px; }
        .card-header { display: flex; align-items: center; justify-content: space-between; padding: 17px 19px; border-bottom: 1px solid #edf0f5; gap: 10px; }
        .card-title { font: 800 13px Manrope, sans-serif; }
        .card-subtitle { color: #98a3b3; font-size: 10px; margin-top: 4px; }
        .text-link { color: #1769e8; font-size: 10px; font-weight: 700; border: 0; background: none; }
        .map-area { padding: 15px; }
        .map-canvas { height: 285px; position: relative; overflow: hidden; border-radius: 10px; background: #edf3f2; }
        .map-canvas:before { content: ""; position: absolute; inset: 0; opacity: .65; background-image: linear-gradient(30deg, transparent 48%, #fff 49%, #fff 52%, transparent 53%), linear-gradient(120deg, transparent 47%, #fff 48%, #fff 51%, transparent 52%); background-size: 105px 90px, 135px 110px; }
        .map-road { position: absolute; height: 12px; background: #fff; border: 1px solid #dce5e2; border-radius: 10px; transform-origin: center; }
        .road-one { width: 120%; top: 48%; left: -10%; transform: rotate(-13deg); }
        .road-two { width: 90%; top: 47%; left: 15%; transform: rotate(55deg); }
        .road-three { width: 80%; top: 22%; left: 8%; transform: rotate(24deg); }
        .road-four { width: 75%; top: 75%; left: 28%; transform: rotate(-43deg); }
        .map-river { position: absolute; width: 120%; height: 22px; background: #cfe7ed; top: 86%; left: -10%; transform: rotate(-17deg); opacity: .7; }
        .map-label { position: absolute; font-size: 9px; color: #879a98; font-weight: 700; letter-spacing: .3px; }
        .map-label.one { top: 14%; left: 8%; }
        .map-label.two { top: 76%; right: 7%; }
        .map-label.three { top: 12%; right: 8%; }
        .map-label.four { bottom: 9%; left: 11%; }
        .map-pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 5px; }
        .pin-dot { width: 13px; height: 13px; border: 3px solid white; border-radius: 50%; box-shadow: 0 1px 5px #1a2d3b55; }
        .pin-heavy { background: #ed9b36; }
        .pin-severe { background: #e34f5c; }
        .pin-clear { background: #19a879; }
        .pin-moderate { background: #e7b94a; }
        .pin-label { font-size: 9px; background: white; padding: 5px 7px; border-radius: 5px; box-shadow: 0 2px 5px #17243a13; white-space: nowrap; color: #526174; font-weight: 700; }
        .map-legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 13px 2px 0; color: #7f8c9e; font-size: 10px; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-dot { width: 7px; height: 7px; border-radius: 50%; }

        .weather-card { padding: 18px; background: linear-gradient(135deg, #17365e, #1769b9); color: white; border: 0; }
        .weather-top { display: flex; justify-content: space-between; align-items: center; color: #d3e6ff; font-size: 11px; }
        .weather-temp { font: 800 35px Manrope, sans-serif; margin-top: 15px; }
        .weather-description { font-size: 11px; color: #d3e6ff; margin-top: 2px; }
        .weather-bottom { border-top: 1px solid #ffffff30; display: flex; justify-content: space-between; margin-top: 19px; padding-top: 13px; color: #d3e6ff; font-size: 10px; }
        .signal-card { padding: 17px; margin-top: 15px; }
        .signal-heading { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800; }
        .signal-status { display: flex; align-items: center; gap: 9px; margin-top: 16px; }
        .signal-light { width: 43px; height: 43px; border-radius: 12px; display: grid; place-items: center; background: #fff3e7; color: #e68b2a; }
        .signal-number { font: 800 21px Manrope, sans-serif; }
        .signal-caption { color: #8a97a8; font-size: 10px; margin-top: 3px; }

        .chart-card { padding-bottom: 15px; }
        .chart-wrap { padding: 15px 19px 0; }
        .chart-svg { width: 100%; height: 175px; overflow: visible; }
        .chart-gridline { stroke: #edf0f5; stroke-width: 1; }
        .chart-area { fill: url(#chartFill); }
        .chart-line { fill: none; stroke: #2875e8; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
        .chart-point { fill: white; stroke: #2875e8; stroke-width: 2; }
        .chart-labels { display: flex; justify-content: space-between; color: #9aa5b4; font-size: 9px; padding: 5px 2px 0; }
        .chart-summary { display: flex; gap: 20px; padding: 12px 19px 0; }
        .chart-stat strong { font: 800 16px Manrope, sans-serif; display: block; }
        .chart-stat span { color: #929eae; font-size: 9px; }

        .table-card { overflow: hidden; }
        .table-toolbar { display: flex; align-items: center; gap: 8px; }
        .filter-select { border: 1px solid #e8edf3; background: white; border-radius: 7px; padding: 7px 9px; color: #65748a; font-size: 10px; outline: 0; }
        .table-scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 570px; }
        th { text-align: left; color: #98a3b2; font-size: 9px; letter-spacing: .6px; text-transform: uppercase; font-weight: 800; padding: 13px 18px; background: #fafbfd; }
        td { padding: 14px 18px; border-top: 1px solid #f0f2f6; font-size: 11px; color: #5f6d81; }
        .intersection-name { color: #25344b; font-weight: 700; }
        .intersection-area { color: #9aa5b3; font-size: 9px; margin-top: 4px; }
        .status { display: inline-block; padding: 5px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; white-space: nowrap; }
        .status-clear { background: #e7f7ef; color: #159467; }
        .status-moderate { background: #fff6df; color: #a77a18; }
        .status-heavy { background: #fff0e4; color: #d77a27; }
        .status-severe { background: #ffebed; color: #d94c58; }
        .status-high { background: #ffebed; color: #d94c58; }
        .status-medium { background: #fff6df; color: #a77a18; }
        .status-low { background: #e7f7ef; color: #159467; }
        .status-open { background: #ffebed; color: #d94c58; }
        .status-investigating { background: #fff6df; color: #a77a18; }
        .status-monitoring { background: #e7f0ff; color: #3475cb; }

        .bottom-grid { display: grid; grid-template-columns: 1.25fr .9fr; gap: 17px; margin-top: 18px; }
        .incident-list { padding: 4px 18px 12px; }
        .incident-row { display: flex; align-items: center; gap: 11px; padding: 12px 0; border-bottom: 1px solid #f0f2f6; }
        .incident-row:last-child { border-bottom: 0; }
        .incident-icon { width: 34px; height: 34px; border-radius: 9px; background: #fff0ed; color: #df6557; display: grid; place-items: center; flex-shrink: 0; }
        .incident-main { flex: 1; min-width: 0; }
        .incident-name { font-size: 11px; font-weight: 700; color: #35435a; }
        .incident-meta { font-size: 9px; color: #9aa5b3; margin-top: 4px; }
        .incident-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .recommendation { padding: 17px; }
        .recommendation-item { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid #f0f2f6; }
        .recommendation-item:last-child { border: 0; }
        .recommendation-icon { color: #2473e5; background: #edf4ff; border-radius: 8px; width: 31px; height: 31px; display: grid; place-items: center; flex-shrink: 0; }
        .recommendation-title { font-size: 11px; font-weight: 700; }
        .recommendation-text { color: #909cad; font-size: 10px; line-height: 1.5; margin-top: 4px; }

        .empty-state { text-align: center; color: #9aa5b3; padding: 30px; font-size: 11px; }
        .footer { text-align: center; color: #a0aaba; font-size: 10px; padding: 23px 0 0; }

        @media(max-width: 1100px) {
          .sidebar { width: 215px; }
          .content { padding: 24px 21px; }
          .topbar { padding: 0 21px; }
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media(max-width: 760px) {
          .sidebar { position: fixed; z-index: 20; inset: 0 auto 0 0; width: 260px; transform: translateX(-105%); transition: transform .25s; box-shadow: 15px 0 40px #101e3530; }
          .sidebar.open { transform: translateX(0); }
          .mobile-menu { display: grid; }
          .topbar { height: 66px; padding: 0 14px; }
          .top-actions { gap: 7px; }
          .search-box { width: 150px; }
          .profile-info, .profile-chevron { display: none; }
          .content { padding: 21px 14px 30px; }
          .welcome { flex-direction: column; }
          .welcome h1 { font-size: 20px; }
          .section-grid, .bottom-grid { grid-template-columns: 1fr; }
          .map-canvas { height: 250px; }
        }
        @media(max-width: 480px) {
          .topbar { gap: 8px; }
          .page-title { font-size: 14px; }
          .breadcrumb { font-size: 9px; }
          .search-box { display: none; }
          .profile { padding-left: 6px; }
          .metric-grid { gap: 9px; }
          .metric-card { padding: 13px; }
          .metric-value { font-size: 21px; }
          .metric-label { font-size: 10px; }
          .metric-foot { font-size: 9px; }
          .welcome-actions { width: 100%; }
          .date-select, .primary-btn { flex: 1; justify-content: center; }
          .card-header { padding: 14px; }
          .map-area { padding: 10px; }
          .map-label { font-size: 8px; }
          .pin-label { font-size: 8px; }
        }
      `}</style>

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><TrafficCone size={23} /></div>
          <div>
            <div className="brand-name">AYKEL TRAFFIC</div>
            <div className="brand-sub">SMART CITY OPERATIONS</div>
          </div>
        </div>

        <div className="nav-label">MAIN MENU</div>
        {navItems.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`nav-item ${active === name ? "active" : ""}`}
            onClick={() => { setActive(name); setMobileOpen(false); }}
          >
            <Icon size={17} /> {name}
          </button>
        ))}

        <div className="nav-label">SYSTEM</div>
        <button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => setActive("Settings")}>
          <Settings size={17} /> Settings
        </button>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-title">System status</div>
            <div className="system-line"><span className="green-dot" /> Dashboard running</div>
            <div className="system-line" style={{ marginTop: 9 }}><Activity size={13} /> Demo monitoring mode</div>
          </div>
          <div className="sidebar-footer">AYKEL TOWN · CHILGA<br />TRAFFIC MANAGEMENT SYSTEM<br />Version 1.0 · Demonstration</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <div className="page-title">{active}</div>
              <div className="breadcrumb">Aykel Town / {active}</div>
            </div>
          </div>

          <div className="top-actions">
            <div className="search-box">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search intersections..." />
            </div>
            <button className="icon-btn" onClick={() => setNotifications(!notifications)} title="Toggle notifications">
              <Bell size={16} />
              {notifications && <span className="notification-dot" />}
            </button>
            <div className="profile">
              <div className="avatar">AT</div>
              <div className="profile-info">
                <div className="profile-name">Traffic Operator</div>
                <div className="profile-role">Administrator</div>
              </div>
              <ChevronDown className="profile-chevron" size={14} color="#8996a9" />
            </div>
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <h1>Good day, Traffic Operator 👋</h1>
              <p>Monitor traffic activity and road conditions across Aykel Town.</p>
            </div>
            <div className="welcome-actions">
              <select className="date-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option>Today</option>
                <option>This week</option>
                <option>This month</option>
              </select>
              <button className="primary-btn" onClick={() => window.print()}>
                <Activity size={14} /> Export report
              </button>
            </div>
          </div>

          <div className="demo-banner">
            <AlertTriangle size={15} />
            Demonstration data only — traffic figures, map positions, weather, and incidents are illustrative, not live Aykel measurements.
          </div>

          <section className="metric-grid">
            <div className="card metric-card">
              <div className="metric-top">
                <span className="metric-label">Monitored vehicles / hour</span>
                <span className="metric-icon blue"><CarFront size={18} /></span>
              </div>
              <div className="metric-value">{totalVehicles.toLocaleString()}</div>
              <div className="metric-foot"><span className="trend-up"><ArrowUpRight size={12} /></span> Sample traffic volume</div>
            </div>
            <div className="card metric-card">
              <div className="metric-top">
                <span className="metric-label">Average speed</span>
                <span className="metric-icon green"><Gauge size={18} /></span>
              </div>
              <div className="metric-value">29 <span style={{ fontSize: 12, color: "#8b97a8" }}>km/h</span></div>
              <div className="metric-foot">Across sample monitoring zones</div>
            </div>
            <div className="card metric-card">
              <div className="metric-top">
                <span className="metric-label">Severe congestion</span>
                <span className="metric-icon red"><AlertTriangle size={18} /></span>
              </div>
              <div className="metric-value">{severeCount}</div>
              <div className="metric-foot"><span className="trend-down">Needs attention</span></div>
            </div>
            <div className="card metric-card">
              <div className="metric-top">
                <span className="metric-label">Monitored zones</span>
                <span className="metric-icon orange"><Signal size={18} /></span>
              </div>
              <div className="metric-value">{intersections.length}</div>
              <div className="metric-foot">Illustrative monitoring locations</div>
            </div>
          </section>

          <section className="section-grid">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Aykel traffic overview</div>
                  <div className="card-subtitle">Illustrative monitoring-zone map</div>
                </div>
                <span className="status status-moderate">DEMO MAP</span>
              </div>
              <div className="map-area">
                <div className="map-canvas">
                  <div className="map-road road-one" />
                  <div className="map-road road-two" />
                  <div className="map-road road-three" />
                  <div className="map-road road-four" />
                  <div className="map-river" />
                  <span className="map-label one">AYKEL TOWN</span>
                  <span className="map-label two">CHILGA</span>
                  <span className="map-label three">NORTH ZONE</span>
                  <span className="map-label four">SOUTH ZONE</span>

                  {[
                    { x: "48%", y: "48%", label: "Central", level: "heavy" },
                    { x: "69%", y: "30%", label: "Market", level: "moderate" },
                    { x: "27%", y: "68%", label: "Bus station", level: "severe" },
                    { x: "77%", y: "70%", label: "Hospital", level: "clear" },
                    { x: "25%", y: "25%", label: "School", level: "moderate" },
                  ].map((pin) => (
                    <div key={pin.label} className="map-pin" style={{ left: pin.x, top: pin.y }}>
                      <span className={`pin-dot pin-${pin.level}`} />
                      <span className="pin-label">{pin.label}</span>
                    </div>
                  ))}
                </div>
                <div className="map-legend">
                  <span className="legend-item"><i className="legend-dot pin-clear" /> Clear</span>
                  <span className="legend-item"><i className="legend-dot pin-moderate" /> Moderate</span>
                  <span className="legend-item"><i className="legend-dot pin-heavy" /> Heavy</span>
                  <span className="legend-item"><i className="legend-dot pin-severe" /> Severe</span>
                </div>
              </div>
            </div>

            <div>
              <div className="card weather-card">
                <div className="weather-top"><span>Weather overview</span><CloudSun size={22} /></div>
                <div className="weather-temp">--°C</div>
                <div className="weather-description">Weather data not connected</div>
                <div className="weather-bottom">
                  <span>Location<br /><strong>Aykel, Ethiopia</strong></span>
                  <span>Live weather<br /><strong>Unavailable</strong></span>
                </div>
              </div>

              <div className="card signal-card">
                <div className="signal-heading"><span>Signal operations</span><Zap size={16} color="#e58a27" /></div>
                <div className="signal-status">
                  <div className="signal-light"><Signal size={21} /></div>
                  <div>
                    <div className="signal-number">3 / 5</div>
                    <div className="signal-caption">Sample adaptive signals</div>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 10, background: "#edf1f6", marginTop: 15, overflow: "hidden" }}>
                  <div style={{ width: "60%", height: "100%", background: "#2475e8", borderRadius: 10 }} />
                </div>
                <div style={{ color: "#96a2b2", fontSize: 9, marginTop: 8 }}>Illustrative signal configuration</div>
              </div>
            </div>
          </section>

          <section className="section-grid">
            <div className="card chart-card">
              <div className="card-header">
                <div>
                  <div className="card-title">Traffic volume analytics</div>
                  <div className="card-subtitle">Illustrative hourly vehicle pattern · {period}</div>
                </div>
                <span className="status status-clear">SAMPLE</span>
              </div>
              <div className="chart-wrap">
                <svg className="chart-svg" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2875e8" stopOpacity=".22" />
                      <stop offset="100%" stopColor="#2875e8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[25, 65, 105, 145].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} className="chart-gridline" />)}
                  <polygon className="chart-area" points={`0,${155 - chartValues[0]} ${chartValues.map((v, i) => `${i * (600 / 11)},${155 - v * 1.5}`).join(" ")} 600,180 0,180`} />
                  <polyline className="chart-line" points={chartValues.map((v, i) => `${i * (600 / 11)},${155 - v * 1.5}`).join(" ")} />
                  {chartValues.map((v, i) => <circle key={i} className="chart-point" cx={i * (600 / 11)} cy={155 - v * 1.5} r="3.5" />)}
                </svg>
                <div className="chart-labels">
                  {["6 AM", "8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"].map((label) => <span key={label}>{label}</span>)}
                </div>
              </div>
              <div className="chart-summary">
                <div className="chart-stat"><strong>70%</strong><span>Sample peak activity</span></div>
                <div className="chart-stat"><strong>12 hrs</strong><span>Illustrative timeline</span></div>
              </div>
            </div>

            <div className="card table-card">
              <div className="card-header">
                <div>
                  <div className="card-title">Traffic conditions</div>
                  <div className="card-subtitle">Sample monitoring locations</div>
                </div>
                <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option>All</option>
                  <option>Clear</option>
                  <option>Moderate</option>
                  <option>Heavy</option>
                  <option>Severe</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Location</th><th>Speed</th><th>Condition</th></tr></thead>
                  <tbody>
                    {filteredIntersections.map((item) => (
                      <tr key={item.name}>
                        <td><div className="intersection-name">{item.name}</div><div className="intersection-area">{item.area}</div></td>
                        <td>{item.speed} km/h</td>
                        <td><Status level={item.level} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredIntersections.length === 0 && <div className="empty-state">No matching monitoring locations found.</div>}
              </div>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent incidents</div>
                  <div className="card-subtitle">Illustrative incident reports</div>
                </div>
                <button className="text-link" onClick={() => setActive("Incidents")}>View all</button>
              </div>
              <div className="incident-list">
                {incidents.map((incident) => (
                  <div className="incident-row" key={incident.title}>
                    <div className="incident-icon"><AlertTriangle size={16} /></div>
                    <div className="incident-main">
                      <div className="incident-name">{incident.title}</div>
                      <div className="incident-meta">{incident.place} · {incident.time}</div>
                    </div>
                    <div className="incident-right">
                      <Status level={incident.severity} />
                      <Status level={incident.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card recommendation">
              <div className="card-title">Operator recommendations</div>
              <div className="card-subtitle">Suggested actions based on sample data</div>
              <div className="recommendation-item">
                <div className="recommendation-icon"><TrafficCone size={16} /></div>
                <div><div className="recommendation-title">Review bus station congestion</div><div className="recommendation-text">Check traffic flow and possible road obstructions in this sample zone.</div></div>
              </div>
              <div className="recommendation-item">
                <div className="recommendation-icon"><Users size={16} /></div>
                <div><div className="recommendation-title">Consider pedestrian safety</div><div className="recommendation-text">Review pedestrian crossing arrangements near busy public areas.</div></div>
              </div>
              <div className="recommendation-item">
                <div className="recommendation-icon"><CheckCircle2 size={16} /></div>
                <div><div className="recommendation-title">Review signal timing</div><div className="recommendation-text">Evaluate whether signal plans match observed traffic demand.</div></div>
              </div>
            </div>
          </section>

          <div className="footer">
            Aykel Town Smart Traffic Management · Demonstration interface · Not connected to live traffic sensors
          </div>
        </div>
      </main>
    </div>
  );
}
