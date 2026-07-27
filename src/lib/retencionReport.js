export const RETENCION_STATUS_LABELS = {
    'EXPIRED': 'Expiró (no renovó)',
    'CANCELLED': 'Cancelado por el socio',
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

    const { count: nuevosMiembros, error: nuevosError } = await supabaseClient
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('status', 'MEMBER')
    .in('membership_type', ['time_classes', 'time'])
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
  
    if (nuevosError) return { error: nuevosError.message }
  
    const { data: cancelaciones, error: cancelError } = await supabaseClient
      .from('member_cancellations')
      .select('user_id, status, plan_name, cancelled_at')
      .eq('branch_id', branchId)
      .gte('cancelled_at', fromISO)
      .lte('cancelled_at', toISO)

    if (cancelError) return { error: cancelError.message }

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
    ;(cancelaciones || []).forEach(c => {
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

    return {
      totalMiembros: totalMiembros || 0,
      nuevosMiembros: nuevosMiembros || 0,
      cancelados: (cancelaciones || []).length,
      canceladosPorMotivo,
      cancelacionesList: (cancelaciones || []).map(buildCancelacion),
    }
  }