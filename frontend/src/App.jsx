
import { useEffect, useMemo, useState } from 'react'
import './App.css'

const navItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'traffic', label: 'Traffic monitoring', icon: '⇄' },
  { id: 'signals', label: 'Traffic signals', icon: '◉' },
  { id: 'reports', label: 'Reports', icon: '▤' },
]

const trafficSeries = {
  Today: {
    labels: ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM'],
    values: [28, 62, 45, 54, 48, 77, 61],
  },
  Week: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [48, 62, 54, 72, 66, 42, 34],
  },
  Month: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    values: [54, 68, 61, 76],
  },
}

function normalizeIntersection(item, index) {
  return {
    id: item.id ?? item.intersectionId ?? index,
    name: item.name ?? 'Unknown intersection',
    area: item.district ?? 'Unknown area',
    vehicles: Number(item.vehiclesPerHour ?? 0),
    dailyVehicles: Number(item.dailyVehicles ?? 0),
    speed: Number(item.speed ?? 0),
    level: item.congestion ?? 'Unknown',
    signal: item.signalPhase ?? 'Unknown',
    mode: item.mode ?? 'unknown',
    waitSeconds: Number(item.waitSeconds ?? 0),
  }
}

function extractIntersections(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.intersections)) return payload.intersections
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function App() {
  const [activePage, setActivePage] = useState('overview')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [areaFilter, setAreaFilter] = useState('All')
  const [signalFilter, setSignalFilter] = useState('All')
  const [sortConfig, setSortConfig] = useState(null)

  const [roads, setRoads] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [dataMode, setDataMode] = useState('simulated')
  const [lastUpdated, setLastUpdated] = useState(null)

  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [period, setPeriod] = useState('Week')

  // Load intersections from the backend.
  async function loadIntersections(showLoading = false) {
    if (showLoading) setLoading(true)

    try {
      const response = await fetch('/api/intersections')

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const payload = await response.json()
      const intersections = extractIntersections(payload)

      if (!intersections.length) {
        throw new Error('The API returned no intersections.')
      }

      setRoads(intersections.map(normalizeIntersection))
      setApiError('')
      setLastUpdated(new Date())
    } catch (error) {
      setApiError(error.message || 'Could not load traffic data.')
    } finally {
      setLoading(false)
    }
  }

  // Initial API request and automatic server updates.
  useEffect(() => {
    loadIntersections(true)

    const eventSource = new EventSource('/api/events')

    eventSource.onmessage = (event) => {
      try {
        const dashboard = JSON.parse(event.data)

        if (dashboard.dataMode) {
          setDataMode(dashboard.dataMode)
        }

        const intersections = extractIntersections(dashboard)

        if (intersections.length) {
          setRoads(intersections.map(normalizeIntersection))
          setApiError('')
          setLastUpdated(new Date())
        }
      } catch {
        setApiError('Received an invalid update from the server.')
      }
    }

    eventSource.onerror = () => {
      setApiError('Live connection interrupted. Waiting for reconnection...')
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const signals = roads.map((road) => ({
    id: road.id,
    location: road.name,
    state: road.signal,
    duration: `${road.waitSeconds} sec`,
    mode: road.mode,
  }))

  const areaOptions = useMemo(
    () => [...new Set(roads.map((road) => road.area))].sort(),
    [roads],
  )

  const filteredRoads = useMemo(() => {
    const query = search.trim().toLowerCase()

    const matches = roads.filter((road) => {
      const matchesSearch =
        road.name.toLowerCase().includes(query) ||
        road.area.toLowerCase().includes(query)

      return (
        matchesSearch &&
        (filter === 'All' || road.level === filter) &&
        (areaFilter === 'All' || road.area === areaFilter) &&
        (signalFilter === 'All' || road.signal === signalFilter)
      )
    })

    if (!sortConfig) return matches

    const { key, direction } = sortConfig

    return [...matches].sort((a, b) => {
      const left = a[key]
      const right = b[key]

      const comparison =
        typeof left === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, {
              numeric: true,
              sensitivity: 'base',
            })

      return comparison * (direction === 'asc' ? 1 : -1)
    })
  }, [roads, search, filter, areaFilter, signalFilter, sortConfig])

  const totalVehicles = roads.reduce(
    (sum, road) => sum + road.vehicles,
    0,
  )

  const congestedRoads = roads.filter(
    (road) => road.level.toLowerCase() === 'heavy',
  ).length

  const averageSpeed = roads.length
    ? Math.round(
        roads.reduce((sum, road) => sum + road.speed, 0) / roads.length,
      )
    : 0

  const areaStats = [...roads.reduce((areas, road) => {
    areas.set(
      road.area,
      (areas.get(road.area) || 0) + road.vehicles,
    )
    return areas
  }, new Map())]
    .map(([area, vehicles]) => ({ area, vehicles }))
    .sort((a, b) => b.vehicles - a.vehicles)

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  async function refreshDashboard() {
    await loadIntersections(true)

    if (!apiError) {
      showNotice('Traffic data refreshed from the backend.')
    }
  }

  function exportReport() {
    if (!roads.length) {
      showNotice('No traffic data available to export.')
      return
    }

    const csvRows = [
      [
        'Intersection',
        'Area',
        'Vehicles per hour',
        'Daily vehicles',
        'Average speed (km/h)',
        'Congestion',
        'Signal phase',
        'Signal mode',
        'Waiting time (seconds)',
      ],
      ...roads.map((road) => [
        road.name,
        road.area,
        road.vehicles,
        road.dailyVehicles,
        road.speed,
        road.level,
        road.signal,
        road.mode,
        road.waitSeconds,
      ]),
    ]

    const csv = csvRows
      .map((row) =>
        row.map((value) =>
          `"${String(value).replaceAll('"', '""')}"`,
        ).join(','),
      )
      .join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'smart-city-traffic-report.csv'
    link.click()

    URL.revokeObjectURL(url)
    showNotice('Traffic report downloaded.')
  }

  function selectPage(page) {
    setActivePage(page)
    setMobileMenu(false)
  }

  function sortRoads(key) {
    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === 'asc'
          ? 'desc'
          : 'asc',
    }))
  }

  function clearRoadFilters() {
    setSearch('')
    setFilter('All')
    setAreaFilter('All')
    setSignalFilter('All')
  }

  const roadTableProps = {
    roads: filteredRoads,
    totalRoads: roads.length,
    search,
    setSearch,
    filter,
    setFilter,
    areaFilter,
    setAreaFilter,
    areaOptions,
    signalFilter,
    setSignalFilter,
    sortConfig,
    onSort: sortRoads,
    onClearFilters: clearRoadFilters,
    loading,
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">⌁</div>
          <div className="brand-copy">
            <strong>TrafficFlow</strong>
            <span>SMART CITY SYSTEM</span>
          </div>

          <button
            className="close-menu"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'nav-active' : ''}`}
              onClick={() => selectPage(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>

              {item.label}

              {item.id === 'traffic' && (
                <span className="nav-count">{roads.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-top">
              <span className="pulse-dot" />
              <strong>System status</strong>
            </div>

            <p>
              {apiError ? 'Connection issue' : 'Backend connected'}
            </p>

            <div className="status-track"><span /></div>

            <small>
              {dataMode === 'simulated'
                ? 'Simulated traffic data'
                : 'Backend traffic data'}
            </small>
          </div>

          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-info">
              <strong>City Administrator</strong>
              <span>Traffic operations</span>
            </div>
            <span className="profile-dots" aria-hidden="true">•••</span>
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setMobileMenu(true)}
              aria-label="Open navigation"
            >
              ☰
            </button>

            <div>
              <div className="breadcrumb">
                Workspace <span>/</span>{' '}
                {navItems.find((item) => item.id === activePage)?.label}
              </div>

              <h1>
                {activePage === 'overview'
                  ? 'Traffic overview'
                  : navItems.find((item) => item.id === activePage)?.label}
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="live-badge">
              <span />
              {dataMode === 'simulated' ? 'Simulated data' : 'Connected'}
            </div>

            <button
              className="icon-button"
              onClick={refreshDashboard}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
              disabled={loading}
            >
              ↻
            </button>

            <button
              className="primary-button export-button"
              onClick={exportReport}
            >
              <span aria-hidden="true">⇩</span> Export report
            </button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}

        {apiError && (
          <div className="notice" role="alert">
            {apiError}
          </div>
        )}

        {activePage === 'overview' && (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">CITY TRAFFIC INTELLIGENCE</p>
                <h2>
                  Good day, Administrator <span aria-hidden="true">✦</span>
                </h2>
                <p className="muted">
                  Here’s what’s happening across the city’s roads.
                </p>
              </div>

              <div className="date-card">
                <span className="date-icon" aria-hidden="true">◷</span>
                <div>
                  <strong>
                    {lastUpdated
                      ? lastUpdated.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Waiting for data'}
                  </strong>

                  <span>
                    {lastUpdated
                      ? `Last updated ${lastUpdated.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : 'Connecting to backend...'}
                  </span>
                </div>
              </div>
            </section>

            <section className="stats-grid" aria-label="Traffic statistics">
              <StatCard
                title="Vehicles per hour"
                value={totalVehicles.toLocaleString()}
                unit="vehicles"
                icon="▤"
                color="blue"
                note="Across monitored intersections"
              />

              <StatCard
                title="Monitored signals"
                value={signals.length}
                unit="signals"
                icon="◉"
                color="green"
                note="Connected intersections"
              />

              <StatCard
                title="Congested roads"
                value={congestedRoads}
                unit="roads"
                icon="⇄"
                color="orange"
                note="Require attention"
              />

              <StatCard
                title="Average speed"
                value={averageSpeed}
                unit="km/h"
                icon="↗"
                color="purple"
                note="Across monitored intersections"
              />
            </section>

            <section className="analytics-grid" aria-label="Traffic analytics">
              <div className="panel trend-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Traffic volume trends</h3>
                    <p>Illustrative traffic activity · sample chart</p>
                  </div>

                  <div className="period-tabs" aria-label="Traffic chart period">
                    {Object.keys(trafficSeries).map((range) => (
                      <button
                        key={range}
                        className={period === range ? 'period-active' : ''}
                        onClick={() => setPeriod(range)}
                        aria-pressed={period === range}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <TrafficChart series={trafficSeries[period]} />
              </div>

              <div className="panel area-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Vehicles by area</h3>
                    <p>Current vehicles per hour</p>
                  </div>

                  <span className="chart-icon">⌖</span>
                </div>

                <div className="area-list">
                  {areaStats.map(({ area, vehicles }) => (
                    <div className="area-row" key={area}>
                      <div className="area-label">
                        <span>{area}</span>
                        <strong>{vehicles.toLocaleString()}</strong>
                      </div>

                      <div className="area-track">
                        <span
                          style={{
                            width: `${areaStats[0]?.vehicles
                              ? (vehicles / areaStats[0].vehicles) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="area-total">
                  <span>Total vehicles per hour</span>
                  <strong>{totalVehicles.toLocaleString()}</strong>
                </div>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel traffic-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Traffic flow overview</h3>
                    <p>Illustrative road congestion by area</p>
                  </div>

                  <span className="small-tag">DEMO MAP</span>
                </div>

                <div
                  className="traffic-map"
                  role="img"
                  aria-label="Illustrative map of traffic congestion"
                >
                  <div className="map-grid" />
                  <div className="map-road road-one"><span /></div>
                  <div className="map-road road-two"><span /></div>
                  <div className="map-road road-three"><span /></div>
                  <div className="map-road road-four"><span /></div>
                  <div className="map-road road-five"><span /></div>
                  <div className="map-label label-bole">BOLE</div>
                  <div className="map-label label-meskel">MESKEL SQ.</div>
                  <div className="map-label label-mexico">MEXICO SQ.</div>
                  <div className="map-label label-cmc">CMC</div>
                  <div className="map-pin pin-one heavy-pin"><span>!</span></div>
                  <div className="map-pin pin-two moderate-pin"><span>!</span></div>
                  <div className="map-pin pin-three clear-pin"><span>✓</span></div>
                  <div className="map-pin pin-four heavy-pin"><span>!</span></div>

                  <div className="map-caption">
                    <span className="pulse-dot" />
                    Illustrative traffic map
                  </div>
                </div>

                <div className="map-legend">
                  <span><i className="legend-dot clear-dot" /> Clear</span>
                  <span><i className="legend-dot moderate-dot" /> Moderate</span>
                  <span><i className="legend-dot heavy-dot" /> Heavy congestion</span>
                </div>
              </div>

              <div className="panel signals-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Signal monitoring</h3>
                    <p>Backend intersection status</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => selectPage('signals')}
                  >
                    View all →
                  </button>
                </div>

                <div className="signal-list">
                  {signals.slice(0, 4).map((signal) => (
                    <div className="signal-row" key={signal.id}>
                      <SignalLight state={signal.state} />

                      <div className="signal-info">
                        <strong>{signal.location}</strong>
                        <span>
                          Waiting time: {signal.duration}
                        </span>
                      </div>

                      <SignalBadge state={signal.state} />
                    </div>
                  ))}
                </div>

                <div className="panel-footer">
                  <span>
                    <span className="pulse-dot" />
                    Signal phases from backend data
                  </span>
                </div>
              </div>
            </section>

            <RoadTable
              {...roadTableProps}
              onViewAll={() => selectPage('traffic')}
            />
          </>
        )}

        {activePage === 'traffic' && (
          <section className="page-section">
            <div className="page-intro">
              <div>
                <h2>Traffic monitoring</h2>
                <p>
                  Monitor intersection traffic conditions from the backend.
                </p>
              </div>

              <span className="small-tag">
                {roads.length} INTERSECTIONS
              </span>
            </div>

            <RoadTable {...roadTableProps} />
          </section>
        )}

        {activePage === 'signals' && (
          <section className="page-section">
            <div className="page-intro">
              <div>
                <h2>Traffic signals</h2>
                <p>
                  Inspect current signal phases and operating modes.
                </p>
              </div>

              <span className="small-tag">
                {signals.length} INTERSECTIONS
              </span>
            </div>

            <div className="signal-cards">
              {signals.map((signal) => (
                <div className="panel signal-card" key={signal.id}>
                  <div className="signal-card-heading">
                    <span className="signal-card-icon">◉</span>
                    <SignalBadge state={signal.state} />
                  </div>

                  <h3>{signal.location}</h3>

                  <p>Waiting time: {signal.duration}</p>

                  <div className="signal-card-light">
                    <SignalLight state={signal.state} />
                    <span>
                      Signal mode: {signal.mode}
                    </span>
                  </div>

                  <span className="small-tag">
                    {signal.mode.toUpperCase()} MODE
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activePage === 'reports' && (
          <section className="page-section">
            <div className="page-intro">
              <div>
                <h2>Traffic reports</h2>
                <p>
                  Export the current intersection data from the backend.
                </p>
              </div>
            </div>

            <div className="panel report-panel">
              <div className="report-icon">▤</div>

              <h3>Road traffic summary</h3>

              <p>
                Includes intersection name, area, hourly vehicle count,
                daily vehicle count, average speed, congestion,
                signal phase, operating mode, and waiting time.
              </p>

              <div className="report-summary">
                <span>
                  Intersections
                  <strong>{roads.length}</strong>
                </span>

                <span>
                  Vehicles per hour
                  <strong>{totalVehicles.toLocaleString()}</strong>
                </span>

                <span>
                  Heavy congestion
                  <strong>{congestedRoads}</strong>
                </span>
              </div>

              <button
                className="primary-button"
                onClick={exportReport}
              >
                ⇩ Download CSV report
              </button>
            </div>
          </section>
        )}

        <footer className="footer">
          <span>
            TrafficFlow <span className="footer-dot">●</span>
            Smart City Traffic System
          </span>

          <span>
            Backend connected · {dataMode} data
          </span>
        </footer>
      </main>
    </div>
  )
}

function SignalLight({ state }) {
  const normalized = String(state).toLowerCase()

  return (
    <div
      className={`traffic-light light-${normalized}`}
      aria-label={`Signal ${state}`}
    >
      <i /><i /><i />
    </div>
  )
}

function SignalBadge({ state }) {
  const normalized = String(state).toLowerCase()
  const supported = ['green', 'red', 'yellow'].includes(normalized)

  return (
    <span
      className={`state-badge ${
        supported ? `state-${normalized}` : ''
      }`}
    >
      {state}
    </span>
  )
}

function StatCard({ title, value, unit, icon, color, note }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className={`stat-icon ${color}`}>{icon}</span>
        <span className="stat-menu" aria-hidden="true">•••</span>
      </div>

      <p className="stat-title">{title}</p>

      <div className="stat-value">
        {value}<span>{unit}</span>
      </div>

      <div className="stat-note">
        <span className={`note-mark ${color}`}>↗</span>
        {note}
      </div>
    </article>
  )
}

function TrafficChart({ series }) {
  const points = series.values
    .map((value, index) => {
      const x = 26 + (index * 588) / (series.values.length - 1)
      const y = 176 - value * 1.48
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `26,190 ${points} 614,190`

  return (
    <div className="chart-wrap">
      <div className="chart-summary">
        <strong>Vehicle activity</strong>
        <span><i /> Index</span>
      </div>

      <svg
        className="traffic-chart"
        viewBox="0 0 640 220"
        role="img"
        aria-label={`Illustrative vehicle activity for ${series.labels.join(', ')}`}
      >
        <defs>
          <linearGradient
            id="chartFill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#4279ee" stopOpacity=".2" />
            <stop offset="100%" stopColor="#4279ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[30, 75, 120, 165].map((y) => (
          <line
            key={y}
            x1="26"
            x2="614"
            y1={y}
            y2={y}
            className="chart-gridline"
          />
        ))}

        <polygon points={areaPoints} fill="url(#chartFill)" />
        <polyline points={points} className="chart-line" />

        {series.values.map((value, index) => {
          const x = 26 + (index * 588) / (series.values.length - 1)
          const y = 176 - value * 1.48

          return (
            <circle
              key={series.labels[index]}
              cx={x}
              cy={y}
              r="4"
              className="chart-point"
            />
          )
        })}
      </svg>

      <div className="chart-labels">
        {series.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function RoadTable({
  roads,
  totalRoads,
  search,
  setSearch,
  filter,
  setFilter,
  areaFilter,
  setAreaFilter,
  areaOptions,
  signalFilter,
  setSignalFilter,
  sortConfig,
  onSort,
  onClearFilters,
  onViewAll,
  loading,
}) {
  const hasFilters =
    search.trim() !== '' ||
    filter !== 'All' ||
    areaFilter !== 'All' ||
    signalFilter !== 'All'

  function renderSortHeading(label, key) {
    const direction =
      sortConfig?.key === key ? sortConfig.direction : null

    const indicator =
      direction === 'asc'
        ? '▲'
        : direction === 'desc'
          ? '▼'
          : '↕'

    const accessibleDirection =
      direction === 'asc'
        ? 'ascending'
        : direction === 'desc'
          ? 'descending'
          : 'unsorted'

    return (
      <th
        aria-sort={
          direction === 'asc'
            ? 'ascending'
            : direction === 'desc'
              ? 'descending'
              : 'none'
        }
      >
        <button
          className="sort-button"
          type="button"
          onClick={() => onSort(key)}
          aria-label={`Sort by ${label.toLowerCase()} (${accessibleDirection})`}
        >
          {label}<span aria-hidden="true">{indicator}</span>
        </button>
      </th>
    )
  }

  return (
    <section className="panel roads-panel">
      <div className="panel-heading roads-heading">
        <div>
          <h3>Road traffic status</h3>
          <p>Vehicle activity and congestion by intersection</p>
        </div>

        {onViewAll && (
          <button className="text-button" onClick={onViewAll}>
            View all roads →
          </button>
        )}
      </div>

      <div className="table-tools">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roads or areas..."
            aria-label="Search roads or areas"
          />
        </label>

        <div className="filter-controls">
          <label className="filter-box">
            <span>Congestion</span>

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter by congestion"
            >
              <option>All</option>
              <option>Clear</option>
              <option>Moderate</option>
              <option>Heavy</option>
            </select>
          </label>

          <label className="filter-box">
            <span>Area</span>

            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
              aria-label="Filter by area"
            >
              <option>All</option>

              {areaOptions.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>

          <label className="filter-box">
            <span>Signal</span>

            <select
              value={signalFilter}
              onChange={(event) => setSignalFilter(event.target.value)}
              aria-label="Filter by signal phase"
            >
              <option>All</option>
              <option>Red</option>
              <option>Yellow</option>
              <option>Green</option>
            </select>
          </label>

          {hasFilters && (
            <button
              className="clear-filters"
              type="button"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {renderSortHeading('Road / area', 'name')}
              {renderSortHeading('Vehicles / hour', 'vehicles')}
              {renderSortHeading('Avg. speed', 'speed')}
              {renderSortHeading('Congestion', 'level')}
              {renderSortHeading('Signal phase', 'signal')}
            </tr>
          </thead>

          <tbody>
            {loading && roads.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-state">
                  Connecting to traffic backend...
                </td>
              </tr>
            )}

            {roads.map((road) => (
              <tr key={road.id}>
                <td>
                  <strong>{road.name}</strong>
                  <span className="cell-subtitle">{road.area}</span>
                </td>

                <td>{road.vehicles.toLocaleString()}</td>

                <td>
                  {road.speed} <span className="cell-unit">km/h</span>
                </td>

                <td>
                  <span
                    className={`congestion-badge congestion-${road.level.toLowerCase()}`}
                  >
                    <i />{road.level}
                  </span>
                </td>

                <td>
                  <span
                    className={`signal-status ${
                      road.signal === 'Green'
                        ? 'signal-on'
                        : 'signal-maintenance'
                    }`}
                  >
                    <i />{road.signal}
                  </span>
                </td>
              </tr>
            ))}

            {!loading && roads.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-state">
                  No intersection data is available.
                </td>
              </tr>
            )}

            {roads.length > 0 && filteredRoadsEmpty(roads, totalRoads) && null}
          </tbody>
        </table>
      </div>

      <div className="table-bottom">
        <span>
          Showing <strong>{roads.length}</strong> of{' '}
          <strong>{totalRoads}</strong> road segments
        </span>

        <span>Backend data</span>
      </div>
    </section>
  )
}

function filteredRoadsEmpty(roads, totalRoads) {
  return roads.length === 0 && totalRoads > 0
}

export default App
.