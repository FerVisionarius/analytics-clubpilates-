export async function fetchEventRatings(supabaseClient, branchId) {
  const { data: responses } = await supabaseClient
    .from('class_survey_responses')
    .select('event_id')

  const candidateEventIds = [...new Set((responses || []).map(r => r.event_id))]
  if (candidateEventIds.length === 0) return []

  const { data: classes } = await supabaseClient
    .from('classes')
    .select('event_id, trainer_id, name, scheduled_at')
    .eq('branch_id', branchId)
    .in('event_id', candidateEventIds)
    .order('scheduled_at', { ascending: false })

  const eventInfo = {}
  ;(classes || []).forEach(c => {
    if (!eventInfo[c.event_id]) {
      eventInfo[c.event_id] = { trainerId: c.trainer_id, name: c.name, lastScheduledAt: c.scheduled_at }
    }
  })

  const eventIds = Object.keys(eventInfo)
  if (eventIds.length === 0) return []

  const { data: answers } = await supabaseClient
    .from('class_survey_answers')
    .select('answer_numeric, response_id, class_survey_responses!inner(event_id)')
    .eq('answer_type', 'numeric')
    .in('class_survey_responses.event_id', eventIds)

  const perEvent = {}
  ;(answers || []).forEach(a => {
    const eid = a.class_survey_responses.event_id
    if (!perEvent[eid]) perEvent[eid] = { sum: 0, count: 0 }
    perEvent[eid].sum += a.answer_numeric
    perEvent[eid].count += 1
  })

  return Object.entries(perEvent).map(([eid, stats]) => ({
    eventId: eid,
    name: eventInfo[eid].name,
    trainerId: eventInfo[eid].trainerId,
    lastScheduledAt: eventInfo[eid].lastScheduledAt,
    avg: stats.sum / stats.count,
    count: stats.count,
  }))
}

export async function fetchEventResponses(supabaseClient, eventId) {
  const { data: responses } = await supabaseClient
    .from('class_survey_responses')
    .select('id, user_id, submitted_at, class_survey_answers(question_key, question_label, answer_type, answer_numeric, answer_text)')
    .eq('event_id', eventId)
    .order('submitted_at', { ascending: false })

  return responses || []
}
