export function normalizePhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-9) // ultimos 9 digitos, ignora prefijo de pais
}

export function phonesMatch(a, b) {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  return na.length > 0 && na === nb
}

export function callCustomerNumber(call) {
  return call.direction === 'outbound' ? call.to_number : call.from_number
}

export function contactFullName(contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.phone || 'Sin nombre'
}

export async function fetchContacts(supabaseClient, branchId) {
  const { data, error } = await supabaseClient
    .schema('crm')
    .from('contacts')
    .select('id, branch_id, first_name, last_name, phone, email, custom_attributes, created_at, updated_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { contacts: data || [] }
}

export async function upsertContact(supabaseClient, contact) {
  const payload = {
    branch_id: contact.branch_id,
    first_name: contact.first_name || null,
    last_name: contact.last_name || null,
    phone: contact.phone || null,
    email: contact.email || null,
    custom_attributes: contact.custom_attributes || {},
  }
  if (contact.id) {
    return supabaseClient.schema('crm').from('contacts').update(payload).eq('id', contact.id)
  }
  return supabaseClient.schema('crm').from('contacts').insert(payload)
}

export async function deleteContact(supabaseClient, id) {
  return supabaseClient.schema('crm').from('contacts').delete().eq('id', id)
}

export async function fetchCustomFieldDefinitions(supabaseClient) {
  const { data, error } = await supabaseClient
    .schema('crm')
    .from('custom_field_definitions')
    .select('id, key, label, field_type, options')
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }
  return { fields: data || [] }
}

export async function createCustomFieldDefinition(supabaseClient, field) {
  return supabaseClient.schema('crm').from('custom_field_definitions').insert({
    key: field.key,
    label: field.label,
    field_type: field.field_type,
    options: field.field_type === 'list' ? field.options : null,
  })
}

export async function fetchAgentsMap(supabaseClient) {
  const { data } = await supabaseClient.schema('crm').from('retell_agents').select('agent_id, name')
  const map = {}
  ;(data || []).forEach(a => { map[a.agent_id] = a.name })
  return map
}

export async function fetchCallsForBranch(supabaseClient, branchId) {
  const { data, error } = await supabaseClient
    .schema('crm')
    .from('retell_calls')
    .select('id, call_id, agent_id, from_number, to_number, direction, status, duration_seconds, cost_cents, transcript, recording_url, disconnection_reason, raw_payload, started_at, ended_at')
    .eq('branch_id', branchId)
    .order('started_at', { ascending: false })
  if (error) return { error: error.message }
  return { calls: data || [] }
}

export function callsForContact(calls, contact) {
  if (!contact?.phone) return []
  return calls.filter(call => phonesMatch(callCustomerNumber(call), contact.phone))
}
