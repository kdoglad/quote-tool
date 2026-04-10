import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DNSPRule } from '../types/domain.types'

export function useDNSPRules() {
  return useQuery<DNSPRule[]>({
    queryKey: ['dnsp-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dnsp_rules')
        .select('*')
        .order('state', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: Infinity, // DNSP rules rarely change
  })
}
