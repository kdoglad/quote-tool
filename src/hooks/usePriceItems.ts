import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceItem } from '../types/domain.types'

export function usePriceItems(versionId: string | undefined) {
  return useQuery<PriceItem[]>({
    queryKey: ['price-items', versionId],
    queryFn: async () => {
      if (!versionId) return []
      const { data, error } = await supabase
        .from('price_items')
        .select('*')
        .eq('version_id', versionId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!versionId,
  })
}

export function useUpdatePriceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      versionId: string
      updates: Partial<Omit<PriceItem, 'id' | 'version_id' | 'created_at'>>
    }) => {
      const { data, error } = await supabase
        .from('price_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data: unknown, variables: { id: string; versionId: string; updates: Partial<Omit<PriceItem, 'id' | 'version_id' | 'created_at'>> }) => {
      qc.invalidateQueries({ queryKey: ['price-items', variables.versionId] })
    },
  })
}

export function useCreatePriceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: Omit<PriceItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('price_items')
        .insert(item)
        .select()
        .single()
      if (error) throw error
      return data as PriceItem
    },
    onSuccess: (data: PriceItem) => {
      qc.invalidateQueries({ queryKey: ['price-items', data.version_id] })
    },
  })
}

export function useDeletePriceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, versionId }: { id: string; versionId: string }) => {
      const { error } = await supabase.from('price_items').delete().eq('id', id)
      if (error) throw error
      return versionId
    },
    onSuccess: (versionId) => {
      qc.invalidateQueries({ queryKey: ['price-items', versionId] })
    },
  })
}
