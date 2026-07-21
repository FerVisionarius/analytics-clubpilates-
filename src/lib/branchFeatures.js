import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useBranchFeatureEnabled(branchId, featureKey) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!branchId) return

    supabase
      .from('branch_features')
      .select('enabled')
      .eq('branch_id', branchId)
      .eq('feature_key', featureKey)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEnabled(data?.enabled ?? false)
      })

    return () => { cancelled = true }
  }, [branchId, featureKey])

  return enabled
}
