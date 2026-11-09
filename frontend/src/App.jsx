import { useMemo, useState } from 'react'
import './App.css'

const initialRoads = [
  { id: 1, name: 'Bole Road', area: 'Bole', vehicles: 1240, speed: 24, level: 'Heavy', signal: 'Active' },
  { id: 2, name: 'Mexico Square', area: 'Kirkos', vehicles: 860, speed: 38, level: 'Moderate', signal: 'Active' },
  { id: 3, name: 'Meskel Square', area: 'Kirkos', vehicles: 1530, speed: 16, level: 'Heavy', signal: 'Active' },
  { id: 4, name: 'CMC Road', area: 'Yeka', vehicles: 540, speed: 48, level: 'Clear', signal: 'Active' },
  { id: 5, name: 'Piassa Road', area: 'Arada', vehicles: 980, speed: 29, level: 'Moderate', signal: 'Maintenance' },
  { id: 6, name: 'Africa Avenue', area: 'Bole', vehicles: 710, speed: 42, level: 'Clear', signal: 'Active' },
]

const signals = [
  { id: 1, location: 'Bole Road Junction', state: 'Green', duration: '35 sec' },
  { id: 2, location: 'Meskel Square', state: 'Red', duration: '52 sec' },
  { id: 3, location: 'Mexico Square', state: 'Yellow', duration: '5 sec' },
  { id: 4, location: 'CMC Intersection', state: 'Green', duration: '28 sec' },
]

const navItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'traffic', label: 'Traffic monitoring', icon: '⇄' },
  { id: 'signals', label: 'Traffic signals', icon: '◉' },
  { id: 'reports', label: 'Reports', icon: '▤' },
]

const trafficSeries = {
  Today: { labels: ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM'], values: [28, 62, 45, 54, 48, 77, 61] },
  Week: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [48, 62, 54, 72, 66, 42, 34] },
  Month: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], values: [54, 68, 61, 76] },
}

function App() {
  const [activePage, setActivePage] = useState('overview')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [areaFilter, setAreaFilter] = useState('All')
  const [signalFilter, setSignalFilter] = useState('All')
  const [sortConfig, setSortConfig] = useState(null)
  const [roads] = useState(initialRoads)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [period, setPeriod] = useState('Week')

  const areaOptions = useMemo(() => [...new Set(roads.map((road) => road.area))].sort(), [roads])
  const filteredRoads = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = roads.filter((road) => {
      const matchesSearch = road.name.toLowerCase().includes(query) || road.area.toLowerCase().includes(query)
      return matchesSearch
        && (filter === 'All' || road.level === filter)
        && (areaFilter === 'All' || road.area === areaFilter)
        && (signalFilter === 'All' || road.signal === signalFilter)
    })

    if (!sortConfig) return matches

    const { key, direction } = sortConfig
    return matches.sort((a, b) => {
      const left = a[key]
      const right = b[key]
      const comparison = typeof left === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
      return comparison * (direction === 'asc' ? 1 : -1)
    })
  }, [roads, search, filter, areaFilter, signalFilter, sortConfig])

  const totalVehicles = roads.reduce((sum, road) => sum + road.vehicles, 0)
  const congestedRoads = roads.filter((road) => road.level === 'Heavy').length
  const averageSpeed = Math.round(roads.reduce((sum, road) => sum + road.speed, 0) / roads.length)
  const areaStats = [...roads.reduce((areas, road) => {
    areas.set(road.area, (areas.get(road.area) || 0) + road.vehicles)
    return areas
  }, new Map())].map(([area, vehicles]) => ({ area, vehicles })).sort((a, b) => b.vehicles - a.vehicles)

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  function refreshDashboard() {
    setLastUpdated(new Date())
    showNotice('Dashboard refreshed. Sample data remains unchanged.')
  }

  function exportReport() {
    const csvRows = [
      ['Road', 'Area', 'Vehicles', 'Average speed (km/h)', 'Congestion', 'Signal'],
      ...roads.map((road) => [road.name, road.area, road.vehicles, road.speed, road.level, road.signal]),
    ]
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
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
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon" aria-hidden="true">⌁</div>
          <div className="brand-copy"><strong>TrafficFlow</strong><span>SMART CITY SYSTEM</span></div>
          <button className="close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu">×</button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activePage === item.id ? 'nav-active' : ''}`} onClick={() => selectPage(item.id)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.id === 'traffic' && <span className="nav-count">{roads.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-top"><span className="pulse-dot" /><strong>System status</strong></div>
            <p>Demo dashboard online</p>
            <div className="status-track"><span /></div>
            <small>Sample data · No live sensors</small>
          </div>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-info"><strong>City Administrator</strong><span>Traffic operations</span></div>
            <span className="profile-dots" aria-hidden="true">•••</span>
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open navigation">☰</button>
            <div>
              <div className="breadcrumb">Workspace <span>/</span> {navItems.find((item) => item.id === activePage)?.label}</div>
              <h1>{activePage === 'overview' ? 'Traffic overview' : navItems.find((item) => item.id === activePage)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="live-badge"><span /> Demo mode</div>
            <button className="icon-button" onClick={refreshDashboard} aria-label="Refresh dashboard" title="Refresh dashboard">↻</button>
            <button className="primary-button export-button" onClick={exportReport}><span aria-hidden="true">⇩</span> Export report</button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}

        {activePage === 'overview' && (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">CITY TRAFFIC INTELLIGENCE</p>
                <h2>Good day, Administrator <span aria-hidden="true">✦</span></h2>
                <p className="muted">Here’s what’s happening across the city’s roads.</p>
              </div>
              <div className="date-card">
                <span className="date-icon" aria-hidden="true">◷</span>
                <div>
                  <strong>{lastUpdated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  <span>Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </section>

            <section className="stats-grid" aria-label="Traffic statistics">
              <StatCard title="Vehicles monitored" value={totalVehicles.toLocaleString()} unit="vehicles" icon="▤" color="blue" note="Across monitored roads" />
              <StatCard title="Active signals" value={signals.length} unit="signals" icon="◉" color="green" note="Sample intersections" />
              <StatCard title="Congested roads" value={congestedRoads} unit="roads" icon="⇄" color="orange" note="Require attention" />
              <StatCard title="Average speed" value={averageSpeed} unit="km/h" icon="↗" color="purple" note="Across monitored roads" />
            </section>

            <section className="analytics-grid" aria-label="Traffic analytics">
              <div className="panel trend-panel">
                <div className="panel-heading">
                  <div><h3>Traffic volume trends</h3><p>Relative vehicle activity · illustrative sample</p></div>
                  <div className="period-tabs" aria-label="Traffic chart period">
                    {Object.keys(trafficSeries).map((range) => (
                      <button key={range} className={period === range ? 'period-active' : ''} onClick={() => setPeriod(range)} aria-pressed={period === range}>{range}</button>
                    ))}
                  </div>
                </div>
                <TrafficChart series={trafficSeries[period]} />
              </div>
              <div className="panel area-panel">
                <div className="panel-heading"><div><h3>Vehicles by area</h3><p>Monitored road segments</p></div><span className="chart-icon">⌖</span></div>
                <div className="area-list">
                  {areaStats.map(({ area, vehicles }) => (
                    <div className="area-row" key={area}>
                      <div className="area-label"><span>{area}</span><strong>{vehicles.toLocaleString()}</strong></div>
                      <div className="area-track"><span style={{ width: `${(vehicles / areaStats[0].vehicles) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="area-total"><span>Total monitored vehicles</span><strong>{totalVehicles.toLocaleString()}</strong></div>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel traffic-panel">
                <div className="panel-heading">
                  <div><h3>Traffic flow overview</h3><p>Illustrative road congestion by area</p></div>
                  <span className="small-tag">DEMO DATA</span>
                </div>
                <div className="traffic-map" role="img" aria-label="Illustrative map of traffic congestion around Bole, Meskel Square, Mexico Square, and CMC">
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
                  <div className="map-caption"><span className="pulse-dot" /> Illustrative traffic map</div>
                </div>
                <div className="map-legend">
                  <span><i className="legend-dot clear-dot" /> Clear</span>
                  <span><i className="legend-dot moderate-dot" /> Moderate</span>
                  <span><i className="legend-dot heavy-dot" /> Heavy congestion</span>
                </div>
              </div>

              <div className="panel signals-panel">
                <div className="panel-heading">
                  <div><h3>Signal monitoring</h3><p>Intersection status overview</p></div>
                  <button className="text-button" onClick={() => selectPage('signals')}>View all →</button>
                </div>
                <div className="signal-list">
                  {signals.map((signal) => (
                    <div className="signal-row" key={signal.id}>
                      <div className={`traffic-light light-${signal.state.toLowerCase()}`} aria-hidden="true"><i /><i /><i /></div>
                      <div className="signal-info"><strong>{signal.location}</strong><span>Cycle: {signal.duration}</span></div>
                      <span className={`state-badge state-${signal.state.toLowerCase()}`}>{signal.state}</span>
                    </div>
                  ))}
                </div>
                <div className="panel-footer"><span><span className="pulse-dot" /> Signal statuses are simulated</span></div>
              </div>
            </section>

            <RoadTable {...roadTableProps} onViewAll={() => selectPage('traffic')} />
          </>
        )}

        {activePage === 'traffic' && (
          <section className="page-section">
            <div className="page-intro"><div><h2>Traffic monitoring</h2><p>Search road segments and inspect sample traffic conditions.</p></div><span className="small-tag">{roads.length} ROAD SEGMENTS</span></div>
            <RoadTable {...roadTableProps} />
          </section>
        )}

        {activePage === 'signals' && (
          <section className="page-section">
            <div className="page-intro"><div><h2>Traffic signals</h2><p>Sample intersection status. No live signal controls are connected.</p></div><span className="small-tag">{signals.length} INTERSECTIONS</span></div>
            <div className="signal-cards">
              {signals.map((signal) => (
                <div className="panel signal-card" key={signal.id}>
                  <div className="signal-card-heading"><span className="signal-card-icon">◉</span><span className={`state-badge state-${signal.state.toLowerCase()}`}>{signal.state}</span></div>
                  <h3>{signal.location}</h3>
                  <p>Sample signal cycle: {signal.duration}</p>
                  <div className="signal-card-light"><div className={`traffic-light light-${signal.state.toLowerCase()}`} aria-hidden="true"><i /><i /><i /></div><span>Simulated status</span></div>
                  <button className="secondary-button" onClick={() => showNotice(`Demo only: ${signal.location} was not changed.`)}>Test demo control</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activePage === 'reports' && (
          <section className="page-section">
            <div className="page-intro"><div><h2>Traffic reports</h2><p>Export the current sample road data as a CSV file.</p></div></div>
            <div className="panel report-panel">
              <div className="report-icon">▤</div>
              <h3>Road traffic summary</h3>
              <p>Includes road name, area, vehicle count, average speed, congestion level, and signal status.</p>
              <div className="report-summary"><span>Road segments <strong>{roads.length}</strong></span><span>Vehicles monitored <strong>{totalVehicles.toLocaleString()}</strong></span><span>Heavy congestion <strong>{congestedRoads}</strong></span></div>
              <button className="primary-button" onClick={exportReport}>⇩ Download CSV report</button>
            </div>
          </section>
        )}

        <footer className="footer">
          <span>TrafficFlow <span className="footer-dot">●</span> Smart City Traffic System</span>
          <span>Prototype dashboard · Sample data only</span>
        </footer>
      </main>
    </div>
  )
}

function StatCard({ title, value, unit, icon, color, note }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span className={`stat-icon ${color}`}>{icon}</span><span className="stat-menu" aria-hidden="true">•••</span></div>
      <p className="stat-title">{title}</p>
      <div className="stat-value">{value}<span>{unit}</span></div>
      <div className="stat-note"><span className={`note-mark ${color}`}>↗</span>{note}</div>
    </article>
  )
}

function TrafficChart({ series }) {
  const points = series.values.map((value, index) => {
    const x = 26 + (index * 588) / (series.values.length - 1)
    const y = 176 - value * 1.48
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `26,190 ${points} 614,190`

  return (
    <div className="chart-wrap">
      <div className="chart-summary"><strong>Vehicle activity</strong><span><i /> Index</span></div>
      <svg className="traffic-chart" viewBox="0 0 640 220" role="img" aria-label={`Illustrative vehicle activity for ${series.labels.join(', ')}`}>
        <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4279ee" stopOpacity=".2" /><stop offset="100%" stopColor="#4279ee" stopOpacity="0" /></linearGradient></defs>
        {[30, 75, 120, 165].map((y) => <line key={y} x1="26" x2="614" y1={y} y2={y} className="chart-gridline" />)}
        <polygon points={areaPoints} fill="url(#chartFill)" />
        <polyline points={points} className="chart-line" />
        {series.values.map((value, index) => {
          const x = 26 + (index * 588) / (series.values.length - 1)
          const y = 176 - value * 1.48
          return <circle key={series.labels[index]} cx={x} cy={y} r="4" className="chart-point" />
        })}
      </svg>
      <div className="chart-labels">{series.labels.map((label) => <span key={label}>{label}</span>)}</div>
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
}) {
  const hasFilters = search.trim() !== '' || filter !== 'All' || areaFilter !== 'All' || signalFilter !== 'All'

  function renderSortHeading(label, key) {
    const direction = sortConfig?.key === key ? sortConfig.direction : null
    const indicator = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'
    const accessibleDirection = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'unsorted'
    return (
      <th aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
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
        <div><h3>Road traffic status</h3><p>Vehicle activity and congestion by road segment</p></div>
        {onViewAll && <button className="text-button" onClick={onViewAll}>View all roads →</button>}
      </div>
      <div className="table-tools">
        <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roads or areas..." aria-label="Search roads or areas" /></label>
        <div className="filter-controls">
          <label className="filter-box"><span>Congestion</span><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by congestion"><option>All</option><option>Clear</option><option>Moderate</option><option>Heavy</option></select></label>
          <label className="filter-box"><span>Area</span><select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} aria-label="Filter by area"><option>All</option>{areaOptions.map((area) => <option key={area}>{area}</option>)}</select></label>
          <label className="filter-box"><span>Signal</span><select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)} aria-label="Filter by signal status"><option>All</option><option>Active</option><option>Maintenance</option></select></label>
          {hasFilters && <button className="clear-filters" type="button" onClick={onClearFilters}>Clear filters</button>}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            {renderSortHeading('Road / area', 'name')}
            {renderSortHeading('Vehicles', 'vehicles')}
            {renderSortHeading('Avg. speed', 'speed')}
            {renderSortHeading('Congestion', 'level')}
            {renderSortHeading('Signal', 'signal')}
          </tr></thead>
          <tbody>
            {roads.map((road) => (
              <tr key={road.id}>
                <td><strong>{road.name}</strong><span className="cell-subtitle">{road.area}</span></td>
                <td>{road.vehicles.toLocaleString()}</td>
                <td>{road.speed} <span className="cell-unit">km/h</span></td>
                <td><span className={`congestion-badge congestion-${road.level.toLowerCase()}`}><i />{road.level}</span></td>
                <td><span className={`signal-status ${road.signal === 'Active' ? 'signal-on' : 'signal-maintenance'}`}><i />{road.signal}</span></td>
              </tr>
            ))}
            {roads.length === 0 && <tr><td colSpan="5" className="empty-state">No roads match your search. Try a different term or filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-bottom"><span>Showing <strong>{roads.length}</strong> of <strong>{totalRoads}</strong> road segments</span><span>Demo data only</span></div>
    </section>
  )
}

export default App
