import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_NUM = [1, 2, 3, 4, 5, 6, 0]

const SLOT_MINUTES = 15
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

/** Misma escala que HeatmapOcupacion: 0–2% rojo → 50% amarillo → 100% verde */
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

/**
 * Agrupa clases por (día de semana, nombre, slot horario redondeado a bloques
 * de 15 min). Como el event_id cambia cada semana en Glofox y la hora puede
 * variar ligeramente entre repeticiones, se usa un slot aproximado: la clase
 * se asigna al slot más cercano ya existente en el grupo (día+nombre) si cae
 * dentro de la tolerancia (±15 min); si no, abre un slot nuevo.
 */
function groupClasses(classes) {
  // groups[dayNum][name] = array de { slotMinutes, sumBooked, sumCapacity, count }
  const groups = {}
  DIAS_NUM.forEach(d => { groups[d] = {} })

  classes.forEach(c => {
    const madridTime = getMadridTime(c.scheduled_at)
    const dayNum = madridTime.getUTCDay()
    const h = madridTime.getUTCHours()
    const m = madridTime.getUTCMinutes()
    const minutesOfDay = h * 60 + m
    const name = c.name || 'Sin nombre'

    if (!groups[dayNum][name]) groups[dayNum][name] = []
    const slots = groups[dayNum][name]

    // Busca un slot existente dentro de la tolerancia
    let slot = slots.find(s => Math.abs(s.anchorMinutes - minutesOfDay) <= TOLERANCE_MIN)

    if (!slot) {
      // Redondea al bloque de 15 min más cercano para que el slot quede "limpio"
      const roundedMinutes = Math.round(minutesOfDay / SLOT_MINUTES) * SLOT_MINUTES
      slot = {
        anchorMinutes: minutesOfDay,
        roundedMinutes,
        name,
        dayNum,
        sumBooked: 0,
        sumCapacity: 0,
        count: 0,
      }
      slots.push(slot)
    }

    slot.sumBooked += c.booked_count || 0
    slot.sumCapacity += c.capacity || 0
    slot.count += 1
  })

  return groups
}

export default function OcupacionPromedio({ branchId }) {
  const [range, setRange] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groupedSlots, setGroupedSlots] = useState({})

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
      let query = supabase
        .from('classes')
        .select('scheduled_at, booked_count, capacity, name, branch_id')
        .eq('branch_id', branchId)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .gt('capacity', 0)
        .range(from, from + pageSize - 1)

      const { data, error: queryError } = await query
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

  // Construye la lista final de slots por día, ordenada por hora, con pct calculado
  const slotsByDay = {}
  DIAS_NUM.forEach(dayNum => {
    const slotsForDay = Object.values(groupedSlots[dayNum] || {}).flat()
    slotsByDay[dayNum] = slotsForDay
      .map(s => ({
        ...s,
        pct: s.sumCapacity > 0 ? Math.round((s.sumBooked / s.sumCapacity) * 100) : 0,
      }))
      .sort((a, b) => a.roundedMinutes - b.roundedMinutes)
  })

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
          Compara la ocupación de clases recurrentes (mismo día, hora aproximada y nombre) entre semanas.
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

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-text-200 text-sm">Cargando datos...</div>
      ) : (
        <div className="rounded-xl border border-bg-300 bg-white overflow-x-auto">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DIAS.map((d, i) => (
              <div key={d} className="text-center py-2 px-1 border-b border-r border-bg-300 last:border-r-0 bg-bg-200/90">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-200">{d}</p>
              </div>
            ))}

            {DIAS_NUM.map(dayNum => {
              const slots = slotsByDay[dayNum] || []
              return (
                <div key={dayNum} className="border-r border-bg-300 last:border-r-0 p-2 space-y-2">
                  {slots.length === 0 && (
                    <p className="text-xs text-primary-300 text-center py-4">Sin clases</p>
                  )}
                  {slots.map((s, i) => {
                    const colors = getOccupancyColor(s.pct)
                    return (
                      <div
                        key={`${s.name}_${s.roundedMinutes}_${i}`}
                        className="rounded-lg px-2 py-1.5"
                        style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}` }}
                      >
                        <p className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                          {s.name}
                        </p>
                        <p className="text-xs opacity-80" style={{ color: colors.text }}>
                          {formatHour(s.roundedMinutes)}
                        </p>
                        <p className="text-xs font-bold" style={{ color: colors.text }}>
                          {s.pct}% ({s.sumBooked}/{s.sumCapacity})
                        </p>
                      </div>
                    )
                  })}
                </div>
              )
            })}
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
    </div>
  )
}