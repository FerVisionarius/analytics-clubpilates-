import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

function TablaEstadistica({ titulo, filas, columnas, nota }) {
  const total = filas.reduce((sum, f) => sum + f.cantidad, 0)
  return (
    <div className="bg-bg-200 border border-bg-300 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-bg-300">
        <h3 className="text-text-100 font-semibold">{titulo}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg-200 border-b border-bg-300">
          <tr>
            {columnas.map(c => (
              <th key={c} className="text-left text-xs text-primary-300 font-medium px-6 py-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-bg-300/60 hover:bg-primary-100/40">
              <td className="px-6 py-3 text-text-100">
                <div className="flex items-center gap-2">
                  <span>{f.label}</span>
                  {f.tooltip && (
                    <div className="relative group">
                      <svg className="w-4 h-4 text-primary-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="absolute left-6 top-0 z-10 hidden group-hover:block bg-text-100 text-white text-xs rounded-lg px-3 py-2 w-64 shadow-xl">
                        {f.tooltip}
                      </div>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-3 text-text-100 font-medium">{f.cantidad.toLocaleString('es-ES')}</td>
              <td className="px-6 py-3 text-text-200">{total > 0 ? ((f.cantidad / total) * 100).toFixed(2) + '%' : '—'}</td>
              {f.extra !== undefined && (
                <td className="px-6 py-3 text-text-200">{f.extra}</td>
              )}
            </tr>
          ))}
          <tr className="bg-primary-100/30">
            <td className="px-6 py-3 text-text-100 font-semibold">Total general</td>
            <td className="px-6 py-3 text-text-100 font-semibold">{total.toLocaleString('es-ES')}</td>
            <td className="px-6 py-3 text-text-100 font-semibold">100.00%</td>
            {filas[0]?.extra !== undefined && <td />}
          </tr>
        </tbody>
      </table>
      {nota && <p className="text-xs text-primary-300 px-6 py-3">{nota}</p>}
    </div>
  )
}

export default function EstadisticasSocios({ branchId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tipoSuscripcion, setTipoSuscripcion] = useState([])
  const [estadoSocios, setEstadoSocios] = useState([])
  const [tipoSocio, setTipoSocio] = useState([])
  const [sinSuscripcion, setSinSuscripcion] = useState(0)

  useEffect(() => {
    fetchData()
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    setError(null)

    let allMembers = []
    let from = 0
    const pageSize = 1000

    while (true) {
    const { data, error: queryError } = await supabase
        .from('members')
        .select('membership_type, membership_status, plan_name, auto_renewal')
        .eq('branch_id', branchId)
        .eq('status', 'MEMBER')
        .in('membership_type', ['time_classes', 'time'])
        .range(from, from + pageSize - 1)

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }
      if (!data || data.length === 0) break
      allMembers = [...allMembers, ...data]
      if (data.length < pageSize) break
      from += pageSize
    }

    // Tabla 1: Tipo de Suscripción
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

    const tipoSuscripcionFilas = Object.entries(suscripcionMap)
      .map(([label, cantidad]) => ({
        label,
        cantidad,
        extra: CLASES_POR_TIPO[label] ?? '—',
      }))
      .sort((a, b) => b.cantidad - a.cantidad)

    // Tabla 2: Estado de Socios
    const estadoMap = {}
    allMembers.forEach(m => {
      const estado = m.membership_status ?? 'Sin estado'
      estadoMap[estado] = (estadoMap[estado] || 0) + 1
    })

    // Contar socios sin suscripción (payg + num_classes) por separado
    let sinSuscripcion = 0
    let fromSin = 0
    while (true) {
      const { data: sinData } = await supabase
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
    const estadoFilas = Object.entries(estadoMap)
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

    // Tabla 3: Tipo de Socio
    let recurrente = 0
    let noRecurrente = 0
    let sinDato = 0
    allMembers.forEach(m => {
      const p = m.plan_name?.toLowerCase() || ''
      if (p.includes('cobro recurrente')) recurrente++
      else if (p.includes('no recurrente')) noRecurrente++
      else sinDato++
    })
    
    const tipoSocioFilas = [
      { label: 'Recurrente', cantidad: recurrente },
      { label: 'No recurrente', cantidad: noRecurrente },
      ...(sinDato > 0 ? [{ label: 'Sin dato', cantidad: sinDato }] : []),
    ]

    setTipoSuscripcion(tipoSuscripcionFilas)
    setEstadoSocios(estadoFilas)
    setTipoSocio(tipoSocioFilas)
    setSinSuscripcion(sinSuscripcion)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-text-200 text-sm">Cargando datos...</div>
  )

  if (error) return (
    <p className="text-red-600 text-sm text-center py-12">{error}</p>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-text-100">Estadísticas de Socios</h2>
        <p className="text-sm text-text-200 mt-1">Estado actual del centro seleccionado.</p>
      </div>

      <TablaEstadistica
        titulo="Tipo de Suscripción"
        columnas={['Tipo de Suscripción', 'Cantidad de socios', '% del total', 'Clases est. x semana']}
        filas={tipoSuscripcion}
      />

      <TablaEstadistica
        titulo="Estado de Socios"
        columnas={['Estado', 'Cantidad de socios', '% del total']}
        filas={estadoSocios}
        nota="Se recomienda mantener OVERDUE por debajo del 2%"
      />

{sinSuscripcion > 0 && (
        <div className="bg-bg-200 border border-bg-300 rounded-2xl px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-text-200">Socios sin suscripción activa (pago por clase / clases privadas)</span>
          <span className="text-text-100 font-semibold">{sinSuscripcion.toLocaleString('es-ES')}</span>
        </div>
      )}

      <TablaEstadistica
        titulo="Tipo de Socio"
        columnas={['Tipo', 'Cantidad de socios', '% del total']}
        filas={tipoSocio}
        nota="Se recomienda mantener No recurrente por debajo del 10%"
      />
    </div>
  )
}