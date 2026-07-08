import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

const toMadridDate = (iso) => {
  const d = new Date(iso)
  return new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).toDateString()
}

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const membershipLabel = (type) => {
  if (type === 'time_classes') return 'Suscripción recurrente'
  if (type === 'time') return 'Suscripción recurrente'
  if (type === 'num_classes') return 'Pack de clases'
  if (type === 'payg') return 'Pago por clase'
  return type || '—'
}

export default function Laserr({ branchId }) {
  const [dateFrom, setDateFrom] = useState(() => {
    return sessionStorage.getItem(`laserr_dateFrom_${branchId}`) || firstOfMonth
  })
  const [dateTo, setDateTo] = useState(() => {
    return sessionStorage.getItem(`laserr_dateTo_${branchId}`) || todayStr
  })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(() => {
    const saved = sessionStorage.getItem(`laserr_modal_${branchId}`)
    return saved ? JSON.parse(saved) : null
  })
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

  useEffect(() => {
    sessionStorage.setItem(`laserr_dateFrom_${branchId}`, dateFrom)
  }, [dateFrom, branchId])

  useEffect(() => {
    sessionStorage.setItem(`laserr_dateTo_${branchId}`, dateTo)
  }, [dateTo, branchId])

  useEffect(() => {
    if (modal) {
      sessionStorage.setItem(`laserr_modal_${branchId}`, JSON.stringify(modal))
    } else {
      sessionStorage.removeItem(`laserr_modal_${branchId}`)
    }
  }, [modal, branchId])

  async function fetchData() {
    setLoading(true)
    setStats(null)

    const fromISO = dateFrom + 'T00:00:00+00:00'
    const toISO = dateTo + 'T23:59:59+00:00'

    const { data: leads } = await supabase
      .from('members')
      .select('glofox_member_id, name, email, created_at')
      .eq('branch_id', branchId)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)

    const { data: activeClasses } = await supabase
      .from('classes')
      .select('event_id')
      .eq('branch_id', branchId)
      .gte('scheduled_at', fromISO)
      .lte('scheduled_at', toISO)
      .ilike('name', '%introducci%')

    const activeEventIds = [...new Set((activeClasses || []).map(c => c.event_id).filter(Boolean))]

    const { data: allBookings } = await supabase
      .from('bookings')
      .select('glofox_booking_id, user_id, attended, time_start, event_id, status')
      .eq('branch_id', branchId)
      .gte('time_start', fromISO)
      .lte('time_start', toISO)
      .in('event_id', activeEventIds.length > 0 ? activeEventIds : ['none'])

    if (!leads || !allBookings) {
      setLoading(false)
      return
    }

    const leadIds = leads.map(l => l.glofox_member_id)
    const leadsMap = {}
    leads.forEach(l => { leadsMap[l.glofox_member_id] = l })

    const apuntadosIds = [...new Set(allBookings.map(b => b.user_id))]

    const canceladosBookings = allBookings.filter(b => b.status === 'CANCELED')
    const canceladosIds = [...new Set(canceladosBookings.map(b => b.user_id))]

    const asistidosBookings = allBookings.filter(b => b.status !== 'CANCELED' && b.attended === true)
    const asistidosIds = [...new Set(asistidosBookings.map(b => b.user_id))]

    const noAsistieronIds = apuntadosIds.filter(
      id => !canceladosIds.includes(id) && !asistidosIds.includes(id)
    )

    const allUserIds = [...new Set([...apuntadosIds, ...canceladosIds, ...asistidosIds, ...noAsistieronIds])]
    const peopleMap = {}
    if (allUserIds.length > 0) {
      const { data: allPeople } = await supabase
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

    const { data: nuevasMembresias } = await supabase
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
        const { data: extraPeople } = await supabase
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
      const { data: membresiasAsistidos } = await supabase
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

    setStats({
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
    })

    setLoading(false)
  }

  function pct(num, den) {
    if (!den) return '—'
    return Math.round((num / den) * 100) + '%'
  }

  const steps = stats ? [
    { label: 'Leads totales', value: stats.leads, pct: null, color: 'bg-accent-100', desc: 'Nuevos leads en el período', list: stats.leadsList },
    { label: 'Apuntados a intro', value: stats.apuntados, pct: pct(stats.apuntados, stats.leads), color: 'bg-accent-200', desc: 'Reservaron clase de introducción', list: stats.apuntadosList },
    { label: 'Cancelados', value: stats.cancelados, pct: pct(stats.cancelados, stats.apuntados), color: 'bg-red-400', desc: 'Cancelaron la reserva de intro', list: stats.canceladosList },
    { label: 'Asistieron', value: stats.asistidos, pct: pct(stats.asistidos, stats.apuntados), color: 'bg-primary-200', desc: 'Asistieron a la clase', list: stats.asistidosList },
    { label: 'No asistieron', value: stats.noAsistieron, pct: pct(stats.noAsistieron, stats.apuntados), color: 'bg-orange-400', desc: 'No asistieron ni cancelaron', list: stats.noAsistieronList },
    { label: 'Compraron en el momento', value: stats.compraronEnMomento, pct: pct(stats.compraronEnMomento, stats.asistidos), color: 'bg-green-500', desc: 'Membresía el mismo día de la clase', list: stats.compraronEnMomentoList },
    { label: 'Compraron después', value: stats.compraronDespues, pct: pct(stats.compraronDespues, stats.asistidos), color: 'bg-emerald-400', desc: 'Membresía en días posteriores', list: stats.compraronDespuesList },
    { label: 'No compraron', value: stats.noCompraron, pct: pct(stats.noCompraron, stats.asistidos), color: 'bg-red-500', desc: 'Asistieron pero no compraron membresía', list: stats.noCompraronList },
    { label: 'Nuevos miembros sin intro', value: stats.sinIntro, pct: pct(stats.sinIntro, stats.leads), color: 'bg-amber-500', desc: 'Compraron directamente sin pasar por clase intro', list: stats.sinIntroList },
  ] : []

  const maxVal = stats ? Math.max(stats.leads, 1) : 1

  async function exportarPDF() {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email || !stats) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(18)
    doc.setTextColor(30, 30, 30)
    doc.text('Laserr - Funnel de conversión', pageWidth / 2, 30, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Período: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, pageWidth / 2, 38, { align: 'center' })

    autoTable(doc, {
      startY: 48,
      head: [['Paso', 'Descripción', 'Valor', '% paso anterior']],
      body: steps.map(step => [step.label, step.desc, String(step.value), step.pct || '—']),
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

    const pdfBase64 = doc.output('datauristring').split(',')[1]

    setExporting(true)
    try {
      await fetch('https://n8n.clubpilatesia.es/webhook/export-laserr-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pdfBase64, dateFrom, dateTo, branchId })
      })
      setExportMsg('Informe enviado')
    } catch (err) {
      setExportMsg('Error al enviar')
    }
    setExporting(false)
    setTimeout(() => setExportMsg(null), 3000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-100">Laserr</h2>
          <p className="text-text-200 text-sm mt-0.5">Funnel de conversión de leads</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-200">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-white border border-primary-200 text-text-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-100"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {loading ? 'Cargando...' : 'Aplicar'}
        </button>
        <button
          onClick={exportarPDF}
          disabled={!stats || exporting}
          className="bg-accent-200 hover:bg-accent-100 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {exporting ? 'Enviando...' : 'Exportar PDF'}
        </button>
        {exportMsg && (
          <span className="text-sm text-green-600 font-medium">{exportMsg}</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent-100 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={i}
              onClick={() => step.list?.length > 0 && setModal({ title: step.label, people: step.list })}
              className={`bg-bg-200 border border-bg-300 rounded-xl p-4 ${step.list?.length > 0 ? 'cursor-pointer hover:border-primary-200 transition-colors' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-text-100">{step.label}</span>
                  <span className="text-xs text-primary-300 ml-2">{step.desc}</span>
                </div>
                <div className="flex items-center gap-3">
                  {step.pct && (
                    <span className="text-xs text-text-200 bg-primary-100 px-2 py-0.5 rounded-full">
                      {step.pct} del paso anterior
                    </span>
                  )}
                  <span className="text-2xl font-bold text-text-100">{step.value}</span>
                </div>
              </div>
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${step.color} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.round((step.value / maxVal) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="mt-6 bg-bg-200 border border-accent-200/30 rounded-xl p-4">
            <p className="text-xs text-text-200 uppercase tracking-wider mb-3">Conversión total</p>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {pct(stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro, stats.leads)}
                </p>
                <p className="text-xs text-text-200 mt-1">leads → membresía</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {pct(stats.compraronEnMomento + stats.compraronDespues, stats.asistidos)}
                </p>
                <p className="text-xs text-text-200 mt-1">asistidos → membresía</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-text-100">
                  {stats.compraronEnMomento + stats.compraronDespues + stats.sinIntro}
                </p>
                <p className="text-xs text-text-200 mt-1">total conversiones</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !stats && (
        <div className="text-center py-20 text-primary-300">
          Selecciona un rango de fechas y pulsa Aplicar
        </div>
      )}

{modal && (
  <div
    className="fixed inset-0 bg-text-100/40 z-50 flex items-center justify-center px-4"
    onClick={() => setModal(null)}
  >
    <div
      className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300 flex-shrink-0">
        <h3 className="text-text-100 font-semibold">{modal.title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-200">{modal.people.length} personas</span>
          <button
            onClick={() => setModal(null)}
            className="text-text-200 hover:text-text-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="overflow-y-scroll overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-200 border-b border-bg-300 z-10">
            <tr>
              <th className="text-left text-xs text-primary-300 font-medium px-6 py-3 whitespace-nowrap">Nombre</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Email</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Alta</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Membresía</th>
              <th className="text-left text-xs text-primary-300 font-medium px-4 py-3 whitespace-nowrap">Compra</th>
            </tr>
          </thead>
          <tbody>
            {modal.people.map((p, i) => (
              <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                <td className="px-6 py-3 text-text-100 font-medium whitespace-nowrap">{p.name || '—'}</td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{p.email || '—'}</td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3 text-text-200 max-w-xs truncate" title={p.membership_type ? membershipLabel(p.membership_type) : '—'}>
                  {p.membership_type ? membershipLabel(p.membership_type) : '—'}
                </td>
                <td className="px-4 py-3 text-text-200 whitespace-nowrap">{formatDate(p.membership_start_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}
    </div>
  )
}