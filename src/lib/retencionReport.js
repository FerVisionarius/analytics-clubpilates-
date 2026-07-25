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
  
    if (totalError) return { error: totalError.message }
  
    const { count: nuevosMiembros, error: nuevosError } = await supabaseClient
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('status', 'MEMBER')
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
  
    const statusMap = {}
    ;(cancelaciones || []).forEach(c => {
      const key = c.status || 'Sin estado'
      statusMap[key] = (statusMap[key] || 0) + 1
    })
  
    const canceladosPorMotivo = Object.entries(statusMap)
      .map(([status, cantidad]) => ({
        status,
        label: RETENCION_STATUS_LABELS[status] || status,
        cantidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
  
    return {
      totalMiembros: totalMiembros || 0,
      nuevosMiembros: nuevosMiembros || 0,
      cancelados: (cancelaciones || []).length,
      canceladosPorMotivo,
      cancelacionesList: cancelaciones || [],
    }
  }