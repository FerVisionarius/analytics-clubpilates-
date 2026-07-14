export async function fetchAllRolePermissions(supabaseClient) {
  const { data } = await supabaseClient
    .from('role_permissions')
    .select('role, item_id, enabled')

  const map = { manager: {}, admin: {}, superadmin: {} }
  ;(data || []).forEach(r => {
    if (!map[r.role]) map[r.role] = {}
    map[r.role][r.item_id] = r.enabled
  })
  return map
}

export async function fetchAllowedNavItemIds(supabaseClient, role, allItemIds) {
  if (!role) return []
  const { data } = await supabaseClient
    .from('role_permissions')
    .select('item_id, enabled')
    .eq('role', role)

  const disabled = new Set((data || []).filter(r => r.enabled === false).map(r => r.item_id))
  return allItemIds.filter(id => !disabled.has(id))
}

export async function upsertRolePermission(supabaseClient, role, itemId, enabled) {
  return supabaseClient
    .from('role_permissions')
    .upsert({ role, item_id: itemId, enabled }, { onConflict: 'role,item_id' })
}
