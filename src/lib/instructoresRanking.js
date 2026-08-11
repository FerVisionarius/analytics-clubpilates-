// Ranking de instructores por ocupación de sus clases y asistencia, en un rango.
export async function fetchInstructorOccupancy(supabaseClient, branchId, dateFrom, dateTo) {
  const fromISO = dateFrom + 'T00:00:00+00:00'
  const toISO = dateTo + 'T23:59:59+00:00'
  const pageSize = 1000

  // Clases del período (con instructor, reservas y capacidad).
  let allClasses = []
  let from = 0
  while (true) {
    const { data } = await supabaseClient
      .from('classes')
      .select('event_id, trainer_id, booked_count, capacity')
      .eq('branch_id', branchId)
      .gte('scheduled_at', fromISO)
      .lte('scheduled_at', toISO)
      .gt('capacity', 0)
      .range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    allClasses = allClasses.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  let staffQuery = supabaseClient.from('staff').select('glofox_user_id, name')
  if (branchId) staffQuery = staffQuery.eq('branch_id', branchId)
  const { data: staff } = await staffQuery
  const staffMap = {}
  ;(staff || []).forEach(s => { staffMap[s.glofox_user_id] = s.name })

  // Reservas del período (para asistencia). class_bookings.time_start está en
  // hora Madrid con sufijo +00; el rango de día encaja igualmente.
  const eventTrainer = {}
  allClasses.forEach(c => { if (c.event_id) eventTrainer[c.event_id] = c.trainer_id })

  let allBookings = []
  from = 0
  while (true) {
    const { data } = await supabaseClient
      .from('class_bookings')
      .select('event_id, attended, status')
      .eq('branch_id', branchId)
      .gte('time_start', fromISO)
      .lte('time_start', toISO)
      .range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    allBookings = allBookings.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  const map = {}
  allClasses.forEach(c => {
    const t = c.trainer_id
    if (!t) return
    if (!map[t]) map[t] = { clases: 0, reservas: 0, plazas: 0, reservasBk: 0, asistidos: 0 }
    map[t].clases += 1
    map[t].reservas += c.booked_count || 0
    map[t].plazas += c.capacity || 0
  })
  allBookings.forEach(b => {
    const t = eventTrainer[b.event_id]
    if (!t || !map[t]) return
    if (b.status !== 'CANCELED') {
      map[t].reservasBk += 1
      if (b.attended === true) map[t].asistidos += 1
    }
  })

  return Object.entries(map)
    .filter(([t]) => staffMap[t])
    .map(([t, s]) => ({
      trainerId: t,
      name: staffMap[t],
      clases: s.clases,
      reservas: s.reservas,
      plazas: s.plazas,
      ocupacion: s.plazas > 0 ? s.reservas / s.plazas : 0,
      asistidos: s.asistidos,
      asistencia: s.reservasBk > 0 ? s.asistidos / s.reservasBk : 0,
    }))
    .sort((a, b) => b.ocupacion - a.ocupacion)
}
