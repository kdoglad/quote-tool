import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceVersion } from '../types/domain.types'

export function usePriceVersions() {
  return useQuery<PriceVersion[]>({
    queryKey: ['price-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_versions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useLatestPublishedVersion() {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', 'latest-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_versions')
        .select('*')
        .eq('is_draft', false)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function usePriceVersion(id: string | undefined) {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('price_versions')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateDraftVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      versionName,
      notes,
      sourceVersionId,
      userId,
    }: {
      versionName: string
      notes: string
      sourceVersionId?: string
      userId: string
    }) => {
      // Create the new draft version record
      const { data: newVersion, error: vErr } = await supabase
        .from('price_versions')
        .insert({ version_name: versionName, notes, is_draft: true, created_by: userId })
        .select()
        .single()
      if (vErr) throw vErr

      // If sourceVersionId provided, copy all its items into the new draft
      if (sourceVersionId) {
        const { data: sourceItems, error: iErr } = await supabase
          .from('price_items')
          .select('category, subcategory, code, name, unit, base_price, formula, conditions, sort_order, is_optional, is_active, notes')
          .eq('version_id', sourceVersionId)
        if (iErr) throw iErr

        if (sourceItems && sourceItems.length > 0) {
          const itemsToInsert = sourceItems.map((item: Record<string, unknown>) => ({
            ...item,
            version_id: newVersion.id,
          }))
          const { error: insertErr } = await supabase.from('price_items').insert(itemsToInsert)
          if (insertErr) throw insertErr
        }
      }

      return newVersion
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-versions'] })
    },
  })
}
