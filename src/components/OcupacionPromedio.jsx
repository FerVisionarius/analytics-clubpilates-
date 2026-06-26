import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_NUM = [1, 2, 3, 4, 5, 6, 0]

const HOUR_HEIGHT = 64
const START_HOUR = 7
const END_HOUR = 22
const TOTAL_HOURS = END_HOUR - START_HOUR
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT

const TOLERANCE_MIN = 15

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

function getMadridTime(utcDate) {
  const d = new Date(utcDate)
  const madridOffset = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const diff = madridOffset - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(d.getTime() + diff)
}

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 28)
  return { start: formatDateInput(start), end: formatDateInput(end) }
}

function storageKey(branchId) {
  return `ocupacionPromedio_range_${branchId}`
}

function loadStoredRange(branchId) {
  try {
    const raw = sessionStorage.getItem(storageKey(branchId))
    if (!raw) return defaultRange()
    const parsed = JSON.parse(raw)
    if (parsed?.start && parsed?.end) return parsed
    return defaultRange()
  } catch {
    return defaultRange()
  }
}

function timeToMinutes(h, m) {
  return (h - START_HOUR) * 60 + m
}

function minutesToPx(minutes) {
  return (minutes / 60) * HOUR_HEIGHT
}

function dayLabelFromNum(dayNum) {
  // DIAS_NUM = [1,2,3,4,5,6,0] -> índice en DIAS = ['Lun',...,'Dom']
  const idx = DIAS_NUM.indexOf(dayNum)
  return DIAS[idx]
}

/**
 * Agrupa clases por (día de semana, nombre, slot horario). El event_id cambia
 * cada semana en Glofox, así que la identidad de "misma clase recurrente" se
 * basa en día + nombre + hora aproximada (±15 min de tolerancia). La clase se
 * asigna al slot ya existente más cercano si cae dentro de tolerancia; si no,
 * abre un slot nuevo. El slot guarda su hora "habitual" (anchorMinutes de la
 * primera sesión vista) y la lista de sesiones individuales que lo componen,
 * para poder mostrar el desglose semana por semana al hacer click.
 */
function groupClasses(classes) {
  const groups = {}
  DIAS_NUM.forEach(d => { groups[d] = {} })

  classes.forEach(c => {
    const madridTime = getMadridTime(c.scheduled_at)
    const dayNum = madridTime.getUTCDay()
    const h = madridTime.getUTCHours()
    const m = madridTime.getUTCMinutes()
    const minutesOfDay = h * 60 + m
    const name = c.name || 'Sin nombre'

    if (h < START_HOUR || h >= END_HOUR) return

    if (!groups[dayNum][name]) groups[dayNum][name] = []
    const slots = groups[dayNum][name]

    let slot = slots.find(s => Math.abs(s.anchorMinutes - minutesOfDay) <= TOLERANCE_MIN)

    if (!slot) {
      slot = {
        anchorMinutes: minutesOfDay,
        name,
        dayNum,
        sumBooked: 0,
        sumCapacity: 0,
        count: 0,
        sessions: [],
      }
      slots.push(slot)
    }

    slot.sumBooked += c.booked_count || 0
    slot.sumCapacity += c.capacity || 0
    slot.count += 1
    slot.sessions.push({
      scheduledAt: c.scheduled_at,
      booked: c.booked_count || 0,
      capacity: c.capacity || 0,
      madridTime,
    })
  })

  return groups
}

function formatSessionDate(madridTime) {
  return madridTime.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function OcupacionPromedio({ branchId }) {
  const [range, setRange] = useState(() => loadStoredRange(branchId))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groupedSlots, setGroupedSlots] = useState({})
  const [detailModal, setDetailModal] = useState(null)

  useEffect(() => {
    setRange(loadStoredRange(branchId))
  }, [branchId])

  useEffect(() => {
    sessionStorage.setItem(storageKey(branchId), JSON.stringify(range))
  }, [branchId, range])

  useEffect(() => {
    fetchData()
  }, [branchId, range.start, range.end])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const startDate = new Date(range.start + 'T00:00:00')
    const endDate = new Date(range.end + 'T23:59:59')

    if (startDate > endDate) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.')
      setLoading(false)
      return
    }

    let allClasses = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error: queryError } = await supabase
        .from('classes')
        .select('scheduled_at, booked_count, capacity, name, branch_id')
        .eq('branch_id', branchId)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .gt('capacity', 0)
        .range(from, from + pageSize - 1)

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }
      if (!data || data.length === 0) break
      allClasses = [...allClasses, ...data]
      if (data.length < pageSize) break
      from += pageSize
    }

    setGroupedSlots(groupClasses(allClasses))
    setLoading(false)
  }

  const slotsByDay = {}
  DIAS_NUM.forEach(dayNum => {
    const slotsForDay = Object.values(groupedSlots[dayNum] || {}).flat()
    slotsByDay[dayNum] = slotsForDay.map(s => ({
      ...s,
      pct: s.sumCapacity > 0 ? Math.round((s.sumBooked / s.sumCapacity) * 100) : 0,
      startMin: timeToMinutes(Math.floor(s.anchorMinutes / 60), s.anchorMinutes % 60),
    }))
  })

  const hourLabels = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hourLabels.push(`${String(h).padStart(2, '0')}:00`)
  }

  function formatHour(minutes) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-100">Ocupación Promedio</h2>
        <p className="text-sm text-text-200 mt-1">
          Compara la ocupación de clases recurrentes (mismo día, hora habitual y nombre) entre semanas.
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-200">Desde</label>
          <input
            type="date"
            value={range.start}
            onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-200">Hasta</label>
          <input
            type="date"
            value={range.end}
            onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-100"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-text-200 text-sm">Cargando datos...</div>
      ) : (
        <div className="rounded-xl border border-bg-300 bg-white">
          <div className="grid border-b border-bg-300 bg-bg-200/90"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-bg-300" />
            {DIAS.map(d => (
              <div key={d} className="text-center py-2 px-1 border-r border-bg-300 last:border-r-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-200">{d}</p>
              </div>
            ))}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: '700px' }}>
            <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
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

              {DIAS_NUM.map(dayNum => {
                const slots = slotsByDay[dayNum] || []
                return (
                  <div key={dayNum} className="relative border-r border-bg-300 last:border-r-0" style={{ height: TOTAL_HEIGHT }}>
                    {hourLabels.map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-bg-300/80"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}

                    {slots.map((s, i) => {
                      const top = minutesToPx(s.startMin)
                      const height = HOUR_HEIGHT - 4
                      const colors = getOccupancyColor(s.pct)
                      return (
                        <div
                          key={`${s.name}_${s.anchorMinutes}_${i}`}
                          className="absolute rounded overflow-hidden cursor-pointer transition-all duration-150 hover:brightness-110 hover:z-10 hover:shadow-lg"
                          style={{
                            top: top + 2,
                            height,
                            left: 2,
                            right: 2,
                            background: colors.bg,
                            borderLeft: `3px solid ${colors.border}`,
                          }}
                          onClick={() => setDetailModal({ dayNum, slot: s })}
                        >
                          <div className="px-1.5 py-1 h-full flex flex-col justify-start overflow-hidden">
                            <p className="text-xs font-semibold leading-tight truncate" style={{ color: colors.text }}>
                              {s.name}
                            </p>
                            <p className="text-xs leading-tight opacity-80 truncate" style={{ color: colors.text }}>
                              {formatHour(s.anchorMinutes)}
                            </p>
                            <p className="text-xs font-bold mt-auto leading-tight" style={{ color: colors.text }}>
                              {s.pct}% ({s.sumBooked}/{s.sumCapacity}) · {s.count} {s.count === 1 ? 'clase' : 'clases'}
                            </p>
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

      <div className="flex items-center gap-3 text-xs text-primary-300 flex-wrap">
        <span>Ocupación promedio:</span>
        <div className="flex items-center gap-2">
          <span>0%</span>
          <div
            className="h-3 w-56 rounded-sm border border-bg-300"
            style={{ background: `linear-gradient(to right, ${OCCUPANCY_GRADIENT})` }}
          />
          <span>100%</span>
        </div>
      </div>

      {/* Modal de desglose por sesión, para verificar el cálculo del promedio */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
              <div>
                <h3 className="text-text-100 font-semibold">{detailModal.slot.name}</h3>
                <p className="text-xs text-text-200 mt-0.5">
                  {dayLabelFromNum(detailModal.dayNum)} · {formatHour(detailModal.slot.anchorMinutes)}
                </p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {detailModal.slot.sessions
                .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                .map((sess, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-bg-300/60 pb-2 last:border-b-0">
                    <span className="text-text-100">{dayLabelFromNum(detailModal.dayNum)} {formatSessionDate(sess.madridTime)}</span>
                    <span className="text-text-200">{sess.booked}/{sess.capacity}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-bg-300">
                <span className="text-text-100">Total</span>
                <span className="text-text-100">
                  {detailModal.slot.sumBooked}/{detailModal.slot.sumCapacity} ({detailModal.slot.pct}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}