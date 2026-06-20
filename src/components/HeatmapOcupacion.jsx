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

function getMadridKey(iso) {
  const d = getMadridTime(iso)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${m}`
}

// bookings.time_start está guardado como hora de Madrid local con sufijo +00
// (no es UTC real, a diferencia de classes.scheduled_at). Por eso aquí NO se
// aplica conversión de zona: se leen los componentes UTC del string tal cual.
function getBookingMadridKey(iso) {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day}T${h}:${m}`
}

function buildBookingIndex(bookings) {
  const byEventTime = {}
  const byMadridKey = {}
  bookings.forEach(b => {
    const key = getBookingMadridKey(b.time_start)
    if (b.event_id) {
      const eventTimeKey = `${b.event_id}_${key}`
      if (!byEventTime[eventTimeKey]) byEventTime[eventTimeKey] = []
      byEventTime[eventTimeKey].push(b)
    }
    if (!byMadridKey[key]) byMadridKey[key] = []
    byMadridKey[key].push(b)
  })
  return { byEventTime, byMadridKey }
}

const OCCUPANCY_RED = '#dd0025'
const OCCUPANCY_YELLOW = '#FFD700'
const OCCUPANCY_GREEN = '#1DB954'

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')
}

function lerpColor(from, to, t) {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  )
}

function darkenHex(hex, amount = 0.18) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

function getContrastText(hex) {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#1d1c1c' : '#ffffff'
}

/** Escala 0–2% rojo → 50% amarillo → 100% verde, cuantizada cada 2% */
function occupancyHex(pct) {
  const step = Math.min(100, Math.max(0, Math.round(pct / 2) * 2))
  if (step <= 2) return OCCUPANCY_RED
  if (step <= 50) return lerpColor(OCCUPANCY_RED, OCCUPANCY_YELLOW, (step - 2) / (50 - 2))
  return lerpColor(OCCUPANCY_YELLOW, OCCUPANCY_GREEN, (step - 50) / (100 - 50))
}

function getOccupancyColor(pct) {
  const bg = occupancyHex(pct)
  return { bg, border: darkenHex(bg), text: getContrastText(bg) }
}

const OCCUPANCY_GRADIENT = Array.from({ length: 51 }, (_, i) => {
  const pct = i * 2
  return `${occupancyHex(pct)} ${pct}%`
}).join(', ')

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
  const [bookingIndex, setBookingIndex] = useState({ byEventTime: {}, byMadridKey: {} })
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

    // bookings.time_start está en hora Madrid local con sufijo +00 (no UTC real).
    // classes.scheduled_at sí está en UTC real, que es una semana antes/después
    // en UTC respecto a Madrid. Para no perder bookings en los bordes de la
    // semana por este desfase, se amplía el rango de consulta ±1 día.
    const bookingRangeStart = new Date(weekStart)
    bookingRangeStart.setDate(bookingRangeStart.getDate() - 1)
    const bookingRangeEnd = new Date(weekEnd)
    bookingRangeEnd.setDate(bookingRangeEnd.getDate() + 1)

    let allBookings = []
    from = 0
    let bookingFields = 'glofox_booking_id, user_id, attended, time_start, event_id'

    while (true) {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(bookingFields)
        .eq('branch_id', branchId)
        .gte('time_start', bookingRangeStart.toISOString())
        .lt('time_start', bookingRangeEnd.toISOString())
        .range(from, from + pageSize - 1)

      if (error && bookingFields.includes('event_id')) {
        bookingFields = 'glofox_booking_id, user_id, attended, time_start'
        from = 0
        allBookings = []
        continue
      }
      if (error || !bookings?.length) break
      allBookings = [...allBookings, ...bookings]
      if (bookings.length < pageSize) break
      from += pageSize
    }

    setBookingIndex(buildBookingIndex(allBookings))

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

    const madridKey = getMadridKey(ev.scheduledAt)
    let bookings = []
    if (ev.eventId) {
      bookings = bookingIndex.byEventTime[`${ev.eventId}_${madridKey}`] || []
    } else {
      bookings = bookingIndex.byMadridKey[madridKey] || []
    }

    if (bookings.length === 0) {
      // bookings.time_start está en hora Madrid local con sufijo +00, así que
      // el rango de búsqueda debe construirse en esa misma convención: se toma
      // la hora Madrid de la clase y se usa tal cual como si fuera UTC.
      const madridT = getMadridTime(ev.scheduledAt)
      const fromISO = new Date(madridT.getTime() - 30 * 60 * 1000).toISOString()
      const toISO = new Date(madridT.getTime() + 30 * 60 * 1000).toISOString()

      let query = supabase
        .from('bookings')
        .select('glofox_booking_id, user_id, attended, time_start, event_id')
        .eq('branch_id', branchId)
        .gte('time_start', fromISO)
        .lte('time_start', toISO)

      if (ev.eventId) query = query.eq('event_id', ev.eventId)

      const { data, error } = await query

      if (error && ev.eventId) {
        const fallback = await supabase
          .from('bookings')
          .select('glofox_booking_id, user_id, attended, time_start')
          .eq('branch_id', branchId)
          .gte('time_start', fromISO)
          .lte('time_start', toISO)

        if (fallback.error) {
          setClassModal(prev => prev ? { ...prev, loading: false, error: fallback.error.message } : null)
          return
        }
        bookings = fallback.data || []
      } else if (error) {
        setClassModal(prev => prev ? { ...prev, loading: false, error: error.message } : null)
        return
      } else {
        bookings = data || []
      }

      if (bookings.length > 1) {
        const matched = bookings.filter(b => getBookingMadridKey(b.time_start) === madridKey)
        if (matched.length) bookings = matched
      }
    }

    const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]
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

    const attendees = bookings.map(b => ({
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
      <div className="flex items-center gap-3 text-xs text-primary-300 flex-wrap">
        <span>Ocupación:</span>
        <div className="flex items-center gap-2">
          <span>0%</span>
          <div
            className="h-3 w-56 rounded-sm border border-bg-300"
            style={{ background: `linear-gradient(to right, ${OCCUPANCY_GRADIENT})` }}
          />
          <span>100%</span>
        </div>
        {[
          { label: '0–2%', pct: 0 },
          { label: '50%', pct: 50 },
          { label: '100%', pct: 100 },
        ].map(({ label, pct }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border border-bg-300/50" style={{ background: occupancyHex(pct) }} />
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