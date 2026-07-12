import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@4.2.1'
import { fetchLaserrStats, renderLaserrPdfSection } from '../../../src/lib/laserrReport.js'
import { fetchSociosStats, renderSociosPdfSection } from '../../../src/lib/sociosReport.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// El cron corre el día 1 a las 10:00 (Europe/Madrid), así que "hoy" cae en
// el mes que arranca. El informe siempre cubre el mes completo anterior.
function previousMonthRange() {
  const now = new Date()
  const madridNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const firstOfThisMonth = new Date(madridNow.getFullYear(), madridNow.getMonth(), 1)
  const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000)
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1)
  const toISODate = (d) => d.toISOString().split('T')[0]
  return { dateFrom: toISODate(lastMonthStart), dateTo: toISODate(lastMonthEnd) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: branches, error: branchesError } = await supabaseAdmin
      .from('branches')
      .select('branch_id, name')
      .order('name')
    if (branchesError) throw branchesError

    const { dateFrom, dateTo } = previousMonthRange()

    const reports = []
    for (const branch of branches ?? []) {
      const [laserrStats, sociosStats] = await Promise.all([
        fetchLaserrStats(supabaseAdmin, branch.branch_id, dateFrom, dateTo),
        fetchSociosStats(supabaseAdmin, branch.branch_id),
      ])

      if (!laserrStats || sociosStats.error) {
        reports.push({
          branchId: branch.branch_id,
          branchName: branch.name,
          error: sociosStats?.error || 'Sin datos de Laserr para el período',
        })
        continue
      }

      const doc = new jsPDF()
      renderLaserrPdfSection(doc, { stats: laserrStats, dateFrom, dateTo })
      doc.addPage()
      renderSociosPdfSection(doc, sociosStats)
      const pdfBase64 = doc.output('datauristring').split(',')[1]

      reports.push({ branchId: branch.branch_id, branchName: branch.name, pdfBase64 })
    }

    return new Response(JSON.stringify({ dateFrom, dateTo, reports }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
