import autoTable from 'jspdf-autotable'

// Umbrales (% del total) a partir de los cuales una fila se resalta como alerta
export const SOCIOS_ALERT_THRESHOLDS = {
  '4 clases': 50,
  'No recurrente': 10,
  'Atrasados': 2,
}

export function isSociosAlert(label, pct) {
  const threshold = SOCIOS_ALERT_THRESHOLDS[label]
  return threshold !== undefined && pct > threshold
}

function clasificarTipoSuscripcion(membership_type, plan_name) {
  if (membership_type === 'payg') return 'Pago por clase'
  if (membership_type === 'num_classes') return 'Clases privadas'
  if (membership_type === 'time') return 'Ilimitado'
  if (membership_type === 'time_classes') {
    if (plan_name?.toLowerCase().includes('4 clases')) return '4 clases'
    if (plan_name?.toLowerCase().includes('8 clases')) return '8 clases'
    return 'Otro'
  }
  return 'Sin clasificar'
}

export async function fetchSociosStats(supabaseClient, branchId) {
  let allMembers = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error: queryError } = await supabaseClient
      .from('members')
      .select('membership_type, membership_status, plan_name, plan_code, auto_renewal')
      .eq('branch_id', branchId)
      .eq('status', 'MEMBER')
      .in('membership_type', ['time_classes', 'time'])
      .range(from, from + pageSize - 1)

    if (queryError) return { error: queryError.message }
    if (!data || data.length === 0) break
    allMembers = [...allMembers, ...data]
    if (data.length < pageSize) break
    from += pageSize
  }

  const suscripcionMap = {}
  allMembers.forEach(m => {
    const tipo = clasificarTipoSuscripcion(m.membership_type, m.plan_name)
    suscripcionMap[tipo] = (suscripcionMap[tipo] || 0) + 1
  })

  const CLASES_POR_TIPO = {
    '4 clases': 1,
    '8 clases': 2,
    'Ilimitado': 3,
    'Pago por clase': null,
    'Clases privadas': null,
    'Otro': null,
    'Sin clasificar': null,
  }

  const tipoSuscripcion = Object.entries(suscripcionMap)
    .map(([label, cantidad]) => ({
      label,
      cantidad,
      extra: CLASES_POR_TIPO[label] ?? '—',
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const estadoMap = {}
  allMembers.forEach(m => {
    const estado = m.membership_status ?? 'Sin estado'
    estadoMap[estado] = (estadoMap[estado] || 0) + 1
  })

  let sinSuscripcion = 0
  let fromSin = 0
  while (true) {
    const { data: sinData } = await supabaseClient
      .from('members')
      .select('glofox_member_id')
      .eq('branch_id', branchId)
      .eq('status', 'MEMBER')
      .in('membership_type', ['payg', 'num_classes'])
      .range(fromSin, fromSin + 999)
    if (!sinData || sinData.length === 0) break
    sinSuscripcion += sinData.length
    if (sinData.length < 1000) break
    fromSin += 1000
  }

  const ESTADO_LABELS = {
    'ACTIVE': 'Activos',
    'PAUSED': 'Pausados',
    'FUTURE': 'Futuros',
    'LOCKED': 'Atrasados',
    'Sin estado': 'Sin estado',
  }

  const ESTADO_TOOLTIPS = {
    'ACTIVE': 'Miembros con una suscripción de 4 clases, 8 clases o ilimitadas',
    'PAUSED': 'Miembros con la suscripción pausada',
  }

  const ESTADO_ORDEN = ['ACTIVE', 'PAUSED', 'FUTURE', 'LOCKED', 'Sin estado']
  const estadoSocios = Object.entries(estadoMap)
    .map(([key, cantidad]) => ({
      label: ESTADO_LABELS[key] || key,
      cantidad,
      tooltip: ESTADO_TOOLTIPS[key] || null,
    }))
    .sort((a, b) => {
      const ia = ESTADO_ORDEN.indexOf(Object.keys(ESTADO_LABELS).find(k => ESTADO_LABELS[k] === a.label) || a.label)
      const ib = ESTADO_ORDEN.indexOf(Object.keys(ESTADO_LABELS).find(k => ESTADO_LABELS[k] === b.label) || b.label)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

    const planCodes = [...new Set(allMembers.map(m => m.plan_code).filter(Boolean))]
    let catalogMap = {}
    
    if (planCodes.length > 0) {
      const { data: catalog } = await supabaseClient
        .from('membership_plan_catalog')
        .select('plan_code, is_recurring')
        .eq('branch_id', branchId)
        .in('plan_code', planCodes)
    
      if (catalog) {
        catalog.forEach(c => { catalogMap[c.plan_code] = c.is_recurring })
      }
    }
    
    let recurrente = 0
    let noRecurrente = 0
    let sinDato = 0
    allMembers.forEach(m => {
      if (!m.plan_code || !(m.plan_code in catalogMap)) {
        sinDato++
      } else if (catalogMap[m.plan_code]) {
        recurrente++
      } else {
        noRecurrente++
      }
    })

  const tipoSocio = [
    { label: 'Recurrente', cantidad: recurrente },
    { label: 'No recurrente', cantidad: noRecurrente },
    ...(sinDato > 0 ? [{ label: 'Sin dato', cantidad: sinDato }] : []),
  ]

  return { tipoSuscripcion, estadoSocios, tipoSocio, sinSuscripcion }
}

export function renderSociosPdfSection(doc, { tipoSuscripcion, estadoSocios, tipoSocio, sinSuscripcion, branchName }, startY = 30) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const todayStr = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })

  doc.setFontSize(18)
  doc.setTextColor(30, 30, 30)
  doc.text('Estadisticas de Socios', pageWidth / 2, startY, { align: 'center' })

  let subtitleY = startY + 8
  if (branchName) {
    doc.setFontSize(12)
    doc.setTextColor(60, 60, 60)
    doc.text(branchName, pageWidth / 2, subtitleY, { align: 'center' })
    subtitleY += 7
  }

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Estado al ${todayStr}`, pageWidth / 2, subtitleY, { align: 'center' })

  const totalCon = (filas) => filas.reduce((sum, f) => sum + f.cantidad, 0)
  const pctRow = (filas, total) => filas.map(f => [
    f.label,
    String(f.cantidad),
    total > 0 ? ((f.cantidad / total) * 100).toFixed(2) + '%' : '—',
    ...(f.extra !== undefined ? [String(f.extra)] : [])
  ])

  const alertCell = (filas, total) => (data) => {
    if (data.column.index !== 2) return
    const row = filas[data.row.index]
    if (!row) return
    const pct = total > 0 ? (row.cantidad / total) * 100 : 0
    if (isSociosAlert(row.label, pct)) {
      data.cell.styles.textColor = [220, 38, 38]
      data.cell.styles.fontStyle = 'bold'
    }
  }

  const totalSuscripcion = totalCon(tipoSuscripcion)
  autoTable(doc, {
    startY: subtitleY + 10,
    head: [['Tipo de Suscripción', 'Cantidad', '%', 'Clases est./sem']],
    body: [
      ...pctRow(tipoSuscripcion, totalSuscripcion),
      ['Total general', String(totalSuscripcion), '100.00%', '—']
    ],
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [225, 232, 240] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    didParseCell: alertCell(tipoSuscripcion, totalSuscripcion)
  })

  const totalEstado = totalCon(estadoSocios)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Estado de Socios', 'Cantidad', '%']],
    body: [
      ...pctRow(estadoSocios, totalEstado),
      ['Total general', String(totalEstado), '100.00%']
    ],
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [225, 232, 240] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    didParseCell: alertCell(estadoSocios, totalEstado)
  })

  if (sinSuscripcion > 0) {
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`Socios sin suscripción activa (pago por clase / clases privadas): ${sinSuscripcion}`, 14, doc.lastAutoTable.finalY + 10)
  }

  const totalSocio = totalCon(tipoSocio)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + (sinSuscripcion > 0 ? 16 : 10),
    head: [['Tipo de Socio', 'Cantidad', '%']],
    body: [
      ...pctRow(tipoSocio, totalSocio),
      ['Total general', String(totalSocio), '100.00%']
    ],
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [225, 232, 240] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    didParseCell: alertCell(tipoSocio, totalSocio)
  })

  return doc.lastAutoTable.finalY
}
