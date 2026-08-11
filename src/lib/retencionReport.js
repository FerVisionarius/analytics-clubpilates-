export const RETENCION_STATUS_LABELS = {
    'EXPIRED': 'Cancelación programada',
    'CANCELLED': 'Cancelación inmediata',
  }

  export async function fetchRetencionStats(supabaseClient, branchId, dateFrom, dateTo) {
    const fromISO = dateFrom + 'T00:00:00+00:00'
    const toISO = dateTo + 'T23:59:59+00:00'

    const { count: totalMiembros, error: totalError } = await supabaseClient
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('status', 'MEMBER')
      .in('membership_type', ['time_classes', 'time'])

    if (totalError) return { error: totalError.message }

    // Altas de suscripción recurrente dentro del período. Sirven para detectar
    // "cambios de suscripción": personas que cancelan una suscripción y dan de
    // alta otra en el mismo período (no son bajas ni altas nuevas reales).
    const { data: nuevasSubs } = await supabaseClient
      .from('new_memberships_log')
      .select('user_id, plan_name, contract_start')
      .eq('branch_id', branchId)
      .in('membership_type', ['TIME_CLASSES', 'TIME'])
      .eq('status', 'ACTIVE')
      .gte('contract_start', fromISO)
      .lte('contract_start', toISO)

    const nuevaSubByUser = {}
    ;(nuevasSubs || []).forEach(s => {
      if (!nuevaSubByUser[s.user_id]) nuevaSubByUser[s.user_id] = s
    })
    const nuevaSubUserIds = new Set(Object.keys(nuevaSubByUser))

    const { data: cancelaciones, error: cancelError } = await supabaseClient
      .from('member_cancellations')
      .select('user_id, status, plan_name, cancelled_at')
      .eq('branch_id', branchId)
      .gte('cancelled_at', fromISO)
      .lte('cancelled_at', toISO)

    if (cancelError) return { error: cancelError.message }

    // Un "cambio de suscripción" = cancela una suscripción y da de alta otra
    // recurrente en el mismo período.
    const cambioUserIds = new Set(
      (cancelaciones || [])
        .map(c => c.user_id)
        .filter(id => id && nuevaSubUserIds.has(id))
    )

    const cancelacionesReales = (cancelaciones || []).filter(c => !cambioUserIds.has(c.user_id))

    // Datos de personas para cancelaciones y cambios
    const userIds = [...new Set((cancelaciones || []).map(c => c.user_id).filter(Boolean))]
    const peopleMap = {}
    if (userIds.length > 0) {
      const { data: people } = await supabaseClient
        .from('members')
        .select('glofox_member_id, name, email')
        .eq('branch_id', branchId)
        .in('glofox_member_id', userIds)
      if (people) people.forEach(p => { peopleMap[p.glofox_member_id] = p })
    }

    const buildCancelacion = (c) => {
      const p = peopleMap[c.user_id]
      return {
        name: p?.name || '—',
        email: p?.email || '—',
        plan_name: c.plan_name,
        cancelled_at: c.cancelled_at,
      }
    }

    const statusMap = {}
    cancelacionesReales.forEach(c => {
      const key = c.status || 'Sin estado'
      if (!statusMap[key]) statusMap[key] = []
      statusMap[key].push(buildCancelacion(c))
    })

    const canceladosPorMotivo = Object.entries(statusMap)
      .map(([status, list]) => ({
        status,
        label: RETENCION_STATUS_LABELS[status] || status,
        cantidad: list.length,
        list,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)

    // Lista de cambios de suscripción (plan anterior → plan nuevo)
    const cambiosList = [...cambioUserIds].map(uid => {
      const p = peopleMap[uid]
      const canc = (cancelaciones || []).find(c => c.user_id === uid)
      const sub = nuevaSubByUser[uid]
      return {
        name: p?.name || '—',
        email: p?.email || '—',
        plan_anterior: canc?.plan_name || '—',
        plan_nuevo: sub?.plan_name || '—',
        cambiado_at: sub?.contract_start || canc?.cancelled_at,
      }
    })

    // Nuevos miembros del período (primera afiliación al club), excluyendo cambios.
    const { data: nuevosData } = await supabaseClient
      .from('members')
      .select('glofox_member_id, name, email, created_at, plan_name')
      .eq('branch_id', branchId)
      .eq('status', 'MEMBER')
      .in('membership_type', ['time_classes', 'time'])
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false })

    const nuevosMiembrosList = (nuevosData || [])
      .filter(m => !cambioUserIds.has(m.glofox_member_id))
      .map(m => ({
        name: m.name || '—',
        email: m.email || '—',
        plan_name: m.plan_name,
        created_at: m.created_at,
      }))

    return {
      totalMiembros: totalMiembros || 0,
      nuevosMiembros: nuevosMiembrosList.length,
      nuevosMiembrosList,
      cancelados: cancelacionesReales.length,
      canceladosPorMotivo,
      cancelacionesList: cancelacionesReales.map(buildCancelacion),
      cambiosSuscripcion: cambiosList.length,
      cambiosList,
    }
  }
