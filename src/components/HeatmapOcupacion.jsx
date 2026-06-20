import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_NUM = [1, 2, 3, 4, 5, 6, 0]

// Layout constants
const HOUR_HEIGHT = 64      // px per hour
const START_HOUR = 7        // 07:00
const END_HOUR = 22         // 22:00
const TOTAL_HOURS = END_HOUR - START_HOUR
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT

function minutesToPx(minutes) {
  return (minutes / 60) * HOUR_HEIGHT
}

function timeToMinutes(h, m) {
  return (h - START_HOUR) * 60 + m
}

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date) {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function getMadridTime(utcDate) {
  const d = new Date(utcDate)
  const madridOffset = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const diff = madridOffset - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(d.getTime() + diff)
}

function getOccupancyColor(pct) {
  if (pct < 25) return { bg: 'rgba(30,58,138,0.85)', border: '#1e3a8a', text: '#93c5fd' }
  if (pct < 50) return { bg: 'rgba(29,78,216,0.85)', border: '#1d4ed8', text: '#bfdbfe' }
  if (pct < 70) return { bg: 'rgba(37,99,235,0.9)', border: '#2563eb', text: '#dbeafe' }
  if (pct < 85) return { bg: 'rgba(109,40,217,0.9)', border: '#6d28d9', text: '#e9d5ff' }
  if (pct < 95) return { bg: 'rgba(124,58,237,0.9)', border: '#7c3aed', text: '#ede9fe' }
  return { bg: 'rgba(192,38,211,0.9)', border: '#c026d3', text: '#fce7f3' }
}

// Detect overlapping events and assign column layout
function overlaps(a, b) {
  return a.startMin < b.startMin + b.duration && a.startMin + a.duration > b.startMin
}

function layoutEvents(events) {
  if (!events.length) return []

  // Sort by start time
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin)

  // Step 1: assign columns greedily
  // columns[i] = array of events placed in column i
  const columns = []
  const result = sorted.map(event => ({ ...event, col: 0, totalCols: 1 }))

  for (const ev of result) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      // Check against ALL events in this column, not just the last
      const collidesWithCol = columns[col].some(other => overlaps(ev, other))
      if (!collidesWithCol) {
        columns[col].push(ev)
        ev.col = col
        placed = true
        break
      }
    }
    if (!placed) {
      ev.col = columns.length
      columns.push([ev])
    }
  }

  // Step 2: find connected overlap groups using union-find style BFS
  // All events that are transitively connected via overlaps share the same totalCols
  const visited = new Set()

  for (let i = 0; i < result.length; i++) {
    if (visited.has(i)) continue

    // BFS to find all events in this overlap group
    const group = []
    const queue = [i]
    visited.add(i)

    while (queue.length) {
      const idx = queue.shift()
      group.push(idx)
      for (let j = 0; j < result.length; j++) {
        if (!visited.has(j) && overlaps(result[idx], result[j])) {
          visited.add(j)
          queue.push(j)
        }
      }
    }

    // totalCols for the group = max col index in group + 1
    const maxCol = Math.max(...group.map(idx => result[idx].col))
    const totalCols = maxCol + 1
    group.forEach(idx => { result[idx].totalCols = totalCols })
  }

  return result
}

export default function HeatmapOcupacion({ branchId }) {
  const [classesData, setClassesData] = useState([])
  const [allClassNames, setAllClassNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [instructors, setInstructors] = useState([])
  const [selectedInstructor, setSelectedInstructor] = useState('')
  const [selectedClassName, setSelectedClassName] = useState('')
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()))
  const [tooltip, setTooltip] = useState(null)
  const [classModal, setClassModal] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    setSelectedInstructor('')
    setSelectedClassName('')
  }, [branchId])

  useEffect(() => {
    fetchData()
  }, [branchId, selectedInstructor, weekStart])

  // Scroll to 7:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [])

  const columnDates = DIAS_NUM.map(dayNum => {
    const d = new Date(weekStart)
    const offset = dayNum === 0 ? 6 : dayNum - 1
    d.setDate(d.getDate() + offset)
    return d
  })

  async function fetchData() {
    setLoading(true)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    let allClasses = []
    let from = 0
    const pageSize = 1000

    while (true) {
      let query = supabase
        .from('classes')
        .select('scheduled_at, booked_count, capacity, trainer_id, name, branch_id, duration_min, event_id')
        .gte('scheduled_at', weekStart.toISOString())
        .lt('scheduled_at', weekEnd.toISOString())
        .gt('capacity', 0)
        .range(from, from + pageSize - 1)

      if (branchId) query = query.eq('branch_id', branchId)
      if (selectedInstructor) query = query.eq('trainer_id', selectedInstructor)

      const { data: classes } = await query
      if (!classes || classes.length === 0) break
      allClasses = [...allClasses, ...classes]
      if (classes.length < pageSize) break
      from += pageSize
    }

    let staffQuery = supabase
      .from('staff')
      .select('glofox_user_id, name')
      .order('name')
    if (branchId) staffQuery = staffQuery.eq('branch_id', branchId)
    const { data: staff } = await staffQuery

    const uniqueStaff = [...new Map((staff || []).map(s => [s.glofox_user_id, s])).values()]
    const staffMap = {}
    uniqueStaff.forEach(s => { staffMap[s.glofox_user_id] = s.name })
    setInstructors(uniqueStaff)

    // Group by day, then layout overlapping events per day
    const byDay = {}
    DIAS_NUM.forEach(d => { byDay[d] = [] })

    allClasses.forEach(c => {
      const madridTime = getMadridTime(c.scheduled_at)
      const dayNum = madridTime.getUTCDay()
      const h = madridTime.getUTCHours()
      const m = madridTime.getUTCMinutes()
      const startMin = timeToMinutes(h, m)
      const duration = c.duration_min || 50

      // Skip classes outside our display range
      if (h < START_HOUR || h >= END_HOUR) return

      const pct = c.capacity > 0 ? Math.round((c.booked_count / c.capacity) * 100) : 0

      byDay[dayNum].push({
        id: `${c.scheduled_at}_${c.trainer_id || 'x'}_${c.name || 'x'}`,
        eventId: c.event_id,
        startMin,
        duration,
        h,
        m,
        pct,
        booked: c.booked_count || 0,
        capacity: c.capacity,
        name: c.name || '',
        trainerName: staffMap[c.trainer_id] || '',
        scheduledAt: c.scheduled_at,
      })
    })

    // Apply layout algorithm per day
    const laid = {}
    DIAS_NUM.forEach(dayNum => {
      laid[dayNum] = layoutEvents(byDay[dayNum])
    })

    // Collect unique class names for filter
    const names = [...new Set(allClasses.map(c => c.name).filter(Boolean))].sort()
    setAllClassNames(names)
    setClassesData(laid)
    setLoading(false)
  }

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  function thisWeek() {
    setWeekStart(getMondayOfWeek(new Date()))
  }

  async function openClassModal(ev, timeLabel) {
    setTooltip(null)
    setClassModal({ ev, timeLabel, attendees: [], loading: true, error: null })

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('glofox_booking_id, user_id, attended, time_start')
      .eq('branch_id', branchId)
      .eq('time_start', ev.scheduledAt)

    if (error) {
      setClassModal(prev => prev ? { ...prev, loading: false, error: error.message } : null)
      return
    }

    const userIds = [...new Set((bookings || []).map(b => b.user_id).filter(Boolean))]
    let membersMap = {}

    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('glofox_member_id, name, email')
        .eq('branch_id', branchId)
        .in('glofox_member_id', userIds)

      if (members) {
        members.forEach(m => { membersMap[m.glofox_member_id] = m })
      }
    }

    const attendees = (bookings || []).map(b => ({
      name: membersMap[b.user_id]?.name || '—',
      email: membersMap[b.user_id]?.email || '—',
      attended: b.attended,
    }))

    setClassModal(prev => prev ? { ...prev, attendees, loading: false } : null)
  }

  function attendedLabel(attended) {
    if (attended === true) return 'Asistió'
    if (attended === false) return 'No asistió'
    return 'Reservado'
  }

  // Hour labels for Y axis
  const hourLabels = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hourLabels.push(`${String(h).padStart(2, '0')}:00`)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="bg-white hover:bg-primary-100 border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2">← Anterior</button>
          <button onClick={thisWeek} className="bg-white hover:bg-primary-100 border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2">Hoy</button>
          <button onClick={nextWeek} className="bg-white hover:bg-primary-100 border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2">Siguiente →</button>
          <span className="text-sm text-text-200 ml-2">
            {formatDate(columnDates[0])} — {formatDate(columnDates[6])}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-200">Clase:</span>
            <select
              value={selectedClassName}
              onChange={e => setSelectedClassName(e.target.value)}
              className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-100 max-w-52"
            >
              <option value="">Todas</option>
              {allClassNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-200">Instructor:</span>
            <select
              value={selectedInstructor}
              onChange={e => setSelectedInstructor(e.target.value)}
              className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-100"
            >
              <option value="">Todos</option>
              {instructors.map(i => (
                <option key={i.glofox_user_id} value={i.glofox_user_id}>{i.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-text-200 text-sm">Cargando datos...</div>
      ) : (
        <div className="rounded-xl border border-bg-300 bg-white">
          {/* Day headers — sticky */}
          <div className="grid border-b border-bg-300 bg-bg-200/90 backdrop-blur-sm sticky top-0 z-20"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-bg-300" />
            {DIAS.map((d, i) => {
              const isToday = columnDates[i].toDateString() === new Date().toDateString()
              return (
                <div key={d} className={`text-center py-2 px-1 border-r border-bg-300 last:border-r-0 ${isToday ? 'bg-primary-100/70' : ''}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-accent-200' : 'text-text-200'}`}>{d}</div>
                  <div className={`text-xs mt-0.5 ${isToday ? 'text-accent-200 font-medium' : 'text-primary-300'}`}>{formatDate(columnDates[i])}</div>
                </div>
              )
            })}
          </div>

          {/* Scrollable calendar body */}
          <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
            <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>

              {/* Y-axis hour labels */}
              <div className="border-r border-bg-300 relative" style={{ height: TOTAL_HEIGHT }}>
                {hourLabels.map((label, i) => (
                  <div
                    key={label}
                    className="absolute right-2 text-xs text-primary-300 -translate-y-2"
                    style={{ top: i * HOUR_HEIGHT }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DIAS_NUM.map((dayNum, colIdx) => {
                const rawEvents = classesData[dayNum] || []
                const filteredRaw = selectedClassName ? rawEvents.filter(ev => ev.name === selectedClassName) : rawEvents
                // Re-run layout after filtering so col/totalCols are correct for the filtered set
                const events = selectedClassName ? layoutEvents(filteredRaw) : filteredRaw
                const isToday = columnDates[colIdx].toDateString() === new Date().toDateString()

                return (
                  <div
                    key={dayNum}
                    className={`relative border-r border-bg-300 last:border-r-0 ${isToday ? 'bg-primary-100/30' : ''}`}
                    style={{ height: TOTAL_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    {hourLabels.map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-bg-300/80"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}
                    {/* Half-hour lines */}
                    {hourLabels.slice(0, -1).map((_, i) => (
                      <div
                        key={`half_${i}`}
                        className="absolute left-0 right-0 border-t border-bg-300/40"
                        style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      />
                    ))}

                    {/* Events */}
                    {events.map(ev => {
                      const top = minutesToPx(ev.startMin)
                      const height = Math.max(minutesToPx(ev.duration), 20)
                      const colors = getOccupancyColor(ev.pct)
                      const colWidth = 100 / ev.totalCols
                      const left = ev.col * colWidth
                      const endH = Math.floor((START_HOUR * 60 + ev.startMin + ev.duration) / 60)
                      const endM = (START_HOUR * 60 + ev.startMin + ev.duration) % 60
                      const timeLabel = `${String(START_HOUR + Math.floor(ev.startMin / 60)).padStart(2,'0')}:${String(ev.startMin % 60).padStart(2,'0')} - ${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`

                      return (
                        <div
                          key={ev.id}
                          className="absolute rounded overflow-hidden cursor-pointer transition-all duration-150 hover:brightness-110 hover:z-10 hover:shadow-lg"
                          style={{
                            top: top + 1,
                            height: height - 2,
                            left: `calc(${left}% + 2px)`,
                            width: `calc(${colWidth}% - 4px)`,
                            background: colors.bg,
                            borderLeft: `3px solid ${colors.border}`,
                            zIndex: 5,
                          }}
                          onMouseEnter={(e) => setTooltip({
                            ev,
                            timeLabel,
                            x: e.clientX,
                            y: e.clientY
                          })}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => openClassModal(ev, timeLabel)}
                        >
                          <div className="px-1.5 py-1 h-full flex flex-col justify-start overflow-hidden">
                            {height >= 18 && (
                              <p className="text-xs font-semibold leading-tight truncate" style={{ color: colors.text }}>
                                {ev.name}
                              </p>
                            )}
                            {height >= 34 && (
                              <p className="text-xs leading-tight opacity-80 truncate" style={{ color: colors.text }}>
                                {timeLabel}
                              </p>
                            )}
                            {height >= 48 && ev.trainerName && (
                              <p className="text-xs leading-tight opacity-70 truncate" style={{ color: colors.text }}>
                                {ev.trainerName}
                              </p>
                            )}
                            {height >= 56 && (
                              <p className="text-xs font-bold mt-auto" style={{ color: colors.text }}>
                                {ev.pct}%
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-primary-300">
        <span>Ocupación:</span>
        {[
          { label: '<25%', bg: '#1e3a8a' },
          { label: '<50%', bg: '#1d4ed8' },
          { label: '<70%', bg: '#2563eb' },
          { label: '<85%', bg: '#6d28d9' },
          { label: '<95%', bg: '#7c3aed' },
          { label: '100%', bg: '#c026d3' },
        ].map(({ label, bg }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: bg }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-bg-200 border border-bg-300 rounded-xl p-3 text-sm shadow-2xl pointer-events-none min-w-48"
          style={{ left: tooltip.x + 14, top: tooltip.y - 120 }}
        >
          <p className="font-semibold text-text-100 mb-1.5">{tooltip.ev.name || 'Clase'}</p>
          <p className="text-text-200 text-xs mb-1">{tooltip.timeLabel} · {tooltip.ev.duration} min</p>
          <div className="border-t border-bg-300 my-1.5" />
          <p className="text-text-200">Ocupación: <span className="text-text-100 font-semibold">{tooltip.ev.pct}%</span></p>
          <p className="text-text-200">Reservas: <span className="text-text-100">{tooltip.ev.booked} / {tooltip.ev.capacity}</span></p>
          {tooltip.ev.trainerName && (
            <p className="text-text-200">Instructor: <span className="text-text-100">{tooltip.ev.trainerName}</span></p>
          )}
          <p className="text-text-200 text-xs mt-2 text-accent-200">Clic para ver reservas</p>
        </div>
      )}

      {/* Modal reservas */}
      {classModal && (
        <div
          className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
          onClick={() => setClassModal(null)}
        >
          <div
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <div>
                <h3 className="text-text-100 font-semibold">{classModal.ev.name || 'Clase'}</h3>
                <p className="text-xs text-text-200 mt-0.5">
                  {classModal.timeLabel}
                  {classModal.ev.trainerName ? ` · ${classModal.ev.trainerName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-200">
                  {classModal.loading ? '…' : `${classModal.attendees.length} reservas`}
                </span>
                <button
                  onClick={() => setClassModal(null)}
                  className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {classModal.loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : classModal.error ? (
                <p className="text-red-600 text-sm text-center py-12 px-6">{classModal.error}</p>
              ) : classModal.attendees.length === 0 ? (
                <p className="text-text-200 text-sm text-center py-12">No hay reservas para esta clase</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-200 border-b border-bg-300">
                    <tr>
                      <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Nombre</th>
                      <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Email</th>
                      <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classModal.attendees.map((p, i) => (
                      <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                        <td className="px-6 py-3 text-text-100 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-text-200">{p.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.attended === true
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : p.attended === false
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-primary-100 text-text-200 border border-primary-200'
                          }`}>
                            {attendedLabel(p.attended)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}