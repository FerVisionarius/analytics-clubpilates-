import autoTable from 'jspdf-autotable'
import { fetchEventRatings } from './ratings.js'

export const toMadridDate = (iso) => {
  const d = new Date(iso)
  return new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).toDateString()
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function pct(num, den) {
  if (!den) return '—'
  return Math.round((num / den) * 100) + '%'
}

// Distintos centros nombran la clase de intro de formas diferentes:
// "Clase de introducción", "Clase Introductoria", "Clase de Prueba",
// "FREE INTRO CLASS"... Todas cuentan igual para el funnel LASERR.
export const INTRO_CLASS_FILTER = 'name.ilike.%intro%,name.ilike.%prueba%'

const WEEKDAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const toMadridWeekday = (iso) => {
  const label = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long' }).format(new Date(iso))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export async function fetchLaserrClassBreakdown(supabaseClient, branchId, dateFrom, dateTo) {
  const fromISO = dateFrom + 'T00:00:00+00:00'
  const toISO = dateTo + 'T23:59:59+00:00'

  const { data: classes } = await supabaseClient
    .from('classes')
    .select('event_id, name, trainer_id, scheduled_at')
    .eq('branch_id', branchId)
    .gte('scheduled_at', fromISO)
    .lte('scheduled_at', toISO)
    .or(INTRO_CLASS_FILTER)

  if (!classes || classes.length === 0) return { porDia: [], porInstructor: [] }

  const eventIds = [...new Set(classes.map(c => c.event_id).filter(Boolean))]

  const { data: bookings } = await supabaseClient
    .from('bookings')
    .select('user_id, attended, time_start, event_id, status, is_late_cancellation')
    .eq('branch_id', branchId)
    .gte('time_start', fromISO)
    .lte('time_start', toISO)
    .in('event_id', eventIds.length > 0 ? eventIds : ['none'])

  const { data: staff } = await supabaseClient
    .from('staff')
    .select('glofox_user_id, name')
    .eq('branch_id', branchId)

  const staffMap = {}
  ;(staff || []).forEach(s => { staffMap[s.glofox_user_id] = s.name })

  const bookingsByEvent = {}
  ;(bookings || []).forEach(b => {
    if (!bookingsByEvent[b.event_id]) bookingsByEvent[b.event_id] = []
    bookingsByEvent[b.event_id].push(b)
  })

  const allAsistidoIds = [...new Set(
    (bookings || []).filter(b => b.status !== 'CANCELED' && b.attended === true).map(b => b.user_id)
  )]

  const primeraMembresiaMap = {}
  if (allAsistidoIds.length > 0) {
    const { data: membresias } = await supabaseClient
      .from('new_memberships_log')
      .select('user_id, contract_start')
      .in('user_id', allAsistidoIds)
      .order('contract_start', { ascending: true })

    ;(membresias || []).forEach(m => {
      if (!primeraMembresiaMap[m.user_id]) primeraMembresiaMap[m.user_id] = m
    })
  }

  const ratingsByEvent = {}
  const allRatings = await fetchEventRatings(supabaseClient, branchId)
  allRatings.forEach(r => { ratingsByEvent[r.eventId] = r })

  const classDetails = classes.map(c => {
    const evBookings = bookingsByEvent[c.event_id] || []
    const asistidosEv = evBookings.filter(b => b.status !== 'CANCELED' && b.attended === true)
    const canceladosEv = evBookings.filter(b => b.status === 'CANCELED')
    const canceladosTardia = canceladosEv.filter(b => b.is_late_cancellation === true).length
    const canceladosNormal = canceladosEv.length - canceladosTardia
    const rating = ratingsByEvent[c.event_id]

    return {
      eventId: c.event_id,
      name: c.name,
      scheduledAt: c.scheduled_at,
      dia: toMadridWeekday(c.scheduled_at),
      instructor: staffMap[c.trainer_id] || 'Sin asignar',
      apuntados: evBookings.length,
      asistidos: asistidosEv.length,
      cancelados: canceladosEv.length,
      canceladosNormal,
      canceladosTardia,
      asistidoIds: asistidosEv.map(b => b.user_id),
      ratingAvg: rating?.avg ?? null,
      ratingCount: rating?.count ?? 0,
    }
  }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const sum = (list, field) => list.reduce((s, c) => s + c[field], 0)

  const groupBy = (keyFn) => {
    const map = {}
    classDetails.forEach(c => {
      const key = keyFn(c)
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return map
  }

  const buildGroupStats = (list) => {
    const apuntados = sum(list, 'apuntados')
    const asistidos = sum(list, 'asistidos')
    const cancelados = sum(list, 'cancelados')
    const canceladosNormal = sum(list, 'canceladosNormal')
    const canceladosTardia = sum(list, 'canceladosTardia')
    const asistidoIds = new Set(list.flatMap(c => c.asistidoIds))
    const comprados = [...asistidoIds].filter(uid => primeraMembresiaMap[uid]).length
    return {
      clases: list.length,
      apuntados,
      asistidos,
      cancelados,
      canceladosNormal,
      canceladosTardia,
      tasaCancelacion: pct(cancelados, apuntados),
      comprados,
      retencion: pct(comprados, asistidos),
      classList: list,
    }
  }

  const diaMap = groupBy(c => c.dia)
  const porDia = WEEKDAY_ORDER
    .filter(dia => diaMap[dia])
    .map(dia => ({
      dia,
      instructores: [...new Set(diaMap[dia].map(c => c.instructor))].join(', '),
      ...buildGroupStats(diaMap[dia]),
    }))

  const instructorMap = groupBy(c => c.instructor)
  const porInstructor = Object.entries(instructorMap)
    .map(([instructor, list]) => ({
      instructor,
      ...buildGroupStats(list),
    }))
    .sort((a, b) => b.asistidos - a.asistidos)

  return { porDia, porInstructor }
}

export async function fetchLaserrStats(supabaseClient, branchId, dateFrom, dateTo) {
  const fromISO = dateFrom + 'T00:00:00+00:00'
  const toISO = dateTo + 'T23:59:59+00:00'

  const { data: leads } = await supabaseClient
    .from('members')
    .select('glofox_member_id, name, email, created_at')
    .eq('branch_id', branchId)
    .gte('created_at', fromISO)
    .lte('created_at', toISO)

  const { data: activeClasses } = await supabaseClient
    .from('classes')
    .select('event_id')
    .eq('branch_id', branchId)
    .gte('scheduled_at', fromISO)
    .lte('scheduled_at', toISO)
    .or(INTRO_CLASS_FILTER)

  const activeEventIds = [...new Set((activeClasses || []).map(c => c.event_id).filter(Boolean))]

  const { data: allBookings } = await supabaseClient
    .from('bookings')
    .select('glofox_booking_id, user_id, attended, time_start, event_id, status')
    .eq('branch_id', branchId)
    .gte('time_start', fromISO)
    .lte('time_start', toISO)
    .in('event_id', activeEventIds.length > 0 ? activeEventIds : ['none'])

  if (!leads || !allBookings) return null

  const leadsMap = {}
  leads.forEach(l => { leadsMap[l.glofox_member_id] = l })

  const apuntadosIds = [...new Set(allBookings.map(b => b.user_id))]

  const asistidosSet = new Set(
    allBookings.filter(b => b.status !== 'CANCELED' && b.attended === true).map(b => b.user_id)
  )
  const canceladosSet = new Set(
    allBookings.filter(b => b.status === 'CANCELED').map(b => b.user_id)
  )

  const asistidosIds = apuntadosIds.filter(id => asistidosSet.has(id))
  const canceladosIds = apuntadosIds.filter(id => !asistidosSet.has(id) && canceladosSet.has(id))
  const noAsistieronIds = apuntadosIds.filter(id => !asistidosSet.has(id) && !canceladosSet.has(id))

  const asistidosBookings = allBookings.filter(
    b => b.status !== 'CANCELED' && b.attended === true && asistidosIds.includes(b.user_id)
  )

  const allUserIds = [...new Set([...apuntadosIds, ...canceladosIds, ...asistidosIds, ...noAsistieronIds])]
  const peopleMap = {}
  if (allUserIds.length > 0) {
    const { data: allPeople } = await supabaseClient
      .from('members')
      .select('glofox_member_id, name, email, created_at, status, membership_type, membership_start_date')
      .eq('branch_id', branchId)
      .in('glofox_member_id', allUserIds)

    if (allPeople) {
      allPeople.forEach(p => { peopleMap[p.glofox_member_id] = p })
    }
  }

  const buildPerson = (id) => {
    const p = peopleMap[id] || leadsMap[id]
    return {
      name: p?.name || '—',
      email: p?.email || '—',
      created_at: p?.created_at,
      membership_type: p?.membership_type,
      membership_start_date: p?.membership_start_date,
    }
  }

  let sinIntroList = []

  const { data: nuevasMembresias } = await supabaseClient
    .from('new_memberships_log')
    .select('user_id, contract_start, event_created, member_state, plan_name')
    .eq('branch_id', branchId)
    .gte('contract_start', fromISO)
    .lte('contract_start', toISO)

  if (nuevasMembresias) {
    const sinIntroRows = nuevasMembresias.filter(
      m => !asistidosIds.includes(m.user_id) && m.plan_name !== null
    )

    const sinIntroUserIds = sinIntroRows.map(m => m.user_id)
    const missingIds = sinIntroUserIds.filter(id => !peopleMap[id])

    if (missingIds.length > 0) {
      const { data: extraPeople } = await supabaseClient
        .from('members')
        .select('glofox_member_id, name, email')
        .eq('branch_id', branchId)
        .in('glofox_member_id', missingIds)

      if (extraPeople) extraPeople.forEach(p => { peopleMap[p.glofox_member_id] = p })
    }

    sinIntroList = sinIntroRows.map(m => {
      const p = peopleMap[m.user_id]
      return {
        name: p?.name || '—',
        email: p?.email || '—',
        created_at: m.contract_start,
        membership_type: m.plan_name,
        membership_start_date: m.event_created,
      }
    })
  }

  const primeraMembresiaMap = {}
  if (asistidosIds.length > 0) {
    const { data: membresiasAsistidos } = await supabaseClient
      .from('new_memberships_log')
      .select('user_id, contract_start')
      .in('user_id', asistidosIds)
      .order('contract_start', { ascending: true })

    if (membresiasAsistidos) {
      membresiasAsistidos.forEach(m => {
        if (!primeraMembresiaMap[m.user_id]) primeraMembresiaMap[m.user_id] = m
      })
    }
  }

  let compraronEnMomentoList = []
  let compraronDespuesList = []
  let noCompraronList = []

  asistidosIds.forEach(userId => {
    const membresia = primeraMembresiaMap[userId]
    const booking = asistidosBookings.find(b => b.user_id === userId)
    const person = buildPerson(userId)

    if (!membresia) {
      noCompraronList.push(person)
      return
    }

    const claseDate = booking ? toMadridDate(booking.time_start) : null
    const compraDate = membresia.contract_start ? toMadridDate(membresia.contract_start) : null

    if (claseDate && compraDate && claseDate === compraDate) {
      compraronEnMomentoList.push(person)
    } else {
      compraronDespuesList.push(person)
    }
  })

  return {
    leads: leads.length,
    leadsList: leads,
    apuntados: apuntadosIds.length,
    apuntadosList: apuntadosIds.map(buildPerson),
    cancelados: canceladosIds.length,
    canceladosList: canceladosIds.map(buildPerson),
    asistidos: asistidosIds.length,
    asistidosList: asistidosIds.map(buildPerson),
    noAsistieron: noAsistieronIds.length,
    noAsistieronList: noAsistieronIds.map(buildPerson),
    compraronEnMomento: compraronEnMomentoList.length,
    compraronEnMomentoList,
    compraronDespues: compraronDespuesList.length,
    compraronDespuesList,
    noCompraron: noCompraronList.length,
    noCompraronList,
    sinIntro: sinIntroList.length,
    sinIntroList,
  }
}

export function buildLaserrSteps(stats) {
  if (!stats) return []
  return [
    { label: 'Leads totales', value: stats.leads, pct: null, desc: 'Nuevos leads en el período', list: stats.leadsList },
    { label: 'Apuntados a intro', value: stats.apuntados, pct: pct(stats.apuntados, stats.leads), pctSuffix: 'del paso anterior', desc: 'Reservaron clase de introducción', list: stats.apuntadosList },
    { label: 'Asistieron', value: stats.asistidos, pct: pct(stats.asistidos, stats.apuntados), pctSuffix: 'del paso anterior', desc: 'Asistieron a la clase', list: stats.asistidosList },
    { label: 'Compraron en el momento', value: stats.compraronEnMomento, pct: null, desc: 'Membresía el mismo día de la clase', list: stats.compraronEnMomentoList, indent: true },
    { label: 'Compraron después', value: stats.compraronDespues, pct: null, desc: 'Membresía en días posteriores', list: stats.compraronDespuesList, indent: true },
    { label: 'No compraron', value: stats.noCompraron, pct: null, desc: 'Asistieron pero no compraron membresía', list: stats.noCompraronList, indent: true },
    { label: 'No asistieron', value: stats.noAsistieron, pct: pct(stats.noAsistieron, stats.apuntados), pctSuffix: 'de apuntados a intro', desc: 'No asistieron ni cancelaron', list: stats.noAsistieronList },
    { label: 'Cancelados', value: stats.cancelados, pct: pct(stats.cancelados, stats.apuntados), pctSuffix: 'de apuntados a intro', desc: 'Cancelaron la reserva de intro', list: stats.canceladosList },
    { label: 'Nuevos miembros sin intro', value: stats.sinIntro, pct: pct(stats.sinIntro, stats.apuntados), pctSuffix: 'de apuntados a intro', desc: 'Compraron directamente sin pasar por clase intro', list: stats.sinIntroList },
  ]
}

export function renderLaserrPdfSection(doc, { stats, dateFrom, dateTo, branchName, startY = 30 }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const steps = buildLaserrSteps(stats)

  doc.setFontSize(18)
  doc.setTextColor(30, 30, 30)
  doc.text('LASERR - Funnel de conversión', pageWidth / 2, startY, { align: 'center' })

  let subtitleY = startY + 8
  if (branchName) {
    doc.setFontSize(12)
    doc.setTextColor(60, 60, 60)
    doc.text(branchName, pageWidth / 2, subtitleY, { align: 'center' })
    subtitleY += 7
  }

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Período: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, pageWidth / 2, subtitleY, { align: 'center' })

  autoTable(doc, {
    startY: subtitleY + 10,
    head: [['Paso', 'Descripción', 'Valor', '% paso anterior']],
    body: steps.map(step => [step.indent ? `   ${step.label}` : step.label, step.desc, String(step.value), step.pct || '—']),
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [225, 232, 240] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'center' }
    }
  })

  const finalY = doc.lastAutoTable.finalY + 10
  const tableWidth = 182
  const startX = (pageWidth - tableWidth) / 2

  autoTable(doc, {
    startY: finalY,
    body: [
      ['Leads a membresía', pct(stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro, stats.leads)],
      ['Asistidos a membresía', pct(stats.compraronEnMomento + stats.compraronDespues, stats.asistidos)],
      ['Total conversiones', String(stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro)]
    ],
    theme: 'plain',
    tableWidth: tableWidth,
    margin: { left: startX },
    styles: { fontSize: 10, cellPadding: 4, fillColor: [230, 240, 255] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 30, 30] },
      1: { halign: 'right', fontStyle: 'bold', textColor: [30, 30, 30] }
    },
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.lineWidth = { top: 0.3 }
        data.cell.styles.lineColor = [200, 210, 230]
      }
    }
  })

  return doc.lastAutoTable.finalY
}
