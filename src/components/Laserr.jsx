import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(todayStr)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    if (branchId) fetchData()
  }, [branchId])

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

    const { data: bookings } = await supabase
      .from('bookings')
      .select('glofox_booking_id, user_id, attended, time_start, event_id, status')
      .eq('branch_id', branchId)
      .gte('time_start', fromISO)
      .lte('time_start', toISO)
      .neq('status', 'CANCELED')
      .in('event_id', activeEventIds.length > 0 ? activeEventIds : ['none'])

    const { data: canceledBookings } = await supabase
      .from('bookings')
      .select('user_id, event_id')
      .eq('branch_id', branchId)
      .gte('time_start', fromISO)
      .lte('time_start', toISO)
      .eq('status', 'CANCELED')
      .in('event_id', activeEventIds.length > 0 ? activeEventIds : ['none'])

    if (!leads || !bookings) {
      setLoading(false)
      return
    }

    const leadIds = leads.map(l => l.glofox_member_id)
    const leadsMap = {}
    leads.forEach(l => { leadsMap[l.glofox_member_id] = l })

    const asistidosBookings = bookings.filter(b => b.attended === true)
    const asistidosIds = [...new Set(asistidosBookings.map(b => b.user_id))]
    const apuntadosIds = [...new Set(bookings.map(b => b.user_id))]
    const canceladosIds = [...new Set((canceledBookings || []).map(b => b.user_id))]

    // Traer datos de TODOS los usuarios involucrados (apuntados, cancelados, asistidos),
    // no solo de los leads creados en el rango
    const allUserIds = [...new Set([...apuntadosIds, ...canceladosIds, ...asistidosIds])]
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

    let membersMap = {}
    asistidosIds.forEach(id => {
      const p = peopleMap[id]
      if (p && p.membership_type !== 'payg' && p.membership_start_date && p.membership_start_date <= toISO) {
        membersMap[id] = p
      }
    })

    let sinIntroList = []

    const { data: nuevasMembresias } = await supabase
    .from('new_memberships_log')
    .select('user_id, contract_start, event_created, member_state, plan_name')
    .eq('branch_id', branchId)
    .gte('contract_start', fromISO)
    .lte('contract_start', toISO)

    if (nuevasMembresias) {
      const sinIntroRows = nuevasMembresias.filter(m => !asistidosIds.includes(m.user_id))

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
          created_at: m.event_created,
          membership_type: m.plan_name,
          membership_start_date: m.contract_start,
        }
      })
    }

    let compraronEnMomentoList = []
    let compraronDespuesList = []
    let noCompraronList = []

    asistidosIds.forEach(userId => {
      const member = membersMap[userId]
      const booking = asistidosBookings.find(b => b.user_id === userId)
      const person = buildPerson(userId)

      if (!member || member.status !== 'MEMBER') {
        noCompraronList.push(person)
        return
      }

      const claseDate = booking ? toMadridDate(booking.time_start) : null
      const compraDate = member.membership_start_date ? toMadridDate(member.membership_start_date) : null

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
    { label: 'Compraron en el momento', value: stats.compraronEnMomento, pct: pct(stats.compraronEnMomento, stats.asistidos), color: 'bg-green-500', desc: 'Membresía el mismo día de la clase', list: stats.compraronEnMomentoList },
    { label: 'Compraron después', value: stats.compraronDespues, pct: pct(stats.compraronDespues, stats.asistidos), color: 'bg-emerald-400', desc: 'Membresía en días posteriores', list: stats.compraronDespuesList },
    { label: 'No compraron', value: stats.noCompraron, pct: pct(stats.noCompraron, stats.asistidos), color: 'bg-red-500', desc: 'Asistieron pero no compraron membresía', list: stats.noCompraronList },
    { label: 'Nuevos miembros sin intro', value: stats.sinIntro, pct: pct(stats.sinIntro, stats.leads), color: 'bg-amber-500', desc: 'Compraron directamente sin pasar por clase intro', list: stats.sinIntroList },
  ] : []

  const maxVal = stats ? Math.max(stats.leads, 1) : 1

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
            className="bg-bg-200 border border-bg-300 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-300">
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
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-200 border-b border-bg-300">
                  <tr>
                    <th className="text-left text-xs text-primary-300 font-medium px-6 py-3">Nombre</th>
                    <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Email</th>
                    <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Alta</th>
                    <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Membresía</th>
                    <th className="text-left text-xs text-primary-300 font-medium px-4 py-3">Compra</th>
                  </tr>
                </thead>
                <tbody>
                  {modal.people.map((p, i) => (
                    <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
                      <td className="px-6 py-3 text-text-100 font-medium">{p.name || '—'}</td>
                      <td className="px-4 py-3 text-text-200">{p.email || '—'}</td>
                      <td className="px-4 py-3 text-text-200">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-text-200">{p.membership_type ? membershipLabel(p.membership_type) : '—'}</td>
                      <td className="px-4 py-3 text-text-200">{formatDate(p.membership_start_date)}</td>
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