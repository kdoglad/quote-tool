import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceItemOption } from '../types/domain.types'

/**
 * Fetch all variant options for a set of price items.
 * Returns empty array gracefully if the price_item_options table doesn't exist yet
 * (i.e. migration 004 hasn't been applied).
 */
export function usePriceItemOptions(priceItemIds: string[]) {
  const sortedIds = [...priceItemIds].sort()
  return useQuery<PriceItemOption[]>({
    queryKey: ['price-item-options', sortedIds.join(',')],
    queryFn: async () => {
      if (priceItemIds.length === 0) return []
      const { data, error } = await supabase
        .from('price_item_options')
        .select('*')
        .in('price_item_id', priceItemIds)
        .order('sort_order', { ascending: true })
      if (error) {
        // 42P01 = undefined_table (migration 004 not yet applied)
        if (error.code === '42P01') return []
        throw error
      }
      return data ?? []
    },
    enabled: priceItemIds.length > 0,
    staleTime: 5 * 60 * 1000, // options don't change often
  })
}
